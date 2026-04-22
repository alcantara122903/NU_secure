/**
 * Contractor Service
 * Handles contractor registration with ID verification and QR ticket generation
 */

import type { VisitorRegistrationData } from '@/types/visitor';
import { supabase } from '../database/supabase';
import { uploadFacePhoto } from '../storage/upload';

/**
 * Generate a random token for QR code
 */
function generateQRToken(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${timestamp}-${random}`.toUpperCase();
}

/**
 * Generate contractor pass number (format: CONV-XXXXXXXX)
 */
function generateContractorPassNumber(): string {
  const random = Math.random().toString(36).substring(2, 10).toUpperCase();
  return `CONV-${random}`;
}

/**
 * Generate control number (format: CTRL-XXXXXXXX)
 */
function generateControlNumber(): string {
  const random = Math.random().toString(36).substring(2, 10).toUpperCase();
  return `CTRL-${random}`;
}

export const contractorService = {
  /**
   * Register contractor and generate QR pass
   */
  async registerAndGenerateQRPass(contractorData: VisitorRegistrationData & {
    destinationOfficeId: number;
    idPassNumber: string;
    reasonForVisit: string;
  }): Promise<{
    qrToken: string;
    passNumber: string;
    controlNumber: string;
    visitorId: number;
    contractorId: number;
    visitId: number;
  } | null> {
    try {
      console.log('\n💾 === CONTRACTOR PASS GENERATION ===\n');
      console.log('📋 Input data:');
      console.log(`   firstName: ${contractorData.firstName}`);
      console.log(`   lastName: ${contractorData.lastName}`);
      console.log(`   contactNo: ${contractorData.contactNo}`);
      console.log(`   idPassNumber: ${contractorData.idPassNumber}`);
      console.log(`   reasonForVisit: ${contractorData.reasonForVisit}`);
      console.log(`   destinationOfficeId: ${contractorData.destinationOfficeId}`);

      // STEP 1: Create address record if components provided
      let addressId: number | null = null;
      if (contractorData.addressHouseNo || contractorData.addressStreet || 
          contractorData.addressBarangay || contractorData.addressMunicipality) {
        
        console.log('\n📝 STEP 1: Creating address record...');
        const { data: addressData, error: addressError } = await supabase
          .from('address')
          .insert([{
            house_no: contractorData.addressHouseNo || null,
            street: contractorData.addressStreet || null,
            barangay: contractorData.addressBarangay || null,
            city_municipality: contractorData.addressMunicipality || null,
            province: contractorData.addressProvince || null,
            region: contractorData.addressRegion || null,
          }])
          .select('address_id');

        if (addressError) {
          console.error('❌ Address creation failed:', addressError.message);
          return null;
        }

        addressId = addressData?.[0]?.address_id || null;
        console.log(`✅ Address created: address_id=${addressId}`);
      }

      // STEP 2: Create visitor record with photo upload
      console.log('\n📝 STEP 2: Creating visitor record...');
      const passNumber = generateContractorPassNumber();
      const controlNumber = generateControlNumber();
      console.log(`   pass_number: ${passNumber}, control_number: ${controlNumber}`);

      // Upload face photo only
      let photoUrl: string | null = null;
      
      if (contractorData.facePhotoUri) {
        console.log('\n📤 STEP 2: Uploading face photo...');
        const uploadResult = await uploadFacePhoto(contractorData.facePhotoUri);
        if (uploadResult.success && uploadResult.publicUrl) {
          photoUrl = uploadResult.publicUrl;
          console.log(`   ✅ Face photo uploaded: ${photoUrl}`);
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

      // Attempt insert with retry logic
      let visitorData_db: any = null;
      let visitorError: any = null;
      
      for (let attempt = 1; attempt <= 3; attempt++) {
        console.log(`   Attempt ${attempt}/3...`);
        
        const result = await supabase
          .from('visitor')
          .insert([{
            first_name: contractorData.firstName,
            last_name: contractorData.lastName,
            contact_no: contractorData.contactNo,
            pass_number: passNumber,
            control_number: controlNumber,
            address_id: addressId || null,
            visitor_photo_with_id_url: photoUrl || null,
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
        return null;
      }

      const visitorId = visitorData_db?.[0]?.visitor_id;
      if (!visitorId) {
        console.error('❌ No visitor ID returned');
        return null;
      }

      console.log(`✅ Visitor created: visitor_id=${visitorId}, pass=${passNumber}, control=${controlNumber}`);

      // STEP 3: Create contractor record
      console.log('\n📝 STEP 3: Creating contractor record...');
      let contractorData_db: any = null;
      let contractorError: any = null;

      for (let attempt = 1; attempt <= 3; attempt++) {
        console.log(`   Attempt ${attempt}/3...`);

        const result = await supabase
          .from('contractor')
          .insert([{
            visitor_id: visitorId,
            company_name: contractorData.idPassNumber, // Store as company_name for now
            purpose: contractorData.reasonForVisit,
            status: 'active',
            created_at: new Date().toISOString(),
          }])
          .select('contractor_id');

        contractorData_db = result.data;
        contractorError = result.error;

        if (!contractorError) {
          console.log(`   ✅ Insert succeeded on attempt ${attempt}`);
          break;
        }

        console.log(`   ⚠️ Attempt ${attempt} failed: ${contractorError.message}`);
        if (attempt < 3) {
          await new Promise(resolve => setTimeout(resolve, 500 * attempt));
        }
      }

      if (contractorError) {
        console.error('❌ Contractor creation failed:', contractorError.message);
        console.warn('⚠️ Visitor record was created, but contractor details could not be saved');
      }

      const contractorId = contractorData_db?.[0]?.contractor_id || 0;

      // STEP 4: Create visit record
      console.log('\n📝 STEP 4: Creating visit record...');
      const qrToken = generateQRToken();

      let visitData: any = null;
      let visitError: any = null;

      for (let attempt = 1; attempt <= 3; attempt++) {
        console.log(`   Attempt ${attempt}/3...`);

        const result = await supabase
          .from('visit')
          .insert([{
            visitor_id: visitorId,
            visit_type_id: 2, // Contractor visit type
            primary_office_id: contractorData.destinationOfficeId,
            qr_token: qrToken,
            guard_user_id: guardUserId,
            purpose_reason: contractorData.reasonForVisit || null,
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

      // STEP 5: Create office expectation for destination office
      console.log('\n📝 STEP 5: Creating office expectation...');

      const expectationResult = await supabase
        .from('office_expectation')
        .insert([{
          visit_id: visitId,
          office_id: contractorData.destinationOfficeId,
          expected_order: 1,
          expectation_status_id: 1,
          created_at: new Date().toISOString(),
        }]);

      if (expectationResult.error) {
        console.warn('⚠️ Office expectation creation failed:', expectationResult.error.message);
      } else {
        console.log(`✅ Office expectation created for office_id=${contractorData.destinationOfficeId}`);
      }

      console.log('\n✅ === CONTRACTOR PASS GENERATED SUCCESSFULLY ===\n');

      return {
        qrToken,
        passNumber,
        controlNumber,
        visitorId,
        contractorId,
        visitId,
      };
    } catch (error) {
      console.error('❌ CONTRACTOR PASS GENERATION ERROR:', error);
      return null;
    }
  },
};
