/**
 * Diagnostic: Investigate "52 need review" and related counts.
 * Run: npx ts-node scripts/check-need-review-counts.ts
 * Requires: .env with CLOUD_SQL_*, Cloud SQL Proxy on 127.0.0.1:5433
 */
import 'dotenv/config';
import { queryCloudSql } from '../src/db/cloudSqlPool';
import { getSupabaseAdmin } from '../src/supabase';

async function main() {
  console.log('=== Need Review Diagnostic ===\n');

  // 1. Cloud SQL: Leads/clients by status (phi_clients)
  try {
    const { rows: statusRows } = await queryCloudSql<{ status: string; count: string }>(
      `SELECT status, COUNT(*)::text as count FROM phi_clients GROUP BY status ORDER BY count DESC`
    );
    console.log('phi_clients by status:');
    statusRows.forEach((r) => console.log(`  ${r.status}: ${r.count}`));

    const matching = statusRows.find((r) => r.status === 'matching');
    if (matching) {
      console.log(`\n→ ${matching.count} leads in "matching" (need doula assignment/review)`);
    }
  } catch (err) {
    console.error('phi_clients query failed:', (err as Error).message);
  }

  // 2. Supabase: doula_documents with status 'uploaded' or 'pending' (need admin review)
  try {
    const supabase = getSupabaseAdmin();
    const { data: docs, error } = await supabase
      .from('doula_documents')
      .select('doula_id, document_type, status')
      .in('status', ['uploaded', 'pending']);

    if (error) {
      console.error('\ndoula_documents query failed:', error.message);
    } else if (docs && docs.length > 0) {
      const doulaIds = new Set(docs.map((d) => d.doula_id));
      console.log(`\ndoula_documents pending review: ${docs.length} documents across ${doulaIds.size} doulas`);
    } else {
      console.log('\ndoula_documents: 0 documents pending review');
    }
  } catch (err) {
    console.error('\ndoula_documents query failed:', (err as Error).message);
  }

  // 3. Cloud SQL: Total doulas
  try {
    const { rows: doulaRows } = await queryCloudSql<{ count: string }>(
      `SELECT COUNT(*)::text as count FROM public.doulas`
    );
    console.log(`\nTotal doulas in Cloud SQL: ${doulaRows[0]?.count ?? '?'}`);
  } catch (err) {
    console.error('doulas count failed:', (err as Error).message);
  }

  console.log('\n=== End diagnostic ===');
}

main();
