import { API_BASE_URL } from '@/config/api';
import { authSessionService } from '@/services/auth-session';

export const AUTH_ERROR_MESSAGES = {
  INVALID_CREDENTIALS: 'Invalid email or password.',
  NETWORK:
    'Unable to connect to the server. Please check your internet connection and try again.',
  SERVER: 'Something went wrong. Please try again.',
  UNAUTHORIZED: 'Your session has expired. Please sign in again.',
  VALIDATION: 'The given data was invalid.',
} as const;

export type ApiErrorCode =
  | 'NETWORK'
  | 'UNAUTHORIZED'
  | 'INVALID_CREDENTIALS'
  | 'SERVER'
  | 'VALIDATION'
  | 'RATE_LIMITED'
  | 'UNKNOWN';

export class ApiClientError extends Error {
  readonly code: ApiErrorCode;
  readonly status?: number;
  readonly errors?: Record<string, string[]>;
  readonly responseCode?: string;

  constructor(
    code: ApiErrorCode,
    message: string,
    status?: number,
    errors?: Record<string, string[]>,
    responseCode?: string,
  ) {
    super(message);
    this.name = 'ApiClientError';
    this.code = code;
    this.status = status;
    this.errors = errors;
    this.responseCode = responseCode;
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

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
};

const extractMessage = (data: unknown, fallback: string): string => {
  const root = asRecord(data);
  if (!root) {
    return fallback;
  }

  if (typeof root.message === 'string' && root.message.trim()) {
    return root.message.trim();
  }

  const errors = asRecord(root.errors);
  if (errors) {
    for (const value of Object.values(errors)) {
      if (Array.isArray(value) && typeof value[0] === 'string' && value[0].trim()) {
        return value[0].trim();
      }
      if (typeof value === 'string' && value.trim()) {
        return value.trim();
      }
    }
  }

  return fallback;
};

const extractErrors = (data: unknown): Record<string, string[]> | undefined => {
  const root = asRecord(data);
  const errors = asRecord(root?.errors);
  if (!errors) {
    return undefined;
  }

  const normalized: Record<string, string[]> = {};
  for (const [key, value] of Object.entries(errors)) {
    if (Array.isArray(value)) {
      normalized[key] = value.map(String);
    } else if (typeof value === 'string') {
      normalized[key] = [value];
    }
  }

  return Object.keys(normalized).length > 0 ? normalized : undefined;
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
  const errors = extractErrors(data);
  const responseCode =
    typeof asRecord(data)?.code === 'string' ? String(asRecord(data)?.code) : undefined;

  if (response.status === 401) {
    if (auth) {
      throw new ApiClientError('UNAUTHORIZED', AUTH_ERROR_MESSAGES.UNAUTHORIZED, 401);
    }
    throw new ApiClientError(
      'INVALID_CREDENTIALS',
      extractMessage(data, AUTH_ERROR_MESSAGES.INVALID_CREDENTIALS),
      401,
      errors,
      responseCode,
    );
  }

  if (response.status === 429) {
    throw new ApiClientError(
      'RATE_LIMITED',
      extractMessage(data, 'Too many requests. Please try again later.'),
      429,
      errors,
      responseCode,
    );
  }

  if (!response.ok) {
    if (response.status >= 500 || data == null) {
      throw new ApiClientError(
        'SERVER',
        extractMessage(data, AUTH_ERROR_MESSAGES.SERVER),
        response.status,
        errors,
        responseCode,
      );
    }

    if (response.status === 422) {
      throw new ApiClientError(
        'VALIDATION',
        extractMessage(data, AUTH_ERROR_MESSAGES.VALIDATION),
        422,
        errors,
        responseCode,
      );
    }

    if (!auth) {
      throw new ApiClientError(
        response.status === 400 || response.status === 410 ? 'VALIDATION' : 'INVALID_CREDENTIALS',
        extractMessage(data, AUTH_ERROR_MESSAGES.INVALID_CREDENTIALS),
        response.status,
        errors,
        responseCode,
      );
    }

    throw new ApiClientError(
      'SERVER',
      extractMessage(data, AUTH_ERROR_MESSAGES.SERVER),
      response.status,
      errors,
      responseCode,
    );
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
