/**
 * Normal Visitor Service
 * Handles QR ticket generation, database operations, and office scanning validation
 */

import type { VisitorRegistrationData } from '@/types/visitor';
import { addressService, type AddressData } from '../address';
import { supabase } from '../database/supabase';
import { uploadFacePhoto } from '../storage/upload';
import { processOfficeCheckInScan } from '@/services/office-checkin-scan';
import { visitorLookupService } from './visitor-lookup';

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
        
        console.log('\n📝 STEP 1: Creating/checking address record...');
        const addressData: AddressData = {
          houseNo: visitorData.addressHouseNo || undefined,
          street: visitorData.addressStreet || undefined,
          barangay: visitorData.addressBarangay || undefined,
          cityMunicipality: visitorData.addressMunicipality || undefined,
          province: visitorData.addressProvince || undefined,
          region: visitorData.addressRegion || undefined,
        };
        addressId = await addressService.createAddress(addressData);
        if (!addressId) {
          console.warn('⚠️ Address creation failed');
        }
      }

      // STEP 2: Create visitor record with photo uploads
      console.log('\n📝 STEP 2: Creating visitor record...');
      const passNumber = generatePassNumber();
      const controlNumber = generateControlNumber();
      console.log(`   pass_number: ${passNumber}, control_number: ${controlNumber}`);

      // Upload face photo only
      let visitorPhotoUrl: string | null = null;
      if (visitorData.facePhotoUri) {
        console.log('\n📤 STEP 2: Uploading face photo...');
        const uploadResult = await uploadFacePhoto(visitorData.facePhotoUri);
        if (uploadResult.success && uploadResult.publicUrl) {
          visitorPhotoUrl = uploadResult.publicUrl;
          console.log(`   ✅ Face photo uploaded: ${visitorPhotoUrl}`);
        } else {
          console.warn('   ⚠️ Face photo upload failed');
          console.warn(`      Error: ${uploadResult.error}`);
        }
      } else {
        console.log('\n📤 STEP 2: No face photo URI provided');
      }

      // Get current user from session
      console.log('\n👤 Fetching current guard user...');
      const { data: { user: authUser } } = await supabase.auth.getUser();
      let guardUserId: number | null = null;
      
      if (authUser) {
        // Query guard_user table to get user_id by email
        const { data: guardUser, error: guardError } = await supabase
          .from('guard_user')
          .select('user_id')
          .eq('email', authUser.email)
          .single();
        
        if (guardUser) {
          guardUserId = guardUser.user_id;
          console.log(`✅ Guard user found: user_id=${guardUserId}`);
        } else {
          console.warn(`⚠️ Guard user not found for email: ${authUser.email}`);
        }
      } else {
        console.warn('⚠️ No auth user session found');
      }

      // Attempt insert with retry logic for sequence issues
      console.log('\n👥 CHECKING FOR EXISTING VISITOR RECORD');
      let existingVisitor = await visitorLookupService.findExistingVisitor({
        firstName: visitorData.firstName,
        lastName: visitorData.lastName,
        contactNo: visitorData.contactNo,
      });

      let visitorData_db: any = null;
      let visitorError: any = null;

      if (existingVisitor) {
        // REUSE: Reuse existing visitor
        console.log('\n♻️ REUSING EXISTING VISITOR RECORD');
        console.log(`   Visitor ID: ${existingVisitor.visitor_id}`);
        visitorData_db = [{
          visitor_id: existingVisitor.visitor_id,
        }];
        visitorError = null;
        console.log('\n✅ Using existing visitor record - no new record created');
      } else {
        // CREATE: New visitor record with retry logic
        console.log('\n📝 CREATING NEW VISITOR RECORD');
        
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
              visitor_photo_with_id_url: visitorPhotoUrl || null,
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
      }

      const visitorId = visitorData_db?.[0]?.visitor_id;
      if (!visitorId) {
        console.error('❌ No visitor ID returned');
        return null;
      }

      if (existingVisitor) {
        console.log(`✅ Visitor record reused: visitor_id=${visitorId}`);
      } else {
        console.log(`✅ New visitor created: visitor_id=${visitorId}, pass=${passNumber}, control=${controlNumber}${visitorPhotoUrl ? `, photo=${visitorPhotoUrl}` : ''}`);
      }

      // STEP 3: Create visit record
      console.log('\n📝 STEP 3: Creating visit record...');
      const qrToken = generateQRToken();
      const primaryOfficeId = visitorData.selectedOfficeIds[0];

      // Attempt insert with retry logic
      let visitData: any = null;
      let visitError: any = null;

      for (let attempt = 1; attempt <= 3; attempt++) {
        console.log(`   Attempt ${attempt}/3...`);

        const result = await supabase
          .from('visit')
          .insert([{
            visitor_id: visitorId,
            visit_type_id: 3, // Normal visitor visit type
            primary_office_id: primaryOfficeId,
            qr_token: qrToken,
            guard_user_id: guardUserId,
            purpose_reason: visitorData.reasonForVisit || null,
            entry_time: new Date().toISOString(),
          }])
          .select('visit_id');

        visitData = result.data;
        visitError = result.error;

        if (!visitError) {
          console.log(`   ✅ Insert succeeded on attempt ${attempt}`);
          break;
        }

        console.log(`   ⚠️ Attempt ${attempt} failed: ${(visitError as any)?.message}`);

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
            visitData = [existing] as any;
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
        console.error('❌ Visit creation failed:', (visitError as any)?.message);
        return null;
      }

      const visitId = (visitData as any)?.[0]?.visit_id;
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
      let expectationError: any = null;

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

        console.log(`   ⚠️ Attempt ${attempt} failed: ${(expectationError as any)?.message}`);

        // Wait before retry
        if (attempt < 3) {
          await new Promise(resolve => setTimeout(resolve, 500 * attempt));
        }
      }

      if (expectationError) {
        console.error('❌ Office expectation creation failed:', (expectationError as any)?.message);
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
    const result = await processOfficeCheckInScan({
      rawQrValue: qrToken,
      scanningOfficeId: currentOfficeId,
      scannedByUserId,
    });

    if (!result.success) {
      return null;
    }

    return {
      isCorrect: result.authorized,
      message: result.message,
      visitorName: result.visitorName || 'Visitor',
      passNumber: result.passNumber || '',
      controlNumber: result.controlNumber || '',
      expectedOfficeName: result.expectedOfficeName,
    };
  },
};
