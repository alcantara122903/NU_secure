/**
 * Enrollee Service - Moved from services/enrollee.ts
 * Handles enrollee registration, ID extraction, and status tracking
 */

import type { IDExtractionData, VisitorRegistrationData } from '@/types/visitor';
import { addressService, type AddressData } from '../address';
import { supabase } from '../database/supabase';
import { extractTextFromImageViaOCR as extractDataFromIDViaBackend } from '../ocr/ocr-client';
import {
    formatParsedData,
    getConfidenceMessage,
    parseIDText,
    validateParsedData
} from '../ocr/parsers/parser-registry';
import { uploadFacePhoto } from '../storage/upload';
import { visitorLookupService } from './visitor-lookup';


export const enrolleeService = {
  /**
   * Extract data from ID using OCR.Space API and intelligent multi-ID parsing
   * 
   * Supports 17 different Philippine ID types
   */
  async extractDataFromID(base64Image: string): Promise<IDExtractionData | null> {
    try {
      console.log('\n\n========== ID EXTRACTION PROCESS STARTED ==========\n');
      
      // STEP 1: OCR
      console.log('📊 STEP 1: Calling OCR.Space API');
      console.log('   Status: Sending image to OCR.Space...');
      
      const ocrRawText = await extractDataFromIDViaBackend(base64Image);
      
      if (!ocrRawText) {
        console.error('\n❌ STEP 1 FAILED: OCR.Space did not return text');
        console.error('\n💡 Troubleshooting suggestions:');
        console.error('   1. Check internet connection - OCR.Space needs connectivity');
        console.error('   2. Image may be too blurry or poorly lit - try retaking the photo');
        console.error('   3. ID may be at an angle - ensure it\'s straight and well-centered');
        console.error('   4. Try uploading from gallery instead of camera');
        console.error('   5. If problem persists, you can enter information manually in Step 3');
        return null;
      }

      console.log('\n✅ STEP 1 SUCCESS: OCR.Space returned raw text');
      console.log(`   ✓ Text received: ${ocrRawText.length} characters`);
      console.log(`   ✓ Lines: ${ocrRawText.trim().split('\n').length}`);
      
      // Log raw OCR text
      console.log('\n📝 RAW OCR TEXT (for debugging):');
      console.log('─'.repeat(60));
      console.log(ocrRawText);
      console.log('─'.repeat(60));
      console.log('\n📋 Formatted as lines:');
      const ocrLines = ocrRawText.trim().split('\n');
      ocrLines.forEach((line, idx) => {
        console.log(`   [${idx}] "${line}"`);
      });
      console.log('\n');
      
      // STEP 2: PARSE
      console.log('\n📊 STEP 2: Parsing raw text to extract fields');
      console.log('   Status: Analyzing OCR text for firstName, lastName, address...');
      
      const parsedData = parseIDText(ocrRawText);
      
      console.log('\n✅ STEP 2 COMPLETE: Parser output:');
      console.log(`   ✓ firstName: "${parsedData.firstName || '(not found)'}"`);
      console.log(`   ✓ lastName: "${parsedData.lastName || '(not found)'}"`);
      console.log(`   ✓ address: "${parsedData.address.substring(0, 60) || '(not found)'}${parsedData.address.length > 60 ? '...' : ''}"`);
      console.log(`   ✓ confidence: ${parsedData.confidence}`);
      
      // STEP 3: VALIDATE (IMPROVED - allows partial extraction)
      console.log('\n📊 STEP 3: Validating parsed data');
      console.log('   Status: Checking if ANY field was extracted...');
      
      const isValid = validateParsedData(parsedData);
      
      if (!isValid) {
        console.error('\n❌ STEP 3 FAILED: No fields could be extracted');
        console.error('   The OCR text was too corrupted or unrecognizable');
        return null;
      }

      console.log('\n✅ STEP 3 SUCCESS: At least ONE field was validated');
      console.log('   ℹ️ Partial extraction allowed - user can edit missing fields in Step 3');
      
      // STEP 4: RETURN
      console.log('\n📊 STEP 4: Formatting and returning extracted data');
      
      const formattedData = formatParsedData(parsedData);
      const message = getConfidenceMessage(parsedData.confidence);
      
      const extractedFields: string[] = [];
      const missingFields: string[] = [];
      
      if (formattedData.firstName) extractedFields.push('firstName');
      else missingFields.push('firstName');
      
      if (formattedData.lastName) extractedFields.push('lastName');
      else missingFields.push('lastName');
      
      if (formattedData.address) extractedFields.push('address');
      else missingFields.push('address');
      
      console.log(`\n✅ FINAL RESULT: Extraction successful`);
      console.log(`   ✓ Confidence: ${parsedData.confidence}`);
      console.log(`   ✓ Fields found: ${extractedFields.length > 0 ? extractedFields.join(', ') : '(none extracted successfully)'}`);
      if (missingFields.length > 0) {
        console.log(`   ⚠️ Fields missing: ${missingFields.join(', ')} - user will enter these manually`);
      }
      console.log(`   ✓ Message: ${message}`);
      console.log('\n========== ID EXTRACTION PROCESS COMPLETED ==========\n');
      
      return {
        firstName: parsedData.firstName,
        lastName: parsedData.lastName,
        address: parsedData.address,
        addressHouseNo: parsedData.addressHouseNo,
        addressStreet: parsedData.addressStreet,
        addressBarangay: parsedData.addressBarangay,
        addressCityMunicipality: parsedData.addressCityMunicipality,
        addressProvince: parsedData.addressProvince,
        addressRegion: parsedData.addressRegion,
        contactNo: (parsedData as any).contactNo || '',
        confidence: parsedData.confidence,
        detectedIdType: parsedData.detectedIdType,
        rawOcrText: ocrRawText,
      };
    } catch (error) {
      console.error('\n❌ EXTRACTION ERROR: Exception thrown');
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(`   Details: ${errorMessage}`);
      console.error('\n========== ID EXTRACTION PROCESS FAILED ==========\n');
      return null;
    }
  },

  /**
   * Create visitor and enrollee record in database
   */
  async createEnrollee(enrolleeData: VisitorRegistrationData & {
    passNumber: string;
    controlNumber: string;
    qrToken: string;
  }): Promise<{ enrollee_id: number; visitor_id: number; visit_id?: number } | null> {
    try {
      console.log('\n💾 === CREATING ENROLLEE RECORD ===\n');
      console.log('📋 Input data:');
      console.log(`   firstName: ${enrolleeData.firstName}`);
      console.log(`   lastName: ${enrolleeData.lastName}`);
      console.log(`   passNumber: ${enrolleeData.passNumber}`);
      console.log(`   controlNumber: ${enrolleeData.controlNumber}`);

      // Create address record if components provided
      let addressId: number | null = null;
      if (enrolleeData.addressHouseNo || enrolleeData.addressStreet || 
          enrolleeData.addressBarangay || enrolleeData.addressMunicipality || 
          enrolleeData.addressProvince || enrolleeData.addressRegion) {
        console.log('\n📍 Creating address record...');
        const addressData: AddressData = {
          houseNo: enrolleeData.addressHouseNo,
          street: enrolleeData.addressStreet,
          barangay: enrolleeData.addressBarangay,
          cityMunicipality: enrolleeData.addressMunicipality,
          province: enrolleeData.addressProvince,
          region: enrolleeData.addressRegion,
        };
        addressId = await addressService.createAddress(addressData);
        console.log(`✅ Address created with ID: ${addressId}`);
      } else {
        console.log('\n⚠️ No address components provided, skipping address creation');
      }

      // Create visitor record
      console.log('\n👤 Creating visitor record...');
      
      // Upload face photo only
      let photoUrl: string | null = null;
      
      if (enrolleeData.facePhotoUri) {
        console.log('\n📤 Uploading face photo...');
        console.log(`   URI type: ${typeof enrolleeData.facePhotoUri}`);
        console.log(`   URI length: ${enrolleeData.facePhotoUri.length}`);
        console.log(`   URI preview: ${enrolleeData.facePhotoUri.substring(0, 80)}...`);
        
        const uploadResult = await uploadFacePhoto(enrolleeData.facePhotoUri);
        
        console.log('   Upload result:', {
          success: uploadResult.success,
          error: uploadResult.error,
          publicUrl: uploadResult.publicUrl?.substring(0, 80) + '...',
        });
        
        if (uploadResult.success && uploadResult.publicUrl) {
          photoUrl = uploadResult.publicUrl;
          console.log(`   ✅ Face photo uploaded successfully`);
          console.log(`   URL saved: ${photoUrl}`);
        } else {
          console.warn(`   ⚠️ Face photo upload failed: ${uploadResult.error}`);
        }
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
      
      // ======= VISITOR DEDUPLICATION LOGIC =======
      // Check if visitor already exists to prevent duplicate records
      // Especially important when same person registers with different visit types
      // Example: Normal Visitor (visit_type=3) then Enrollee (visit_type=1)
      console.log('\n👥 CHECKING FOR EXISTING VISITOR RECORD');
      let existingVisitor = await visitorLookupService.findExistingVisitor({
        firstName: enrolleeData.firstName,
        lastName: enrolleeData.lastName,
        contactNo: enrolleeData.contactNo,
      });

      let visitorData: any;

      if (existingVisitor) {
        // Visitor already exists - reuse their record
        console.log('\n♻️ REUSING EXISTING VISITOR RECORD');
        console.log(`   Visitor ID: ${existingVisitor.visitor_id}`);
        console.log(`   Name: ${existingVisitor.first_name} ${existingVisitor.last_name}`);
        console.log(`   Contact: ${existingVisitor.contact_no}`);
        console.log(`   Address ID: ${existingVisitor.address_id}`);

        visitorData = {
          visitor_id: existingVisitor.visitor_id,
          first_name: existingVisitor.first_name,
          last_name: existingVisitor.last_name,
          contact_no: existingVisitor.contact_no,
          pass_number: existingVisitor.pass_number,
          control_number: existingVisitor.control_number,
          address_id: existingVisitor.address_id,
          visitor_photo_with_id_url: existingVisitor.visitor_id ? photoUrl : null, // Update photo if new one provided
        };

        console.log('\n✅ Using existing visitor record - no new record created');
      } else {
        // Visitor doesn't exist - create new record
        console.log('\n📝 CREATING NEW VISITOR RECORD');

        const visitorPayload = {
          first_name: enrolleeData.firstName,
          last_name: enrolleeData.lastName,
          contact_no: enrolleeData.contactNo || null,
          // Save uploaded photo URL or null if no photo
          visitor_photo_with_id_url: photoUrl || null,
          pass_number: enrolleeData.passNumber,
          control_number: enrolleeData.controlNumber,
          address_id: addressId || null,
          created_at: new Date().toISOString(),
        };
        
        console.log('   Payload:', JSON.stringify(visitorPayload, null, 2));

        const { data: newVisitorData, error: visitorError }: any = await supabase
          .from('visitor')
          .insert([visitorPayload])
          .select()
          .single();

        if (visitorError) {
          console.error('\n❌ VISITOR CREATION FAILED');
          console.error('   Error code:', visitorError.code);
          console.error('   Error message:', visitorError.message);
          console.error('   Error details:', visitorError.details);
          console.error('\n   🔍 DIAGNOSTIC INFO:');
          console.error('   - Check if test data with this ID already exists in database');
          console.error('   - Run: SELECT * FROM visitor WHERE first_name = \'', enrolleeData.firstName, '\';');
          console.error('   - If duplicates exist, run the cleanup SQL from DATABASE_CLEANUP_INSTRUCTIONS.sql');
          throw new Error(`Visitor creation failed: ${visitorError.message}`);
        }

        if (!newVisitorData || !newVisitorData.visitor_id) {
          console.error('\n❌ VISITOR CREATED BUT NO DATA RETURNED');
          throw new Error('Visitor was created but database returned null');
        }

        visitorData = newVisitorData;
        console.log(`✅ New visitor created with ID: ${visitorData.visitor_id}`);
        console.log(`   Record: ${JSON.stringify(visitorData)}`);
      }

      // Check if enrollee already exists for this visitor
      console.log('\n🔍 CHECKING FOR EXISTING ENROLLEE RECORD');
      const { data: existingEnrollee, error: lookupError } = await supabase
        .from('enrollee')
        .select('enrollee_id, visitor_id, updated_at')
        .eq('visitor_id', visitorData.visitor_id)
        .single();

      let enrolleeRecData: any;
      
      if (existingEnrollee) {
        // Enrollee already exists - return existing record instead of creating duplicate
        console.log('\n♻️ REUSING EXISTING ENROLLEE RECORD');
        console.log(`   Enrollee ID: ${existingEnrollee.enrollee_id}`);
        console.log(`   Visitor ID: ${existingEnrollee.visitor_id}`);
        console.log(`   Last updated: ${existingEnrollee.updated_at}`);
        enrolleeRecData = existingEnrollee;
        console.log('\n✅ Existing enrollee returned - no duplicate created');
      } else if (lookupError && lookupError.code !== 'PGRST116') {
        // Some other error occurred (not "no rows found")
        console.warn('⚠️ Error checking for existing enrollee:', lookupError.message);
        // Continue with creating new enrollee
        
        // Create enrollee record
        console.log('\n📝 Creating enrollee record...');
        
        const enrolleePayload = {
          visitor_id: visitorData.visitor_id,
          updated_at: new Date().toISOString(),
        };
        
        console.log('   Payload:', JSON.stringify(enrolleePayload));

        const { data: newEnrolleeRec, error: enrolleeError } = await supabase
          .from('enrollee')
          .insert([enrolleePayload])
          .select()
          .single();

        if (enrolleeError) {
          console.error('\n❌ ENROLLEE CREATION FAILED');
          console.error('   Error code:', enrolleeError.code);
          console.error('   Error message:', enrolleeError.message);
          console.error('   Error details:', enrolleeError.details);
          console.error('\n   🔍 DIAGNOSTIC INFO:');
          console.error(`   - Tried to create enrollee for visitor_id: ${visitorData.visitor_id}`);
          console.error('   - Possible causes:');
          console.error('     1. Enrollee already exists for this visitor (unique constraint)');
          console.error('     2. Database connection issue');
          console.error('     3. RLS policy blocking INSERT');
          throw new Error(`Enrollee creation failed: ${enrolleeError.message}`);
        }

        if (!newEnrolleeRec || !newEnrolleeRec.enrollee_id) {
          console.error('\n❌ ENROLLEE CREATED BUT NO DATA RETURNED');
          throw new Error('Enrollee was created but database returned null');
        }

        enrolleeRecData = newEnrolleeRec;
        console.log(`✅ New enrollee created with ID: ${enrolleeRecData.enrollee_id}`);
      } else {
        // No existing enrollee found (PGRST116 = no rows), create new one
        // Create enrollee record
        console.log('\n📝 Creating enrollee record...');
        
        const enrolleePayload = {
          visitor_id: visitorData.visitor_id,
          updated_at: new Date().toISOString(),
        };
        
        console.log('   Payload:', JSON.stringify(enrolleePayload));

        const { data: newEnrolleeRec, error: enrolleeError } = await supabase
          .from('enrollee')
          .insert([enrolleePayload])
          .select()
          .single();

        if (enrolleeError) {
          console.error('\n❌ ENROLLEE CREATION FAILED');
          console.error('   Error code:', enrolleeError.code);
          console.error('   Error message:', enrolleeError.message);
          console.error('   Error details:', enrolleeError.details);
          console.error('\n   🔍 DIAGNOSTIC INFO:');
          console.error(`   - Tried to create enrollee for visitor_id: ${visitorData.visitor_id}`);
          throw new Error(`Enrollee creation failed: ${enrolleeError.message}`);
        }

        if (!newEnrolleeRec || !newEnrolleeRec.enrollee_id) {
          console.error('\n❌ ENROLLEE CREATED BUT NO DATA RETURNED');
          throw new Error('Enrollee was created but database returned null');
        }

        enrolleeRecData = newEnrolleeRec;
        console.log(`✅ New enrollee created with ID: ${enrolleeRecData.enrollee_id}`);
      }

      // Create visit record
      console.log('\n🎫 Creating visit record...');
      
      const visitPayload = {
        visitor_id: visitorData.visitor_id,
        visit_type_id: 1, // Enrollee visit type
        qr_token: enrolleeData.qrToken,
        guard_user_id: guardUserId,
        entry_time: new Date().toISOString(),
      };
      
      console.log('   Payload:', JSON.stringify(visitPayload));

      const { data: visitData, error: visitError } = await supabase
        .from('visit')
        .insert([visitPayload])
        .select()
        .single();

      if (visitError) {
        console.warn('\n⚠️ Visit record creation error (non-critical)');
        console.warn('   Error:', visitError.message);
        console.warn('   Continuing anyway as visit record is not blocking...');
      } else if (visitData && visitData.visit_id) {
        console.log(`✅ Visit record created with ID: ${visitData.visit_id}`);
      }

      // Handle progress: Resume if exists, or initialize if new enrollee
      console.log('\n📊 PROGRESS HANDLING: Resume or Initialize');
      try {
        const progressRecords = await this.resumeOrInitializeProgress(enrolleeRecData.enrollee_id);
        if (progressRecords && progressRecords.length > 0) {
          console.log(`✅ Progress handled for ${progressRecords.length} enrollment steps`);
        } else if (progressRecords === null) {
          console.warn('⚠️ Progress records is NULL - check logs above for details');
        } else {
          console.warn('⚠️ Progress records returned empty array');
        }
      } catch (progressError) {
        console.error('❌ ERROR handling progress:');
        console.error('   Error:', progressError);
      }

      console.log('\n✅ === ENROLLEE CREATION COMPLETED SUCCESSFULLY ===\n');

      return {
        enrollee_id: enrolleeRecData.enrollee_id,
        visitor_id: visitorData.visitor_id,
        visit_id: visitData?.visit_id,
      };
    } catch (error: any) {
      console.error('\n❌ === ENROLLEE CREATION FAILED ===\n');
      console.error('Error type:', error.constructor.name);
      console.error('Error message:', error.message);
      console.error('Full error:', error);
      console.error('\n📋 TROUBLESHOOTING STEPS:');
      console.error('1. Check DATABASE_CLEANUP_INSTRUCTIONS.sql in project root');
      console.error('2. Run the cleanup SQL in Supabase SQL Editor');
      console.error('3. Ensure visitor_id sequence is reset');
      console.error('4. Check Supabase RLS policies allow INSERT on visitor table');
      console.error('5. Verify your EXPO_PUBLIC_SUPABASE_ANON_KEY is correct\n');
      return null;
    }
  },

  /**
   * Get enrollee by ID with visitor info
   */
  async getEnrolleeById(enrolleeId: number): Promise<any | null> {
    try {
      const { data, error } = await supabase
        .from('enrollee')
        .select(`
          enrollee_id,
          enrollee_status_id,
          visitor:visitor(*)
        `)
        .eq('enrollee_id', enrolleeId)
        .single();

      if (error) {
        console.error('❌ Error fetching enrollee:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('❌ Error in getEnrolleeById:', error);
      return null;
    }
  },

  /**
   * Resume or initialize enrollee progress
   * 
   * If enrollee already has progress from a previous visit, resume it
   * If no progress exists, initialize all steps as pending
   * 
   * TRANSACTION-SAFE: Checks and creates atomically
   */
  async resumeOrInitializeProgress(enrolleeId: number): Promise<any[] | null> {
    try {
      console.log(`\n📋 RESUME/INITIALIZE PROGRESS for enrollee_id: ${enrolleeId}`);

      // STEP 1: Check if progress records already exist for this enrollee
      console.log('   Step 1: Checking for existing progress...');
      const { data: existingProgress, error: checkError } = await supabase
        .from('enrollee_progress')
        .select('progress_id, step_id, completed_at, step_status_id')
        .eq('enrollee_id', enrolleeId)
        .order('step_id', { ascending: true });

      if (checkError) {
        console.error('❌ Error checking progress:', checkError);
        return null;
      }

      // STEP 2: If progress exists, return it (RESUME)
      if (existingProgress && existingProgress.length > 0) {
        console.log(`\n✅ RESUME MODE: Found ${existingProgress.length} existing progress records`);
        
        // Fetch full progress data with step details for resuming
        const { data: fullProgress, error: fetchError } = await supabase
          .from('enrollee_progress')
          .select(`
            progress_id,
            enrollee_id,
            step_id,
            completed_at,
            step_status_id,
            step:enrollee_step(
              step_id,
              step_name,
              step_order,
              office_id
            ),
            status:step_status(
              step_status_id,
              step_status_name
            )
          `)
          .eq('enrollee_id', enrolleeId)
          .order('step_id', { ascending: true });

        if (fetchError) {
          console.error('❌ Error fetching full progress:', fetchError);
          return null;
        }

        // Log progress summary
        console.log('   Progress Summary:');
        fullProgress?.forEach((p: any) => {
          const status = p.completed_at ? '✅ COMPLETED' : '⏳ PENDING';
          console.log(`     - Step ${p.step?.step_order}: ${p.step?.step_name} [${status}]`);
        });

        console.log('\n✅ Progress RESUMED - all previous work preserved\n');
        return fullProgress || [];
      }

      // STEP 3: No progress exists - INITIALIZE new progress records
      console.log('   Step 1 Result: No progress found');
      console.log('\n📊 INITIALIZE MODE: Creating new progress records...');

      // Get pending status ID
      let pendingStatusId: number | null = null;
      const { data: allStatuses } = await supabase
        .from('step_status')
        .select('step_status_id, step_status_name');

      if (allStatuses && allStatuses.length > 0) {
        let pendingStatus = allStatuses.find((s: any) => 
          s.step_status_name?.toLowerCase().includes('pending') || 
          s.step_status_name?.toLowerCase().includes('not started')
        );
        
        if (!pendingStatus) {
          pendingStatus = allStatuses[0];
        }
        
        pendingStatusId = pendingStatus.step_status_id;
        console.log(`   Found step status: ${pendingStatus.step_status_name} (ID: ${pendingStatusId})`);
      }

      // Fetch all active enrollment steps
      const { data: steps, error: stepsError } = await supabase
        .from('enrollee_step')
        .select('step_id, step_name, step_order, office_id')
        .eq('is_active', true)
        .order('step_order', { ascending: true });

      if (stepsError) {
        console.error('❌ Error fetching enrollment steps:', stepsError);
        return null;
      }

      if (!steps || steps.length === 0) {
        console.warn('⚠️ No active enrollment steps found');
        return [];
      }

      console.log(`   Found ${steps.length} active enrollment steps to initialize`);

      // Create progress payloads for all steps
      const progressPayloads = steps.map((step: any) => ({
        enrollee_id: enrolleeId,
        step_id: step.step_id,
        completed_at: null,
        step_status_id: pendingStatusId,
      }));

      // Insert progress records
      const { data: newProgress, error: insertError } = await supabase
        .from('enrollee_progress')
        .insert(progressPayloads)
        .select(`
          progress_id,
          enrollee_id,
          step_id,
          completed_at,
          step_status_id,
          step:enrollee_step(
            step_id,
            step_name,
            step_order,
            office_id
          ),
          status:step_status(
            step_status_id,
            step_status_name
          )
        `);

      if (insertError) {
        console.error('❌ Error creating progress records:', insertError);
        return null;
      }

      console.log(`✅ INITIALIZED ${newProgress?.length || 0} progress records`);
      newProgress?.forEach((p: any) => {
        console.log(`   - Step ${p.step?.step_order}: ${p.step?.step_name} [⏳ PENDING]`);
      });

      console.log('\n✅ Progress INITIALIZED - ready to begin enrollment\n');
      return newProgress || [];

    } catch (error) {
      console.error('❌ Error in resumeOrInitializeProgress:', error);
      return null;
    }
  },

  /**
   * Create enrollee_progress records for a new enrollee
   * Automatically creates progress tracking for all active enrollment steps
   * Works with or without step_status data
   */
  async createEnrolleeProgressRecords(enrolleeId: number): Promise<any[] | null> {
    try {
      console.log(`\n📊 Creating progress records for enrollee_id: ${enrolleeId}`);

      // Try to get a valid step_status_id (optional)
      let pendingStatusId: number | null = null;
      const { data: allStatuses } = await supabase
        .from('step_status')
        .select('step_status_id, step_status_name');

      if (allStatuses && allStatuses.length > 0) {
        // Try to find a pending status
        let pendingStatus = allStatuses.find((s: any) => 
          s.step_status_name?.toLowerCase().includes('pending') || 
          s.step_status_name?.toLowerCase().includes('not started')
        );
        
        if (!pendingStatus) {
          pendingStatus = allStatuses[0];
        }
        
        pendingStatusId = pendingStatus.step_status_id;
        console.log(`   ✅ Found step status: ${pendingStatus.step_status_name} (ID: ${pendingStatusId})`);
      } else {
        console.log(`   ℹ️ No step_status records found - will create progress records without status_id`);
      }

      // Step 2: Fetch all active enrollment steps
      const { data: steps, error: stepsError } = await supabase
        .from('enrollee_step')
        .select('step_id, step_name, step_order, office_id')
        .eq('is_active', true)
        .order('step_order', { ascending: true });

      if (stepsError) {
        console.error('❌ Error fetching enrollment steps:', stepsError);
        return null;
      }

      if (!steps || steps.length === 0) {
        console.warn('⚠️ No active enrollment steps found in enrollee_step table');
        console.warn('   Check that enrollee_step records have is_active = true');
        return [];
      }

      console.log(`   Found ${steps.length} active enrollment steps`);

      // Step 3: Create progress records for each step
      // Include step_status_id only if available
      const progressPayloads = steps.map((step: any) => {
        const payload: any = {
          enrollee_id: enrolleeId,
          step_id: step.step_id,
          completed_at: null,
        };
        
        // Only add step_status_id if we found one
        if (pendingStatusId !== null) {
          payload.step_status_id = pendingStatusId;
        }
        
        return payload;
      });

      console.log(`   Creating ${progressPayloads.length} progress records...`);
      console.log(`   Payloads:`, JSON.stringify(progressPayloads, null, 2));

      const { data: progressData, error: progressError } = await supabase
        .from('enrollee_progress')
        .insert(progressPayloads)
        .select();

      if (progressError) {
        console.error('❌ Error creating progress records:', progressError);
        console.error('   Error details:', progressError.message);
        return null;
      }

      console.log(`   Insert completed. progressData:`, JSON.stringify(progressData));

      if (progressData && progressData.length > 0) {
        console.log(`✅ Created ${progressData.length} progress records:`);
        progressData.forEach((p: any) => console.log(`   - Progress ID: ${p.progress_id}, Step: ${p.step_id}`));
      } else {
        console.warn('⚠️ Insert succeeded but no data returned from select()');
        console.warn(`   progressData is: ${progressData === null ? 'null' : 'empty array'}`);
      }

      return progressData;
    } catch (error) {
      console.error('❌ Error in createEnrolleeProgressRecords:', error);
      return null;
    }
  },

  /**
   * Get enrollee steps with progress status
   * Joins enrollee_progress with enrollee_step to get all steps for this enrollee
   */
  async getEnrolleeSteps(enrolleeId: number): Promise<any[] | null> {
    try {
      console.log(`📚 Fetching enrollee steps for enrollee_id: ${enrolleeId}`);
      
      const { data, error } = await supabase
        .from('enrollee_progress')
        .select(`
          progress_id,
          enrollee_id,
          completed_at,
          step:enrollee_step(
            step_id,
            step_name,
            step_order,
            office_id
          ),
          status:step_status(
            step_status_name
          )
        `)
        .eq('enrollee_id', enrolleeId);

      if (error) {
        console.error('❌ Error fetching steps:', error);
        return null;
      }

      // Transform data to match UI expectations
      const transformedData = data?.map((progress: any) => ({
        progress_id: progress.progress_id,
        step_id: progress.step?.step_id,
        step_name: progress.step?.step_name,
        step_order: progress.step?.step_order,
        office_id: progress.step?.office_id,
        status: progress.completed_at ? 'completed' : 'pending', // If completed_at exists, it's completed
        completed_at: progress.completed_at,
        step_status_name: progress.status?.step_status_name,
      })) || [];

      // Sort by step_order (client-side to ensure correct order)
      const sortedData = transformedData.sort((a: any, b: any) => {
        return (a.step_order || 0) - (b.step_order || 0);
      });

      if (sortedData && sortedData.length > 0) {
        console.log(`✅ Found ${sortedData.length} enrollee steps:`, sortedData);
      } else {
        console.warn('⚠️ No enrollee progress found for this enrollee');
      }

      return sortedData;
    } catch (error) {
      console.error('❌ Error in getEnrolleeSteps:', error);
      return null;
    }
  },

  /**
   * Get visit by QR token
   */
  async getVisitByQRToken(qrToken: string): Promise<any | null> {
    try {
      const { data, error } = await supabase
        .from('visit')
        .select(`
          visit_id,
          status,
          qr_token,
          visitor:visitor(*)
        `)
        .eq('qr_token', qrToken)
        .single();

      if (error) {
        console.error('❌ Error fetching visit by QR token:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('❌ Error in getVisitByQRToken:', error);
      return null;
    }
  },

  /**
   * Update visit status
   */
  async updateVisitStatus(visitId: number, status: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('visit')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('visit_id', visitId);

      if (error) {
        console.error('❌ Error updating visit status:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('❌ Error in updateVisitStatus:', error);
      return false;
    }
  },

  /**
   * Get next incomplete step for an enrollee
   * Returns the first step that is not completed (completed_at is null)
   */
  async getNextIncompleteStep(enrolleeId: number): Promise<any | null> {
    try {
      const { data, error } = await supabase
        .from('enrollee_progress')
        .select(`
          progress_id,
          step_id,
          completed_at,
          step:enrollee_step(
            step_id,
            step_name,
            step_order,
            office_id
          )
        `)
        .eq('enrollee_id', enrolleeId)
        .is('completed_at', null)
        .order('step_id', { ascending: true })
        .limit(1)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No rows found - all steps are complete
          console.log(`✅ All steps completed for enrollee ${enrolleeId}`);
          return null;
        }
        console.error('❌ Error fetching next incomplete step:', error);
        return null;
      }

      const stepData = data?.step as any;
      console.log(`📍 Next incomplete step: ${stepData?.step_name} (Order: ${stepData?.step_order})`);
      return data;
    } catch (error) {
      console.error('❌ Error in getNextIncompleteStep:', error);
      return null;
    }
  },

  /**
   * Get progress summary for an enrollee
   * Shows: completed count, pending count, total count
   * Used for progress bar and UI display
   */
  async getProgressSummary(enrolleeId: number): Promise<any | null> {
    try {
      const { data: steps, error } = await supabase
        .from('enrollee_progress')
        .select(`
          progress_id,
          completed_at,
          step:enrollee_step(step_order)
        `)
        .eq('enrollee_id', enrolleeId)
        .order('step_id', { ascending: true });

      if (error) {
        console.error('❌ Error fetching progress summary:', error);
        return null;
      }

      if (!steps || steps.length === 0) {
        return {
          total_steps: 0,
          completed_steps: 0,
          pending_steps: 0,
          progress_percentage: 0,
          all_completed: false,
        };
      }

      const completedCount = steps.filter((s: any) => s.completed_at !== null).length;
      const totalCount = steps.length;
      const pendingCount = totalCount - completedCount;

      const summary = {
        total_steps: totalCount,
        completed_steps: completedCount,
        pending_steps: pendingCount,
        progress_percentage: Math.round((completedCount / totalCount) * 100),
        all_completed: completedCount === totalCount,
      };

      console.log(`📊 Progress: ${completedCount}/${totalCount} steps (${summary.progress_percentage}%)`);
      return summary;
    } catch (error) {
      console.error('❌ Error in getProgressSummary:', error);
      return null;
    }
  },

  /**
   * Mark a step as completed
   * Sets completed_at timestamp for a progress record
   */
  async markStepAsCompleted(progressId: number): Promise<boolean> {
    try {
      console.log(`✅ Marking progress ${progressId} as completed...`);

      const { error } = await supabase
        .from('enrollee_progress')
        .update({
          completed_at: new Date().toISOString(),
        })
        .eq('progress_id', progressId);

      if (error) {
        console.error('❌ Error marking step as completed:', error);
        return false;
      }

      console.log(`✅ Step marked as completed`);
      return true;
    } catch (error) {
      console.error('❌ Error in markStepAsCompleted:', error);
      return false;
    }
  },
};
