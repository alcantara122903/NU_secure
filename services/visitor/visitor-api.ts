/**
 * Visitor API Service
 * Calls backend API for visitor registration
 */

import API_CONFIG from '@/config/api';

export type VisitorType = 'enrollee' | 'contractor' | 'normal_visitor';

export interface VisitorRegistrationPayload {
  type: VisitorType;
  firstName: string;
  lastName: string;
  contactNo: string;
  visitorPhotoUrl?: string;
  addressId: number;
  guardUserId: number;
  visitTypeId: number;
  purposeReason?: string;
  primaryOfficeId: number;
  qrToken: string;
  enrolleeStatusId?: number;
  companyName?: string;
  contactPerson?: string;
  contractorPurpose?: string;
  contractorStatus?: string;
}

export interface ApiRegistrationResult {
  success: boolean;
  data?: {
    visitorId: number;
    visitId: number;
    enrolleeId?: number;
    contractorId?: number;
  };
  error?: string;
}

export const visitorApiService = {
  /**
   * Register visitor via backend API
   */
  async registerVisitorViaAPI(
    payload: VisitorRegistrationPayload
  ): Promise<ApiRegistrationResult> {
    try {
      console.log('\n📡 === CALLING BACKEND API ===\n');
      console.log(`   URL: ${API_CONFIG.ENDPOINTS.REGISTER_VISITOR}`);
      console.log(`   Type: ${payload.type}`);
      console.log(`   Payload:`, JSON.stringify(payload, null, 2));

      const response = await fetch(API_CONFIG.ENDPOINTS.REGISTER_VISITOR, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (!response.ok) {
        console.error('❌ API Error:', result.error);
        return {
          success: false,
          error: result.error || 'Registration failed',
        };
      }

      if (!result.success) {
        console.error('❌ Registration failed:', result.error);
        return {
          success: false,
          error: result.error,
        };
      }

      console.log('✅ Registration successful via API');
      console.log('   Data:', result.data);

      return {
        success: true,
        data: result.data,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ API call failed:', message);
      return {
        success: false,
        error: message,
      };
    }
  },
};
