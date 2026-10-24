const { readFileSync } = require('fs');
const { join } = require('path');
const { PGlite } = require('@electric-sql/pglite');
const { strict: assert } = require('assert');
async function main() {
  const db = new PGlite();
  try {
    await db.exec(
      'CREATE TABLE public.doulas (id text PRIMARY KEY, address text, country text, certifications jsonb)'
    );
    for (const [id, country] of [
      ['missing', null],
      ['us', 'US'],
      ['other', 'Canada'],
      ['blank', ''],
    ]) {
      await db.query('INSERT INTO public.doulas VALUES ($1,$2,$3,$4)', [
        id,
        '100 Fictional Way',
        country,
        JSON.stringify([
          { name: 'Fictional training', expiration_date: '2030-03-31' },
        ]),
      ]);
    }
    const before = (await db.query('SELECT * FROM public.doulas ORDER BY id'))
      .rows;
    const sql = readFileSync(
      join(__dirname, '../src/db/migrations/20261024_doula_address_unit.sql'),
      'utf8'
    );
    await db.exec(sql);
    const after = (await db.query('SELECT * FROM public.doulas ORDER BY id'))
      .rows;
    assert.deepEqual(
      after.map(({ unit_number, ...row }) => {
        assert.equal(unit_number, null);
        return row;
      }),
      before
    );
    assert(after.every((row) => row.unit_number === null));
    await db.exec(sql);
    assert.deepEqual(
      (await db.query('SELECT * FROM public.doulas ORDER BY id')).rows,
      after
    );
    await db.query(
      "INSERT INTO public.doulas (id,unit_number) VALUES ('new','Apt 4B')"
    );
    assert.equal(
      (await db.query("SELECT country FROM public.doulas WHERE id='new'"))
        .rows[0].country,
      'United States'
    );
    await db.query("UPDATE public.doulas SET unit_number='' WHERE id='new'");
    await assert.rejects(
      db.query("UPDATE public.doulas SET unit_number=$1 WHERE id='new'", [
        'A'.repeat(101),
      ])
    );
  } finally {
    await db.close();
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
