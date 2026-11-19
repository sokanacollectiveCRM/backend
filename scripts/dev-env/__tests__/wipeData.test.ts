import { isProductionTarget } from '../syntheticSeed';
import { buildTruncateSql, tablesToTruncate } from '../wipeData';

describe('isolated data wipe helpers', () => {
  it('refuses production database and instance names', () => {
    expect(
      isProductionTarget({
        database: 'sokana_private',
        host: '127.0.0.1',
      })
    ).toMatch(/production database/);
    expect(
      isProductionTarget({
        database: 'sokana_private_dev',
        instance: 'sokana-private-data:us-central1:sokana-phi-postgres',
      })
    ).toMatch(/production Cloud SQL instance/);
  });

  it('truncates application tables including admins and skips PostGIS catalogs', () => {
    const tables = tablesToTruncate([
      'phi_clients',
      'admins',
      'spatial_ref_sys',
      'doulas',
      'cloudsql_connectivity_test',
    ]);
    expect(tables).toEqual(['admins', 'doulas', 'phi_clients']);
    expect(buildTruncateSql(tables)).toBe(
      'TRUNCATE TABLE "admins", "doulas", "phi_clients" CASCADE'
    );
  });

  it('rejects unsafe identifiers', () => {
    expect(() => buildTruncateSql(['admins;drop'])).toThrow(/unsafe table name/);
  });
});
