-- 2026-05-23: revocable sync tokens
-- Add a per-user version counter; long-lived sync JWTs embed the version at
-- signing and are rejected when it no longer matches. "Revoke all sync tokens"
-- = bump this column.
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS sync_token_version INTEGER NOT NULL DEFAULT 0;
