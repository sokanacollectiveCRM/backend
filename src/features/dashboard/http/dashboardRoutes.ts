import express, { Router } from 'express';

import { queryCloudSql } from '../../../db/cloudSqlPool';
import authMiddleware from '../../../middleware/authMiddleware';
import authorizeRoles from '../../../middleware/authorizeRoles';

const dashboardRoutes: Router = express.Router();

const countRows = async (
  sql: string,
  params: unknown[] = []
): Promise<number> => {
  try {
    const { rows } = await queryCloudSql<{ count: string }>(sql, params);
    const count = Number(rows[0]?.count ?? 0);
    return Number.isFinite(count) ? count : 0;
  } catch (err) {
    console.warn('[dashboard] Cloud SQL count failed:', err);
    return 0;
  }
};

const fetchMonthlyRevenueFromCloudSql = async (
  sinceIso: string,
  nowIso: string
): Promise<number | null> => {
  try {
    const { rows } = await queryCloudSql<{ amount: string }>(
      `SELECT COALESCE(SUM(amount), 0)::text as amount
       FROM payment_installments
       WHERE due_date >= $1::date AND due_date <= $2::date
         AND status IN ('succeeded', 'completed', 'paid')`,
      [sinceIso.split('T')[0], nowIso.split('T')[0]]
    );
    const total = parseFloat(rows[0]?.amount ?? '0');
    return Number.isFinite(total) ? total : 0;
  } catch (err) {
    console.warn('[dashboard] Cloud SQL revenue failed:', err);
    return null;
  }
};

const fetchCalendarEventsFromCloudSql = async (
  todayIso: string
): Promise<
  { id: string; type: string; title: string; date: string; color: string }[]
> => {
  try {
    const { rows } = await queryCloudSql<{
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
    console.warn('[dashboard/calendar] Cloud SQL lookup failed:', err);
    return [];
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
    const thirtyDaysAgoIso = new Date(
      now.getTime() - 30 * 24 * 60 * 60 * 1000
    ).toISOString();

    try {
      const [
        totalDoulas,
        totalClients,
        pendingContracts,
        overdueNotes,
        monthlyRevenue,
      ] = await Promise.all([
        countRows('SELECT COUNT(*)::text AS count FROM public.doulas'),
        countRows('SELECT COUNT(*)::text AS count FROM public.phi_clients'),
        countRows(
          `SELECT COUNT(*)::text AS count
           FROM public.phi_contracts
           WHERE status IS DISTINCT FROM 'signed'`
        ),
        countRows(
          `SELECT COUNT(*)::text AS count
           FROM public.client_activities
           WHERE timestamp < $1::timestamptz`,
          [sevenDaysAgoIso]
        ),
        fetchMonthlyRevenueFromCloudSql(thirtyDaysAgoIso, nowIso),
      ]);

      res.status(200).json({
        totalDoulas,
        totalClients,
        pendingContracts,
        overdueNotes,
        upcomingTasks: 0,
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

dashboardRoutes.get(
  '/calendar',
  authMiddleware,
  (req, res, next) => authorizeRoles(req, res, next, ['admin']),
  async (_req, res) => {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayIso = today.toISOString().split('T')[0];
      const events = await fetchCalendarEventsFromCloudSql(todayIso);
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

export default dashboardRoutes;
