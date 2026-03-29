/**
 * Backend OCR Service - Node.js/Express Example
 * 
 * This is a sample backend service that handles OCR processing
 * Place this in your backend repository
 * 
 * Installation:
 * npm install express tesseract.js cors dotenv
 * 
 * Setup:
 * 1. Create a .env file with BACKEND_PORT=3000
 * 2. Start this server: node ocr-backend.js
 * 3. Update OCR_API_ENDPOINT in utils/ocr-service.ts to point to this server
 */

const express = require('express');
const cors = require('cors');
require('dotenv').config();
const { createWorker } = require('tesseract.js');
const fs = require('fs');
const path = require('path');
const os = require('os');

const app = express();

// Global worker instance (reused across requests)
let worker = null;
let isInitialized = false;

// Initialize Tesseract worker once at startup
async function initializeWorker() {
  try {
    console.log('🤖 Initializing Tesseract worker (this takes 10-30 seconds on first run)...');
    worker = await createWorker();
    isInitialized = true;
    console.log('✅ Tesseract worker initialized and ready');
  } catch (error) {
    console.error('❌ Failed to initialize Tesseract worker:', error);
    process.exit(1);
  }
}

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb' }));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OCR Backend Service is running',
    tesseractReady: isInitialized,
    timestamp: new Date().toISOString()
  });
});

// Diagnostic endpoint - test if connection works
app.post('/api/test', (req, res) => {
  console.log('📋 Test endpoint called - connection working!');
  res.json({ 
    status: 'Connection successful',
    message: 'Phone can reach backend',
    tesseractReady: isInitialized
  });
});

/**
 * OCR Extraction Endpoint
 * 
 * POST /api/ocr/extract
 * Body: { image: base64EncodedImage, format: 'GENERIC' | 'NATIONAL_ID' | ... }
 * Response: { text: extractedText, error?: errorMessage }
 */
app.post('/api/ocr/extract', async (req, res) => {
  const startTime = Date.now();
  let tempFilePath = null;
  
  try {
    if (!isInitialized) {
      return res.status(503).json({ error: 'Tesseract worker not yet initialized' });
    }

    const { image, format } = req.body;

    console.log(`📸 OCR request received - extracting: First Name, Last Name, Address`);
    
    if (!image) {
      console.warn('⚠️  No image data provided');
      return res.status(400).json({ error: 'Image data is required' });
    }

    const imageSize = image.length;
    console.log(`📏 Image size: ${(imageSize / 1024).toFixed(2)} KB`);

    // Validate it's valid base64 and save to temporary file
    try {
      const imageBuffer = Buffer.from(image, 'base64');
      console.log(`✅ Image buffer created: ${imageBuffer.length} bytes`);
      
      // Save to temporary file
      const tempDir = os.tmpdir();
      tempFilePath = path.join(tempDir, `ocr_${Date.now()}.jpg`);
      
      fs.writeFileSync(tempFilePath, imageBuffer);
      console.log(`💾 Saved image to temp file`);
      
      // Run Tesseract with optimized settings for ID extraction
      // psm 6 = assume a single uniform block of text
      // oem 3 = use both legacy and LSTM modes
      console.log('🔍 Extracting name and address fields...');
      const result = await worker.recognize(tempFilePath, {
        lang: 'eng',
      });
      
      const text = result.data.text;

      console.log(`✅ OCR completed in ${Date.now() - startTime}ms`);
      console.log(`📄 Extracted text length: ${text.length} characters`);
      
      if (text.length === 0) {
        console.warn('⚠️ OCR returned empty - image may not be readable');
      }

      res.json({
        text: text,
        length: text.length,
        processingTime: Date.now() - startTime,
      });
    } catch (bufferError) {
      console.error('❌ Image processing error:', bufferError.message);
      res.status(400).json({
        error: 'Invalid image data',
        message: 'Image must be valid base64 encoded data'
      });
    }
  } catch (error) {
    console.error('❌ OCR Error:', error.message);
    const processingTime = Date.now() - startTime;
    
    res.status(500).json({
      error: error.message || 'Unknown OCR error',
      message: 'Failed to process image with OCR',
      processingTime: processingTime
    });
  } finally {
    // Clean up temporary file
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try {
        fs.unlinkSync(tempFilePath);
        console.log('🗑️ Temp file cleaned up');
      } catch (e) {
        console.warn('⚠️ Could not delete temp file');
      }
    }
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server and initialize Tesseract
async function startServer() {
  const PORT = process.env.BACKEND_PORT || 3000;
  
  await initializeWorker();
  
  // Listen on all network interfaces (0.0.0.0) so phone can reach it
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 OCR Backend Service running on http://0.0.0.0:${PORT}`);
    console.log(`📍 Use from phone: http://192.168.68.104:${PORT}`);
    console.log(`📍 Health check: http://192.168.68.104:${PORT}/health`);
    console.log(`📍 OCR endpoint: POST http://192.168.68.104:${PORT}/api/ocr/extract`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
