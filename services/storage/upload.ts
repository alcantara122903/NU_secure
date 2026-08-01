/**
 * Supabase Storage Upload Service
 * Handles file uploads for visitor photos and documents
 * 
 * Bucket structure:
 * - visitor-file/Face_ID_Picture/ → face and ID capture photos
 */

import { File } from 'expo-file-system';
import { supabase } from '../database/supabase';

/** Storage bucket for visitor face/ID photos — must exist in Supabase Storage. */
export const VISITOR_FILES_BUCKET =
  process.env.EXPO_PUBLIC_STORAGE_BUCKET?.trim() || 'visitor-file';

/**
 * Upload result interface
 */
export interface UploadResult {
  success: boolean;
  filePath?: string;
  publicUrl?: string;
  signedUrl?: string;
  error?: string;
}

/**
 * Generate a unique filename for uploaded photos
 * Format: YYYY-MM-DD_HHmmss_RANDOM
 * Example: 2024-04-08_143022_a7b2c9f0
 */
export function generatePhotoFilename(fileExtension: string = 'jpg'): string {
  const now = new Date();
  
  // Format: YYYY-MM-DD_HHmmss
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  
  // Generate random suffix (8 hex chars)
  const randomSuffix = Math.random().toString(16).substring(2, 10);
  
  return `${year}-${month}-${day}_${hours}${minutes}${seconds}_${randomSuffix}.${fileExtension}`;
}

/**
 * Upload image to Supabase Storage
 * 
 * @param filePath - Full storage path including filename (e.g., "Face_photos/2024-04-08_143022_a7b2c9f0.jpg")
 * @param imageUri - Image URI (file://, asset-library://, or data:)
 * @returns Upload result with file path and URLs
 */
