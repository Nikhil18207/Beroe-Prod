/**
 * API Client for Beroe Procurement Engine
 */

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
const TOKEN_KEY = "beroe_auth_token";

interface RequestOptions extends RequestInit {
  timeout?: number;
  skipAuth?: boolean; // Skip adding auth header for public endpoints
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

async function request<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<T> {
  const { timeout = 30000, skipAuth, ...fetchOptions } = options;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...fetchOptions,
      signal: controller.signal,
      headers: buildHeaders({ ...options, skipAuth }),
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
  const { timeout = 60000, skipAuth, ...fetchOptions } = options;

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
      // Don't set Content-Type - browser will set it with boundary for FormData
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
