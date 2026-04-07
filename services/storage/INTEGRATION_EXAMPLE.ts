/**
 * EXAMPLE: Storage Upload Integration for Register Visitor Screen
 * 
 * This file demonstrates how to integrate Supabase Storage uploads
 * with your existing camera capture and registration flow.
 * 
 * Copy patterns from this file into your register-visitor.tsx screen.
 */

import { cameraService, uploadFacePhoto, uploadIdPhoto, type UploadResult } from '@/services';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Alert } from 'react-native';

/**
 * INTEGRATION EXAMPLE 1: Upload Face Photo
 * 
 * After capturing face photo in Step 1, upload it to Supabase
 */
export async function handleCaptureFaceWithUpload(
  onUploadComplete?: (result: UploadResult) => void
): Promise<void> {
  try {
    // 1. Capture photo from camera (your existing flow)
    const captureResult = await cameraService.capturePhoto();

    if (!captureResult.success) {
      Alert.alert('Camera Error', captureResult.error || 'Failed to capture photo');
      return;
    }

    console.log('✅ Face photo captured');

    // 2. Upload to Supabase Storage
    if (captureResult.uri) {
      console.log('📤 Uploading face photo...');
      const uploadResult = await uploadFacePhoto(captureResult.uri);

      if (uploadResult.success) {
        console.log('✅ Face photo uploaded successfully');
        console.log(`   File path: ${uploadResult.filePath}`);
        console.log(`   Public URL: ${uploadResult.publicUrl}`);
        
        // 3. Call callback with upload result
        onUploadComplete?.(uploadResult);
      } else {
        Alert.alert('Upload Error', uploadResult.error || 'Failed to upload face photo');
      }
    }
  } catch (error) {
    console.error('❌ Error in face upload flow:', error);
    Alert.alert('Error', 'An unexpected error occurred');
  }
}

/**
 * INTEGRATION EXAMPLE 2: Upload ID Photo from Camera
 * 
 * Capture ID photo and upload to Supabase (Step 2)
 */
export async function handleCaptureIdWithUpload(
  onUploadComplete?: (result: UploadResult) => void
): Promise<void> {
  try {
    // 1. Capture photo from camera
    const captureResult = await cameraService.capturePhoto();

    if (!captureResult.success) {
      Alert.alert('Camera Error', captureResult.error || 'Failed to capture ID photo');
      return;
    }

    console.log('✅ ID photo captured from camera');

    // 2. Upload to Supabase Storage
    if (captureResult.uri) {
      console.log('📤 Uploading ID photo...');
      const uploadResult = await uploadIdPhoto(captureResult.uri);

      if (uploadResult.success) {
        console.log('✅ ID photo uploaded successfully');
        console.log(`   File path: ${uploadResult.filePath}`);
        console.log(`   Public URL: ${uploadResult.publicUrl}`);
        
        // 3. Proceed to OCR extraction if needed
        onUploadComplete?.(uploadResult);
      } else {
        Alert.alert('Upload Error', uploadResult.error || 'Failed to upload ID photo');
      }
    }
  } catch (error) {
    console.error('❌ Error in ID capture upload flow:', error);
    Alert.alert('Error', 'An unexpected error occurred');
  }
}

/**
 * INTEGRATION EXAMPLE 3: Upload ID Photo from Gallery/File Picker
 * 
 * Fallback option when camera is unavailable (Step 2)
 * Allows user to pick image from device gallery or files
 */
export async function handlePickIdPhotoFromGallery(
  onUploadComplete?: (result: UploadResult) => void
): Promise<void> {
  try {
    // 1. Request gallery permissions
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'Gallery access is required to upload a photo');
      return;
    }

    // 2. Launch image picker
    console.log('📷 Opening gallery...');
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 0.8,
    });

    if (result.canceled) {
      console.log('⚠️ Gallery selection cancelled');
      return;
    }

    const selectedImage = result.assets[0];
    console.log('✅ Image selected from gallery');

    // 3. Upload to Supabase Storage
    if (selectedImage.uri) {
      console.log('📤 Uploading ID photo from gallery...');
      const uploadResult = await uploadIdPhoto(selectedImage.uri);

      if (uploadResult.success) {
        console.log('✅ ID photo from gallery uploaded successfully');
        console.log(`   File path: ${uploadResult.filePath}`);
        console.log(`   Public URL: ${uploadResult.publicUrl}`);
        
        onUploadComplete?.(uploadResult);
      } else {
        Alert.alert('Upload Error', uploadResult.error || 'Failed to upload ID photo');
      }
    }
  } catch (error) {
    console.error('❌ Error in gallery upload flow:', error);
    Alert.alert('Error', 'An unexpected error occurred');
  }
}

