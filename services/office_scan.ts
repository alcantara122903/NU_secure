/**
 * Office Scan Service
 * Handles QR scanning operations at offices
 */

import { supabase } from './supabase';

export const officeScanService = {
  /**
   * Record a scan at an office (Main function for Office Portal)
   */
  async recordScan(scanData: {
    visitId: number;
    officeId: number;
    scannedByUserId: number;
    validationStatusId?: number;
    remarks?: string;
  }) {
    try {
      const { data, error } = await supabase
        .from('office_scan')
        .insert([
          {
            visit_id: scanData.visitId,
            office_id: scanData.officeId,
            scanned_by_user_id: scanData.scannedByUserId,
            scan_time: new Date().toISOString(),
            validation_status_id: scanData.validationStatusId || 1, // 1 = Valid
            remarks: scanData.remarks,
          },
        ])
        .select();

      if (error) throw error;

      // Update office_expectation status to "Arrived"
      await supabase
        .from('office_expectation')
        .update({ expectation_status_id: 2 }) // 2 = Arrived
        .match({ visit_id: scanData.visitId, office_id: scanData.officeId });

      return data[0];
    } catch (error) {
      console.error('Record scan error:', error);
      throw error;
    }
  },

  /**
   * Get scan details
   */
  async getScan(scanId: number) {
    try {
      const { data, error } = await supabase
        .from('office_scan')
        .select(`
          *,
          visit:visit_id (*),
          office:office_id (*),
          scanned_by_user:scanned_by_user_id (first_name, last_name)
        `)
        .eq('scan_id', scanId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Get scan error:', error);
      throw error;
    }
  },

  /**
   * Get all scans for an office today
   */
  async getOfficeTodayScans(officeId: number) {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const { data, error } = await supabase
        .from('office_scan')
        .select(`
          scan_id,
          scan_time,
          remarks,
          visit:visit_id (
            visitor:visitor_id (first_name, last_name),
            qr_token,
            entry_time
          ),
          scanned_by_user:scanned_by_user_id (first_name, last_name)
        `)
        .eq('office_id', officeId)
        .gte('scan_time', today.toISOString())
        .order('scan_time', { ascending: false });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Get office today scans error:', error);
      throw error;
    }
  },

  /**
   * Get scans by visitor
   */
  async getScansByVisitor(visitorId: number) {
    try {
      const { data, error } = await supabase
        .from('office_scan')
        .select(`
          *,
          office:office_id (office_name, building, floor),
          scanned_by_user:scanned_by_user_id (first_name, last_name)
        `)
        .eq('visit_id', visitorId)
        .order('scan_time', { ascending: false });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Get scans by visitor error:', error);
      throw error;
    }
  },

  /**
   * Flag a scan as suspicious
   */
  async flagScan(scanId: number, remarks: string) {
    try {
      const { data, error } = await supabase
        .from('office_scan')
        .update({
          validation_status_id: 3, // 3 = Suspicious/Flagged
          remarks,
        })
        .eq('scan_id', scanId)
        .select();

      if (error) throw error;

      // Create notification for admin
      const scan = await this.getScan(scanId);
      if (scan) {
        await supabase.from('notification').insert([
          {
            scan_id: scanId,
            notif_type_id: 3, // Alert type
            message: `Suspicious scan flagged: ${remarks}`,
            sent_at: new Date().toISOString(),
          },
        ]);
      }

      return data[0];
    } catch (error) {
      console.error('Flag scan error:', error);
      throw error;
    }
  },

  /**
   * Get pending scans (not yet scanned at expected offices)
   */
  async getPendingScans(officeId: number) {
    try {
      const { data, error } = await supabase
        .from('office_expectation')
        .select(`
          expectation_id,
          visit:visit_id (
            visitor:visitor_id (first_name, last_name),
            entry_time,
            qr_token
          ),
          expected_order
        `)
        .eq('office_id', officeId)
        .eq('expectation_status_id', 1) // 1 = Expected (not yet arrived)
        .order('expected_order', { ascending: true });

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('Get pending scans error:', error);
      throw error;
    }
  },
};