export async function uploadImage(
  filePath: string,
  imageUri: string
): Promise<UploadResult> {
  try {
    console.log(`\n📤 Starting upload to: ${filePath}`);
    console.log(`   URI preview: ${imageUri?.substring(0, 80)}...`);
    
    // Validate inputs
    if (!filePath || !imageUri) {
      return {
        success: false,
        error: 'Missing filePath or imageUri',
      };
    }

    // Extract base64 data
    console.log('🔄 Extracting base64 data...');
    let base64Data: string;
    
    if (imageUri.startsWith('data:image')) {
      const parts = imageUri.split(',');
      if (parts.length !== 2) {
        console.error('❌ Invalid data URL format');
        return {
          success: false,
          error: 'Invalid data URL format',
        };
      }
      base64Data = parts[1];
      console.log(`✓ Base64 extracted: ${(base64Data.length / 1024).toFixed(2)} KB`);
    } else if (imageUri.startsWith('file://') || imageUri.startsWith('content://')) {
      console.log('📂 Reading file from URI...');
      try {
        const file = new File(imageUri);
        base64Data = await file.base64();
        console.log(`✓ File read: ${(base64Data.length / 1024).toFixed(2)} KB`);
      } catch (fileError: any) {
        console.error('❌ File read failed:', fileError.message);
        return {
          success: false,
          error: `File read failed: ${fileError.message}`,
        };
      }
    } else {
      console.error('❌ Unknown URI type');
      return {
        success: false,
        error: 'Unknown URI format',
      };
    }

    // Decode base64 to binary string, then to bytes
    console.log('🔄 Converting to upload-ready format...');
    let uploadData: any;
    
    try {
      // Try to create an ArrayBuffer from base64
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      uploadData = bytes.buffer; // Use ArrayBuffer instead of Uint8Array
      console.log(`✓ Converted to ArrayBuffer: ${(uploadData.byteLength / 1024).toFixed(2)} KB`);
    } catch (conversionError: any) {
      console.error('❌ Conversion error:', conversionError.message);
      console.warn('⚠️ Falling back to base64 string upload');
      uploadData = base64Data;
      console.log(`✓ Using base64 string: ${(base64Data.length / 1024).toFixed(2)} KB`);
    }

    console.log('📡 Uploading to Supabase...');
    console.log(`   Bucket: ${VISITOR_FILES_BUCKET}`);
    console.log(`   Path: ${filePath}`);
    console.log(`   Data type: ${uploadData instanceof ArrayBuffer ? 'ArrayBuffer' : typeof uploadData}`);

    try {
      const { data, error } = await supabase.storage
        .from(VISITOR_FILES_BUCKET)
        .upload(filePath, uploadData, {
          cacheControl: '3600',
          upsert: false,
          contentType: 'image/jpeg',
        });

      if (error) {
        console.error('❌ Supabase upload error:');
        console.error('   Code:', (error as any).statusCode);
        console.error('   Message:', error.message);
        console.error('   Full error:', JSON.stringify(error));
        const notFound =
          /bucket not found/i.test(error.message) ||
          String((error as any).statusCode) === '404';
        return {
          success: false,
          error: notFound
            ? `Upload failed: Storage bucket "${VISITOR_FILES_BUCKET}" not found. Create it in Supabase → Storage (Public), then add folder Face_ID_Picture.`
            : `Upload failed: ${error.message}`,
        };
      }

      if (!data) {
        console.error('❌ No data returned from upload');
        return {
          success: false,
          error: 'Upload returned no data',
        };
      }

      console.log('✅ Upload successful');
      console.log('   Response path:', data.path);
      
      // Construct public URL
      const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
      if (!supabaseUrl) {
        console.error('❌ EXPO_PUBLIC_SUPABASE_URL not configured');
        return {
          success: false,
          error: 'Supabase URL not configured',
        };
      }

      // Use relative path format (bucket/path) instead of full URL
      // This is more portable and matches friend's working format
      const relativeUrl = `${VISITOR_FILES_BUCKET}/${filePath}`;
      console.log(`✓ Public URL generated: ${relativeUrl}`);

      return {
        success: true,
        filePath: data.path,
        publicUrl: relativeUrl,
      };
    } catch (uploadError: any) {
      console.error('❌ Upload exception caught:');
      console.error('   Type:', uploadError.constructor.name);
      console.error('   Message:', uploadError.message);
      console.error('   Full error:', JSON.stringify(uploadError));
      return {
        success: false,
        error: uploadError.message || 'Unknown upload error',
      };
    }
  } catch (error: any) {
    console.error('❌ Upload error:', error);
    return {
      success: false,
      error: error.message || 'Unknown error',
    };
  }
}

/**
 * Upload face photo to Face_ID_Picture folder
 * 
 * @param imageUri - Image URI from camera or gallery
 * @returns Upload result with file path and public URL
 */
export async function uploadFacePhoto(imageUri: string): Promise<UploadResult> {
  console.log('\n👤 Uploading face photo...');
  
  const filename = generatePhotoFilename('jpg');
  const filePath = `Face_ID_Picture/face_${filename}`;
  
  return uploadImage(filePath, imageUri);
}

/**
 * Upload ID photo to Face_ID_Picture folder
 * 
 * @param imageUri - Image URI from camera or gallery
 * @returns Upload result with file path and public URL
 */
export async function uploadIdPhoto(imageUri: string): Promise<UploadResult> {
  console.log('\n🆔 Uploading ID photo...');
  
  const filename = generatePhotoFilename('jpg');
  const filePath = `Face_ID_Picture/id_${filename}`;
  
  return uploadImage(filePath, imageUri);
}

/**
 * Delete a file from Supabase Storage
 * 
 * @param filePath - Full path of file to delete (e.g., "Face_photos/2024-04-08_143022_a7b2c9f0.jpg")
 */
