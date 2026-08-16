import { API_BASE_URL } from '@/config/api';
import { authSessionService } from '@/services/auth-session';

export const AUTH_ERROR_MESSAGES = {
  INVALID_CREDENTIALS: 'Invalid email or password.',
  NETWORK: 'Unable to connect to the server. Check your network connection.',
  SERVER: 'Something went wrong. Please try again.',
  UNAUTHORIZED: 'Your session has expired. Please sign in again.',
} as const;

export type ApiErrorCode =
  | 'NETWORK'
  | 'UNAUTHORIZED'
  | 'INVALID_CREDENTIALS'
  | 'SERVER'
  | 'UNKNOWN';

export class ApiClientError extends Error {
  readonly code: ApiErrorCode;
  readonly status?: number;

  constructor(code: ApiErrorCode, message: string, status?: number) {
    super(message);
    this.name = 'ApiClientError';
    this.code = code;
    this.status = status;
  }
}

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type ApiRequestOptions = {
  method?: HttpMethod;
  body?: unknown;
  auth?: boolean;
  token?: string;
  timeoutMs?: number;
};

const DEFAULT_TIMEOUT_MS = 20000;

const isProbablyHtml = (text: string): boolean => {
  const trimmed = text.trim().toLowerCase();
  return (
    trimmed.startsWith('<!doctype') ||
    trimmed.startsWith('<html') ||
    trimmed.includes('<body')
  );
};

const parseJsonSafely = (text: string): unknown | null => {
  if (!text || isProbablyHtml(text)) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

async function request<T = unknown>(
  url: string,
  options: ApiRequestOptions = {},
): Promise<T> {
  if (!API_BASE_URL) {
    throw new ApiClientError('NETWORK', AUTH_ERROR_MESSAGES.NETWORK);
  }

  const { method = 'GET', body, auth = true, token, timeoutMs = DEFAULT_TIMEOUT_MS } = options;

  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  if (auth) {
    const bearerToken = token ?? authSessionService.getToken();
    if (bearerToken) {
      headers.Authorization = `Bearer ${bearerToken}`;
    }
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (error) {
    const aborted = error instanceof Error && error.name === 'AbortError';
    console.warn(
      `[api] ${method} ${url} failed`,
      error instanceof Error ? error.message : error,
    );
    throw new ApiClientError(
      'NETWORK',
      AUTH_ERROR_MESSAGES.NETWORK,
      aborted ? 408 : undefined,
    );
  } finally {
    clearTimeout(timeoutId);
  }

  const raw = await response.text();
  const data = parseJsonSafely(raw);

  if (response.status === 401) {
    if (auth) {
      throw new ApiClientError('UNAUTHORIZED', AUTH_ERROR_MESSAGES.UNAUTHORIZED, 401);
    }
    throw new ApiClientError(
      'INVALID_CREDENTIALS',
      AUTH_ERROR_MESSAGES.INVALID_CREDENTIALS,
      401,
    );
  }

  if (!response.ok) {
    if (response.status >= 500 || data == null) {
      throw new ApiClientError('SERVER', AUTH_ERROR_MESSAGES.SERVER, response.status);
    }

    if (!auth) {
      throw new ApiClientError(
        'INVALID_CREDENTIALS',
        AUTH_ERROR_MESSAGES.INVALID_CREDENTIALS,
        response.status,
      );
    }

    throw new ApiClientError('SERVER', AUTH_ERROR_MESSAGES.SERVER, response.status);
  }

  return data as T;
}

export const apiClient = {
  get<T = unknown>(url: string, options?: Omit<ApiRequestOptions, 'method' | 'body'>) {
    return request<T>(url, { ...options, method: 'GET' });
  },
  post<T = unknown>(
    url: string,
    body?: unknown,
    options?: Omit<ApiRequestOptions, 'method' | 'body'>,
  ) {
    return request<T>(url, { ...options, method: 'POST', body });
  },
};
