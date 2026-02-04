-- ============================================
-- BEROE PROCUREMENT PLATFORM - SCHEMA UPDATE FOR DEMO MODE
-- Run this in Supabase SQL Editor AFTER the initial schema
-- This allows sessions without authentication (demo mode)
-- ============================================

-- 1. Drop existing foreign key constraints that prevent null user_id
ALTER TABLE sessions DROP CONSTRAINT IF EXISTS sessions_user_id_fkey;
ALTER TABLE uploaded_files DROP CONSTRAINT IF EXISTS uploaded_files_user_id_fkey;
ALTER TABLE uploaded_files DROP CONSTRAINT IF EXISTS uploaded_files_session_id_fkey;
ALTER TABLE conversations DROP CONSTRAINT IF EXISTS conversations_user_id_fkey;
ALTER TABLE conversations DROP CONSTRAINT IF EXISTS conversations_session_id_fkey;

-- 2. Change sessions.id from UUID to TEXT to support demo session IDs
-- First, create a new table with the correct structure
CREATE TABLE IF NOT EXISTS sessions_new (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,

  -- Setup data
  category_name TEXT DEFAULT '',
  spend DECIMAL(15, 2) DEFAULT 0,
  goals JSONB DEFAULT '[]',
  portfolio_locations TEXT[] DEFAULT '{}',

  -- Uploaded data (stored as JSONB for flexibility)
  spend_data JSONB,
  playbook_data JSONB,
  contracts_data JSONB,

  -- Computed data
  opportunities JSONB DEFAULT '[]',
  computed_metrics JSONB,

  -- Metadata
  status TEXT DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Copy existing data (if any)
INSERT INTO sessions_new (id, user_id, category_name, spend, goals, portfolio_locations, spend_data, playbook_data, contracts_data, opportunities, computed_metrics, status, created_at, updated_at)
SELECT id::TEXT, user_id, category_name, spend, to_jsonb(goals), portfolio_locations, spend_data, playbook_data, contracts_data, opportunities, computed_metrics, status, created_at, updated_at
FROM sessions
ON CONFLICT (id) DO NOTHING;

-- 4. Drop old table and rename new one
DROP TABLE IF EXISTS sessions CASCADE;
ALTER TABLE sessions_new RENAME TO sessions;

-- 5. Update uploaded_files to use TEXT session_id
ALTER TABLE uploaded_files
  ALTER COLUMN session_id TYPE TEXT USING session_id::TEXT;

-- 6. Update conversations to use TEXT session_id
ALTER TABLE conversations
  ALTER COLUMN session_id TYPE TEXT USING session_id::TEXT;

-- 7. Make user_id nullable for demo sessions
ALTER TABLE sessions ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE uploaded_files ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE conversations ALTER COLUMN user_id DROP NOT NULL;

-- 8. Recreate indexes
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_updated_at ON sessions(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_id ON sessions(id);
CREATE INDEX IF NOT EXISTS idx_uploaded_files_session_id ON uploaded_files(session_id);

-- 9. Disable RLS for demo mode (or add permissive policies)
-- Option A: Disable RLS entirely (simpler for demo)
ALTER TABLE sessions DISABLE ROW LEVEL SECURITY;
ALTER TABLE uploaded_files DISABLE ROW LEVEL SECURITY;
ALTER TABLE conversations DISABLE ROW LEVEL SECURITY;

-- Option B (Alternative): Add permissive policies for demo sessions
-- Uncomment below if you want to keep RLS enabled with demo support
/*
-- Allow anyone to access sessions with null user_id (demo sessions)
DROP POLICY IF EXISTS "Demo sessions are public" ON sessions;
CREATE POLICY "Demo sessions are public" ON sessions
  FOR ALL USING (user_id IS NULL);

DROP POLICY IF EXISTS "Demo files are public" ON uploaded_files;
CREATE POLICY "Demo files are public" ON uploaded_files
  FOR ALL USING (user_id IS NULL);

DROP POLICY IF EXISTS "Demo conversations are public" ON conversations;
CREATE POLICY "Demo conversations are public" ON conversations
  FOR ALL USING (user_id IS NULL);
*/

-- 10. Create trigger for sessions updated_at
DROP TRIGGER IF EXISTS update_sessions_updated_at ON sessions;
CREATE TRIGGER update_sessions_updated_at
  BEFORE UPDATE ON sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 11. Grant permissions for anon role (needed for Supabase client)
GRANT ALL ON sessions TO anon;
GRANT ALL ON uploaded_files TO anon;
GRANT ALL ON conversations TO anon;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon;

-- ============================================
-- STORAGE BUCKET POLICIES
-- Configure in Supabase Dashboard > Storage > Buckets
-- For each bucket, set it to "Public" or add these policies manually
-- ============================================

-- Create buckets if they don't exist (ignore errors if they exist)
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('spend-files', 'spend-files', true),
  ('playbook-files', 'playbook-files', true),
  ('contract-files', 'contract-files', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Create storage policies using the correct Supabase method
-- These allow public access for demo mode

-- Spend files bucket policies
CREATE POLICY "Allow public uploads to spend-files" ON storage.objects
  FOR INSERT TO anon WITH CHECK (bucket_id = 'spend-files');

CREATE POLICY "Allow public reads from spend-files" ON storage.objects
  FOR SELECT TO anon USING (bucket_id = 'spend-files');

CREATE POLICY "Allow public deletes from spend-files" ON storage.objects
  FOR DELETE TO anon USING (bucket_id = 'spend-files');

-- Playbook files bucket policies
CREATE POLICY "Allow public uploads to playbook-files" ON storage.objects
  FOR INSERT TO anon WITH CHECK (bucket_id = 'playbook-files');

CREATE POLICY "Allow public reads from playbook-files" ON storage.objects
  FOR SELECT TO anon USING (bucket_id = 'playbook-files');

CREATE POLICY "Allow public deletes from playbook-files" ON storage.objects
  FOR DELETE TO anon USING (bucket_id = 'playbook-files');

-- Contract files bucket policies
CREATE POLICY "Allow public uploads to contract-files" ON storage.objects
  FOR INSERT TO anon WITH CHECK (bucket_id = 'contract-files');

CREATE POLICY "Allow public reads from contract-files" ON storage.objects
  FOR SELECT TO anon USING (bucket_id = 'contract-files');

CREATE POLICY "Allow public deletes from contract-files" ON storage.objects
  FOR DELETE TO anon USING (bucket_id = 'contract-files');
