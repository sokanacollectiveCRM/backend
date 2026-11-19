import {
  SYNTHETIC_EMAIL_DOMAIN,
  buildFixtureCatalog,
  buildUpsertSql,
  clientNumberForIndex,
  dumpContainsRowData,
  isProductionTarget,
  pickInsertColumns,
  prepareInsert,
  syntheticEmail,
  syntheticId,
} from '../syntheticSeed';

describe('synthetic dev-env seed helpers', () => {
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
    expect(
      isProductionTarget({
        database: 'sokana_private_dev',
        host: '/cloudsql/sokana-private-data:us-central1:sokana-phi-postgres-dev',
      })
    ).toBeNull();
  });

  it('detects dump files that contain row data', () => {
    expect(dumpContainsRowData('CREATE TABLE public.phi_clients ();')).toBe(
      false
    );
    expect(
      dumpContainsRowData('COPY public.phi_clients (id) FROM stdin;')
    ).toBe(true);
    expect(
      dumpContainsRowData('INSERT INTO public.phi_clients VALUES (1);')
    ).toBe(false);
  });

  it('inserts only columns that exist and keeps required fields', () => {
    const available = [
      {
        column_name: 'id',
        is_nullable: 'NO',
        column_default: 'gen_random_uuid()',
        data_type: 'uuid',
      },
      {
        column_name: 'first_name',
        is_nullable: 'NO',
        column_default: null,
        data_type: 'text',
      },
      {
        column_name: 'email',
        is_nullable: 'YES',
        column_default: null,
        data_type: 'text',
      },
    ];
    const insert = prepareInsert('public.phi_clients', available, {
      id: 'abc',
      first_name: 'Maya',
      last_name: 'Rivera',
      email: syntheticEmail('maya.rivera'),
    });
    expect(insert.columns).toEqual(['id', 'first_name', 'email']);
    expect(insert.sql).toContain('ON CONFLICT ("id") DO UPDATE');
    expect(insert.columns).not.toContain('last_name');
  });

  it('throws when a NOT NULL column without default is missing', () => {
    expect(() =>
      pickInsertColumns(
        [
          {
            column_name: 'first_name',
            is_nullable: 'NO',
            column_default: null,
            data_type: 'text',
          },
        ],
        { email: 'x@sokana-dev.example' },
        { fillMissingRequired: false }
      )
    ).toThrow(/first_name/);
  });

  it('builds deterministic fixture identities on the synthetic domain', () => {
    const fixture = buildFixtureCatalog();
    expect(syntheticEmail(fixture.admin.emailLocal)).toBe(
      `dev.admin@${SYNTHETIC_EMAIL_DOMAIN}`
    );
    expect(syntheticId(fixture.doulas[0].key)).toMatch(/^[0-9a-f-]{36}$/);
    expect(syntheticId(fixture.doulas[0].key)).toBe(
      syntheticId(fixture.doulas[0].key)
    );
    expect(clientNumberForIndex(0)).toBe('CL-90001');
    expect(fixture.clients.some((client) => client.status === 'matching')).toBe(
      true
    );
    expect(fixture.clients.some((client) => client.status === 'active')).toBe(
      true
    );
  });

  it('builds conflict SQL for single-column tables', () => {
    expect(buildUpsertSql('public.admins', ['id'])).toContain('DO NOTHING');
  });
});
