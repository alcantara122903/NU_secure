/**
 * Office Enrollment Scanner Service
 * Handles scanning and tracking enrollee QR codes in offices
 * Works with your actual database schema
 */

import type { EnrolleeQRData } from '@/types/enrollee';
import { enrolleeService } from './enrollee';

export const officeEnrolleeService = {
  /**
   * Scan enrollee QR code and get current status
   * Called when office scans the QR code
   * QR code should contain the pass_number from visitor table
   */
  async scanEnrolleeQR(qrCodeValue: string): Promise<{
    enrollee: EnrolleeQRData | null;
    steps: any[];
    overallStatus: string;
  } | null> {
    try {
      console.log('🔍 Scanning enrollee QR code:', qrCodeValue);

      // Get enrollee by QR code (pass_number)
      const enrollee = await enrolleeService.getEnrolleeByQRCode(qrCodeValue);

      if (!enrollee) {
        console.warn('⚠️ Enrollee not found for QR code:', qrCodeValue);
        return null;
      }

      // Get enrollee steps with progress
      const steps = await enrolleeService.getEnrolleeSteps(enrollee.enrollee_id);

      // Calculate overall status
      const completedSteps = steps.filter(s => s.status === 'completed').length;
      const totalSteps = steps.length;
      const overallStatus = completedSteps === totalSteps ? 'COMPLETED' : 'IN PROGRESS';

      console.log('✅ Enrollee QR scanned successfully:', enrollee.enrollee_id);

      return {
        enrollee,
        steps,
        overallStatus,
      };
    } catch (error) {
      console.error('❌ Error scanning enrollee QR code:', error);
      return null;
    }
  },

  /**
   * Mark a step as completed when office staff approves
   * Updates enrollee_progress table with step completion
   */
  async markStepCompleted(enrolleeId: number, stepId: number) {
    try {
      console.log(`✅ Marking step ${stepId} as completed for enrollee ${enrolleeId}`);

      const result = await enrolleeService.updateEnrolleeStepProgress(
        enrolleeId,
        stepId,
        'completed'
      );

      // Check if all steps are completed
      const steps = await enrolleeService.getEnrolleeSteps(enrolleeId);
      const allCompleted = steps.every(s => s.status === 'completed');

      if (allCompleted) {
        // Update enrollee status to completed
        await enrolleeService.updateEnrolleeStatus(enrolleeId, 'completed');
        console.log('🎉 All steps completed for enrollee:', enrolleeId);
      }

      return result;
    } catch (error) {
      console.error('❌ Error marking step as completed:', error);
      return null;
    }
  },

  /**
   * Get enrollee information for display in office portal
   */
  async getEnrolleeForDisplay(enrolleeId: number) {
    try {
      const enrollee = await enrolleeService.getEnrolleeById(enrolleeId);
      if (!enrollee) return null;

      const steps = await enrolleeService.getEnrolleeSteps(enrolleeId);

      const completedSteps = steps.filter(s => s.status === 'completed').length;
      const totalSteps = steps.length;
      const completionPercentage = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

      return {
        enrollee,
        steps,
        completedSteps,
        totalSteps,
        completionPercentage,
        overallStatus: enrollee.status,
      };
    } catch (error) {
      console.error('❌ Error getting enrollee for display:', error);
      return null;
    }
  },
};
