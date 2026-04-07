/**
 * OCR Diagnostics Logger
 * Helps troubleshoot OCR extraction issues
 */

import { testOCRConnection } from '@/services/ocr/ocr-client';

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
    const connectionTest = await testOCRConnection();

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
