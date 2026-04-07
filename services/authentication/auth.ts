/**
 * Authentication Service
 * Authenticates users against Supabase database
 * Password verification is done via SQL function
 */

import { ApiError, AuthResponse, DashboardRoute, LoginCredentials } from '@/types/auth';
import { supabase } from '../database/supabase';

class AuthService {
  /**
   * Sign in user with email and password using Supabase
   */
  async login(credentials: LoginCredentials): Promise<AuthResponse & { userProfile?: any; dashboard: DashboardRoute }> {
    try {
      console.log('🔐 Logging in user:', credentials.email);

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

      if (user.status !== 'active') {
        console.error('❌ User account not active:', credentials.email);
        throw {
          code: 'LOGIN_FAILED',
          message: 'User account is not active. Contact admin.',
        } as ApiError;
      }

      console.log('✅ Login successful for:', user.email);
      console.log('🔐 User role_id:', user.role_id);

      if (user.role_id === 1) {
        console.warn('⚠️ Admin users must login via the web portal');
        throw {
          code: 'ADMIN_NOT_ALLOWED',
          message: 'Admin users must login via the web portal. This is a mobile app for Guard and Office Staff only.',
        } as ApiError;
      }

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
   * Map role ID to dashboard route
   */
  private getRouteForRole(roleId: number): DashboardRoute {
    if (roleId === 2) {
      return '/guard/dashboard';
    } else if (roleId === 3) {
      return '/office/office-portal';
    }
    return '/guard/dashboard';
  }

  /**
   * Handle authentication errors
   */
  private handleError(error: any): ApiError {
    if (error.code) {
      return error;
    }

    return {
      code: 'AUTH_ERROR',
      message: error.message || 'An authentication error occurred',
    };
  }
}

export const authService = new AuthService();