export async function deleteStorageFile(filePath: string): Promise<UploadResult> {
  try {
    console.log(`🗑️  Deleting: ${filePath}`);
    
    const { error } = await supabase.storage
      .from(VISITOR_FILES_BUCKET)
      .remove([filePath]);

    if (error) {
      console.error(`❌ Delete error: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }

    console.log(`✅ File deleted`);
    return { success: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`❌ Delete failed: ${message}`);
    return {
      success: false,
      error: message,
    };
  }
}

/**
 * Get public URL for a storage file
 * 
 * @param filePath - Full path of file (e.g., "Face_photos/2024-04-08_143022_a7b2c9f0.jpg")
 */
export function getPublicUrl(filePath: string): string {
  const { data } = supabase.storage
    .from(VISITOR_FILES_BUCKET)
    .getPublicUrl(filePath);
  
  return data.publicUrl;
}

/**
 * Turn a stored visitor photo value into a URI Image can load.
 * Handles absolute URLs, `visitor-file/...` relative paths from upload, and private buckets (signed URL).
 */
export async function resolveVisitorPhotoDisplayUri(
  raw: string | null | undefined,
): Promise<string | null> {
  const value = (raw || '').trim();
  if (!value) {
    return null;
  }

  let storagePath: string | null = null;

  if (value.startsWith('http://') || value.startsWith('https://')) {
    // Extract path from Supabase public/signed object URLs so we can re-sign if needed
    const publicMarker = `/storage/v1/object/public/${VISITOR_FILES_BUCKET}/`;
    const signedMarker = `/storage/v1/object/sign/${VISITOR_FILES_BUCKET}/`;
    const altPublic = `/storage/v1/object/public/visitor-files/`;
    const altSigned = `/storage/v1/object/sign/visitor-files/`;
    for (const marker of [publicMarker, signedMarker, altPublic, altSigned]) {
      const idx = value.indexOf(marker);
      if (idx >= 0) {
        storagePath = decodeURIComponent(value.slice(idx + marker.length).split('?')[0] || '');
        break;
      }
    }
    // Non-storage absolute URL — use as-is
    if (!storagePath) {
      return value;
    }
  } else {
    const trimmed = value.replace(/^\/+/, '');
    if (trimmed.startsWith('visitor-files/')) {
      storagePath = trimmed.slice('visitor-files/'.length);
    } else if (trimmed.startsWith(`${VISITOR_FILES_BUCKET}/`)) {
      storagePath = trimmed.slice(VISITOR_FILES_BUCKET.length + 1);
    } else if (trimmed.startsWith('visitor-file/')) {
      storagePath = trimmed.slice('visitor-file/'.length);
    } else {
      storagePath = trimmed;
    }
  }

  if (!storagePath) {
    return null;
  }

  try {
    const { data: signed, error } = await supabase.storage
      .from(VISITOR_FILES_BUCKET)
      .createSignedUrl(storagePath, 60 * 60);
    if (!error && signed?.signedUrl) {
      return signed.signedUrl;
    }
    // Fallback: try alternate bucket name used in older docs
    if (VISITOR_FILES_BUCKET !== 'visitor-files') {
      const { data: altSigned, error: altErr } = await supabase.storage
        .from('visitor-files')
        .createSignedUrl(storagePath, 60 * 60);
      if (!altErr && altSigned?.signedUrl) {
        return altSigned.signedUrl;
      }
    }
  } catch (err) {
    console.warn('[resolveVisitorPhotoDisplayUri] signed URL failed:', err);
  }

  const { data: publicData } = supabase.storage.from(VISITOR_FILES_BUCKET).getPublicUrl(storagePath);
  if (publicData?.publicUrl) {
    return publicData.publicUrl;
  }

  const supabaseUrl = (process.env.EXPO_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
  if (supabaseUrl) {
    return `${supabaseUrl}/storage/v1/object/public/${VISITOR_FILES_BUCKET}/${storagePath}`;
  }

  return null;
}

/**
 * Storage service class (optional - for dependency injection pattern)
 */
export class StorageService {
  async uploadFacePhoto(imageUri: string): Promise<UploadResult> {
    return uploadFacePhoto(imageUri);
  }

  async uploadIdPhoto(imageUri: string): Promise<UploadResult> {
    return uploadIdPhoto(imageUri);
  }

  async deleteFile(filePath: string): Promise<UploadResult> {
    return deleteStorageFile(filePath);
  }

  getPublicUrl(filePath: string): string {
    return getPublicUrl(filePath);
  }
}

export const storageService = new StorageService();
