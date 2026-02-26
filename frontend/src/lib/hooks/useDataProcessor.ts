/**
 * useDataProcessor Hook
 * Provides easy access to the Web Worker for heavy data processing
 * Keeps UI smooth while processing large datasets
 */

import { useCallback, useEffect, useRef, useState } from 'react';

interface DetectedColumns {
  supplier: string | null;
  spend: string | null;
  country: string | null;
  region: string | null;
  price: string | null;
  quantity: string | null;
  category: string | null;
}

interface SpendDataItem {
  name: string;
  spend: number;
  percentage: number;
}

interface PriceData {
  prices: number[];
  avgPrice: number;
  minPrice: number;
  maxPrice: number;
  priceVariance: number;
}

interface ProcessedSpendData {
  columns: DetectedColumns;
  totalSpend: number;
  locations: SpendDataItem[];
  suppliers: SpendDataItem[];
  categories: SpendDataItem[];
  rowCount: number;
  filteredRowCount: number;
  priceData?: PriceData;
}

interface UseDataProcessorResult {
  isProcessing: boolean;
  isReady: boolean;
  error: string | null;
  processSpendData: (
    headers: string[],
    rows: Record<string, string>[],
    options?: {
      selectedCategories?: string[];
      categoryColumn?: string;
    }
  ) => Promise<ProcessedSpendData | null>;
  detectColumns: (
    headers: string[],
    sampleRows: Record<string, string>[]
  ) => Promise<DetectedColumns | null>;
}

export function useDataProcessor(): UseDataProcessorResult {
  const workerRef = useRef<Worker | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pendingResolvers = useRef<Map<string, { resolve: Function; reject: Function }>>(new Map());

  // Initialize worker
  useEffect(() => {
    // Check if we're in browser and Workers are supported
    if (typeof window === 'undefined' || !window.Worker) {
      console.warn('[DataProcessor] Web Workers not supported, falling back to main thread');
      setIsReady(true);
      return;
    }

    try {
      // Create worker using dynamic import for Next.js compatibility
      const worker = new Worker(
        new URL('../dataProcessor.worker.ts', import.meta.url),
        { type: 'module' }
      );

      worker.onmessage = (event) => {
        const { type, payload } = event.data;

        if (type === 'READY') {
          setIsReady(true);
          console.log('[DataProcessor] Worker ready');
          return;
        }

        if (type === 'ERROR') {
          setError(payload);
          setIsProcessing(false);
          console.error('[DataProcessor] Worker error:', payload);
          return;
        }

        // Handle result messages
        const resultType = type.replace('_RESULT', '');
        const resolver = pendingResolvers.current.get(resultType);
        if (resolver) {
          resolver.resolve(payload);
          pendingResolvers.current.delete(resultType);
        }

        setIsProcessing(false);
      };

      worker.onerror = (err) => {
        console.error('[DataProcessor] Worker error:', err);
        setError(err.message);
        setIsProcessing(false);
      };

      workerRef.current = worker;

      return () => {
        worker.terminate();
        workerRef.current = null;
      };
    } catch (err) {
      console.warn('[DataProcessor] Failed to create worker, using main thread:', err);
      setIsReady(true);
    }
  }, []);

  // Process spend data
  const processSpendData = useCallback(async (
    headers: string[],
    rows: Record<string, string>[],
    options?: {
      selectedCategories?: string[];
      categoryColumn?: string;
    }
  ): Promise<ProcessedSpendData | null> => {
    setError(null);
    setIsProcessing(true);

    // If worker is not available, fall back to synchronous processing
    if (!workerRef.current) {
      console.log('[DataProcessor] Processing on main thread (no worker)');
      setIsProcessing(false);
      return null; // Will fall back to existing logic
    }

    return new Promise((resolve, reject) => {
      pendingResolvers.current.set('PROCESS_SPEND_DATA', { resolve, reject });

      workerRef.current!.postMessage({
        type: 'PROCESS_SPEND_DATA',
        payload: {
          headers,
          rows,
          selectedCategories: options?.selectedCategories,
          categoryColumn: options?.categoryColumn,
        },
      });

      // Timeout after 30 seconds
      setTimeout(() => {
        if (pendingResolvers.current.has('PROCESS_SPEND_DATA')) {
          pendingResolvers.current.delete('PROCESS_SPEND_DATA');
          setIsProcessing(false);
          reject(new Error('Processing timeout'));
        }
      }, 30000);
    });
  }, []);

  // Detect columns only
  const detectColumns = useCallback(async (
    headers: string[],
    sampleRows: Record<string, string>[]
  ): Promise<DetectedColumns | null> => {
    setError(null);

    if (!workerRef.current) {
      return null;
    }

    return new Promise((resolve, reject) => {
      pendingResolvers.current.set('DETECT_COLUMNS', { resolve, reject });

      workerRef.current!.postMessage({
        type: 'DETECT_COLUMNS',
        payload: { headers, sampleRows },
      });

      setTimeout(() => {
        if (pendingResolvers.current.has('DETECT_COLUMNS')) {
          pendingResolvers.current.delete('DETECT_COLUMNS');
          reject(new Error('Detection timeout'));
        }
      }, 10000);
    });
  }, []);

  return {
    isProcessing,
    isReady,
    error,
    processSpendData,
    detectColumns,
  };
}

export type { DetectedColumns, ProcessedSpendData, SpendDataItem, PriceData };
