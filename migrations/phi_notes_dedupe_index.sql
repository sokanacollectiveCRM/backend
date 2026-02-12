-- phi_notes dedupe: unique index and idempotent insert
-- Safe to run multiple times (IF NOT EXISTS / IF NOT EXISTS).
-- Dedupe key: (client_id, note_date, md5(coalesce(title,'') || '|' || coalesce(note_content,'')))

-- Create phi_notes table if not present (minimal schema for dedupe)
CREATE TABLE IF NOT EXISTS public.phi_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL,
  note_date date NOT NULL,
  title text,
  note_content text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_phi_notes_client_id ON public.phi_notes(client_id);
CREATE INDEX IF NOT EXISTS idx_phi_notes_note_date ON public.phi_notes(note_date);

-- Unique index for migration and backend dedupe (same expression as migration)
CREATE UNIQUE INDEX IF NOT EXISTS uq_phi_notes_migration_dedupe
  ON public.phi_notes (
    client_id,
    note_date,
    md5(coalesce(title,'') || '|' || coalesce(note_content,''))
  );

COMMENT ON TABLE public.phi_notes IS 'PHI notes per client; deduped by (client_id, note_date, content hash).';

-- Idempotent insert: returns (id, inserted). inserted = false when conflict (dedupe hit).
CREATE OR REPLACE FUNCTION public.insert_phi_note(
  p_client_id uuid,
  p_note_date date,
  p_title text,
  p_note_content text
)
RETURNS TABLE(out_id uuid, out_inserted boolean)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  INSERT INTO public.phi_notes (client_id, note_date, title, note_content)
  VALUES (p_client_id, p_note_date, coalesce(p_title,''), coalesce(p_note_content,''))
  ON CONFLICT (client_id, note_date, md5(coalesce(phi_notes.title,'') || '|' || coalesce(phi_notes.note_content,'')))
  DO NOTHING
  RETURNING phi_notes.id, true;

  IF NOT FOUND THEN
    RETURN QUERY
    SELECT n.id, false
    FROM public.phi_notes n
    WHERE n.client_id = p_client_id
      AND n.note_date = p_note_date
      AND md5(coalesce(n.title,'') || '|' || coalesce(n.note_content,'')) =
          md5(coalesce(p_title,'') || '|' || coalesce(p_note_content,''))
    LIMIT 1;
  END IF;
END;
$$;

COMMENT ON FUNCTION public.insert_phi_note IS 'Idempotent insert for phi_notes; returns existing id on conflict (dedupe).';
