-- ============================================
-- ADD MISSING USER COLUMNS
-- Run this in Supabase SQL Editor
-- ============================================

-- Add missing columns to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS username TEXT UNIQUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS hashed_password TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS company TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS preferences JSONB DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS goals JSONB DEFAULT '{}';
ALTER TABLE users ADD COLUMN IF NOT EXISTS setup_step INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS setup_completed BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login TIMESTAMPTZ;

-- Rename password_hash to hashed_password if it exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'password_hash') THEN
    -- Copy data from password_hash to hashed_password
    UPDATE users SET hashed_password = password_hash WHERE hashed_password IS NULL;
    -- Drop the old column
    ALTER TABLE users DROP COLUMN IF EXISTS password_hash;
  END IF;
END $$;

-- Create index on username
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);

-- Disable RLS for demo/development (or configure policies)
ALTER TABLE users DISABLE ROW LEVEL SECURITY;

-- Grant permissions for authenticated access
GRANT ALL ON users TO anon;
GRANT ALL ON users TO authenticated;

-- Verify the schema
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'users'
ORDER BY ordinal_position;
