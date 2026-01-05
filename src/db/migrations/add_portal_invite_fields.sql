-- Add portal invite tracking fields to client_info table
-- This enables tracking of client portal invitations, resends, and access status

-- Add portal status and tracking fields
ALTER TABLE client_info
ADD COLUMN IF NOT EXISTS portal_status TEXT NOT NULL DEFAULT 'not_invited',
ADD COLUMN IF NOT EXISTS invited_at TIMESTAMPTZ NULL,
ADD COLUMN IF NOT EXISTS last_invite_sent_at TIMESTAMPTZ NULL,
ADD COLUMN IF NOT EXISTS invite_sent_count INT NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS invited_by UUID NULL REFERENCES users(id),
ADD COLUMN IF NOT EXISTS auth_user_id UUID NULL;

-- Add constraint to ensure portal_status has valid values
ALTER TABLE client_info
ADD CONSTRAINT check_portal_status
CHECK (portal_status IN ('not_invited', 'invited', 'active', 'disabled'));

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_client_info_portal_status ON client_info(portal_status);
CREATE INDEX IF NOT EXISTS idx_client_info_auth_user_id ON client_info(auth_user_id) WHERE auth_user_id IS NOT NULL;

-- Ensure email has an index (check if exists first)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'client_info'
    AND indexname = 'idx_client_info_email'
  ) THEN
    CREATE INDEX idx_client_info_email ON client_info(email);
  END IF;
END $$;

-- Add comment for documentation
COMMENT ON COLUMN client_info.portal_status IS 'Portal access status: not_invited, invited, active, disabled';
COMMENT ON COLUMN client_info.invited_at IS 'Timestamp when client was first invited to portal';
COMMENT ON COLUMN client_info.last_invite_sent_at IS 'Timestamp of most recent invite email sent';
COMMENT ON COLUMN client_info.invite_sent_count IS 'Total number of invite emails sent to this client';
COMMENT ON COLUMN client_info.invited_by IS 'Admin user ID who sent the invite';
COMMENT ON COLUMN client_info.auth_user_id IS 'Supabase auth.users.id for portal authentication';
