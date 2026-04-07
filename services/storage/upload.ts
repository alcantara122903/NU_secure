/**
 * Supabase Storage Upload Service
 * Handles file uploads for visitor photos and documents
 * 
 * Bucket structure:
 * - visitor-files/Face_photos/ → face capture photos
 * - visitor-files/ID_photos/ → identity document photos
 */

import { supabase } from '../database/supabase';

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
 * Convert image URI to blob for Supabase upload
 * 
 * Handles:
 * - Camera capture URIs (file:// paths)
 * - Gallery picker URIs (asset-library:// or file://)
 * - Base64 data URLs
 */
export async function imageUriToBlob(imageUri: string): Promise<Blob> {
  // If it's a base64 data URL
  if (imageUri.startsWith('data:')) {
    const [header, data] = imageUri.split(',');
    const mimeMatch = header.match(/:(.*?);/);
    const mimeType = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    
    const binaryString = atob(data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return new Blob([bytes], { type: mimeType });
  }
  
  // If it's a file URI, fetch and convert
  const response = await fetch(imageUri);
  return await response.blob();
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
    
    // Validate inputs
    if (!filePath || !imageUri) {
      return {
        success: false,
        error: 'Missing filePath or imageUri',
      };
    }

    // Convert image to blob
    console.log('🔄 Converting image to blob...');
    const blob = await imageUriToBlob(imageUri);
    console.log(`✓ Blob created (${(blob.size / 1024).toFixed(2)} KB)`);

    // Upload to Supabase
    console.log('📡 Uploading to Supabase...');
    const { data, error } = await supabase.storage
      .from('visitor-files')
      .upload(filePath, blob, {
        cacheControl: '3600',
        upsert: false, // Don't overwrite existing files
        contentType: blob.type,
      });

    if (error) {
      console.error('❌ Upload error:', error.message);
      return {
        success: false,
        error: error.message,
      };
    }

    console.log(`✅ Upload successful`);
    console.log(`   File path: ${data.path}`);

    // Get public URL
    const { data: publicUrlData } = supabase.storage
      .from('visitor-files')
      .getPublicUrl(filePath);

    console.log(`   Public URL: ${publicUrlData.publicUrl}`);

    return {
      success: true,
      filePath: data.path,
      publicUrl: publicUrlData.publicUrl,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error(`❌ Upload failed: ${message}`);
    return {
      success: false,
      error: message,
    };
  }
}

/**
 * Upload face photo to Face_photos folder
 * 
 * @param imageUri - Image URI from camera or gallery
 * @returns Upload result with file path and public URL
 */
export async function uploadFacePhoto(imageUri: string): Promise<UploadResult> {
  console.log('\n👤 Uploading face photo...');
  
  const filename = generatePhotoFilename('jpg');
  const filePath = `Face_photos/${filename}`;
  
  return uploadImage(filePath, imageUri);
}

/**
 * Upload ID photo to ID_photos folder
 * 
 * @param imageUri - Image URI from camera or gallery
 * @returns Upload result with file path and public URL
 */
export async function uploadIdPhoto(imageUri: string): Promise<UploadResult> {
  console.log('\n🆔 Uploading ID photo...');
  
  const filename = generatePhotoFilename('jpg');
  const filePath = `ID_photos/${filename}`;
  
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
      .from('visitor-files')
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
    .from('visitor-files')
    .getPublicUrl(filePath);
  
  return data.publicUrl;
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
