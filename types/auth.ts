/**
 * Authentication-related types
 */

export interface LoginCredentials {
  email: string;
  password: string;
  device_name?: string;
}

export type DashboardRoute = '/guard/dashboard' | '/office/office-portal';

export interface LaravelUser {
  user_id: number;
  first_name?: string;
  last_name?: string;
  email: string;
  role_id: number;
  status?: string;
}

export interface AuthResponse {
  success: boolean;
  message?: string;
  token?: string;
  token_type?: string;
  user?: User;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role?: 'admin' | 'user' | 'visitor' | 'guard' | 'office_staff';
  role_id?: number;
}

export interface UserProfile {
  user_id: number;
  email: string;
  first_name?: string;
  last_name?: string;
  role_id: number;
  status?: string;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export type AuthStatus = 'idle' | 'loading' | 'success' | 'error';
