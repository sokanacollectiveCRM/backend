const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const assert = require('node:assert/strict');
const { PGlite } = require('@electric-sql/pglite');
require('ts-node').register({ transpileOnly: true });
async function main() {
  const db = new PGlite();
  try {
    const owner = '00000000-0000-4000-8000-000000000001',
      tenant = '00000000-0000-4000-8000-000000000002';
    await db.exec(`CREATE TABLE public.doulas(id uuid PRIMARY KEY,tenant_id uuid,profile_review_status text DEFAULT 'approved',profile_review_version int DEFAULT 1,updated_at timestamptz DEFAULT now());
    CREATE TABLE public.doula_documents(id uuid PRIMARY KEY DEFAULT gen_random_uuid(),doula_id text,tenant_id uuid,document_type text,
    file_name text,file_path text,file_size int,mime_type text,expires_at timestamptz,notes text,status text,
    uploaded_at timestamptz DEFAULT now(),created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now(),reviewed_at timestamptz,reviewed_by text,rejection_reason text);`);
    await db.query('INSERT INTO public.doulas(id,tenant_id) VALUES($1,$2)', [
      owner,
      tenant,
    ]);
    await db.query(
      "INSERT INTO public.doula_documents(doula_id,document_type,file_path,status) VALUES($1,'background_check','fictional/archive.pdf','approved')",
      [owner]
    );
    const before = (await db.query('SELECT * FROM public.doula_documents'))
      .rows;
    const migration = readFileSync(
      join(
        __dirname,
        '../src/db/migrations/20261025_p22_documents_background_check.sql'
      ),
      'utf8'
    );
    await db.exec(migration);
    await db.exec(migration);
    assert.deepEqual(
      (await db.query('SELECT * FROM public.doula_documents')).rows,
      before
    );
    assert.equal(
      (await db.query('SELECT background_check_status FROM public.doulas'))
        .rows[0].background_check_status,
      'not_cleared'
    );
    const poolPath = require.resolve('../src/db/cloudSqlPool.ts');
    require.cache[poolPath] = {
      id: poolPath,
      filename: poolPath,
      loaded: true,
      exports: { queryCloudSql: (sql, args) => db.query(sql, args) },
    };
    const storagePath = require.resolve(
      '../src/services/gcs/documentStorage.ts'
    );
    require.cache[storagePath] = {
      id: storagePath,
      filename: storagePath,
      loaded: true,
      exports: {},
    };
    const {
      DoulaDocumentRepository,
    } = require('../src/repositories/doulaDocumentRepository.ts');
    const repository = new DoulaDocumentRepository(null);
    for (const documentType of ['w9', 'direct_deposit_form', 'cpr', 'hipaa']) {
      const result = await repository.createDocument({
        doulaId: owner,
        documentType,
        fileName: `fictional-${documentType}.pdf`,
        filePath: `fictional/${documentType}.pdf`,
        mimeType: 'application/pdf',
        fileSize: 32,
      });
      assert.equal(result.documentType, documentType);
      assert.equal(result.status, 'uploaded');
      assert.equal(
        (await repository.getDocumentById(result.id)).fileName,
        `fictional-${documentType}.pdf`
      );
      const profile = (await db.query('SELECT * FROM public.doulas')).rows[0];
      assert.equal(profile.profile_review_status, 'draft');
      await db.query(
        "UPDATE public.doulas SET profile_review_status='approved'"
      );
      await repository.updateDocumentMetadata(result.id, {
        fileName: 'fictional-renamed.pdf',
      });
      assert.equal(
        (await db.query('SELECT profile_review_status FROM public.doulas'))
          .rows[0].profile_review_status,
        'draft'
      );
    }
    assert.equal(
      (
        await db.query(
          'SELECT count(*)::int AS count FROM public.doula_documents'
        )
      ).rows[0].count,
      5
    );
    await assert.rejects(
      db.query("UPDATE public.doulas SET background_check_status='pending'")
    );
    await assert.rejects(
      db.query(
        "INSERT INTO public.doula_documents(document_type) VALUES('unsupported')"
      )
    );
    console.log(
      'P-22 migration: repeat-safe, historical rows intact, four new/restored types persist and reset review.'
    );
  } finally {
    await db.close();
  }
}
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
