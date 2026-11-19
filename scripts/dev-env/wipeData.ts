/** Tables that are not application rows and must survive a data wipe. */
export const WIPE_PRESERVE_PUBLIC_TABLES = new Set([
  'spatial_ref_sys',
  'geography_columns',
  'geometry_columns',
  'cloudsql_connectivity_test',
]);

export function quoteIdent(name: string): string {
  if (!/^[a-z_][a-z0-9_]*$/.test(name)) {
    throw new Error(`Refusing to truncate unsafe table name: ${name}`);
  }
  return `"${name}"`;
}

export function tablesToTruncate(tableNames: string[]): string[] {
  return [...new Set(tableNames)]
    .filter((name) => !WIPE_PRESERVE_PUBLIC_TABLES.has(name))
    .filter((name) => !name.startsWith('cloudsql_'))
    .sort();
}

export function buildTruncateSql(tableNames: string[]): string {
  const tables = tablesToTruncate(tableNames);
  if (tables.length === 0) {
    throw new Error('No public tables to truncate');
  }
  // Do not use RESTART IDENTITY: Cloud SQL sequences are owned by postgres.
  return `TRUNCATE TABLE ${tables.map(quoteIdent).join(', ')} CASCADE`;
}
