const { readFileSync } = require('fs');
const { join } = require('path');
const { PGlite } = require('@electric-sql/pglite');
const { strict: assert } = require('assert');
async function main() {
  const db = new PGlite();
  try {
    await db.exec(
      'CREATE TABLE public.doulas (id text PRIMARY KEY, phone text, certifications jsonb)'
    );
    const certs = [
      {
        name: 'Fictional training',
        expiration_date: '2030-03-31',
        no_expiration: false,
      },
    ];
    for (const [id, phone] of [
      ['digits', '5555550100'],
      ['dashes', '555-555-0100'],
      ['missing', null],
      ['invalid', '555555010a'],
    ]) {
      await db.query('INSERT INTO public.doulas VALUES ($1,$2,$3)', [
        id,
        phone,
        JSON.stringify(certs),
      ]);
    }
    const sql = readFileSync(
      join(__dirname, '../src/db/migrations/20261024_doula_phone.sql'),
      'utf8'
    );
    await db.exec(sql);
    const first = (await db.query('SELECT * FROM public.doulas ORDER BY id'))
      .rows;
    assert.deepEqual(
      first.map((r) => r.phone),
      ['5555550100', '5555550100', null, null]
    );
    for (const row of first) assert.deepEqual(row.certifications, certs);
    await db.exec(sql);
    assert.deepEqual(
      (await db.query('SELECT * FROM public.doulas ORDER BY id')).rows,
      first
    );
    for (const phone of ['', '555-555-0100', '555555010', '555555010a']) {
      await assert.rejects(
        db.query('UPDATE public.doulas SET phone=$1 WHERE id=$2', [
          phone,
          'digits',
        ])
      );
    }
  } finally {
    await db.close();
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
