/**
 * User Service
 * Handles user profiles and role-based information
 */

import { supabase } from './supabase';

export interface UserProfile {
  user_id: number;
  email: string;
  role_id: number;
  role_name: string;
  first_name: string;
  last_name: string;
  guardData?: {
    guard_id: number;
    badge_number: string;
    station: string;
  };
  officeStaffData?: {
    staff_id: number;
    office_id: number;
    office_name: string;
    position: string;
  };
}

export const userService = {
  /**
   * Get user profile with role and related data
   */
  async getUserProfile(userId: string): Promise<UserProfile | null> {
    try {
      const { data, error } = await supabase
        .from('users')
        .select(`
          user_id,
          email,
          first_name,
          last_name,
          role_id,
          role:role_id (role_name),
          guard (*),
          office_staff (
            staff_id,
            position,
            office:office_id (office_id, office_name)
          )
        `)
        .eq('user_id', userId)
        .single();

      if (error) {
        console.error('Get user profile error:', error);
        return null;
      }

      // Format response
      const profile: UserProfile = {
        user_id: data.user_id,
        email: data.email,
        role_id: data.role_id,
        role_name: Array.isArray(data.role) && data.role.length > 0 
          ? data.role[0].role_name 
          : 'Unknown',
        first_name: data.first_name,
        last_name: data.last_name,
      };

      // Add guard data if guard
      if (data.guard && data.guard.length > 0) {
        profile.guardData = data.guard[0];
      }

      // Add office staff data if office staff
      if (data.office_staff && data.office_staff.length > 0) {
        const staffData = data.office_staff[0];
        const officeInfo = Array.isArray(staffData.office) 
          ? (staffData.office[0] as any)
          : (staffData.office as any);
        
        profile.officeStaffData = {
          staff_id: staffData.staff_id,
          office_id: officeInfo?.office_id || 0,
          office_name: officeInfo?.office_name || 'Unknown',
          position: staffData.position,
        };
      }

      return profile;
    } catch (error) {
      console.error('Get user profile error:', error);
      return null;
    }
  },

  /**
   * Determine which dashboard user should go to based on role
   */
  getRouteForRole(roleId: number): string {
    switch (roleId) {
      case 1: // Guard
        return '/guard/dashboard';
      case 2: // Office Staff
        return '/office/office-portal';
      case 3: // Admin
        return '/admin/dashboard';
      default:
        return '/';
    }
  },

  /**
   * Get all guards
   */
  async getGuards() {
    try {
      const { data, error } = await supabase
        .from('guard')
        .select('*, user:user_id (email, first_name, last_name)');

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Get guards error:', error);
      return [];
    }
  },

  /**
   * Get all office staff for an office
   */
  async getOfficeStaff(officeId: number) {
    try {
      const { data, error } = await supabase
        .from('office_staff')
        .select('*, user:user_id (email, first_name, last_name)')
        .eq('office_id', officeId);

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Get office staff error:', error);
      return [];
    }
  },

  /**
   * Create a new user (admin only)
   */
  async createUser(userData: {
    email: string;
    password: string;
    firstName: string;
    lastName: string;
    roleId: number;
  }) {
    try {
      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: userData.email,
        password: userData.password,
      });

      if (authError) throw authError;

      // Create user profile
      const { data: userProfile, error: profileError } = await supabase
        .from('users')
        .insert([
          {
            user_id: authData.user?.id.replace(/-/g, '').slice(0, 10), // Convert UUID to int (simplified)
            email: userData.email,
            first_name: userData.firstName,
            last_name: userData.lastName,
            role_id: userData.roleId,
            created_at: new Date().toISOString(),
            status: 'active',
          },
        ])
        .select();

      if (profileError) throw profileError;

      return { authUser: authData.user, userProfile: userProfile[0] };
    } catch (error) {
      console.error('Create user error:', error);
      throw error;
    }
  },
};
