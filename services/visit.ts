/**
 * Visit Service
 * Handles visit registration and tracking
 */

import { supabase } from './supabase';

export const visitService = {
  /**
   * Create a new visit
   */
  async createVisit(visitData: {
    visitorId: number;
    guardUserId: number;
    visitTypeId: number;
    primaryOfficeId: number;
    purposeReason?: string;
    qrToken?: string;
  }) {
    try {
      const qrToken = visitData.qrToken || `VIS-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

      const { data, error } = await supabase
        .from('visit')
        .insert([
          {
            visitor_id: visitData.visitorId,
            guard_user_id: visitData.guardUserId,
            visit_type_id: visitData.visitTypeId,
            primary_office_id: visitData.primaryOfficeId,
            purpose_reason: visitData.purposeReason,
            qr_token: qrToken,
            entry_time: new Date().toISOString(),
          },
        ])
        .select();

      if (error) throw error;
      return { ...data[0], qr_token: qrToken };
    } catch (error) {
      console.error('Create visit error:', error);
      throw error;
    }
  },

  /**
   * Get visit by QR token (used when scanning)
   */
  async getVisitByQRToken(qrToken: string) {
    try {
      const { data, error } = await supabase
        .from('visit')
        .select(`
          visit_id,
          qr_token,
          entry_time,
          exit_time,
          primary_office_id,
          visit_type_id,
          purpose_reason,
          visitor:visitor_id (
            visitor_id,
            first_name,
            last_name,
            contact_no,
            pass_number
          ),
          primary_office:primary_office_id (
            office_id,
            office_name,
            building,
            floor
          ),
          visit_type:visit_type_id (
            visit_type_name
          )
        `)
        .eq('qr_token', qrToken)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Get visit by QR token error:', error);
      return null;
    }
  },

  /**
   * Get visit by ID
   */
  async getVisit(visitId: number) {
    try {
      const { data, error } = await supabase
        .from('visit')
        .select(`
          *,
          visitor:visitor_id (*),
          primary_office:primary_office_id (*)
        `)
        .eq('visit_id', visitId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Get visit error:', error);
      throw error;
    }
  },

  /**
   * Update visit exit time
   */
  async exitVisit(visitId: number, exitStatusId: number = 1) {
    try {
      const now = new Date();
      const { data: visitData } = await supabase
        .from('visit')
        .select('entry_time')
        .eq('visit_id', visitId)
        .single();

      const entryTime = visitData ? new Date(visitData.entry_time) : now;
      const durationMinutes = Math.floor((now.getTime() - entryTime.getTime()) / 60000);

      const { data, error } = await supabase
        .from('visit')
        .update({
          exit_time: now.toISOString(),
          duration_minutes: durationMinutes,
          exit_status_id: exitStatusId,
        })
        .eq('visit_id', visitId)
        .select();

      if (error) throw error;
      return data[0];
    } catch (error) {
      console.error('Exit visit error:', error);
      throw error;
    }
  },

  /**
   * Get visits by guard user ID
   */
  async getVisitsByGuard(guardUserId: number, limit: number = 50) {
    try {
      const { data, error } = await supabase
        .from('visit')
        .select(`
          visit_id,
          qr_token,
          entry_time,
          exit_time,
          primary_office_id,
          visitor:visitor_id (first_name, last_name),
          primary_office:primary_office_id (office_name)
        `)
        .eq('guard_user_id', guardUserId)
        .order('entry_time', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Get visits by guard error:', error);
      throw error;
    }
  },

  /**
   * Get all visits for today
   */
  async getTodayVisits(officeId?: number) {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      let query = supabase
        .from('visit')
        .select(`
          visit_id,
          visitor:visitor_id (first_name, last_name),
          entry_time,
          exit_time,
          primary_office_id
        `)
        .gte('entry_time', today.toISOString());

      if (officeId) {
        query = query.eq('primary_office_id', officeId);
      }

      const { data, error } = await query.order('entry_time', { ascending: false });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Get today visits error:', error);
      throw error;
    }
  },
};
