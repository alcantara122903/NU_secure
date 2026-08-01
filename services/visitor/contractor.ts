/**
 * Contractor Service
 * Handles contractor registration with ID verification and QR ticket generation
 */

import { toSupabaseTimestampPh } from '@/lib/supabase-timestamp-ph';
import type { VisitorRegistrationData } from '@/types/visitor';
import { resolvePendingExpectationStatusId } from '@/services/office-flow/db-status-lookups';
import { addressService, type AddressData } from '../address';
import { supabase } from '../database/supabase';
import { uploadFacePhoto } from '../storage/upload';
import { visitorLookupService } from './visitor-lookup';
import {
  resolveDefaultEntryExitStatusId,
  resolveLoggedInGuardUserId,
} from './resolve-guard-user';

/**
 * Generate a random token for QR code
 */
function generateQRToken(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `${timestamp}-${random}`.toUpperCase();
}

/** Generate ID format: YYYY-XXXXXX */
function generateYearSixCode(): string {
  const year = new Date().getFullYear();
  const sixDigits = Math.floor(Math.random() * 1_000_000)
    .toString()
    .padStart(6, '0');
  return `${year}-${sixDigits}`;
}

export const contractorService = {
  /**
   * Register contractor and generate QR pass
   */
  async registerAndGenerateQRPass(contractorData: VisitorRegistrationData & {
    destinationOfficeId: number;
    idPassNumber: string;
    controlNumber?: string;
    reasonForVisit: string;
    /** Saved to contractor.contact_person (on-site / destination contact). */
    contactPerson?: string;
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
      console.log(`   contactPerson: ${contractorData.contactPerson?.trim() || '(derive from visitor name)'}`);

      // STEP 1: Create address record if components provided
      let addressId: number | null = null;
      if (contractorData.addressHouseNo || contractorData.addressStreet || 
          contractorData.addressBarangay || contractorData.addressMunicipality) {
        
        console.log('\n📝 STEP 1: Creating/checking address record...');
        const addressData: AddressData = {
          houseNo: contractorData.addressHouseNo || undefined,
          street: contractorData.addressStreet || undefined,
          barangay: contractorData.addressBarangay || undefined,
          cityMunicipality: contractorData.addressMunicipality || undefined,
          province: contractorData.addressProvince || undefined,
          region: contractorData.addressRegion || undefined,
        };
        addressId = await addressService.createAddress(addressData);
        if (!addressId) {
          console.warn('⚠️ Address creation failed');
        }
      }

      // STEP 2: Create visitor record with photo upload
      console.log('\n📝 STEP 2: Creating visitor record...');
      const passNumber = contractorData.idPassNumber?.trim();
      const controlNumber = contractorData.controlNumber?.trim() || generateYearSixCode();
      if (!passNumber) {
        console.error('❌ ID Pass Number is required for contractor registration');
        return null;
      }
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

      // Get current guard from app session (users.user_id)
      console.log('\n👤 Fetching current guard user...');
      const guardUserId = await resolveLoggedInGuardUserId();
      const entryExitStatusId = await resolveDefaultEntryExitStatusId();

      // ======= VISITOR DEDUPLICATION LOGIC =======
      // Check if visitor already exists to prevent duplicate records
      console.log('\n👥 CHECKING FOR EXISTING VISITOR RECORD');
      let existingVisitor = await visitorLookupService.findExistingVisitor({
        firstName: contractorData.firstName,
        lastName: contractorData.lastName,
        contactNo: contractorData.contactNo,
        birthday: contractorData.birthday,
      });

      let visitorData_db: any;

      if (existingVisitor) {
        // Visitor already exists - reuse their record
        console.log('\n♻️ REUSING EXISTING VISITOR RECORD');
        console.log(`   Visitor ID: ${existingVisitor.visitor_id}`);
        console.log(`   Pass Number: ${existingVisitor.pass_number}`);
        console.log(`   Control Number: ${existingVisitor.control_number}`);
        
        visitorData_db = [{ visitor_id: existingVisitor.visitor_id }];
        const contractorUpdates: Record<string, string> = {};
        if (contractorData.birthday?.trim()) {
          contractorUpdates.birthday = contractorData.birthday.trim();
        }
        if (photoUrl) {
          contractorUpdates.visitor_photo_with_id_url = photoUrl;
        }
        if (Object.keys(contractorUpdates).length > 0) {
          await supabase
            .from('visitor')
            .update(contractorUpdates)
            .eq('visitor_id', existingVisitor.visitor_id);
        }
        console.log('\n✅ Using existing visitor record - no new record created');
      } else {
        // Visitor doesn't exist - create new record
        console.log('\n📝 CREATING NEW VISITOR RECORD');

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
              birthday: contractorData.birthday?.trim() || null,
              address_id: addressId || null,
              visitor_photo_with_id_url: photoUrl || null,
              created_at: toSupabaseTimestampPh(),
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
      }

      const visitorId = visitorData_db?.[0]?.visitor_id;
      if (!visitorId) {
        console.error('❌ No visitor ID returned');
        return null;
      }

      console.log(`✅ Visitor created: visitor_id=${visitorId}, pass=${passNumber}, control=${controlNumber}`);

      // STEP 3: Create visit record (contractor row needs visit_id)
      console.log('\n📝 STEP 3: Creating visit record...');
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
            purpose_reason: contractorData.reasonForVisit?.trim() || null,
            destination_text: contractorData.contactPerson?.trim() || null,
            exit_status_id: entryExitStatusId,
            entry_time: toSupabaseTimestampPh(),
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

      // STEP 4: Contractor table — contractor_id, contact_person, visit_id only
      console.log('\n📝 STEP 4: Creating contractor record...');
      const contactPerson =
        (contractorData.contactPerson && contractorData.contactPerson.trim()) ||
        `${contractorData.firstName} ${contractorData.lastName}`.trim() ||
        contractorData.contactNo?.trim() ||
        '—';

      let contractorData_db: any = null;
      let contractorError: any = null;

      for (let attempt = 1; attempt <= 3; attempt++) {
        console.log(`   Attempt ${attempt}/3...`);

        const result = await supabase
          .from('contractor')
          .insert([{
            visit_id: visitId,
            contact_person: contactPerson,
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
        console.warn('⚠️ Visit was created, but contractor link row could not be saved');
      }

      const contractorId = contractorData_db?.[0]?.contractor_id || 0;

      // STEP 5: Create office expectation for destination office
      console.log('\n📝 STEP 5: Creating office expectation...');

      const pendingExpectationStatusId = await resolvePendingExpectationStatusId();
      const expectationResult = await supabase
        .from('office_expectation')
        .insert([{
          visit_id: visitId,
          office_id: contractorData.destinationOfficeId,
          expected_order: 1,
          expectation_status_id: pendingExpectationStatusId,
          created_at: toSupabaseTimestampPh(),
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
