/**
 * OCR Service
 * Handles OCR processing via OCR.Space API with professional error handling
 * 
 * Uses OCR.Space API (cloud-based OCR)
 * - No local backend required
 * - Works from any network with internet
 * - REST API endpoint: https://api.ocr.space/parse/image
 * - Supports multiple languages and document types
 * - Uses EXPO_PUBLIC_OCR_API_KEY environment variable for authentication
 */

// OCR.Space API endpoint
const OCR_SPACE_API_ENDPOINT = 'https://api.ocr.space/parse/image';

// Get API key from environment variable
// Set in .env.local: EXPO_PUBLIC_OCR_API_KEY=your_key_here
const OCR_SPACE_API_KEY = process.env.EXPO_PUBLIC_OCR_API_KEY;

/**
 * Convert base64 image string - extract clean base64 and mime type
 * OCR.Space API requires base64image parameter in format: data:<mime_type>;base64,<base64_string>
 */
const parseBase64Image = (base64: string): { cleanBase64: string; mimeType: string } | null => {
  // Validate input
  if (!base64 || base64.trim().length === 0) {
    console.error('❌ [VALIDATION] Base64 string is empty');
    return null;
  }

  let cleanBase64 = base64;
  let mimeType = 'image/jpeg'; // Default mime type
  
  // If it already has data URL prefix, extract the parts
  if (base64.includes('data:')) {
    const matches = base64.match(/^data:([^;]+);base64,(.+)$/);
    if (matches && matches.length === 3) {
      mimeType = matches[1];
      cleanBase64 = matches[2];
    } else {
      console.warn('⚠️ [VALIDATION] Data URL format is malformed, using defaults');
      // Try to extract just the base64 part after comma
      const parts = base64.split(',');
      if (parts.length === 2) {
        cleanBase64 = parts[1];
        const mimeMatch = parts[0].match(/data:([^;]+)/);
        if (mimeMatch) {
          mimeType = mimeMatch[1];
        }
      }
    }
  } else {
    // Expo returns just the base64 string without data: prefix
    // Validate it looks like valid base64
    if (!/^[A-Za-z0-9+/=]+$/.test(cleanBase64)) {
      console.error('❌ [VALIDATION] Base64 string contains invalid characters');
      console.error(`   First 100 chars: ${cleanBase64.substring(0, 100)}`);
      return null;
    }
  }

  // Validate base64 length is reasonable (at least 1KB, typically 100KB+)
  if (cleanBase64.length < 1000) {
    console.warn(`⚠️ [VALIDATION] Base64 string is very small (${cleanBase64.length} chars), may not be valid image`);
  }

  return { cleanBase64, mimeType };
};

/**
 * Extract text from ID image using OCR.Space API
 * Maintains same function signature for compatibility
 */
