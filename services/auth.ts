/**
 * Authentication Service
 * Authenticates users against Supabase database
 * Password verification is done via SQL function
 */

import { ApiError, AuthResponse, DashboardRoute, LoginCredentials } from '@/types/auth';
import { supabase } from './supabase';

class AuthService {
  /**
   * Sign in user with email and password using Supabase
   * Also fetches user role and profile information
   */
  async login(credentials: LoginCredentials): Promise<AuthResponse & { userProfile?: any; dashboard: DashboardRoute }> {
    try {
      console.log('🔐 Logging in user:', credentials.email);

      // Call Supabase RPC function to verify password and get user
      const { data: authResult, error: rpcError } = await supabase.rpc('verify_user_login', {
        email_input: credentials.email,
        password_input: credentials.password,
      });

      if (rpcError) {
        console.error('❌ RPC error:', rpcError);
        throw {
          code: 'LOGIN_FAILED',
          message: 'Authentication service unavailable. Please contact admin.',
        } as ApiError;
      }

      if (!authResult || authResult.length === 0) {
        console.error('❌ User not found or invalid credentials:', credentials.email);
        throw {
          code: 'LOGIN_FAILED',
          message: 'Invalid email or password',
        } as ApiError;
      }

      const user = authResult[0];

      console.log('🔍 Password verification result:', user.success);

      if (!user.success) {
        console.error('❌ Password mismatch for:', credentials.email);
        throw {
          code: 'LOGIN_FAILED',
          message: 'Invalid email or password',
        } as ApiError;
      }

      // Check if user is active
      if (user.status !== 'active') {
        console.error('❌ User account not active:', credentials.email);
        throw {
          code: 'LOGIN_FAILED',
          message: 'User account is not active. Contact admin.',
        } as ApiError;
      }

      console.log('✅ Login successful for:', user.email);
      console.log('🔐 User role_id:', user.role_id);

      // Check if user is allowed on mobile app (only Guard and Office Staff)
      if (user.role_id === 1) {
        console.warn('⚠️ Admin users must login via the web portal');
        throw {
          code: 'ADMIN_NOT_ALLOWED',
          message: 'Admin users must login via the web portal. This is a mobile app for Guard and Office Staff only.',
        } as ApiError;
      }

      // Determine dashboard route based on role_id
      const dashboard = this.getRouteForRole(user.role_id);

      return {
        success: true,
        message: 'Login successful',
        token: `token_${user.user_id}_${Date.now()}`,
        user: {
          id: String(user.user_id),
          email: user.email,
          name: `${user.first_name || ''} ${user.last_name || ''}`.trim(),
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
        dashboard,
      };
    } catch (error) {
      console.error('❌ Login error:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Helper: Get dashboard route based on role_id
   * Mobile app only supports: 2 = GUARD, 3 = OFFICE_STAFF
   * Admins (1) use the web portal
   */
  private getRouteForRole(roleId: number | undefined): DashboardRoute {
    switch (roleId) {
      case 2:
        return '/guard/dashboard';
      case 3:
        return '/office/office-portal';
      default:
        return '/guard/dashboard';
    }
  }

  /**
   * Request password reset link via Supabase
   */
  async requestPasswordReset(email: string): Promise<{ success: boolean; message: string }> {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: 'exp://localhost:8081',
      });

      if (error) {
        throw {
          code: 'RESET_FAILED',
          message: error.message || 'Failed to send reset link',
        } as ApiError;
      }

      return {
        success: true,
        message: 'Password reset link sent to your email',
      };
    } catch (error) {
      console.error('Password reset error:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Sign out user from Supabase
   */
  async logout(): Promise<void> {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (error) {
      console.error('Logout error:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Get current session
   */
  async getSession() {
    try {
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      return data.session;
    } catch (error) {
      console.error('Get session error:', error);
      return null;
    }
  }

  /**
   * Get current user
   */
  async getCurrentUser() {
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;
      return data.user;
    } catch (error) {
      console.error('Get user error:', error);
      return null;
    }
  }

  /**
   * Handle API errors
   */
  private handleError(error: unknown): ApiError {
    if (error instanceof Error) {
      return {
        code: 'AUTH_ERROR',
        message: error.message,
      };
    }

    if (typeof error === 'object' && error !== null && 'code' in error) {
      return error as ApiError;
    }

    return {
      code: 'UNKNOWN_ERROR',
      message: 'An unexpected error occurred',
    };
  }
}

// Export singleton instance
export const authService = new AuthService();