/**
 * INTEGRATION EXAMPLE 4: State Management Hook
 * 
 * Use this hook pattern in your component to manage upload state
 */
export interface UploadState {
  facePhoto: {
    uri: string | null;
    filePath: string | null;
    publicUrl: string | null;
    isUploading: boolean;
  };
  idPhoto: {
    uri: string | null;
    filePath: string | null;
    publicUrl: string | null;
    isUploading: boolean;
  };
}

/**
 * Hook to manage upload state
 * Use this pattern in your component
 */
export function usePhotoUpload() {
  const [uploadState, setUploadState] = useState<UploadState>({
    facePhoto: {
      uri: null,
      filePath: null,
      publicUrl: null,
      isUploading: false,
    },
    idPhoto: {
      uri: null,
      filePath: null,
      publicUrl: null,
      isUploading: false,
    },
  });

  // Handler for face photo upload completion
  const handleFacePhotoUploadComplete = (result: UploadResult) => {
    setUploadState(prev => ({
      ...prev,
      facePhoto: {
        ...prev.facePhoto,
        filePath: result.filePath || null,
        publicUrl: result.publicUrl || null,
        isUploading: false,
      },
    }));
  };

  // Handler for ID photo upload completion
  const handleIdPhotoUploadComplete = (result: UploadResult) => {
    setUploadState(prev => ({
      ...prev,
      idPhoto: {
        ...prev.idPhoto,
        filePath: result.filePath || null,
        publicUrl: result.publicUrl || null,
        isUploading: false,
      },
    }));
  };

  // Wrapper for face photo capture + upload
  const captureFace = async () => {
    setUploadState(prev => ({
      ...prev,
      facePhoto: { ...prev.facePhoto, isUploading: true },
    }));
    await handleCaptureFaceWithUpload(handleFacePhotoUploadComplete);
  };

  // Wrapper for ID photo capture + upload
  const captureId = async () => {
    setUploadState(prev => ({
      ...prev,
      idPhoto: { ...prev.idPhoto, isUploading: true },
    }));
    await handleCaptureIdWithUpload(handleIdPhotoUploadComplete);
  };

  // Wrapper for ID photo gallery + upload
  const pickIdFromGallery = async () => {
    setUploadState(prev => ({
      ...prev,
      idPhoto: { ...prev.idPhoto, isUploading: true },
    }));
    await handlePickIdPhotoFromGallery(handleIdPhotoUploadComplete);
  };

  return {
    uploadState,
    captureFace,
    captureId,
    pickIdFromGallery,
  };
}

