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


export const enrolleeService = {
  /**
   * Extract data from ID using OCR.Space API and intelligent multi-ID parsing
   * 
   * Supports 17 different Philippine ID types
   */
  async extractDataFromID(base64Image: string): Promise<(IDExtractionData & { confidence: 'high' | 'medium' | 'low' }) | null> {
    try {
      console.log('\n\n========== ID EXTRACTION PROCESS STARTED ==========\n');
      
      // STEP 1: OCR
      console.log('📊 STEP 1: Calling OCR.Space API');
      console.log('   Status: Sending image to OCR.Space...');
      
      const ocrRawText = await extractDataFromIDViaBackend(base64Image);
      
      if (!ocrRawText) {
        console.error('\n❌ STEP 1 FAILED: OCR.Space did not return text');
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
      
      const extractedFields = [];
      const missingFields = [];
      
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
        confidence: parsedData.confidence,
        detectedIdType: parsedData.detectedIdType,
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
      
      const visitorPayload = {
        first_name: enrolleeData.firstName,
        last_name: enrolleeData.lastName,
        contact_no: enrolleeData.contactNo || null,
        // Use storage file path if available (from new storage service)
        visitor_photo_with_id_url: enrolleeData.idPhotoUri || null,
        pass_number: enrolleeData.passNumber,
        control_number: enrolleeData.controlNumber,
        address_id: addressId || null,
        created_at: new Date().toISOString(),
      };
      
      console.log('   Payload:', JSON.stringify(visitorPayload, null, 2));

      const { data: visitorData, error: visitorError } = await supabase
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

      if (!visitorData || !visitorData.visitor_id) {
        console.error('\n❌ VISITOR CREATED BUT NO DATA RETURNED');
        throw new Error('Visitor was created but database returned null');
      }

      console.log(`✅ Visitor created with ID: ${visitorData.visitor_id}`);
      console.log(`   Record: ${JSON.stringify(visitorData)}`);

      // Create enrollee record
      console.log('\n📝 Creating enrollee record...');
      
      const enrolleePayload = {
        visitor_id: visitorData.visitor_id,
        status: 'pending',
        updated_at: new Date().toISOString(),
      };
      
      console.log('   Payload:', JSON.stringify(enrolleePayload));

      const { data: enrolleeRecData, error: enrolleeError } = await supabase
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

      if (!enrolleeRecData || !enrolleeRecData.enrollee_id) {
        console.error('\n❌ ENROLLEE CREATED BUT NO DATA RETURNED');
        throw new Error('Enrollee was created but database returned null');
      }

      console.log(`✅ Enrollee created with ID: ${enrolleeRecData.enrollee_id}`);

      // Create visit record
      console.log('\n🎫 Creating visit record...');
      
      const visitPayload = {
        visitor_id: visitorData.visitor_id,
        enrollee_id: enrolleeRecData.enrollee_id,
        qr_token: enrolleeData.qrToken,
        status: 'pending',
        created_at: new Date().toISOString(),
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
          status,
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
   * Get enrollee steps
   */
  async getEnrolleeSteps(enrolleeId: number): Promise<any[] | null> {
    try {
      const { data, error } = await supabase
        .from('enrollee_progress')
        .select('*')
        .eq('enrollee_id', enrolleeId);

      if (error) {
        console.error('❌ Error fetching steps:', error);
        return null;
      }

      return data || [];
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
};
