"use client";

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase, demoSessionHelpers, getDemoSessionId } from '../supabase';

// Types for uploaded file records
export interface UploadedFileRecord {
  id: string;
  session_id: string;
  file_name: string;
  file_type: string;
  file_path: string;
  file_size: number;
  parsed_data: any;
  created_at: string;
}

export interface SessionData {
  id: string;
  category_name: string;
  spend: number;
  goals: any;
  portfolio_locations: string[];
  spend_data: any;
  playbook_data: any;
  contracts_data: any;
  opportunities: any[];
  setup_opportunities: any[];
  computed_metrics: any;
  activity_history: any[];
  savings_summary: any;
  opportunity_metrics: any[];
  status: string;
  created_at: string;
  updated_at: string;
}

// Hook for managing Supabase storage in demo mode
export function useSupabaseStorage() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [session, setSession] = useState<SessionData | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFileRecord[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize session on mount
  useEffect(() => {
    const initSession = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Get or create demo session
        const sessionData = await demoSessionHelpers.getOrCreateDemoSession();
        setSession(sessionData);

        // Get uploaded files for this session
        const files = await demoSessionHelpers.getDemoFiles();
        setUploadedFiles(files);

        setIsInitialized(true);
      } catch (err) {
        console.error('Failed to initialize Supabase session:', err);
        setError(err instanceof Error ? err.message : 'Failed to initialize session');
        // Still mark as initialized so app can work offline
        setIsInitialized(true);
      } finally {
        setIsLoading(false);
      }
    };

    initSession();
  }, []);

  // Upload a file to Supabase Storage
  const uploadFile = useCallback(async (
    fileType: 'spend' | 'playbook' | 'contracts' | 'supply-master' | 'other',
    file: File,
    parsedData?: any
  ): Promise<UploadedFileRecord | null> => {
    try {
      setIsLoading(true);
      setError(null);

      const result = await demoSessionHelpers.uploadDemoFile(fileType, file, parsedData);

      // Refresh uploaded files list
      const files = await demoSessionHelpers.getDemoFiles();
      setUploadedFiles(files);

      // Return the new file record
      return result.fileRecord;
    } catch (err) {
      console.error('Failed to upload file:', err);
      setError(err instanceof Error ? err.message : 'Failed to upload file');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Delete a file from Supabase Storage
  const deleteFile = useCallback(async (fileId: string): Promise<boolean> => {
    try {
      setIsLoading(true);
      setError(null);

      // Find the file record to get bucket and path
      const fileRecord = uploadedFiles.find(f => f.id === fileId);
      if (!fileRecord) {
        throw new Error('File not found');
      }

      // Determine bucket from file type
      const bucketMap: Record<string, string> = {
        'spend': 'spend-files',
        'playbook': 'playbook-files',
        'contracts': 'contract-files',
        'supply-master': 'spend-files',
        'other': 'spend-files',
      };
      const bucket = bucketMap[fileRecord.file_type] || 'spend-files';

      await demoSessionHelpers.deleteDemoFile(fileId, bucket, fileRecord.file_path);

      // Update local state
      setUploadedFiles(prev => prev.filter(f => f.id !== fileId));

      return true;
    } catch (err) {
      console.error('Failed to delete file:', err);
      setError(err instanceof Error ? err.message : 'Failed to delete file');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [uploadedFiles]);

  // Get files by type
  const getFilesByType = useCallback((fileType: string): UploadedFileRecord[] => {
    return uploadedFiles.filter(f => f.file_type === fileType);
  }, [uploadedFiles]);

  // Get the latest file of a specific type
  const getLatestFile = useCallback((fileType: string): UploadedFileRecord | null => {
    const files = getFilesByType(fileType);
    return files.length > 0 ? files[0] : null; // Already sorted by created_at desc
  }, [getFilesByType]);

  // Update session data (category, spend, goals, etc.)
  const updateSessionData = useCallback(async (data: Partial<SessionData>): Promise<boolean> => {
    try {
      setIsLoading(true);
      setError(null);

      const updatedSession = await demoSessionHelpers.updateDemoSession(data);
      setSession(updatedSession);

      return true;
    } catch (err) {
      console.error('Failed to update session:', err);
      setError(err instanceof Error ? err.message : 'Failed to update session');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Save analysis results (opportunities, metrics)
  const saveAnalysisResults = useCallback(async (data: {
    opportunities?: any[];
    computed_metrics?: any;
    spend_data?: any;
    playbook_data?: any;
    contracts_data?: any;
  }): Promise<boolean> => {
    try {
      setIsLoading(true);
      setError(null);

      const updatedSession = await demoSessionHelpers.saveDemoAnalysisResults(data);
      setSession(updatedSession);

      return true;
    } catch (err) {
      console.error('Failed to save analysis results:', err);
      setError(err instanceof Error ? err.message : 'Failed to save analysis results');
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Load session data from Supabase (called on mount and can be called manually)
  const loadSession = useCallback(async (): Promise<SessionData | null> => {
    try {
      setIsLoading(true);
      setError(null);

      const sessionData = await demoSessionHelpers.getDemoSession();
      if (sessionData) {
        setSession(sessionData);
      }

      return sessionData;
    } catch (err) {
      console.error('Failed to load session:', err);
      setError(err instanceof Error ? err.message : 'Failed to load session');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Refresh files list
  const refreshFiles = useCallback(async (): Promise<void> => {
    try {
      const files = await demoSessionHelpers.getDemoFiles();
      setUploadedFiles(files);
    } catch (err) {
      console.error('Failed to refresh files:', err);
    }
  }, []);

  // ============================================================================
  // Activity History Operations
  // ============================================================================

  const saveActivityHistory = useCallback(async (activities: any[]): Promise<boolean> => {
    try {
      await demoSessionHelpers.saveDemoActivityHistory(activities);
      return true;
    } catch (err) {
      console.error('Failed to save activity history:', err);
      return false;
    }
  }, []);

  const loadActivityHistory = useCallback(async (): Promise<any[]> => {
    try {
      return await demoSessionHelpers.getDemoActivityHistory();
    } catch (err) {
      console.error('Failed to load activity history:', err);
      return [];
    }
  }, []);

  // ============================================================================
  // Setup Opportunities (Proof Points) Operations
  // ============================================================================

  const saveSetupOpportunities = useCallback(async (opportunities: any[]): Promise<boolean> => {
    try {
      await demoSessionHelpers.saveDemoSetupOpportunities(opportunities);
      return true;
    } catch (err) {
      console.error('Failed to save setup opportunities:', err);
      return false;
    }
  }, []);

  const loadSetupOpportunities = useCallback(async (): Promise<any[]> => {
    try {
      return await demoSessionHelpers.getDemoSetupOpportunities();
    } catch (err) {
      console.error('Failed to load setup opportunities:', err);
      return [];
    }
  }, []);

  // ============================================================================
  // Savings Summary Operations
  // ============================================================================

  const saveSavingsSummary = useCallback(async (summary: any): Promise<boolean> => {
    try {
      await demoSessionHelpers.saveDemoSavingsSummary(summary);
      return true;
    } catch (err) {
      console.error('Failed to save savings summary:', err);
      return false;
    }
  }, []);

  const loadSavingsSummary = useCallback(async (): Promise<any | null> => {
    try {
      return await demoSessionHelpers.getDemoSavingsSummary();
    } catch (err) {
      console.error('Failed to load savings summary:', err);
      return null;
    }
  }, []);

  // ============================================================================
  // Opportunity Metrics Operations
  // ============================================================================

  const saveOpportunityMetrics = useCallback(async (metrics: any[]): Promise<boolean> => {
    try {
      await demoSessionHelpers.saveDemoOpportunityMetrics(metrics);
      return true;
    } catch (err) {
      console.error('Failed to save opportunity metrics:', err);
      return false;
    }
  }, []);

  const loadOpportunityMetrics = useCallback(async (): Promise<any[]> => {
    try {
      return await demoSessionHelpers.getDemoOpportunityMetrics();
    } catch (err) {
      console.error('Failed to load opportunity metrics:', err);
      return [];
    }
  }, []);

  // ============================================================================
  // Full State Sync Operations
  // ============================================================================

  const loadFullState = useCallback(async () => {
    try {
      setIsLoading(true);
      const fullState = await demoSessionHelpers.loadFullDemoState();
      if (fullState.session) {
        setSession(fullState.session);
      }
      return fullState;
    } catch (err) {
      console.error('Failed to load full state:', err);
      return {
        session: null,
        activityHistory: [],
        setupOpportunities: [],
        savingsSummary: null,
        opportunityMetrics: [],
      };
    } finally {
      setIsLoading(false);
    }
  }, []);

  const saveFullState = useCallback(async (state: {
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
  }): Promise<boolean> => {
    try {
      setIsLoading(true);
      const updatedSession = await demoSessionHelpers.saveFullDemoState(state);
      setSession(updatedSession);
      return true;
    } catch (err) {
      console.error('Failed to save full state:', err);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    // State
    isLoading,
    error,
    session,
    uploadedFiles,
    isInitialized,
    sessionId: getDemoSessionId(),

    // File operations
    uploadFile,
    deleteFile,
    getFilesByType,
    getLatestFile,
    refreshFiles,

    // Session operations
    updateSessionData,
    saveAnalysisResults,
    loadSession,

    // Activity history operations
    saveActivityHistory,
    loadActivityHistory,

    // Setup opportunities operations
    saveSetupOpportunities,
    loadSetupOpportunities,

    // Savings summary operations
    saveSavingsSummary,
    loadSavingsSummary,

    // Opportunity metrics operations
    saveOpportunityMetrics,
    loadOpportunityMetrics,

    // Full state sync
    loadFullState,
    saveFullState,
  };
}

export default useSupabaseStorage;
