/**
 * Visitor Service
 * Handles visitor-related database operations
 */

import { supabase } from './supabase';

export const visitorService = {
  /**
   * Create a new visitor
   */
  async createVisitor(visitorData: {
    firstName: string;
    lastName: string;
    contactNo: string;
    passNumber?: string;
  }) {
    try {
      const { data, error } = await supabase
        .from('visitor')
        .insert([
          {
            first_name: visitorData.firstName,
            last_name: visitorData.lastName,
            contact_no: visitorData.contactNo,
            pass_number: visitorData.passNumber || `PASS-${Date.now()}`,
            created_at: new Date().toISOString(),
          },
        ])
        .select();

      if (error) throw error;
      return data[0];
    } catch (error) {
      console.error('Create visitor error:', error);
      throw error;
    }
  },

  /**
   * Get visitor by ID
   */
  async getVisitor(visitorId: number) {
    try {
      const { data, error } = await supabase
        .from('visitor')
        .select('*')
        .eq('visitor_id', visitorId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Get visitor error:', error);
      throw error;
    }
  },

  /**
   * Get visitor by pass number (for QR scanning)
   */
  async getVisitorByPassNumber(passNumber: string) {
    try {
      const { data, error } = await supabase
        .from('visitor')
        .select('*')
        .eq('pass_number', passNumber)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Get visitor by pass number error:', error);
      throw error;
    }
  },

  /**
   * Create contractor visitor
   */
  async createContractor(visitorId: number, contractorData: {
    companyName: string;
    purpose: string;
    contactPerson: string;
    status?: string;
  }) {
    try {
      const { data, error } = await supabase
        .from('contractor')
        .insert([
          {
            visitor_id: visitorId,
            company_name: contractorData.companyName,
            purpose: contractorData.purpose,
            contact_person: contractorData.contactPerson,
            status: contractorData.status || 'active',
            created_at: new Date().toISOString(),
          },
        ])
        .select();

      if (error) throw error;
      return data[0];
    } catch (error) {
      console.error('Create contractor error:', error);
      throw error;
    }
  },

  /**
   * Create enrollee visitor
   */
  async createEnrollee(visitorId: number) {
    try {
      const { data, error } = await supabase
        .from('enrollee')
        .insert([
          {
            visitor_id: visitorId,
            status: 'active',
            updated_at: new Date().toISOString(),
          },
        ])
        .select();

      if (error) throw error;
      return data[0];
    } catch (error) {
      console.error('Create enrollee error:', error);
      throw error;
    }
  },

  /**
   * Get all visitors with pagination
   */
  async getVisitors(page: number = 1, limit: number = 20) {
    try {
      const offset = (page - 1) * limit;
      const { data, error, count } = await supabase
        .from('visitor')
        .select('*', { count: 'exact' })
        .range(offset, offset + limit - 1)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return { data, total: count };
    } catch (error) {
      console.error('Get visitors error:', error);
      throw error;
    }
  },
};
