const BASE_URL = '/api/v1';

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('token');
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

function transformKeys(obj: unknown): unknown {
  if (Array.isArray(obj)) {
    return obj.map(transformKeys);
  }
  if (obj !== null && typeof obj === 'object') {
    return Object.fromEntries(
      Object.entries(obj as Record<string, unknown>).map(([key, value]) => [
        snakeToCamel(key),
        transformKeys(value),
      ])
    );
  }
  return obj;
}

interface ApiErrorResponse {
  error: true;
  code: string;
  message: string;
}

export class ApiError extends Error {
  code: string;
  status: number;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.code = code;
    this.status = status;
    this.name = 'ApiError';
  }
}

let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

async function tryRefreshToken(): Promise<boolean> {
  const refreshToken = localStorage.getItem('refreshToken');
  if (!refreshToken) return false;

  try {
    const response = await fetch(`${BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!response.ok) return false;

    const data = transformKeys(await response.json()) as {
      token: string;
      refreshToken: string;
    };
    localStorage.setItem('token', data.token);
    localStorage.setItem('refreshToken', data.refreshToken);
    return true;
  } catch {
    return false;
  }
}

async function requestWithRefresh<T>(method: string, path: string, body?: unknown): Promise<T> {
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: getAuthHeaders(),
    body: body ? JSON.stringify(body) : undefined,
  });

  if (response.status === 401 && localStorage.getItem('refreshToken')) {
    // Deduplicate concurrent refresh attempts
    if (!isRefreshing) {
      isRefreshing = true;
      refreshPromise = tryRefreshToken().finally(() => {
        isRefreshing = false;
        refreshPromise = null;
      });
    }

    const refreshed = await (refreshPromise ?? Promise.resolve(false));
    if (refreshed) {
      // Retry the original request with the new token
      const retryResponse = await fetch(`${BASE_URL}${path}`, {
        method,
        headers: getAuthHeaders(),
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!retryResponse.ok) {
        const errorData = await retryResponse.json().catch(() => null) as ApiErrorResponse | null;
        throw new ApiError(
          retryResponse.status,
          errorData?.code ?? 'UNKNOWN',
          errorData?.message ?? 'An error occurred'
        );
      }

      const data: unknown = await retryResponse.json();
      return transformKeys(data) as T;
    }

    // Refresh failed — throw the original 401
    const errorData = await response.json().catch(() => null) as ApiErrorResponse | null;
    throw new ApiError(401, errorData?.code ?? 'TOKEN_EXPIRED', errorData?.message ?? 'Session expired');
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => null) as ApiErrorResponse | null;
    throw new ApiError(
      response.status,
      errorData?.code ?? 'UNKNOWN',
      errorData?.message ?? 'An error occurred'
    );
  }

  const data: unknown = await response.json();
  return transformKeys(data) as T;
}

export const api = {
  get: <T>(path: string): Promise<T> => requestWithRefresh<T>('GET', path),
  post: <T>(path: string, body?: unknown): Promise<T> => requestWithRefresh<T>('POST', path, body),
  patch: <T>(path: string, body?: unknown): Promise<T> => requestWithRefresh<T>('PATCH', path, body),
  delete: <T>(path: string): Promise<T> => requestWithRefresh<T>('DELETE', path),
};
