/**
 * Authentication-related types
 */

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthResponse {
  success: boolean;
  message?: string;
  token?: string;
  user?: User;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user' | 'visitor';
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export type AuthStatus = 'idle' | 'loading' | 'success' | 'error';
