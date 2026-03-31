/**
 * Enrollee Service
 * Handles enrollee registration, ID extraction, and status tracking
 * Works with your existing database schema
 * 
 * NOTE: OCR is handled via backend API to support React Native/Expo
 * See: utils/ocr-service.ts for backend API integration
 * 
 * Parser: Multi-ID system that supports 17 Philippine ID types
 * Automatically detects ID type and routes to appropriate parser
 */

import type { EnrolleeQRData, IDExtractionData } from '@/types/enrollee';
import { extractDataFromIDViaBackend } from '@/utils/ocr-service';
import {
    formatParsedData,
    getConfidenceMessage,
    parseIDText,
    validateParsedData
} from './id-multi-parser';
import { supabase } from './supabase';


export const enrolleeService = {
  /**
   * Extract data from ID using OCR.Space API and intelligent multi-ID parsing
   * 
   * Supports 17 different Philippine ID types:
   * 1. Philippine National ID (PhilSys ID)
   * 2. Philippine Passport
   * 3. Driver's License (LTO Philippines)
   * 4. UMID Card
   * 5. PRC ID
   * 6. TIN ID
   * 7. Postal ID
   * 8. Voter's ID
   * 9. Senior Citizen ID
   * 10. PWD ID
   * 11. PhilHealth ID
   * 12. SSS ID
   * 13. School ID
   * 14. Company / Employee ID
   * 15. Barangay ID / Clearance
   * 16. Police Clearance
   * 17. NBI Clearance
   * 
   * Process:
   * 1. Send image to OCR.Space API to extract raw text
   * 2. Auto-detect ID type from extracted text keywords
   * 3. Route to type-specific parser for optimal extraction
   * 4. Extract first_name, last_name, address (if available)
   * 5. Return structured data with confidence level
   * 
   * Returns:
   * - IDExtractionData with extracted fields if successful
   * - null if OCR fails or no critical data extracted
   * 
   * The user will be shown the extracted data and can manually edit
   * if the extraction quality is low or incorrect.
   */
  async extractDataFromID(base64Image: string): Promise<(IDExtractionData & { confidence: 'high' | 'medium' | 'low' }) | null> {
    try {
      console.log('\n\n========== ID EXTRACTION PROCESS STARTED ==========\n');
      
      // ==================== STEP 1: OCR ====================
      console.log('📊 STEP 1: Calling OCR.Space API');
      console.log('   Status: Sending image to OCR.Space...');
      
      const ocrRawText = await extractDataFromIDViaBackend(base64Image);
      
      // Check OCR result
      if (!ocrRawText) {
        console.error('\n❌ STEP 1 FAILED: OCR.Space did not return text');
        console.error('   Reason: ParsedResults missing OR ParsedText is empty');
        console.error('\n📋 This means:');
        console.error('   • OCR.Space could not read the ID image');
        console.error('   • Possible causes: blurry, poor lighting, bad quality');
        console.error('   • User will need to retake the photo or enter data manually');
        return null;
      }

      console.log('\n✅ STEP 1 SUCCESS: OCR.Space returned raw text');
      console.log(`   ✓ Text received: ${ocrRawText.length} characters`);
      console.log(`   ✓ Lines: ${ocrRawText.trim().split('\n').length}`);
      
      // IMPORTANT: Log the actual raw text so we can see what the OCR returned
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
      
      // ==================== STEP 2: PARSE ====================
      console.log('\n📊 STEP 2: Parsing raw text to extract fields');
      console.log('   Status: Analyzing OCR text for firstName, lastName, address...');
      
      const parsedData = parseIDText(ocrRawText);
      
      console.log('\n✅ STEP 2 COMPLETE: Parser output:');
      console.log(`   ✓ firstName: "${parsedData.firstName || '(not found)'}"`);
      console.log(`   ✓ lastName: "${parsedData.lastName || '(not found)'}"`);
      console.log(`   ✓ address: "${parsedData.address.substring(0, 60) || '(not found)'}${parsedData.address.length > 60 ? '...' : ''}"`);
      console.log(`   ✓ confidence: ${parsedData.confidence}`);
      
      // ==================== STEP 3: VALIDATE ====================
      console.log('\n📊 STEP 3: Validating parsed data');
      console.log('   Status: Checking if ANY field was extracted...');
      
      const isValid = validateParsedData(parsedData);
      
      if (!isValid) {
        console.error('\n❌ STEP 3 FAILED: No fields could be extracted');
        console.error('   Reason: Parser could not identify firstName, lastName, or address');
        console.error('\n📋 This means:');
        console.error('   • OCR.Space read the image successfully');
        console.error('   • BUT: The text could not be parsed to find name/address fields');
        console.error('   • Possible causes: unusual ID format, corrupted text, unrecognized layout');
        console.error('   • User will need to enter data manually');
        return null;
      }

      console.log('\n✅ STEP 3 SUCCESS: At least ONE field was validated');
      
      // ==================== STEP 4: RETURN ====================
      console.log('\n📊 STEP 4: Formatting and returning extracted data');
      
      const formattedData = formatParsedData(parsedData);
      const message = getConfidenceMessage(parsedData.confidence);
      
      const extractedFields = [];
      if (formattedData.firstName) extractedFields.push('firstName');
      if (formattedData.lastName) extractedFields.push('lastName');
      if (formattedData.address) extractedFields.push('address');
      
      console.log(`\n✅ FINAL RESULT: Extraction successful`);
      console.log(`   ✓ Confidence: ${parsedData.confidence}`);
      console.log(`   ✓ Fields extracted: ${extractedFields.join(', ')}`);
      console.log(`   ✓ Message: ${message}`);
      console.log('\n========== ID EXTRACTION PROCESS COMPLETED ==========\n');
      
      return {
        firstName: parsedData.firstName,
        lastName: parsedData.lastName,
        address: parsedData.address,
        confidence: parsedData.confidence,
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
   * Works with your actual database schema
   */
  async createEnrollee(enrolleeData: {
    firstName: string;
    lastName: string;
    address: string;
    contactNo?: string;
    facePhotoUri?: string;
    idPhotoUri?: string;
    passNumber: string;
    controlNumber: string;
    qrToken: string;
  }): Promise<{ enrollee_id: number; visitor_id: number; visit_id?: number } | null> {
    try {
      console.log('💾 Creating visitor and enrollee record...');

      // Step 1: Create visitor record first
      const { data: visitorData, error: visitorError } = await supabase
        .from('visitor')
        .insert([
          {
            first_name: enrolleeData.firstName,
            last_name: enrolleeData.lastName,
            address: enrolleeData.address,
            contact_no: enrolleeData.contactNo || null,
            visitor_photo_with_id_url: enrolleeData.idPhotoUri || null,
            pass_number: enrolleeData.passNumber,
            control_number: enrolleeData.controlNumber,
            created_at: new Date().toISOString(),
          },
        ])
        .select()
        .single();

      if (visitorError) {
        console.error('❌ Visitor creation error:', visitorError);
        throw visitorError;
      }

      console.log('✅ Visitor created:', visitorData.visitor_id);

      // Step 2: Create enrollee record linked to visitor
      const { data: enrolleeRecData, error: enrolleeError } = await supabase
        .from('enrollee')
        .insert([
          {
            visitor_id: visitorData.visitor_id,
            status: 'pending',
            updated_at: new Date().toISOString(),
          },
        ])
        .select()
        .single();

      if (enrolleeError) {
        console.error('❌ Enrollee creation error:', enrolleeError);
        throw enrolleeError;
      }

      console.log('✅ Enrollee created:', enrolleeRecData.enrollee_id);

      // Step 3: Create visit record with qr_token for office scanning
      const { data: visitData, error: visitError } = await supabase
        .from('visit')
        .insert([
          {
            visitor_id: visitorData.visitor_id,
            enrollee_id: enrolleeRecData.enrollee_id,
            qr_token: enrolleeData.qrToken,
            status: 'pending',
            created_at: new Date().toISOString(),
          },
        ])
        .select()
        .single();

      if (visitError) {
        console.warn('⚠️ Visit record creation error (non-critical):', visitError);
        // Don't throw - visit is optional for basic functionality
      } else {
        console.log('✅ Visit record created:', visitData.visit_id);
      }

      return {
        enrollee_id: enrolleeRecData.enrollee_id,
        visitor_id: visitorData.visitor_id,
        visit_id: visitData?.visit_id,
      };
    } catch (error: any) {
      console.error('❌ Error creating enrollee:', error);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        status: error.status,
      });
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
          *,
          visitor:visitor_id (
            visitor_id,
            first_name,
            last_name,
            address,
            contact_no,
            pass_number
          )
        `)
        .eq('enrollee_id', enrolleeId)
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('❌ Error fetching enrollee:', error);
      return null;
    }
  },

  /**
   * Get enrollee steps with their completion status
   */
  async getEnrolleeSteps(enrolleeId: number) {
    try {
      const { data, error } = await supabase
        .from('enrollee_step')
        .select(`
          step_id,
          step_name,
          step_order,
          is_active,
          office:office_id (office_id, office_name)
        `)
        .order('step_order', { ascending: true });

      if (error) throw error;

      // Get progress for this enrollee
      const { data: progressData, error: progressError } = await supabase
        .from('enrollee_progress')
        .select(`
          step_id,
          step_status:step_status_id (step_status_name),
          completed_at
        `)
        .eq('enrollee_id', enrolleeId);

      if (progressError) throw progressError;

      // Merge steps with progress
      const stepsWithProgress = data.map(step => {
        const progress = progressData?.find(p => p.step_id === step.step_id);
        const statusObj = progress?.step_status as any;
        const statusName = Array.isArray(statusObj) 
          ? statusObj[0]?.step_status_name 
          : statusObj?.step_status_name;
        return {
          ...step,
          status: statusName || 'pending',
          completed_at: progress?.completed_at,
        };
      });

      return stepsWithProgress;
    } catch (error) {
      console.error('❌ Error fetching enrollee steps:', error);
      return [];
    }
  },

  /**
   * Get enrollee by QR code (pass_number in visitor table)
   */
  async getEnrolleeByQRCode(qrCode: string): Promise<EnrolleeQRData | null> {
    try {
      const { data, error } = await supabase
        .from('visitor')
        .select(`
          visitor_id,
          first_name,
          last_name,
          address,
          contact_no,
          pass_number,
          visitor_photo_with_id_url,
          created_at,
          enrollee:enrollee(enrollee_id, status, updated_at)
        `)
        .eq('pass_number', qrCode)
        .single();

      if (error) throw error;

      return {
        enrollee_id: data.enrollee[0]?.enrollee_id,
        first_name: data.first_name,
        last_name: data.last_name,
        address: data.address,
        registration_date: data.created_at,
        status: data.enrollee[0]?.status,
        facePhotoUri: data.visitor_photo_with_id_url,
        idPhotoUri: data.visitor_photo_with_id_url,
      };
    } catch (error) {
      console.error('❌ Error fetching enrollee by QR code:', error);
      return null;
    }
  },

  /**
   * Get visit and enrollee details by QR token
   * Used by office portal to scan QR codes and display enrollment status
   */
  async getVisitByQRToken(qrToken: string): Promise<any | null> {
    try {
      console.log('🔍 Fetching visit data by QR token:', qrToken);

      const { data, error } = await supabase
        .from('visit')
        .select(`
          visit_id,
          visitor_id,
          enrollee_id,
          qr_token,
          status,
          created_at,
          visitor:visitor_id (
            visitor_id,
            first_name,
            last_name,
            address,
            contact_no,
            pass_number
          ),
          enrollee:enrollee_id (
            enrollee_id,
            status,
            updated_at
          )
        `)
        .eq('qr_token', qrToken)
        .single();

      if (error) {
        console.warn('⚠️ Visit not found for QR token:', qrToken);
        return null;
      }

      console.log('✅ Visit found:', (data as any).visit_id);

      const enrolleeData = Array.isArray((data as any).enrollee) 
        ? (data as any).enrollee[0] 
        : (data as any).enrollee;

      return {
        visitId: (data as any).visit_id,
        visitorId: (data as any).visitor_id,
        enrolleeId: (data as any).enrollee_id,
        qrToken: (data as any).qr_token,
        visitStatus: (data as any).status,
        createdAt: (data as any).created_at,
        visitor: (data as any).visitor,
        enrollee: enrolleeData,
      };
    } catch (error) {
      console.error('❌ Error fetching visit by QR token:', error);
      return null;
    }
  },

  /**
   * Update visit status (when office scans and marks completion)
   */
  async updateVisitStatus(visitId: number, status: 'pending' | 'completed'): Promise<boolean> {
    try {
      console.log(`🔄 Updating visit ${visitId} status to ${status}...`);

      const { error } = await supabase
        .from('visit')
        .update({ status, updated_at: new Date().toISOString() })
        .eq('visit_id', visitId);

      if (error) {
        console.error('❌ Visit status update error:', error);
        return false;
      }

      console.log('✅ Visit status updated');
      return true;
    } catch (error) {
      console.error('❌ Error updating visit status:', error);
      return false;
    }
  },

  /**
   * Update enrollee status
   */
  async updateEnrolleeStatus(
    enrolleeId: number,
    status: 'pending' | 'in-progress' | 'completed'
  ) {
    try {
      const { data, error } = await supabase
        .from('enrollee')
        .update({
          status,
          updated_at: new Date().toISOString(),
        })
        .eq('enrollee_id', enrolleeId)
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('❌ Error updating enrollee status:', error);
      return null;
    }
  },

  /**
   * Update enrollee step progress
   */
  async updateEnrolleeStepProgress(
    enrolleeId: number,
    stepId: number,
    statusName: string
  ) {
    try {
      // First get the step_status_id for the status name
      const { data: statusData, error: statusError } = await supabase
        .from('step_status')
        .select('step_status_id')
        .eq('step_status_name', statusName)
        .single();

      if (statusError) throw statusError;

      // Update or create progress record
      const { data, error } = await supabase
        .from('enrollee_progress')
        .upsert(
          {
            enrollee_id: enrolleeId,
            step_id: stepId,
            step_status_id: statusData.step_status_id,
            completed_at: statusName === 'completed' ? new Date().toISOString() : null,
          },
          { onConflict: 'enrollee_id,step_id' }
        )
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('❌ Error updating enrollee step progress:', error);
      return null;
    }
  },
};
