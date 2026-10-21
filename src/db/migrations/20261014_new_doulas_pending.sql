-- New doula accounts wait for admin approval. Existing accounts are unchanged.
ALTER TABLE public.doulas ALTER COLUMN account_status SET DEFAULT 'pending';