/**
 * HOW TO USE IN YOUR register-visitor.tsx
 * 
 * STEP 1: Import the hook
 * ---
 * import { usePhotoUpload } from '@/services/storage/INTEGRATION_EXAMPLE';
 * 
 * STEP 2: Initialize in component
 * ---
 * const { uploadState, captureFace, captureId, pickIdFromGallery } = usePhotoUpload();
 * 
 * STEP 3: Replace your handleCaptureFace with captureFace()
 * ---
 * In Step 1 of 3 (Face Photo):
 * 
 * const stepContent = () => {
 *   if (step === 1) {
 *     return (
 *       <View>
 *         <Button 
 *           title={uploadState.facePhoto.isUploading ? 'Uploading...' : '📸 Capture Face Photo'}
 *           onPress={captureFace}
 *           disabled={uploadState.facePhoto.isUploading}
 *         />
 *         {uploadState.facePhoto.filePath && (
 *           <Text>✅ Face photo uploaded: {uploadState.facePhoto.filePath}</Text>
 *         )}
 *       </View>
 *     );
 *   }
 *   // ... other steps
 * };
 * 
 * STEP 4: Add ID photo options in Step 2
 * ---
 * In Step 2 of 3 (ID Photo):
 * 
 * if (step === 2) {
 *   return (
 *     <View>
 *       <Button 
 *         title={uploadState.idPhoto.isUploading ? 'Uploading...' : '📸 Capture ID with Camera'}
 *         onPress={captureId}
 *         disabled={uploadState.idPhoto.isUploading}
 *       />
 *       <Button 
 *         title={uploadState.idPhoto.isUploading ? 'Uploading...' : '📁 Select ID from Gallery'}
 *         onPress={pickIdFromGallery}
 *         disabled={uploadState.idPhoto.isUploading}
 *       />
 *     </View>
 *   );
 * }
 * 
 * STEP 5: Save file paths to database
 * ---
 * Before saving the enrollee, capture the file paths:
 * 
 * const facePhotoPath = uploadState.facePhoto.filePath;
 * const idPhotoPath = uploadState.idPhoto.filePath;
 * 
 * Then pass to your enrollee creation:
 * await enrolleeService.createEnrollee({
 *   firstName: extractedFirstName,
 *   lastName: extractedLastName,
 *   address: extractedAddress,
 *   facePhotoPath,     // Store the storage path
 *   idPhotoPath,       // Store the storage path
 *   // ... other fields
 * });
 * 
 * 
 * STORAGE STRUCTURE
 * ==================
 * 
 * Bucket: visitor-files
 * 
 * Face photos:
 *   visitor-files/Face_photos/2024-04-08_143022_a7b2c9f0.jpg
 *   visitor-files/Face_photos/2024-04-08_143025_c1d4e9a2.jpg
 * 
 * ID photos:
 *   visitor-files/ID_photos/2024-04-08_143028_e8f7b1c3.jpg
 *   visitor-files/ID_photos/2024-04-08_143031_j2k9m5d7.jpg
 * 
 * Filename format: YYYY-MM-DD_HHmmss_RANDOMHEX.jpg
 * 
 * 
 * EXACT FOLDER CASING
 * ===================
 * 
 * Keep these exact (case-sensitive):
 * - Face_photos (with underscore, capital F)
 * - ID_photos (uppercase ID, underscore, lowercase photos)
 * 
 * 
 * RETRIEVING UPLOADED FILES LATER
 * ================================
 * 
 * From stored file path:
 * import { getPublicUrl } from '@/services/storage';
 * 
 * const photoUrl = getPublicUrl('Face_photos/2024-04-08_143022_a7b2c9f0.jpg');
 * // Returns: https://YOUR-SUPABASE-URL/storage/v1/object/public/visitor-files/Face_photos/...
 * 
 * 
 * ERROR HANDLING
 * ==============
 * 
 * All functions return UploadResult:
 * {
 *   success: boolean;
 *   filePath?: string;      // Only if success = true
 *   publicUrl?: string;     // Only if success = true
 *   error?: string;         // Only if success = false
 * }
 * 
 * Check error in your callback:
 * const handleUpload = (result: UploadResult) => {
 *   if (!result.success) {
 *     console.error('Upload failed:', result.error);
 *     return;
 *   }
 *   console.log('File saved to:', result.filePath);
 * };
 * 
 * 
 * ENVIRONMENT REQUIREMENTS
 * ========================
 * 
 * Your Supabase .env.local must have:
 * - EXPO_PUBLIC_SUPABASE_URL
 * - EXPO_PUBLIC_SUPABASE_ANON_KEY
 * 
 * 
 * SUPPORTED IMAGE SOURCES
 * =======================
 * 
 * ✅ Camera capture: file:// URI
 * ✅ Gallery picker: asset-library:// or file:// URI
 * ✅ Base64 data URLs: data:image/jpeg;base64,...
 * 
 * 
 * API FUNCTIONS AVAILABLE
 * =======================
 * 
 * From '@/services' or '@/services/storage':
 * 
 * uploadFacePhoto(imageUri)          → Upload face photo
 * uploadIdPhoto(imageUri)            → Upload ID photo
 * uploadImage(filePath, imageUri)    → Generic upload (custom path)
 * deleteStorageFile(filePath)        → Delete file from storage
 * getPublicUrl(filePath)             → Get public URL for file
 * generatePhotoFilename(ext)         → Generate unique filename
 * imageUriToBlob(imageUri)           → Convert URI to Blob
 * 
 * 
 * TROUBLESHOOTING
 * ===============
 * 
 * "Upload Error: Storage bucket not found"
 *   → Verify bucket name is 'visitor-files' in Supabase console
 * 
 * "Permission Denied"
 *   → Check RLS (Row Level Security) policies in Supabase
 *   → Ensure anon key has insert/access permissions on storage
 * 
 * "File path contains invalid characters"
 *   → Filenames are auto-generated, this shouldn't happen
 *   → Check folder names start with correct path
 * 
 * No console logs showing
 *   → Make sure you're viewing React Native debugger output
 *   → Check with: npx expo start
 */
