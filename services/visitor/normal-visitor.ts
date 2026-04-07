/**
 * Normal Visitor Service
 * Handles QR ticket generation, database operations, and office scanning validation
 */

import type { VisitorRegistrationData } from '@/types/visitor';
import { supabase } from '../database/supabase';

/**
 * Generate a random token for QR code
 */
function generateQRToken(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${timestamp}-${random}`.toUpperCase();
}

/**
 * Generate pass number (format: PASS-XXXXXXXX)
 */
function generatePassNumber(): string {
  const random = Math.random().toString(36).substring(2, 10).toUpperCase();
  return `PASS-${random}`;
}

/**
 * Generate control number (format: CTRL-XXXXXXXX)
 */
function generateControlNumber(): string {
  const random = Math.random().toString(36).substring(2, 10).toUpperCase();
  return `CTRL-${random}`;
}

export const normalVisitorService = {
  /**
   * Register normal visitor and create QR ticket
   */
  async registerAndGenerateQRTicket(visitorData: VisitorRegistrationData & {
    selectedOfficeIds: number[];
  }): Promise<{
    qrToken: string;
    passNumber: string;
    controlNumber: string;
    visitorId: number;
    visitId: number;
  } | null> {
    try {
      console.log('\n💾 === NORMAL VISITOR QR TICKET GENERATION ===\n');
      console.log('📋 Input data:');
      console.log(`   firstName: ${visitorData.firstName}`);
      console.log(`   lastName: ${visitorData.lastName}`);
      console.log(`   contactNo: ${visitorData.contactNo}`);
      console.log(`   selectedOffices: ${visitorData.selectedOfficeIds.length} office(s)`);

      // STEP 1: Create address record if components provided
      let addressId: number | null = null;
      if (visitorData.addressHouseNo || visitorData.addressStreet || 
          visitorData.addressBarangay || visitorData.addressMunicipality) {
        
        console.log('\n📝 STEP 1: Creating address record...');
        const { data: addressData, error: addressError } = await supabase
          .from('address')
          .insert([{
            house_no: visitorData.addressHouseNo || null,
            street: visitorData.addressStreet || null,
            barangay: visitorData.addressBarangay || null,
            city_municipality: visitorData.addressMunicipality || null,
            province: visitorData.addressProvince || null,
            region: visitorData.addressRegion || null,
          }])
          .select('address_id');

        if (addressError) {
          console.error('❌ Address creation failed:', addressError.message);
          return null;
        }

        addressId = addressData?.[0]?.address_id || null;
        console.log(`✅ Address created: address_id=${addressId}`);
      }

      // STEP 2: Create visitor record
      console.log('\n📝 STEP 2: Creating visitor record...');
      const passNumber = generatePassNumber();
      const controlNumber = generateControlNumber();
      console.log(`   pass_number: ${passNumber}, control_number: ${controlNumber}`);

      // Attempt insert with retry logic for sequence issues
      let visitorData_db = null;
      let visitorError = null;
      
      for (let attempt = 1; attempt <= 3; attempt++) {
        console.log(`   Attempt ${attempt}/3...`);
        
        const result = await supabase
          .from('visitor')
          .insert([{
            first_name: visitorData.firstName,
            last_name: visitorData.lastName,
            contact_no: visitorData.contactNo,
            pass_number: passNumber,
            control_number: controlNumber,
            address_id: addressId || null,
            created_at: new Date().toISOString(),
          }])
          .select('visitor_id');

        visitorData_db = result.data;
        visitorError = result.error;

        if (!visitorError) {
          console.log(`   ✅ Insert succeeded on attempt ${attempt}`);
          break;
        }

        console.log(`   ⚠️ Attempt ${attempt} failed: ${visitorError.message}`);

        // On last attempt, try to fetch existing visitor by pass_number
        if (attempt === 3) {
          console.log('   📝 Trying to fetch existing visitor by pass_number...');
          const { data: existing } = await supabase
            .from('visitor')
            .select('visitor_id')
            .eq('pass_number', passNumber)
            .single();

          if (existing?.visitor_id) {
            console.log(`   ✅ Found existing visitor: visitor_id=${existing.visitor_id}`);
            visitorData_db = [existing];
            visitorError = null;
            break;
          }
        }

        // Wait before retry
        if (attempt < 3) {
          await new Promise(resolve => setTimeout(resolve, 500 * attempt));
        }
      }

      if (visitorError) {
        console.error('❌ Visitor creation failed after 3 attempts:', visitorError.message);
        console.error('🔍 Error code:', visitorError.code);
        return null;
      }

      const visitorId = visitorData_db?.[0]?.visitor_id;
      if (!visitorId) {
        console.error('❌ No visitor ID returned');
        return null;
      }

      console.log(`✅ Visitor created: visitor_id=${visitorId}, pass=${passNumber}, control=${controlNumber}`);

      // STEP 3: Create visit record
      console.log('\n📝 STEP 3: Creating visit record...');
      const qrToken = generateQRToken();
      const primaryOfficeId = visitorData.selectedOfficeIds[0];

      // Attempt insert with retry logic
      let visitData = null;
      let visitError = null;

      for (let attempt = 1; attempt <= 3; attempt++) {
        console.log(`   Attempt ${attempt}/3...`);

        const result = await supabase
          .from('visit')
          .insert([{
            visitor_id: visitorId,
            visit_type_id: 2,
            primary_office_id: primaryOfficeId,
            qr_token: qrToken,
            entry_time: new Date().toISOString(),
          }])
          .select('visit_id');

        visitData = result.data;
        visitError = result.error;

        if (!visitError) {
          console.log(`   ✅ Insert succeeded on attempt ${attempt}`);
          break;
        }

        console.log(`   ⚠️ Attempt ${attempt} failed: ${visitError.message}`);

        // On last attempt, try to fetch existing visit by qr_token
        if (attempt === 3) {
          console.log('   📝 Trying to fetch existing visit by qr_token...');
          const { data: existing } = await supabase
            .from('visit')
            .select('visit_id')
            .eq('qr_token', qrToken)
            .single();

          if (existing?.visit_id) {
            console.log(`   ✅ Found existing visit: visit_id=${existing.visit_id}`);
            visitData = [existing];
            visitError = null;
            break;
          }
        }

        // Wait before retry
        if (attempt < 3) {
          await new Promise(resolve => setTimeout(resolve, 500 * attempt));
        }
      }

      if (visitError) {
        console.error('❌ Visit creation failed:', visitError.message);
        return null;
      }

      const visitId = visitData?.[0]?.visit_id;
      if (!visitId) {
        console.error('❌ No visit ID returned');
        return null;
      }

      console.log(`✅ Visit created: visit_id=${visitId}, qr_token=${qrToken}`);

      // STEP 4: Create office_expectation records (one per selected office)
      console.log('\n📝 STEP 4: Creating office expectations...');
      const expectations = visitorData.selectedOfficeIds.map((officeId, index) => ({
        visit_id: visitId,
        office_id: officeId,
        expected_order: index + 1,
        expectation_status_id: 1,
        created_at: new Date().toISOString(),
      }));

      // Attempt insert with retry logic
      let expectationError = null;

      for (let attempt = 1; attempt <= 3; attempt++) {
        console.log(`   Attempt ${attempt}/3...`);

        const result = await supabase
          .from('office_expectation')
          .insert(expectations);

        expectationError = result.error;

        if (!expectationError) {
          console.log(`   ✅ Insert succeeded on attempt ${attempt}`);
          break;
        }

        console.log(`   ⚠️ Attempt ${attempt} failed: ${expectationError.message}`);

        // Wait before retry
        if (attempt < 3) {
          await new Promise(resolve => setTimeout(resolve, 500 * attempt));
        }
      }

      if (expectationError) {
        console.error('❌ Office expectation creation failed:', expectationError.message);
        console.warn('⚠️ Visitor and visit records were created, but office route could not be set up');
      } else {
        console.log(`✅ Office expectations created: ${visitorData.selectedOfficeIds.length} office(s) added to route`);
      }

      console.log('\n✅ === NORMAL VISITOR QR TICKET GENERATED SUCCESSFULLY ===\n');

      return {
        qrToken,
        passNumber,
        controlNumber,
        visitorId,
        visitId,
      };
    } catch (error) {
      console.error('❌ QR TICKET GENERATION ERROR:', error);
      return null;
    }
  },

  /**
   * Validate office scan - check if visitor is at correct office
   */
  async validateOfficeScan(qrToken: string, currentOfficeId: number, scannedByUserId: number): Promise<{
    isCorrect: boolean;
    message: string;
    visitorName: string;
    passNumber: string;
    controlNumber: string;
    expectedOfficeId?: number;
    expectedOfficeName?: string;
  } | null> {
    try {
      console.log('\n🔍 === OFFICE SCAN VALIDATION ===\n');
      console.log(`QR Token: ${qrToken}`);
      console.log(`Current Office ID: ${currentOfficeId}`);

      // STEP 1: Lookup visit by QR token
      console.log('\n📝 STEP 1: Looking up visit record...');
      const { data: visitData, error: visitError } = await supabase
        .from('visit')
        .select('visit_id, visitor_id, primary_office_id')
        .eq('qr_token', qrToken)
        .single();

      if (visitError || !visitData) {
        console.error('❌ Visit not found:', visitError?.message);
        return null;
      }

      const { visit_id: visitId, visitor_id: visitorId } = visitData;
      console.log(`✅ Visit found: visit_id=${visitId}, visitor_id=${visitorId}`);

      // STEP 2: Get visitor info
      console.log('\n📝 STEP 2: Fetching visitor information...');
      const { data: visitor, error: visitorError } = await supabase
        .from('visitor')
        .select('first_name, last_name, pass_number, control_number')
        .eq('visitor_id', visitorId)
        .single();

      if (visitorError || !visitor) {
        console.error('❌ Visitor not found');
        return null;
      }

      const visitorName = `${visitor.first_name} ${visitor.last_name}`;
      console.log(`✅ Visitor: ${visitorName} (Pass: ${visitor.pass_number}, Ctrl: ${visitor.control_number})`);

      // STEP 3: Get next expected office from route
      console.log('\n📝 STEP 3: Checking expected office...');
      const { data: expectations, error: expError } = await supabase
        .from('office_expectation')
        .select('expectation_id, office_id, expected_order, expectation_status_id')
        .eq('visit_id', visitId)
        .order('expected_order', { ascending: true });

      if (expError || !expectations || expectations.length === 0) {
        console.error('❌ No office expectations found');
        return null;
      }

      // Find next unvisited office
      let nextExpectation = expectations.find((exp: any) => exp.expectation_status_id === 1); // "Expected"
      if (!nextExpectation) {
        console.log('⚠️ All offices already visited');
        nextExpectation = expectations[expectations.length - 1]; // Show last expected
      }

      const expectedOfficeId = nextExpectation.office_id;
      console.log(`Expected office_id: ${expectedOfficeId}, Current office_id: ${currentOfficeId}`);

      // Get office names
      const { data: currentOffice } = await supabase
        .from('office')
        .select('office_name')
        .eq('office_id', currentOfficeId)
        .single();

      const { data: expectedOffice } = await supabase
        .from('office')
        .select('office_name')
        .eq('office_id', expectedOfficeId)
        .single();

      const isCorrect = currentOfficeId === expectedOfficeId;
      const validationStatusId = isCorrect ? 1 : 2; // 1=Correct, 2=Wrong (verify with your DB)

      console.log(`\n📊 Validation Result: ${isCorrect ? '✅ CORRECT' : '❌ WRONG'}`);

      // STEP 4: Create office_scan record
      console.log('\n📝 STEP 4: Recording scan...');
      const { error: scanError } = await supabase
        .from('office_scan')
        .insert([{
          visit_id: visitId,
          office_id: currentOfficeId,
          scanned_by_user_id: scannedByUserId,
          scan_time: new Date().toISOString(),
          validation_status_id: validationStatusId,
        }]);

      if (scanError) {
        console.error('❌ Scan recording failed:', scanError.message);
        return null;
      }

      console.log('✅ Scan recorded');

      // STEP 5: If wrong office, create alert
      if (!isCorrect) {
        console.log('\n📝 STEP 5: Creating alert for wrong office...');
        const { error: alertError } = await supabase
          .from('alerts')
          .insert([{
            visit_id: visitId,
            visitor_id: visitorId,
            alert_type: 'Wrong Office',
            severity: 'High',
            message: `${visitorName} scanned at wrong office. Expected: ${expectedOffice?.office_name}, Got: ${currentOffice?.office_name}`,
            status: 'Unresolved',
            created_at: new Date().toISOString(),
          }]);

        if (alertError) {
          console.warn('⚠️ Alert creation failed:', alertError.message);
        } else {
          console.log('✅ Alert created');
        }
      } else {
        // Update office_expectation to mark as arrived
        console.log('\n📝 Updating expectation status...');
        const { error: updateError } = await supabase
          .from('office_expectation')
          .update({
            expectation_status_id: 2, // "Arrived" status
            arrived_at: new Date().toISOString(),
          })
          .eq('expectation_id', nextExpectation.expectation_id);

        if (updateError) {
          console.warn('⚠️ Update failed:', updateError.message);
        } else {
          console.log('✅ Expectation updated to "Arrived"');
        }
      }

      const message = isCorrect
        ? `✅ CORRECT: ${visitorName} is in the right place`
        : `❌ WRONG OFFICE: ${visitorName} should be at "${expectedOffice?.office_name}" (not here)`;

      console.log(`\n✅ === SCAN VALIDATION COMPLETE ===\n`);

      return {
        isCorrect,
        message,
        visitorName,
        passNumber: visitor.pass_number,
        controlNumber: visitor.control_number,
        expectedOfficeId,
        expectedOfficeName: expectedOffice?.office_name,
      };
    } catch (error) {
      console.error('❌ SCAN VALIDATION ERROR:', error);
      return null;
    }
  },
};
