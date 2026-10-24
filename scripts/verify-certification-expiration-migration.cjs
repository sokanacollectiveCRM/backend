const { readFileSync } = require('fs');
const { join } = require('path');

const { PGlite } = require('@electric-sql/pglite');
const { strict: assert } = require('assert');

async function verifyMigration() {
  const db = new PGlite();
  try {
    await db.exec(
      'CREATE TABLE public.doulas (id text PRIMARY KEY, certifications jsonb)'
    );
    const legacy = [
      {
        name: 'Fictional birth training',
        issuingOrganization: 'Example Academy',
        year: '2020',
      },
      {
        name: 'Fictional postpartum training',
        issuingOrganization: 'Example Academy',
        year: '2021',
      },
    ];
    const current = [
      {
        name: 'Fictional dated training',
        issuingOrganization: 'Example Academy',
        year: '2019',
        expiration_date: '2028-03-31',
        no_expiration: false,
      },
      {
        name: 'Fictional lifetime training',
        issuingOrganization: '',
        expiration_date: null,
        no_expiration: true,
      },
    ];
    await db.query(
      'INSERT INTO public.doulas VALUES ($1, $2::jsonb), ($3, $4::jsonb), ($5, NULL), ($6, $7::jsonb)',
      [
        'legacy',
        JSON.stringify(legacy),
        'current',
        JSON.stringify(current),
        'missing',
        'empty',
        '[]',
      ]
    );
    const sql = readFileSync(
      join(
        __dirname,
        '../src/db/migrations/20261024_certification_expiration_date.sql'
      ),
      'utf8'
    );
    await db.exec(sql);
    const first = await db.query(
      'SELECT id, certifications FROM public.doulas ORDER BY id'
    );
    assert.deepEqual(first.rows, [
      { id: 'current', certifications: current },
      { id: 'empty', certifications: [] },
      {
        id: 'legacy',
        certifications: legacy.map((entry) => ({
          ...entry,
          expiration_date: null,
          no_expiration: false,
        })),
      },
      { id: 'missing', certifications: null },
    ]);
    await db.exec(sql);
    assert.deepEqual(
      (
        await db.query(
          'SELECT id, certifications FROM public.doulas ORDER BY id'
        )
      ).rows,
      first.rows
    );
  } finally {
    await db.close();
  }
}
verifyMigration().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
