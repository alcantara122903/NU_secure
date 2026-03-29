/**
 * Office Service
 * Handles office-related queries
 */

import { supabase } from './supabase';

export const officeService = {
  /**
   * Get all offices
   */
  async getOffices() {
    try {
      const { data, error } = await supabase
        .from('office')
        .select('*')
        .eq('is_active', true)
        .order('office_name');

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Get offices error:', error);
      throw error;
    }
  },

  /**
   * Get office by ID with full details
   */
  async getOffice(officeId: number) {
    try {
      const { data, error } = await supabase
        .from('office')
        .select('*')
        .eq('office_id', officeId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Get office error:', error);
      throw error;
    }
  },

  /**
   * Get office staff
   */
  async getOfficeStaff(officeId: number) {
    try {
      const { data, error } = await supabase
        .from('office_staff')
        .select(`
          staff_id,
          position,
          user:user_id (first_name, last_name, email)
        `)
        .eq('office_id', officeId);

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Get office staff error:', error);
      throw error;
    }
  },

  /**
   * Get office statistics
   */
  async getOfficeStats(officeId: number) {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Today's visitors
      const { count: todayVisitors } = await supabase
        .from('office_scan')
        .select('*', { count: 'exact' })
        .eq('office_id', officeId)
        .gte('scan_time', today.toISOString());

      // Pending scans
      const { count: pendingScans } = await supabase
        .from('office_expectation')
        .select('*', { count: 'exact' })
        .eq('office_id', officeId)
        .eq('expectation_status_id', 1);

      return {
        todayVisitors: todayVisitors || 0,
        pendingScans: pendingScans || 0,
      };
    } catch (error) {
      console.error('Get office stats error:', error);
      return { todayVisitors: 0, pendingScans: 0 };
    }
  },
};
