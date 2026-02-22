import { createClient } from '@supabase/supabase-js';

// Supabase configuration
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://zgxsphfzxvipxgwddtpz.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpneHNwaGZ6eHZpcHhnd2RkdHB6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAxNDI0MzAsImV4cCI6MjA4NTcxODQzMH0.rllOpccOBlT5WDNwlel_ukqduBWZsbVRlVAmwm9Onqw';

// Create Supabase client
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Demo session ID for unauthenticated users (stored in localStorage)
const DEMO_SESSION_KEY = 'beroe_demo_session_id';

// Get or create demo session ID
export const getDemoSessionId = (): string => {
  if (typeof window === 'undefined') return 'demo-server';

  let sessionId = localStorage.getItem(DEMO_SESSION_KEY);
  if (!sessionId) {
    sessionId = `demo-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    localStorage.setItem(DEMO_SESSION_KEY, sessionId);
  }
  return sessionId;
};

// Database types for TypeScript
export interface DbUser {
  id: string;
  email: string;
  name: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbSession {
  id: string;
  user_id: string | null;
  category_name: string;
  spend: number;
  goals: any;
  portfolio_locations: string[];
  spend_data: any | null;
  playbook_data: any | null;
  contracts_data: any | null;
  opportunities: any[];
  setup_opportunities: any[];
  computed_metrics: any | null;
  activity_history: any[];
  savings_summary: any | null;
  opportunity_metrics: any[];
  status: string;
  created_at: string;
  updated_at: string;
}

export interface DbConversation {
  id: string;
  user_id: string;
  session_id: string | null;
  title: string;
  messages: any[];
  created_at: string;
  updated_at: string;
}

// Helper functions for data operations
export const supabaseHelpers = {
  // Sessions
  async createSession(userId: string, data: Partial<DbSession>) {
    const { data: session, error } = await supabase
      .from('sessions')
      .insert({
        user_id: userId,
        category_name: data.category_name || '',
        spend: data.spend || 0,
        goals: data.goals || [],
        portfolio_locations: data.portfolio_locations || [],
        spend_data: data.spend_data || null,
        playbook_data: data.playbook_data || null,
        opportunities: data.opportunities || [],
        computed_metrics: data.computed_metrics || null,
      })
      .select()
      .single();

    if (error) throw error;
    return session;
  },

  async getSession(sessionId: string) {
    const { data, error } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (error) throw error;
    return data;
  },

  async updateSession(sessionId: string, data: Partial<DbSession>) {
    const { data: session, error } = await supabase
      .from('sessions')
      .update({
        ...data,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId)
      .select()
      .single();

    if (error) throw error;
    return session;
  },

  async getUserSessions(userId: string) {
    const { data, error } = await supabase
      .from('sessions')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  // Conversations
  async saveConversation(userId: string, sessionId: string | null, title: string, messages: any[]) {
    const { data, error } = await supabase
      .from('conversations')
      .insert({
        user_id: userId,
        session_id: sessionId,
        title,
        messages,
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async getConversations(userId: string) {
    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('user_id', userId)
      .order('updated_at', { ascending: false });

    if (error) throw error;
    return data;
  },

  // File storage for uploaded data
  async uploadFile(bucket: string, path: string, file: File) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(path, file, { upsert: true });

    if (error) throw error;
    return data;
  },

  async getFileUrl(bucket: string, path: string) {
    const { data } = supabase.storage
      .from(bucket)
      .getPublicUrl(path);

    return data.publicUrl;
  },

  async downloadFile(bucket: string, path: string) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .download(path);

    if (error) throw error;
    return data;
  },

  async deleteFile(bucket: string, path: string) {
    const { error } = await supabase.storage
      .from(bucket)
      .remove([path]);

    if (error) throw error;
  },

  async listFiles(bucket: string, folder: string) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .list(folder);

    if (error) throw error;
    return data;
  },
};

// ============================================================================
// Demo Session Helpers (No Authentication Required)
// Uses a unique session ID stored in localStorage
// ============================================================================

export const demoSessionHelpers = {
  // Get or create a demo session in the database
  async getOrCreateDemoSession() {
    const sessionId = getDemoSessionId();

    // Try to get existing session
    const { data: existing, error: fetchError } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (existing && !fetchError) {
      return existing;
    }

    // Create new session (use upsert to handle race conditions)
    const { data: newSession, error: createError } = await supabase
      .from('sessions')
      .upsert({
        id: sessionId,
        user_id: null, // Demo sessions have no user
        category_name: '',
        spend: 0,
        goals: { cost: 34, risk: 33, esg: 33 },
        portfolio_locations: [],
        spend_data: null,
        playbook_data: null,
        contracts_data: null,
        opportunities: [],
        setup_opportunities: [],
        computed_metrics: null,
        activity_history: [],
        savings_summary: null,
        opportunity_metrics: [],
        status: 'draft',
      }, { onConflict: 'id' })
      .select()
      .single();

    if (createError) {
      console.error('Error creating demo session:', JSON.stringify(createError, null, 2));
      console.error('Session ID was:', sessionId);
      throw new Error(`Failed to create session: ${createError.message || createError.code || 'Unknown error'}`);
    }

    return newSession;
  },

  // Update demo session data
  async updateDemoSession(data: Partial<DbSession>) {
    const sessionId = getDemoSessionId();

    // First ensure session exists
    const { data: existing } = await supabase
      .from('sessions')
      .select('id')
      .eq('id', sessionId)
      .single();

    if (!existing) {
      // Session doesn't exist, create it first
      console.log('Session not found, creating new one...');
      await this.getOrCreateDemoSession();
    }

    const { data: session, error } = await supabase
      .from('sessions')
      .update({
        ...data,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId)
      .select()
      .single();

    if (error) {
      console.error('Error updating demo session:', JSON.stringify(error, null, 2));
      console.error('Session ID was:', sessionId);
      console.error('Update data was:', Object.keys(data));
      throw new Error(`Failed to update session: ${error.message || error.code || 'Unknown error'}`);
    }

    return session;
  },

  // Get demo session
  async getDemoSession() {
    const sessionId = getDemoSessionId();

    const { data, error } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = not found
      console.error('Error getting demo session:', error);
      throw error;
    }

    return data;
  },

  // Upload file to Supabase Storage for demo session
  async uploadDemoFile(
    fileType: 'spend' | 'playbook' | 'contracts' | 'supply-master' | 'other',
    file: File,
    parsedData?: any
  ) {
    const sessionId = getDemoSessionId();
    const timestamp = Date.now();
    const safeName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
    const filePath = `${sessionId}/${fileType}/${timestamp}-${safeName}`;

    // Determine bucket based on file type
    const bucketMap: Record<string, string> = {
      'spend': 'spend-files',
      'playbook': 'playbook-files',
      'contracts': 'contract-files',
      'supply-master': 'spend-files', // Use spend-files bucket
      'other': 'spend-files', // Use spend-files bucket
    };
    const bucket = bucketMap[fileType] || 'spend-files';

    // Upload file to storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(bucket)
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      console.error('Error uploading file:', uploadError);
      throw uploadError;
    }

    // Save file metadata to uploaded_files table
    const { data: fileRecord, error: dbError } = await supabase
      .from('uploaded_files')
      .insert({
        user_id: null, // Demo session
        session_id: sessionId,
        file_name: file.name,
        file_type: fileType,
        file_path: filePath,
        file_size: file.size,
        parsed_data: parsedData || null,
      })
      .select()
      .single();

    if (dbError) {
      console.error('Error saving file record:', dbError);
      // Don't throw - file is uploaded, just metadata failed
    }

    return {
      path: filePath,
      bucket,
      fileRecord,
    };
  },

  // Get all uploaded files for demo session
  async getDemoFiles() {
    const sessionId = getDemoSessionId();

    const { data, error } = await supabase
      .from('uploaded_files')
      .select('*')
      .eq('session_id', sessionId)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error getting demo files:', error);
      throw error;
    }

    return data || [];
  },

  // Get files by type for demo session
  async getDemoFilesByType(fileType: string) {
    const sessionId = getDemoSessionId();

    const { data, error } = await supabase
      .from('uploaded_files')
      .select('*')
      .eq('session_id', sessionId)
      .eq('file_type', fileType)
      .order('created_at', { ascending: false });

    if (error && error.code !== 'PGRST116') {
      console.error('Error getting demo files by type:', error);
      throw error;
    }

    return data || [];
  },

  // Delete uploaded file for demo session
  async deleteDemoFile(fileId: string, bucket: string, filePath: string) {
    // Delete from storage
    const { error: storageError } = await supabase.storage
      .from(bucket)
      .remove([filePath]);

    if (storageError) {
      console.error('Error deleting file from storage:', storageError);
    }

    // Delete from database
    const { error: dbError } = await supabase
      .from('uploaded_files')
      .delete()
      .eq('id', fileId);

    if (dbError) {
      console.error('Error deleting file record:', dbError);
      throw dbError;
    }
  },

  // Save computed metrics and opportunities to demo session
  async saveDemoAnalysisResults(data: {
    opportunities?: any[];
    computed_metrics?: any;
    spend_data?: any;
    playbook_data?: any;
    contracts_data?: any;
  }) {
    return this.updateDemoSession(data);
  },

  // ============================================================================
  // Activity History Persistence
  // ============================================================================

  // Save activity history to Supabase
  async saveDemoActivityHistory(activities: any[]) {
    const sessionId = getDemoSessionId();

    const { data, error } = await supabase
      .from('sessions')
      .update({
        activity_history: activities,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId)
      .select()
      .single();

    if (error) {
      console.error('Error saving activity history:', error);
      throw error;
    }

    return data;
  },

  // Get activity history from Supabase
  async getDemoActivityHistory(): Promise<any[]> {
    const sessionId = getDemoSessionId();

    const { data, error } = await supabase
      .from('sessions')
      .select('activity_history')
      .eq('id', sessionId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error getting activity history:', error);
      return [];
    }

    return data?.activity_history || [];
  },

  // ============================================================================
  // Setup Opportunities (Proof Points) Persistence
  // ============================================================================

  // Save setup opportunities (with proof point validation status) to Supabase
  async saveDemoSetupOpportunities(opportunities: any[]) {
    const sessionId = getDemoSessionId();

    const { data, error } = await supabase
      .from('sessions')
      .update({
        setup_opportunities: opportunities,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId)
      .select()
      .single();

    if (error) {
      console.error('Error saving setup opportunities:', error);
      throw error;
    }

    return data;
  },

  // Get setup opportunities from Supabase
  async getDemoSetupOpportunities(): Promise<any[]> {
    const sessionId = getDemoSessionId();

    const { data, error } = await supabase
      .from('sessions')
      .select('setup_opportunities')
      .eq('id', sessionId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error getting setup opportunities:', error);
      return [];
    }

    return data?.setup_opportunities || [];
  },

  // ============================================================================
  // Savings Summary Persistence
  // ============================================================================

  async saveDemoSavingsSummary(summary: any) {
    const sessionId = getDemoSessionId();

    const { data, error } = await supabase
      .from('sessions')
      .update({
        savings_summary: summary,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId)
      .select()
      .single();

    if (error) {
      console.error('Error saving savings summary:', error);
      throw error;
    }

    return data;
  },

  async getDemoSavingsSummary(): Promise<any | null> {
    const sessionId = getDemoSessionId();

    const { data, error } = await supabase
      .from('sessions')
      .select('savings_summary')
      .eq('id', sessionId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error getting savings summary:', error);
      return null;
    }

    return data?.savings_summary || null;
  },

  // ============================================================================
  // Opportunity Metrics Persistence
  // ============================================================================

  async saveDemoOpportunityMetrics(metrics: any[]) {
    const sessionId = getDemoSessionId();

    const { data, error } = await supabase
      .from('sessions')
      .update({
        opportunity_metrics: metrics,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId)
      .select()
      .single();

    if (error) {
      console.error('Error saving opportunity metrics:', error);
      throw error;
    }

    return data;
  },

  async getDemoOpportunityMetrics(): Promise<any[]> {
    const sessionId = getDemoSessionId();

    const { data, error } = await supabase
      .from('sessions')
      .select('opportunity_metrics')
      .eq('id', sessionId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error getting opportunity metrics:', error);
      return [];
    }

    return data?.opportunity_metrics || [];
  },

  // ============================================================================
  // Full State Sync - Load all data at once
  // ============================================================================

  async loadFullDemoState(): Promise<{
    session: DbSession | null;
    activityHistory: any[];
    setupOpportunities: any[];
    savingsSummary: any | null;
    opportunityMetrics: any[];
  }> {
    const sessionId = getDemoSessionId();

    const { data, error } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (error && error.code !== 'PGRST116') {
      console.error('Error loading full demo state:', error);
      return {
        session: null,
        activityHistory: [],
        setupOpportunities: [],
        savingsSummary: null,
        opportunityMetrics: [],
      };
    }

    return {
      session: data || null,
      activityHistory: data?.activity_history || [],
      setupOpportunities: data?.setup_opportunities || [],
      savingsSummary: data?.savings_summary || null,
      opportunityMetrics: data?.opportunity_metrics || [],
    };
  },

  // Save full state at once (batch update)
  async saveFullDemoState(state: {
    category_name?: string;
    spend?: number;
    goals?: any;
    activity_history?: any[];
    setup_opportunities?: any[];
    savings_summary?: any;
    opportunity_metrics?: any[];
    computed_metrics?: any;
    spend_data?: any;
    playbook_data?: any;
    contracts_data?: any;
  }) {
    const sessionId = getDemoSessionId();

    // First ensure session exists
    await this.getOrCreateDemoSession();

    const { data, error } = await supabase
      .from('sessions')
      .update({
        ...state,
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId)
      .select()
      .single();

    if (error) {
      console.error('Error saving full demo state:', error);
      throw error;
    }

    return data;
  },
};

export default supabase;
