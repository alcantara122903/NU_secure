/**
 * Authentication Service
 * Authenticates mobile users against the Laravel Sanctum API.
 */

import { API_ENDPOINTS } from '@/config/api';
import {
  AUTH_ERROR_MESSAGES,
  ApiClientError,
  apiClient,
} from '@/services/api';
import { authSessionService } from '@/services/auth-session';
import type {
  AuthResponse,
  DashboardRoute,
  LaravelUser,
  LoginCredentials,
  User,
  UserProfile,
} from '@/types/auth';

export const MOBILE_DEVICE_NAME = 'NU-Secure Mobile';

export class AuthError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'AuthError';
    this.code = code;
  }
}

type LaravelLoginResponse = {
  success?: boolean;
  message?: string;
  token_type?: string;
  token?: string;
  user?: unknown;
};

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
};

export function extractLaravelUser(payload: unknown): LaravelUser | null {
  const root = asRecord(payload);
  if (!root) {
    return null;
  }

  const nestedUser = asRecord(root.user);
  const nestedData = asRecord(root.data);
  const candidate = nestedUser ?? nestedData ?? root;

  const userId = candidate.user_id ?? candidate.id;
  const email = candidate.email;
  const roleId = candidate.role_id;

  if (userId == null || email == null || roleId == null) {
    return null;
  }

  return {
    user_id: Number(userId),
    first_name: candidate.first_name != null ? String(candidate.first_name) : undefined,
    last_name: candidate.last_name != null ? String(candidate.last_name) : undefined,
    email: String(email),
    role_id: Number(roleId),
    status: candidate.status != null ? String(candidate.status) : undefined,
  };
}

export function mapLaravelUser(user: LaravelUser): { user: User; userProfile: UserProfile } {
  const firstName = user.first_name?.trim() ?? '';
  const lastName = user.last_name?.trim() ?? '';

  return {
    user: {
      id: String(user.user_id),
      email: user.email,
      name: `${firstName} ${lastName}`.trim() || user.email,
      role_id: user.role_id,
    },
    userProfile: {
      user_id: user.user_id,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      role_id: user.role_id,
      status: user.status,
    },
  };
}

export function getDashboardRouteForRole(roleId: number): DashboardRoute {
  if (roleId === 3) {
    return '/office/office-portal';
  }
  return '/guard/dashboard';
}

class AuthService {
  async login(
    credentials: LoginCredentials,
  ): Promise<AuthResponse & { userProfile: UserProfile; dashboard: DashboardRoute }> {
    try {
      const data = await apiClient.post<LaravelLoginResponse>(
        API_ENDPOINTS.LOGIN,
        {
          email: credentials.email,
          password: credentials.password,
          device_name: credentials.device_name ?? MOBILE_DEVICE_NAME,
        },
        { auth: false },
      );

      const laravelUser = extractLaravelUser(data);
      if (!data?.success || !data.token || !laravelUser) {
        throw new AuthError('LOGIN_FAILED', AUTH_ERROR_MESSAGES.INVALID_CREDENTIALS);
      }

      const statusNorm = String(laravelUser.status ?? '').trim().toLowerCase();
      if (statusNorm && statusNorm !== 'active') {
        throw new AuthError(
          'LOGIN_FAILED',
          'User account is not active. Contact admin.',
        );
      }

      if (laravelUser.role_id === 1) {
        await this.revokeTokenQuietly(data.token);
        throw new AuthError(
          'ADMIN_NOT_ALLOWED',
          'Admin users must login via the web portal. This is a mobile app for Guard and Office Staff only.',
        );
      }

      if (laravelUser.role_id !== 2 && laravelUser.role_id !== 3) {
        await this.revokeTokenQuietly(data.token);
        throw new AuthError(
          'LOGIN_FAILED',
          'Your account is not authorized to use the mobile app.',
        );
      }

      let resolvedUser = laravelUser;
      const mapped = mapLaravelUser(resolvedUser);
      authSessionService.setSession({
        token: data.token,
        user: mapped.user,
        userProfile: mapped.userProfile,
      });

      try {
        resolvedUser = await this.getCurrentUser(laravelUser);
      } catch (error) {
        if (error instanceof ApiClientError && error.code === 'UNAUTHORIZED') {
          authSessionService.clearSession();
          throw new AuthError('UNAUTHORIZED', AUTH_ERROR_MESSAGES.UNAUTHORIZED);
        }
      }

      const finalMapped = mapLaravelUser(resolvedUser);
      authSessionService.setSession({
        token: data.token,
        user: finalMapped.user,
        userProfile: finalMapped.userProfile,
      });

      return {
        success: true,
        message: 'Login successful',
        token: data.token,
        user: finalMapped.user,
        userProfile: finalMapped.userProfile,
        dashboard: getDashboardRouteForRole(resolvedUser.role_id),
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getCurrentUser(fallback?: LaravelUser): Promise<LaravelUser> {
    const data = await apiClient.get(API_ENDPOINTS.USER, { auth: true });
    const user = extractLaravelUser(data) ?? fallback ?? null;
    if (!user) {
      throw new AuthError('SERVER', AUTH_ERROR_MESSAGES.SERVER);
    }
    return user;
  }

  async logout(tokenOverride?: string): Promise<void> {
    const token = tokenOverride ?? authSessionService.getToken();
    if (!token) {
      return;
    }

    try {
      await apiClient.post(
        API_ENDPOINTS.LOGOUT,
        {},
        { auth: true, token, timeoutMs: 8000 },
      );
    } catch {
      // Local session is still cleared by the caller.
    }
  }

  async forgotPassword(email: string): Promise<{ success: boolean; message: string }> {
    try {
      const data = await apiClient.post<{ success?: boolean; message?: string }>(
        API_ENDPOINTS.FORGOT_PASSWORD,
        { email: email.toLowerCase().trim() },
        { auth: false },
      );

      return {
        success: data?.success !== false,
        message:
          data?.message?.trim() ||
          'If an account exists for this email, password reset instructions have been sent.',
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async resetPassword(input: {
    email: string;
    token: string;
    password: string;
    passwordConfirmation: string;
  }): Promise<{ success: boolean; message: string }> {
    try {
      const data = await apiClient.post<{ success?: boolean; message?: string }>(
        API_ENDPOINTS.RESET_PASSWORD,
        {
          email: input.email.toLowerCase().trim(),
          token: input.token,
          password: input.password,
          password_confirmation: input.passwordConfirmation,
        },
        { auth: false },
      );

      if (data?.success === false) {
        throw new AuthError(
          'RESET_FAILED',
          data.message?.trim() || 'Unable to reset password. Please try again.',
        );
      }

      return {
        success: true,
        message:
          data?.message?.trim() ||
          'Your password has been reset successfully. You can now sign in using your new password.',
      };
    } catch (error) {
      throw this.handleError(error);
    }
  }

  private async revokeTokenQuietly(token: string): Promise<void> {
    try {
      await apiClient.post(
        API_ENDPOINTS.LOGOUT,
        {},
        { auth: true, token, timeoutMs: 8000 },
      );
    } catch {
      // Ignore revoke failures for rejected roles.
    }
  }

  private handleError(error: unknown): AuthError {
    if (error instanceof AuthError) {
      return error;
    }

    if (error instanceof ApiClientError) {
      return new AuthError(error.code, error.message);
    }

    return new AuthError('AUTH_ERROR', AUTH_ERROR_MESSAGES.SERVER);
  }
}

export const authService = new AuthService();
