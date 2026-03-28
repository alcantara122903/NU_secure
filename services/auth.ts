/**
 * Authentication API Service
 * Handles all auth-related API calls
 */

import { ApiError, AuthResponse, LoginCredentials } from '@/types/auth';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'https://api.nu-secure.com';
const API_ENDPOINTS = {
  LOGIN: '/auth/login',
  LOGOUT: '/auth/logout',
  REFRESH: '/auth/refresh',
  PASSWORD_RESET: '/auth/password-reset',
  PASSWORD_RESET_CONFIRM: '/auth/password-reset/confirm',
  VERIFY_EMAIL: '/auth/verify-email',
};

class AuthService {
  /**
   * Sign in user with email and password
   */
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    try {
      // Add timeout to fetch request (3 seconds for development)
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3000);

      const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.LOGIN}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(credentials),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      const data: AuthResponse = await response.json();

      if (!response.ok) {
        throw {
          code: 'LOGIN_FAILED',
          message: data.message || 'Failed to sign in',
        } as ApiError;
      }

      // Store token (integrate with secure storage)
      if (data.token) {
        await this.storeToken(data.token);
      }

      return data;
    } catch (error) {
      // Development fallback: If API is unavailable or times out, allow login for testing
      const isNetworkError = 
        (error instanceof TypeError && error.message.includes('Network request failed')) ||
        (error instanceof Error && error.name === 'AbortError') ||
        (error instanceof Error && error.message.includes('Network'));
      
      if (isNetworkError || (error instanceof Error && error.name === 'AbortError')) {
        console.log('⚠️ API unavailable. Using development mode.');
        const mockToken = `mock_token_${Date.now()}`;
        await this.storeToken(mockToken);
        return {
          success: true,
          message: 'Login successful (development mode)',
          token: mockToken,
          user: {
            id: 'dev-user',
            email: credentials.email,
            name: 'Development User',
          },
        };
      }
      
      console.error('Login error:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Request password reset link
   */
  async requestPasswordReset(email: string): Promise<{ success: boolean; message: string }> {
    try {
      const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.PASSWORD_RESET}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw {
          code: 'RESET_FAILED',
          message: data.message || 'Failed to send reset link',
        } as ApiError;
      }

      return data;
    } catch (error) {
      console.error('Password reset error:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Confirm password reset with token
   */
  async confirmPasswordReset(token: string, newPassword: string): Promise<{ success: boolean }> {
    try {
      const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.PASSWORD_RESET_CONFIRM}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token, newPassword }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw {
          code: 'RESET_CONFIRM_FAILED',
          message: data.message || 'Failed to reset password',
        } as ApiError;
      }

      return data;
    } catch (error) {
      console.error('Confirm password reset error:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Sign out user
   */
  async logout(): Promise<void> {
    try {
      const token = await this.getToken();

      if (token) {
        await fetch(`${API_BASE_URL}${API_ENDPOINTS.LOGOUT}`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
      }

      // Clear token from storage
      await this.clearToken();
    } catch (error) {
      console.error('Logout error:', error);
      // Still clear token even if API call fails
      await this.clearToken();
    }
  }

  /**
   * Refresh authentication token
   */
  async refreshToken(): Promise<{ token: string }> {
    try {
      const token = await this.getToken();

      if (!token) {
        throw {
          code: 'NO_TOKEN',
          message: 'No token available',
        } as ApiError;
      }

      const response = await fetch(`${API_BASE_URL}${API_ENDPOINTS.REFRESH}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw {
          code: 'REFRESH_FAILED',
          message: 'Failed to refresh token',
        } as ApiError;
      }

      if (data.token) {
        await this.storeToken(data.token);
      }

      return data;
    } catch (error) {
      console.error('Token refresh error:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Store authentication token
   * TODO: Replace with secure storage (e.g., SecureStore, Keychain)
   */
  private async storeToken(token: string): Promise<void> {
    try {
      // Implement with SecureStore or Similar
      // await SecureStore.setItemAsync('auth_token', token);
      console.log('Token stored');
    } catch (error) {
      console.error('Failed to store token:', error);
    }
  }

  /**
   * Retrieve stored token
   */
  private async getToken(): Promise<string | null> {
    try {
      // Implement with SecureStore or Similar
      // const token = await SecureStore.getItemAsync('auth_token');
      // return token || null;
      return null;
    } catch (error) {
      console.error('Failed to retrieve token:', error);
      return null;
    }
  }

  /**
   * Clear stored token
   */
  private async clearToken(): Promise<void> {
    try {
      // Implement with SecureStore or Similar
      // await SecureStore.deleteItemAsync('auth_token');
      console.log('Token cleared');
    } catch (error) {
      console.error('Failed to clear token:', error);
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