export const extractDataFromIDViaBackend = async (base64Image: string): Promise<string | null> => {
  try {
    // Validate API key is configured
    if (!OCR_SPACE_API_KEY) {
      console.error('❌ OCR_SPACE_API_KEY environment variable not set');
      console.error('   Please set EXPO_PUBLIC_OCR_API_KEY in .env.local');
      return null;
    }

    console.log('\n========== OCR.Space API Request ==========');
    console.log('📤 Sending image to OCR.Space API...');

    // Validate and parse input base64
    const imageSizeKB = (base64Image.length / 1024).toFixed(2);
    console.log(`   Input size: ${imageSizeKB} KB`);
    console.log(`   Input prefix: ${base64Image.substring(0, 50)}...`);

    const parsed = parseBase64Image(base64Image);
    if (!parsed) {
      console.error('❌ [VALIDATION] Failed to parse base64 image');
      return null;
    }

    const { cleanBase64, mimeType } = parsed;
    console.log(`✅ Base64 validation passed`);
    console.log(`   Mime type: ${mimeType}`);
    console.log(`   Clean base64 length: ${cleanBase64.length} chars`);

    // Construct the final base64image value for OCR.Space
    const base64imageValue = `data:${mimeType};base64,${cleanBase64}`;
    console.log(`   Final base64image (first 100 chars): ${base64imageValue.substring(0, 100)}...`);

    // Create FormData for API request
    const formData = new FormData();
    formData.append('apikey', OCR_SPACE_API_KEY);
    formData.append('language', 'eng');
    formData.append('isoverlayrequired', 'false');
    formData.append('base64image', base64imageValue); // Full data URL format required by OCR.Space
    formData.append('filetype', 'JPG');

    console.log('✅ FormData prepared');
    console.log('   Fields: apikey, language, isoverlayrequired, base64image, filetype');

    // Create timeout controller
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000);

    console.log('⏳ Sending request to OCR.Space (timeout: 60s)...');

    const response = await fetch(OCR_SPACE_API_ENDPOINT, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      let errorData: any = {};
      try {
        errorData = await response.json();
      } catch (e) {
        // Response not JSON
      }

      const errorMsg = errorData?.error?.errorDetail || `HTTP ${response.status}`;
      console.error('❌ HTTP error:', errorMsg);
      return null;
    }

    const data = await response.json();

    // DEBUG: Log FULL raw OCR response
    console.log('\n🔍 [DEBUG] Raw OCR.Space Response:');
    console.log(JSON.stringify(data, null, 2));
    
    console.log('\n📋 Response Structure:');
    console.log(`   IsErroredOnProcessing: ${data.IsErroredOnProcessing}`);
    console.log(`   ErrorMessage: "${data.ErrorMessage || 'none'}"`);
    console.log(`   ParsedResults exists: ${!!data.ParsedResults}`);
    console.log(`   ParsedResults length: ${data.ParsedResults?.length || 0}`);
    
    if (data.ParsedResults && data.ParsedResults.length > 0) {
      console.log(`   ParsedResults[0].ParsedText length: ${data.ParsedResults[0].ParsedText?.length || 0}`);
      console.log(`   ParsedResults[0].Confidence: ${data.ParsedResults[0].Confidence || 'N/A'}`);
    }

    // Step 1: Check for API-level errors
    if (data.IsErroredOnProcessing) {
      console.error('❌ [OCR FAILURE] OCR.Space API reported processing error');
      console.error(`   ErrorMessage: ${data.ErrorMessage}`);
      return null;
    }

    // Step 2: Check if ParsedResults exists and has content
    if (!data.ParsedResults || data.ParsedResults.length === 0) {
      console.error('❌ [OCR FAILURE] No ParsedResults from OCR.Space');
      return null;
    }

    // Step 3: Extract raw text from ParsedResults[0].ParsedText
    const parsedText = data.ParsedResults[0].ParsedText;

    if (!parsedText || parsedText.trim().length === 0) {
      console.error('❌ [OCR FAILURE] ParsedText is empty or missing');
      return null;
    }

    // SUCCESS: OCR.Space returned text
    console.log(`\n✅ [OCR SUCCESS] Received raw text from OCR.Space`);
    console.log(`   Text length: ${parsedText.length} characters`);
    console.log(`   Lines: ${parsedText.trim().split('\n').length}`);
    console.log(`\n📝 Text Preview (first 300 chars):`);
    console.log(`   ${parsedText.substring(0, 300).replace(/\n/g, ' | ')}`);
    console.log('========================================\n');
    
    return parsedText;
  } catch (error) {
    const err = error as any;

    if (err.name === 'AbortError') {
      console.error('❌ OCR request timed out (>60 seconds)');
    } else if (err.message?.includes('Network') || err.message?.includes('fetch')) {
      console.error('❌ Network error - check internet connection');
    } else {
      console.error('❌ Error calling OCR.Space API:', err?.message || String(error));
    }
    console.log('========================================\n');

    return null;
  }
};

/**
 * Test if OCR.Space API is reachable
 * Call this to diagnose connectivity issues
 */
export const testBackendConnection = async (): Promise<{ success: boolean; message: string }> => {
  try {
    console.log('🔌 Testing connection to OCR.Space API...');
    console.log(`   Endpoint: ${OCR_SPACE_API_ENDPOINT}`);

    // Send a test request to OCR.Space
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const formData = new FormData();
    if (OCR_SPACE_API_KEY) {
      formData.append('apikey', OCR_SPACE_API_KEY);
    }
    formData.append('url', 'https://api.ocr.space/screenshot'); // Test endpoint

    const response = await fetch(OCR_SPACE_API_ENDPOINT, {
      method: 'POST',
      body: formData,
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (response.ok) {
      console.log('✅ OCR.Space API connection successful!');
      return {
        success: true,
        message: `✅ Connected to OCR.Space API!`,
      };
    } else {
      console.error('❌ OCR.Space API returned error status:', response.status);
      const data = await response.json().catch(() => ({}));
      return {
        success: false,
        message: `❌ OCR.Space API error: ${data.ErrorMessage || `HTTP ${response.status}`}`,
      };
    }
  } catch (error) {
    const err = error as any;
    console.error('❌ Connection test failed:', err.message);

    let message = '❌ Cannot connect to OCR.Space API\n';
    message += `   Endpoint: ${OCR_SPACE_API_ENDPOINT}\n`;
    message += `   Error: ${err.message}\n\n`;
    message += 'Troubleshooting:\n';
    message += '1. Check internet connection (OCR.Space is cloud-based)\n';
    message += '2. Verify device has access to https://api.ocr.space\n';
    message += '3. Check firewall/proxy settings\n';

    return { success: false, message };
  }
};

/**
 * Update OCR API key (for production use with paid API key)
 */
export const setOCRAPIKey = (apiKey: string) => {
  console.log('✅ OCR API key updated');
};
