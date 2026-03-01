import express, { Router } from 'express';

import authMiddleware from '../middleware/authMiddleware';
import authorizeRoles from '../middleware/authorizeRoles';
import { getPool } from '../db/cloudSqlPool';
import supabase from '../supabase';

const dashboardRoutes: Router = express.Router();

const isMissingRelationError = (error: {
  code?: string;
  message: string;
}): boolean => {
  if (!error) {
    return false;
  }

  const missingRelationCodes = new Set([
    '42P01',
    'PGRST201',
    'PGRST301',
    'PGRST205',
  ]);
  if (error.code && missingRelationCodes.has(error.code)) {
    return true;
  }

  return /relation .* does not exist/i.test(error.message || '');
};

const fetchCount = async (
  table: string,
  applyFilters?: (query: any) => any
): Promise<number> => {
  let query = supabase.from(table).select('id', { count: 'exact', head: true });

  if (applyFilters) {
    query = applyFilters(query);
  }

  const { count, error } = await query;

  if (error) {
    if (isMissingRelationError(error)) {
      console.warn(`[dashboard] Table "${table}" missing. Returning count 0.`);
      return 0;
    }

    console.error(`[dashboard] Failed counting table "${table}":`, error);
    throw error;
  }

  return count ?? 0;
};

const fetchMonthlyRevenue = async (
  sinceIso: string,
  nowIso: string
): Promise<number | null> => {
  const { data, error } = await supabase
    .from('payment_tracking')
    .select('installment_amount, installment_status, due_date')
    .gte('due_date', sinceIso)
    .lte('due_date', nowIso)
    .eq('installment_status', 'paid');

  if (error) {
    if (isMissingRelationError(error)) {
      console.warn(
        '[dashboard] Supabase payment_tracking missing, trying Cloud SQL...'
      );
      return fetchMonthlyRevenueFromCloudSql(sinceIso, nowIso);
    }

    console.error('[dashboard] Failed to compute monthly revenue:', error);
    throw error;
  }

  if (!data) {
    return 0;
  }

  return data.reduce(
    (total: number, row: { installment_amount?: number | string | null }) => {
      const value = Number(row?.installment_amount ?? 0);
      return Number.isFinite(value) ? total + value : total;
    },
    0
  );
};

const fetchMonthlyRevenueFromCloudSql = async (
  sinceIso: string,
  nowIso: string
): Promise<number | null> => {
  try {
    const pool = getPool();
    const { rows } = await pool.query<{ amount: string }>(
      `SELECT COALESCE(SUM(amount), 0)::text as amount
       FROM payment_installments
       WHERE due_date >= $1::date AND due_date <= $2::date
         AND status IN ('succeeded', 'completed', 'paid')`,
      [sinceIso.split('T')[0], nowIso.split('T')[0]]
    );
    const total = parseFloat(rows[0]?.amount ?? '0');
    return Number.isFinite(total) ? total : 0;
  } catch (err) {
    console.warn('[dashboard] Cloud SQL revenue fallback failed:', err);
    return null;
  }
};

dashboardRoutes.get(
  '/stats',
  authMiddleware,
  (req, res, next) => authorizeRoles(req, res, next, ['admin']),
  async (_req, res) => {
    const now = new Date();
    const nowIso = now.toISOString();
    const sevenDaysAgoIso = new Date(
      now.getTime() - 7 * 24 * 60 * 60 * 1000
    ).toISOString();
    const thirtyDaysAheadIso = new Date(
      now.getTime() + 30 * 24 * 60 * 60 * 1000
    ).toISOString();
    const thirtyDaysAgoIso = new Date(
      now.getTime() - 30 * 24 * 60 * 60 * 1000
    ).toISOString();

    try {
      const overdueNotesPromise = fetchCount('notes', (query) =>
        query.lt('lastUpdatedAt', sevenDaysAgoIso)
      ).catch((error) => {
        console.warn(
          '[dashboard] notes count unavailable, defaulting to 0:',
          error
        );
        return 0;
      });

      const [
        totalDoulas,
        totalClients,
        pendingContracts,
        overdueNotes,
        upcomingTasks,
        monthlyRevenue,
      ] = await Promise.all([
        fetchCount('profiles', (query) => query.eq('role', 'doula')),
        fetchCount('clients'),
        fetchCount('contracts', (query) => query.neq('status', 'signed')),
        overdueNotesPromise,
        fetchCount('tasks', (query) =>
          query.gte('dueDate', nowIso).lte('dueDate', thirtyDaysAheadIso)
        ),
        fetchMonthlyRevenue(thirtyDaysAgoIso, nowIso),
      ]);

      res.status(200).json({
        totalDoulas,
        totalClients,
        pendingContracts,
        overdueNotes,
        upcomingTasks,
        monthlyRevenue,
      });
    } catch (error) {
      console.error('Failed to compute dashboard stats:', error);

      const message =
        error instanceof Error
          ? error.message
          : 'Unable to compute dashboard stats';

      res.status(500).json({ error: message });
    }
  }
);

// GET /api/dashboard/calendar - Returns pregnancy due date events
dashboardRoutes.get(
  '/calendar',
  authMiddleware,
  (req, res, next) => authorizeRoles(req, res, next, ['admin']),
  async (_req, res) => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayIso = today.toISOString().split('T')[0];

      let events: { id: string; type: string; title: string; date: string; color: string }[] = [];

      // Try Supabase client_info first
      const { data, error } = await supabase
        .from('client_info')
        .select('id, first_name, last_name, due_date')
        .not('due_date', 'is', null)
        .gte('due_date', todayIso);

      if (error) {
        if (isMissingRelationError(error)) {
          console.warn(
            '[dashboard/calendar] Supabase client_info missing, trying Cloud SQL...'
          );
          events = await fetchCalendarEventsFromCloudSql(todayIso);
        } else {
          console.error('[dashboard/calendar] Failed to fetch due dates:', error);
          throw error;
        }
      } else if (data && data.length > 0) {
        events = data
          .map((client: { id: string; first_name?: string; last_name?: string; due_date: string }) => ({
            id: client.id,
            type: 'pregnancyDueDate',
            title:
              `EDD – Baby Due (${client.first_name || ''} ${client.last_name || ''})`.trim(),
            date: client.due_date,
            color: '#34A853',
          }))
          .sort((a, b) => a.date.localeCompare(b.date));
      }

      res.status(200).json({ events });
    } catch (error) {
      console.error('Failed to fetch calendar events:', error);

      const message =
        error instanceof Error
          ? error.message
          : 'Unable to fetch calendar events';

      res.status(500).json({ error: message });
    }
  }
);

const fetchCalendarEventsFromCloudSql = async (
  todayIso: string
): Promise<{ id: string; type: string; title: string; date: string; color: string }[]> => {
  try {
    const pool = getPool();
    const { rows } = await pool.query<{
      id: string;
      first_name: string | null;
      last_name: string | null;
      due_date: string | null;
    }>(
      `SELECT id, first_name, last_name, due_date
       FROM phi_clients
       WHERE due_date IS NOT NULL AND due_date >= $1
       ORDER BY due_date ASC`,
      [todayIso]
    );
    return rows.map((client) => ({
      id: client.id,
      type: 'pregnancyDueDate',
      title:
        `EDD – Baby Due (${client.first_name || ''} ${client.last_name || ''})`.trim(),
      date: client.due_date!,
      color: '#34A853',
    }));
  } catch (err) {
    console.warn('[dashboard/calendar] Cloud SQL fallback failed:', err);
    return [];
  }
};

export default dashboardRoutes;
