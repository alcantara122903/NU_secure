/**
 * Enrollee Service
 * Handles enrollee registration, ID extraction, and status tracking
 * Works with your existing database schema
 * 
 * NOTE: OCR is handled via backend API to support React Native/Expo
 * See: utils/ocr-service.ts for backend API integration
 */

import type { EnrolleeQRData, IDExtractionData } from '@/types/enrollee';
import { extractDataFromIDViaBackend } from '@/utils/ocr-service';
import {
    formatParsedData,
    getConfidenceMessage,
    parseIDText,
    validateParsedData
} from './id-parser';
import { supabase } from './supabase';


export const enrolleeService = {
  /**
   * Extract data from ID using OCR (Tesseract.js) and intelligent auto-detection parsing
   * 
   * Supports multiple ID formats with automatic detection:
   * - National ID / Citizen ID
   * - Driver's License
   * - Company/Employee ID
   * - Passport (photo page)
   * - Philippine ID / PhilHealth
   * - Generic IDs (auto-detects format)
   * 
   * Process:
   * 1. Initialize OCR engine (Tesseract.js)
   * 2. Convert base64 image to processable format
   * 3. Run OCR to extract text from ID image
   * 4. Auto-detect ID format from extracted text
   * 5. Parse extracted text to find first_name, last_name, address
   * 6. Return structured data or null if incomplete
   * 
   * Returns:
   * - IDExtractionData with extracted fields if successful
   * - null if OCR fails or critical data (name) is missing
   * 
   * The user will be shown the extracted data and can manually edit
   * if the extraction quality is low or incorrect.
   */
  async extractDataFromID(base64Image: string): Promise<(IDExtractionData & { confidence: 'high' | 'medium' | 'low' }) | null> {
    try {
      console.log('🔍 Starting ID extraction process...');
      
      // Step 1: Send image to backend OCR service
      console.log('📤 Sending image to backend OCR service...');
      const extractedText = await extractDataFromIDViaBackend(base64Image);
      
      if (!extractedText) {
        console.warn('⚠️ Backend OCR returned no text');
        return null;
      }

      console.log(`✅ Backend OCR extracted ${extractedText.length} characters`);
      if (extractedText.length > 0) {
        console.log('📝 Sample:', extractedText.substring(0, 150).replace(/\n/g, ' | '));
      }
      
      // Step 2: Parse extracted text
      console.log('🔍 Parsing extracted text to structured data...');
      const parsedData = parseIDText(extractedText);
      
      // Step 3: Validate parsed data
      if (!validateParsedData(parsedData)) {
        console.warn('⚠️ Validation failed - critical fields missing');
        console.log(`   First Name: "${parsedData.firstName}"`);
        console.log(`   Last Name: "${parsedData.lastName}"`);
        return null;
      }
      
      // Step 4: Format and return
      const formattedData = formatParsedData(parsedData);
      const message = getConfidenceMessage(parsedData.confidence);
      console.log(`✅ Extraction successful (${parsedData.confidence} confidence)`);
      console.log(`   ${message}`);
      
      return {
        firstName: formattedData.firstName,
        lastName: formattedData.lastName,
        address: formattedData.address,
        confidence: parsedData.confidence,
      };
    } catch (error) {
      console.error('❌ Error in ID extraction:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('   Details:', errorMessage);
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
    qrCode: string;
  }): Promise<{ enrollee_id: number; visitor_id: number } | null> {
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
            pass_number: enrolleeData.qrCode,
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

      return {
        enrollee_id: enrolleeRecData.enrollee_id,
        visitor_id: visitorData.visitor_id,
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
