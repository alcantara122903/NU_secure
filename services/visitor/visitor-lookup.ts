/**
 * Visitor Lookup Service
 * Handles checking if a visitor already exists in the system
 * 
 * Purpose: Prevent duplicate visitor records when same person registers with different visit types
 * Example: Person registers as normal visitor (visit_type_id=3), then comes back as enrollee (visit_type_id=1)
 * 
 * Solution: Check if visitor exists by name + contact, reuse existing visitor_id
 */

import { supabase } from '../supabase';

export interface VisitorSearchCriteria {
  firstName: string;
  lastName: string;
  contactNo?: string;
}

export interface ExistingVisitor {
  visitor_id: number;
  pass_number: string;
  control_number: string;
  first_name: string;
  last_name: string;
  contact_no: string;
  address_id: number | null;
}

export const visitorLookupService = {
  /**
   * Find existing visitor by first name, last name, and contact number
   * Returns visitor record if found, null otherwise
   * 
   * Used to prevent duplicate visitor records when same person registers multiple times
   */
  async findExistingVisitor(criteria: VisitorSearchCriteria): Promise<ExistingVisitor | null> {
    try {
      console.log('\n🔍 Searching for existing visitor record...');
      console.log(`   First Name: ${criteria.firstName}`);
      console.log(`   Last Name: ${criteria.lastName}`);
      console.log(`   Contact: ${criteria.contactNo || 'N/A'}`);

      // Build query with required fields
      let query = supabase
        .from('visitor')
        .select('*')
        .ilike('first_name', criteria.firstName)
        .ilike('last_name', criteria.lastName);

      // Only add contact filter if provided (optional)
      if (criteria.contactNo && criteria.contactNo.trim()) {
        query = query.eq('contact_no', criteria.contactNo);
      }

      const { data: existingVisitors, error } = await query;

      if (error) {
        console.error('❌ Error searching for visitor:', error);
        return null;
      }

      // Found existing visitor(s)
      if (existingVisitors && existingVisitors.length > 0) {
        const visitor = existingVisitors[0];
        console.log(`✅ Found existing visitor!`);
        console.log(`   Visitor ID: ${visitor.visitor_id}`);
        console.log(`   Name: ${visitor.first_name} ${visitor.last_name}`);
        console.log(`   Contact: ${visitor.contact_no}`);
        console.log(`   Pass Number: ${visitor.pass_number}`);
        console.log(`   Address ID: ${visitor.address_id}`);

        return {
          visitor_id: visitor.visitor_id,
          pass_number: visitor.pass_number,
          control_number: visitor.control_number,
          first_name: visitor.first_name,
          last_name: visitor.last_name,
          contact_no: visitor.contact_no,
          address_id: visitor.address_id,
        };
      }

      console.log('✅ No existing visitor found');
      return null;
    } catch (error) {
      console.error('❌ Visitor lookup error:', error);
      return null;
    }
  },

  /**
   * Find visitors by first name only (less strict matching)
   * Useful for checking similar names
   */
  async findVisitorsByFirstName(firstName: string): Promise<ExistingVisitor[]> {
    try {
      console.log(`\n🔍 Searching for visitors with first name: ${firstName}`);

      const { data: visitors, error } = await supabase
        .from('visitor')
        .select('*')
        .ilike('first_name', `%${firstName}%`);

      if (error) {
        console.error('❌ Error searching by first name:', error);
        return [];
      }

      if (visitors && visitors.length > 0) {
        console.log(`✅ Found ${visitors.length} visitor(s) with similar first name`);
        return visitors.map(v => ({
          visitor_id: v.visitor_id,
          pass_number: v.pass_number,
          control_number: v.control_number,
          first_name: v.first_name,
          last_name: v.last_name,
          contact_no: v.contact_no,
          address_id: v.address_id,
        }));
      }

      return [];
    } catch (error) {
      console.error('❌ Error in findVisitorsByFirstName:', error);
      return [];
    }
  },

  /**
   * Find visitors by contact number
   * Useful for quick lookup by phone number
   */
  async findVisitorByContact(contactNo: string): Promise<ExistingVisitor | null> {
    try {
      console.log(`\n🔍 Searching for visitor with contact: ${contactNo}`);

      const { data: visitors, error } = await supabase
        .from('visitor')
        .select('*')
        .eq('contact_no', contactNo);

      if (error) {
        console.error('❌ Error searching by contact:', error);
        return null;
      }

      if (visitors && visitors.length > 0) {
        const visitor = visitors[0];
        console.log(`✅ Found visitor by contact number`);
        console.log(`   Visitor ID: ${visitor.visitor_id}`);
        console.log(`   Name: ${visitor.first_name} ${visitor.last_name}`);

        return {
          visitor_id: visitor.visitor_id,
          pass_number: visitor.pass_number,
          control_number: visitor.control_number,
          first_name: visitor.first_name,
          last_name: visitor.last_name,
          contact_no: visitor.contact_no,
          address_id: visitor.address_id,
        };
      }

      console.log('✅ No visitor found with this contact number');
      return null;
    } catch (error) {
      console.error('❌ Error in findVisitorByContact:', error);
      return null;
    }
  },

  /**
   * Get visitor's existing visits (all visit types)
   * Shows complete registration history
   */
  async getVisitorVisits(visitorId: number): Promise<any[]> {
    try {
      console.log(`\n📋 Fetching visit history for visitor_id: ${visitorId}`);

      const { data: visits, error } = await supabase
        .from('visit')
        .select(
          `
          visit_id,
          visit_type_id,
          entry_time,
          exit_time,
          qr_token,
          purpose_reason,
          visit_type(visit_type_name),
          primary_office:office(office_name)
        `
        )
        .eq('visitor_id', visitorId)
        .order('entry_time', { ascending: false });

      if (error) {
        console.error('❌ Error fetching visit history:', error);
        return [];
      }

      if (visits && visits.length > 0) {
        console.log(`✅ Found ${visits.length} visit record(s) for this visitor`);
        visits.forEach((v: any, idx) => {
          console.log(`   [${idx + 1}] ${(v.visit_type as any)?.visit_type_name || 'Unknown'} - ${v.entry_time}`);
        });
      } else {
        console.log('✅ No visit history found for this visitor');
      }

      return visits || [];
    } catch (error) {
      console.error('❌ Error in getVisitorVisits:', error);
      return [];
    }
  },
};
