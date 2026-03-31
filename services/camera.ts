/**
 * Camera/Photo Capture Utilities
 * Handles device camera access and photo capture
 */

import * as ImagePicker from 'expo-image-picker';

export interface PhotoCaptureResult {
  success: boolean;
  base64?: string;
  uri?: string;
  error?: string;
}

class CameraService {
  /**
   * Request camera permissions
   */
  async requestCameraPermission(): Promise<boolean> {
    try {
      console.log('📸 Requesting camera permission');

      const { status } = await ImagePicker.requestCameraPermissionsAsync();

      const hasPermission = status === 'granted';
      console.log(`✅ Camera permission: ${hasPermission ? 'granted' : 'denied'}`);

      return hasPermission;
    } catch (error) {
      console.error('❌ CameraService error:', error);
      return false;
    }
  }

  /**
   * Capture photo from camera
   */
  async capturePhoto(): Promise<PhotoCaptureResult> {
    try {
      console.log('📸 Opening camera');

      // Check permissions first
      const hasPermission = await this.requestCameraPermission();
      if (!hasPermission) {
        return {
          success: false,
          error: 'Camera permission denied',
        };
      }

      // Launch camera
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        base64: true,
      });

      if (result.canceled) {
        console.log('⚠️ Camera capture cancelled');
        return {
          success: false,
          error: 'Camera capture cancelled',
        };
      }

      const photo = result.assets[0];

      if (!photo.base64) {
        console.error('❌ No base64 from camera');
        return {
          success: false,
          error: 'Could not encode photo',
        };
      }

      // Create properly formatted data URL
      const dataUrl = `data:image/jpeg;base64,${photo.base64}`;
      
      console.log('✅ Photo captured successfully');
      console.log(`   URI: ${photo.uri}`);
      console.log(`   Base64 length: ${photo.base64.length} chars`);
      console.log(`   Data URL length: ${dataUrl.length} chars`);
      console.log(`   Data URL prefix: ${dataUrl.substring(0, 50)}...`);

      return {
        success: true,
        uri: photo.uri,
        base64: dataUrl,
      };
    } catch (error) {
      console.error('❌ CameraService error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to capture photo',
      };
    }
  }

  /**
   * Pick photo from library
   */
  async pickPhoto(): Promise<PhotoCaptureResult> {
    try {
      console.log('📱 Opening photo library');

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.8,
        base64: true,
      });

      if (result.canceled) {
        console.log('⚠️ Photo selection cancelled');
        return {
          success: false,
          error: 'Photo selection cancelled',
        };
      }

      const photo = result.assets[0];

      if (!photo.base64) {
        console.error('❌ No base64 from photo library');
        return {
          success: false,
          error: 'Could not encode photo',
        };
      }

      // Create properly formatted data URL
      const dataUrl = `data:image/jpeg;base64,${photo.base64}`;

      console.log('✅ Photo selected successfully');
      console.log(`   URI: ${photo.uri}`);
      console.log(`   Base64 length: ${photo.base64.length} chars`);
      console.log(`   Data URL length: ${dataUrl.length} chars`);
      console.log(`   Data URL prefix: ${dataUrl.substring(0, 50)}...`);

      return {
        success: true,
        uri: photo.uri,
        base64: dataUrl,
      };
    } catch (error) {
      console.error('❌ CameraService error:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to pick photo',
      };
    }
  }
}

export const cameraService = new CameraService();
