/**
 * OCR Service
 * Handles OCR processing via backend API with professional error handling
 * 
 * IMPORTANT:
 * - Backend must be running: node BACKEND_OCR_SERVICE.js
 * - Backend listens on: http://192.168.68.104:3000
 * - Phone must be on same WiFi network
 */

// Replace with your actual machine IP
let OCR_API_ENDPOINT = 'http://192.168.68.104:3000/api/ocr/extract';

// Track if backend is available
let backendAvailable = true;
let lastBackendCheckTime = 0;

/**
 * Check if backend is available (with caching)
 * Prevents excessive health checks
 */
const isBackendAvailable = async (): Promise<boolean> => {
  const now = Date.now();
  
  // Only check every 30 seconds
  if (!backendAvailable && (now - lastBackendCheckTime) < 30000) {
    return false;
  }

  try {
    // Create timeout using Promise.race
    const healthUrl = OCR_API_ENDPOINT.replace('/api/ocr/extract', '') + '/health';
    
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Health check timeout')), 5000);
    });
    
    const fetchPromise = fetch(healthUrl, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });
    
    const response = await Promise.race([fetchPromise, timeoutPromise]);
    
    lastBackendCheckTime = now;
    backendAvailable = (response as Response).ok;
    return backendAvailable;
  } catch (err) {
    lastBackendCheckTime = now;
    backendAvailable = false;
    console.warn('⚠️  Health check failed:', (err as Error).message);
    return false;
  }
};

/**
 * Extract text from ID image using backend OCR service
 * Falls back gracefully if backend is unavailable
 */
export const extractDataFromIDViaBackend = async (base64Image: string): Promise<string | null> => {
  try {
    console.log('📤 Sending image to OCR backend...');
    
    // Strip data URL prefix if present (e.g., "data:image/jpeg;base64,")
    let cleanBase64 = base64Image;
    if (base64Image.includes('data:')) {
      cleanBase64 = base64Image.split(',')[1] || base64Image;
      console.log('✅ Stripped data URL prefix from base64');
    }
    
    // Check if backend is available
    const available = await isBackendAvailable();
    if (!available) {
      console.warn('⚠️  Backend OCR service not available');
      console.log('💡 Make sure backend is running: node BACKEND_OCR_SERVICE.js');
      console.log('💡 Verify IP: http://192.168.68.104:3000/health');
      return null;
    }

    console.log('✅ Backend available, sending OCR request...');
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000);

    console.log('⏳ Processing... (this may take 10-30 seconds)');
    
    const response = await fetch(OCR_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        image: cleanBase64,
        format: 'GENERIC',
      }),
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
      
      const errorMsg = errorData?.error || `HTTP ${response.status}`;
      console.error('❌ Backend error:', errorMsg);
      backendAvailable = false;
      return null;
    }

    const data = await response.json();
    
    if (!data.text) {
      console.warn('⚠️  Backend returned no extracted text');
      console.warn('   This may happen with blurry or low-contrast images');
      return null;
    }

    console.log(`✅ OCR Success! Extracted ${data.text.length} characters in ${data.processingTime}ms`);
    return data.text;
    
  } catch (error) {
    const err = error as any;
    
    if (err.name === 'AbortError') {
      console.error('❌ OCR request timed out (>120 seconds)');
    } else if (err.message?.includes('Network')) {
      console.error('❌ Network error - backend unreachable');
    } else {
      console.error('❌ Error calling OCR backend:', err?.message || String(error));
    }
    
    backendAvailable = false;
    return null;
  }
};

/**
 * Test if backend is reachable from phone
 * Call this to diagnose connectivity issues
 */
export const testBackendConnection = async (): Promise<{ success: boolean; message: string }> => {
  try {
    console.log('🔌 Testing connection to backend...');
    console.log(`   Endpoint: ${OCR_API_ENDPOINT}`);
    
    const testUrl = OCR_API_ENDPOINT.replace('/api/ocr/extract', '') + '/api/test';
    
    const timeoutPromise = new Promise<Response>((_, reject) => {
      setTimeout(() => reject(new Error('Test timeout')), 5000);
    });
    
    const fetchPromise = fetch(testUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ test: true }),
    });
    
    const response = await Promise.race([fetchPromise, timeoutPromise]);

    if (response.ok) {
      const data = await response.json();
      console.log('✅ Backend connection successful!');
      console.log('   Response:', data);
      return { 
        success: true, 
        message: `✅ Connected! Tesseract ready: ${data.tesseractReady}` 
      };
    } else {
      console.error('❌ Backend returned error status:', response.status);
      return { 
        success: false, 
        message: `❌ Backend error: HTTP ${response.status}` 
      };
    }
  } catch (error) {
    const err = error as any;
    console.error('❌ Connection failed:', err.message);
    
    let message = '❌ Cannot connect to backend\n';
    message += `   Endpoint: ${OCR_API_ENDPOINT}\n`;
    message += `   Error: ${err.message}\n\n`;
    message += 'Troubleshooting:\n';
    message += '1. Is backend running? (node BACKEND_OCR_SERVICE.js)\n';
    message += '2. Is phone on same WiFi as machine?\n';
    message += '3. Is IP address correct? (Check ipconfig)\n';
    
    return { success: false, message };
  }
};

/**
 * Update the OCR API endpoint (for production/different server)
 */
export const setOCREndpoint = (endpoint: string) => {
  OCR_API_ENDPOINT = endpoint;
  backendAvailable = true;
  console.log('✅ OCR endpoint updated to:', endpoint);
};
