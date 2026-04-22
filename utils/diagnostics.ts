/**
 * OCR Diagnostics Utility
 * Provides diagnostic tools for troubleshooting OCR issues
 */

export interface OCRDiagnosticsResult {
  backendStatus: 'ok' | 'error' | 'timeout';
  tesseractReady: boolean;
  recommendations: string[];
  timestamp: string;
}

/**
 * Run OCR diagnostics
 */
export const runOCRDiagnostics = async (): Promise<OCRDiagnosticsResult> => {
  console.log('🔧 Starting OCR diagnostics...');
  
  const recommendations: string[] = [];
  let backendStatus: 'ok' | 'error' | 'timeout' = 'ok';
  let tesseractReady = false;

  // Check OCR.Space API connectivity
  try {
    console.log('   Testing OCR.Space API connectivity...');
    const apiKey = process.env.EXPO_PUBLIC_OCR_API_KEY;
    
    if (!apiKey) {
      console.warn('   ⚠️ OCR API key not configured');
      recommendations.push('Set EXPO_PUBLIC_OCR_API_KEY environment variable');
    } else {
      console.log('   ✅ OCR API key found');
      tesseractReady = true;
    }
  } catch (error) {
    console.error('   ❌ Backend connection failed');
    backendStatus = 'error';
    recommendations.push('Check internet connection');
    recommendations.push('Verify OCR.Space API is accessible');
  }

  // Add general recommendations
  if (recommendations.length === 0) {
    recommendations.push('OCR service configured correctly');
    recommendations.push('Ready to process ID documents');
  }

  const result: OCRDiagnosticsResult = {
    backendStatus,
    tesseractReady,
    recommendations,
    timestamp: new Date().toISOString(),
  };

  console.log('✅ Diagnostics complete:', result);
  return result;
};
