-- Beroe Procurement Platform - Supabase Schema
-- Run this in your Supabase SQL Editor (https://supabase.com/dashboard/project/zgxsphfzxvipxgwddtpz/sql)

-- ============================================================================
-- Sessions Table (stores demo and user sessions)
-- ============================================================================
CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  category_name TEXT DEFAULT '',
  spend NUMERIC DEFAULT 0,
  goals JSONB DEFAULT '{"cost": 34, "risk": 33, "esg": 33}'::jsonb,
  portfolio_locations TEXT[] DEFAULT '{}',
  spend_data JSONB DEFAULT NULL,
  playbook_data JSONB DEFAULT NULL,
  contracts_data JSONB DEFAULT NULL,
  opportunities JSONB DEFAULT '[]'::jsonb,
  setup_opportunities JSONB DEFAULT '[]'::jsonb,
  computed_metrics JSONB DEFAULT NULL,
  activity_history JSONB DEFAULT '[]'::jsonb,
  savings_summary JSONB DEFAULT NULL,
  opportunity_metrics JSONB DEFAULT '[]'::jsonb,
  status TEXT DEFAULT 'draft',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS but allow public access for demo mode
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

-- Policy: Allow all operations for demo sessions (where user_id is null)
CREATE POLICY "Allow public access to demo sessions" ON sessions
  FOR ALL
  USING (user_id IS NULL)
  WITH CHECK (user_id IS NULL);

-- Policy: Allow authenticated users to access their own sessions
CREATE POLICY "Users can access own sessions" ON sessions
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- Uploaded Files Table (tracks file uploads)
-- ============================================================================
CREATE TABLE IF NOT EXISTS uploaded_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id TEXT REFERENCES sessions(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER DEFAULT 0,
  parsed_data JSONB DEFAULT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE uploaded_files ENABLE ROW LEVEL SECURITY;

-- Policy: Allow public access for demo files
CREATE POLICY "Allow public access to demo files" ON uploaded_files
  FOR ALL
  USING (user_id IS NULL)
  WITH CHECK (user_id IS NULL);

-- Policy: Allow authenticated users to access their own files
CREATE POLICY "Users can access own files" ON uploaded_files
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- Conversations Table (chat history)
-- ============================================================================
CREATE TABLE IF NOT EXISTS conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id TEXT REFERENCES sessions(id) ON DELETE SET NULL,
  title TEXT DEFAULT 'New Conversation',
  messages JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

-- Policy: Allow public access for demo conversations
CREATE POLICY "Allow public access to demo conversations" ON conversations
  FOR ALL
  USING (user_id IS NULL)
  WITH CHECK (user_id IS NULL);

-- Policy: Allow authenticated users to access their own conversations
CREATE POLICY "Users can access own conversations" ON conversations
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- Storage Buckets (for file uploads)
-- ============================================================================
-- Note: Run these in the Supabase Dashboard > Storage > New Bucket
-- Or use the API:

-- INSERT INTO storage.buckets (id, name, public) VALUES ('spend-files', 'spend-files', true);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('playbook-files', 'playbook-files', true);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('contract-files', 'contract-files', true);

-- Storage policies (run after creating buckets)
-- CREATE POLICY "Public read access" ON storage.objects FOR SELECT USING (bucket_id IN ('spend-files', 'playbook-files', 'contract-files'));
-- CREATE POLICY "Public insert access" ON storage.objects FOR INSERT WITH CHECK (bucket_id IN ('spend-files', 'playbook-files', 'contract-files'));
-- CREATE POLICY "Public update access" ON storage.objects FOR UPDATE USING (bucket_id IN ('spend-files', 'playbook-files', 'contract-files'));
-- CREATE POLICY "Public delete access" ON storage.objects FOR DELETE USING (bucket_id IN ('spend-files', 'playbook-files', 'contract-files'));

-- ============================================================================
-- Indexes for performance
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_updated_at ON sessions(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_uploaded_files_session_id ON uploaded_files(session_id);
CREATE INDEX IF NOT EXISTS idx_uploaded_files_file_type ON uploaded_files(file_type);
CREATE INDEX IF NOT EXISTS idx_conversations_user_id ON conversations(user_id);
CREATE INDEX IF NOT EXISTS idx_conversations_session_id ON conversations(session_id);
