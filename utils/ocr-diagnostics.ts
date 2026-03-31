/**
 * OCR Diagnostics Tool
 * Helps troubleshoot OCR extraction issues
 */

import { testBackendConnection } from './ocr-service';

export interface DiagnosticResult {
  backendStatus: 'ok' | 'error';
  backendMessage: string;
  tesseractReady: boolean;
  recommendations: string[];
}

/**
 * Run full OCR diagnostics
 */
export const runOCRDiagnostics = async (): Promise<DiagnosticResult> => {
  const recommendations: string[] = [];
  let backendStatus: 'ok' | 'error' = 'error';
  let backendMessage = '';
  let tesseractReady = false;

  console.log('\n' + '='.repeat(60));
  console.log('🔧 RUNNING OCR DIAGNOSTICS');
  console.log('='.repeat(60));

  try {
    console.log('\n1️⃣  Testing backend connection...');
    const connectionTest = await testBackendConnection();

    if (connectionTest.success) {
      backendStatus = 'ok';
      backendMessage = 'Backend is reachable ✅';
      tesseractReady = connectionTest.message.includes('true');
      console.log('✅ PASS: Backend is accessible');

      if (tesseractReady) {
        console.log('✅ PASS: Tesseract is ready');
      } else {
        console.log('⚠️  WARNING: Tesseract not fully initialized');
        recommendations.push(
          'Tesseract is initializing (takes 10-30 seconds on first run). Wait a moment and try again.'
        );
      }
    } else {
      backendStatus = 'error';
      backendMessage = connectionTest.message;
      console.log('❌ FAIL: Backend not reachable');
      console.log(`   Reason: ${connectionTest.message}`);

      recommendations.push(
        'CRITICAL: Backend service is not running!'
      );
      recommendations.push(
        '   Run on your PC: node BACKEND_OCR_SERVICE.js'
      );
      recommendations.push(
        '   Then verify: curl http://192.168.68.104:3000/health'
      );
      recommendations.push(
        '   Ensure phone and PC are on the same WiFi network'
      );
    }
  } catch (error) {
    console.error('❌ Diagnostic error:', error);
    backendStatus = 'error';
    backendMessage = `Diagnostic failed: ${error}`;
    recommendations.push(
      'An unexpected error occurred during diagnostics'
    );
  }

  console.log('\n' + '='.repeat(60));
  console.log('📋 DIAGNOSTIC SUMMARY');
  console.log('='.repeat(60));
  console.log(`Backend Status: ${backendStatus === 'ok' ? '✅ OK' : '❌ ERROR'}`);
  console.log(`Message: ${backendMessage}`);
  console.log(`Tesseract Ready: ${tesseractReady ? '✅ Yes' : '❌ No'}`);

  if (recommendations.length > 0) {
    console.log('\n💡 RECOMMENDATIONS:');
    recommendations.forEach((rec, i) => {
      console.log(`${i + 1}. ${rec}`);
    });
  }

  console.log('='.repeat(60) + '\n');

  return {
    backendStatus,
    backendMessage,
    tesseractReady,
    recommendations,
  };
};

/**
 * Check specific OCR requirement
 */
export const checkOCRRequirement = async (requirement: 'backend' | 'network' | 'image'): Promise<boolean> => {
  switch (requirement) {
    case 'backend':
      console.log('🔍 Checking if OCR backend is running...');
      const result = await testBackendConnection();
      if (result.success) {
        console.log('✅ Backend is running');
        return true;
      } else {
        console.log('❌ Backend is NOT running');
        console.log(`   Error: ${result.message}`);
        return false;
      }

    case 'network':
      console.log('🔍 Checking network connectivity...');
      try {
        const response = await fetch('http://192.168.68.104:3000/health', {
          method: 'GET',
        });
        if (response.ok) {
          console.log('✅ Network connectivity OK');
          return true;
        } else {
          console.log('❌ Backend is not responding correctly');
          return false;
        }
      } catch (error) {
        console.log('❌ Network error:' , error);
        return false;
      }

    case 'image':
      console.log('🔍 Checking image handling...');
      console.log('   - Image must be: JPEG, PNG (not too blurry)');
      console.log('   - Image must contain readable text');
      console.log('   - Image size: ideally 100-500 KB');
      console.log('✅ Image requirements listed above');
      return true;

    default:
      return false;
  }
};

/**
 * Provide troubleshooting steps for common OCR issues
 */
export const getTroubleshootingSteps = (error: string): string[] => {
  const steps: string[] = [];

  if (error.toLowerCase().includes('backend') || error.toLowerCase().includes('network')) {
    steps.push('Step 1: Is the backend running?');
    steps.push('  → Run: node BACKEND_OCR_SERVICE.js');
    steps.push('Step 2: Is phone on same WiFi?');
    steps.push('  → Check network connection');
    steps.push('Step 3: Is IP address correct?');
    steps.push('  → Run: ipconfig (find your machine IP)');
    steps.push('  → Update IP in utils/ocr-service.ts');
  } else if (error.toLowerCase().includes('text') || error.toLowerCase().includes('extract')) {
    steps.push('Step 1: Improve image quality');
    steps.push('  → Use better lighting');
    steps.push('  → Hold camera steady');
    steps.push('  → Ensure ID is in sharp focus');
    steps.push('Step 2: Position ID correctly');
    steps.push('  → Ensure full ID is visible');
    steps.push('  → Avoid glare and shadows');
    steps.push('Step 3: Try again with improved image');
  } else if (error.toLowerCase().includes('tesseract')) {
    steps.push('Step 1: Wait for Tesseract initialization');
    steps.push('  → On first run, Tesseract takes 10-30 seconds');
    steps.push('Step 2: Check backend console for progress');
    steps.push('  → Watch the terminal where you started the backend');
    steps.push('Step 3: Try again once ready');
  } else {
    steps.push('General troubleshooting:');
    steps.push('  1. Check backend console for error messages');
    steps.push('  2. Verify network connectivity');
    steps.push('  3. Restart the backend service');
    steps.push('  4. Try with a different ID image');
  }

  return steps;
};
