/**
 * API Client for Beroe Procurement Engine
 * Optimized for performance with caching and connection reuse
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
const TOKEN_KEY = "beroe_auth_token";

// Simple in-memory cache for GET requests
const requestCache = new Map<string, { data: unknown; timestamp: number }>();
const CACHE_TTL = 30000; // 30 seconds cache for frequently accessed data

interface RequestOptions extends RequestInit {
  timeout?: number;
  skipAuth?: boolean;
  cache?: boolean; // Enable caching for GET requests
  cacheTTL?: number; // Custom cache TTL in ms
}

class ApiError extends Error {
  status: number;
  data: unknown;

  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

// Get auth token from localStorage
function getAuthToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

// Build headers with optional auth
function buildHeaders(options: RequestOptions): HeadersInit {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    "Connection": "keep-alive", // Reuse connections
    ...options.headers,
  };

  // Add auth token if available and not skipped
  if (!options.skipAuth) {
    const token = getAuthToken();
    if (token) {
      (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;
    }
  }

  return headers;
}

// Check if cached data is still valid
function getCachedData<T>(key: string, ttl: number): T | null {
  const cached = requestCache.get(key);
  if (cached && Date.now() - cached.timestamp < ttl) {
    return cached.data as T;
  }
  return null;
}

// Store data in cache
function setCachedData(key: string, data: unknown): void {
  // Limit cache size to prevent memory issues
  if (requestCache.size > 100) {
    const firstKey = requestCache.keys().next().value;
    if (firstKey) requestCache.delete(firstKey);
  }
  requestCache.set(key, { data, timestamp: Date.now() });
}

// Clear cache for a specific endpoint pattern
export function clearApiCache(pattern?: string): void {
  if (!pattern) {
    requestCache.clear();
    return;
  }
  for (const key of requestCache.keys()) {
    if (key.includes(pattern)) {
      requestCache.delete(key);
    }
  }
}

async function request<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const { timeout = 15000, skipAuth, cache = false, cacheTTL = CACHE_TTL, ...fetchOptions } = options;

  // Check cache for GET requests
  if (cache && options.method === "GET") {
    const cacheKey = `${endpoint}:${getAuthToken() || 'anon'}`;
    const cachedData = getCachedData<T>(cacheKey, cacheTTL);
    if (cachedData) {
      return cachedData;
    }
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...fetchOptions,
      signal: controller.signal,
      headers: buildHeaders({ ...options, skipAuth }),
      // Enable keep-alive for connection reuse
      keepalive: true,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new ApiError(
        errorData?.detail || `HTTP error ${response.status}`,
        response.status,
        errorData
      );
    }

    const data = await response.json();

    // Cache successful GET responses
    if (cache && options.method === "GET") {
      const cacheKey = `${endpoint}:${getAuthToken() || 'anon'}`;
      setCachedData(cacheKey, data);
    }

    return data;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof ApiError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new ApiError("Request timeout", 408);
    }
    throw new ApiError(
      error instanceof Error ? error.message : "Network error",
      0
    );
  }
}

async function uploadFile<T>(
  endpoint: string,
  formData: FormData,
  options: RequestOptions = {}
): Promise<T> {
  const { timeout = 120000, skipAuth, ...fetchOptions } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  // Build headers for file upload (no Content-Type, browser sets it)
  const uploadHeaders: HeadersInit = { ...fetchOptions.headers };
  if (!skipAuth) {
    const token = getAuthToken();
    if (token) {
      (uploadHeaders as Record<string, string>)["Authorization"] = `Bearer ${token}`;
    }
  }

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: "POST",
      body: formData,
      signal: controller.signal,
      ...fetchOptions,
      headers: uploadHeaders,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new ApiError(
        errorData?.detail || `HTTP error ${response.status}`,
        response.status,
        errorData
      );
    }

    return response.json();
  } catch (error) {
    clearTimeout(timeoutId);
    if (error instanceof ApiError) throw error;
    throw new ApiError(
      error instanceof Error ? error.message : "Upload failed",
      0
    );
  }
}

export const apiClient = {
  get: <T>(endpoint: string, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: "GET" }),

  // Cached GET - use for frequently accessed, rarely changing data
  getCached: <T>(endpoint: string, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: "GET", cache: true }),

  post: <T>(endpoint: string, data?: unknown, options?: RequestOptions) =>
    request<T>(endpoint, {
      ...options,
      method: "POST",
      body: data ? JSON.stringify(data) : undefined,
    }),

  put: <T>(endpoint: string, data?: unknown, options?: RequestOptions) =>
    request<T>(endpoint, {
      ...options,
      method: "PUT",
      body: data ? JSON.stringify(data) : undefined,
    }),

  delete: <T>(endpoint: string, options?: RequestOptions) =>
    request<T>(endpoint, { ...options, method: "DELETE" }),

  upload: <T>(endpoint: string, formData: FormData, options?: RequestOptions) =>
    uploadFile<T>(endpoint, formData, options),
};

export { ApiError };
export default apiClient;
