/**
 * Address Service
 * Handles address-related database operations for the address table
 */

import { supabase } from './supabase';

export interface AddressData {
  houseNo?: string;
  street?: string;
  barangay?: string;
  cityMunicipality?: string;
  province?: string;
  region?: string;
}

export const addressService = {
  /**
   * Create a new address record
   * Returns the address_id for linking to visitors
   */
  async createAddress(addressData: AddressData): Promise<number | null> {
    try {
      // Don't create if all fields are empty
      const hasData = Object.values(addressData).some(val => val && val.trim().length > 0);
      if (!hasData) {
        console.warn('⚠️ Address data is empty, skipping address creation');
        return null;
      }

      const { data, error } = await supabase
        .from('address')
        .insert([
          {
            house_no: addressData.houseNo || null,
            street: addressData.street || null,
            barangay: addressData.barangay || null,
            city_municipality: addressData.cityMunicipality || null,
            province: addressData.province || null,
            region: addressData.region || null,
          },
        ])
        .select('address_id')
        .single();

      if (error) {
        console.error('❌ Address creation error:', error);
        throw error;
      }

      console.log(`✅ Address created with ID: ${data.address_id}`);
      return data.address_id;
    } catch (error) {
      console.error('Address service error:', error);
      return null;
    }
  },

  /**
   * Get address by ID
   */
  async getAddress(addressId: number): Promise<AddressData | null> {
    try {
      const { data, error } = await supabase
        .from('address')
        .select('*')
        .eq('address_id', addressId)
        .single();

      if (error) throw error;
      return {
        houseNo: data.house_no,
        street: data.street,
        barangay: data.barangay,
        cityMunicipality: data.city_municipality,
        province: data.province,
        region: data.region,
      };
    } catch (error) {
      console.error('Get address error:', error);
      return null;
    }
  },

  /**
   * Update address record
   */
  async updateAddress(addressId: number, addressData: AddressData): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('address')
        .update({
          house_no: addressData.houseNo || null,
          street: addressData.street || null,
          barangay: addressData.barangay || null,
          city_municipality: addressData.cityMunicipality || null,
          province: addressData.province || null,
          region: addressData.region || null,
        })
        .eq('address_id', addressId);

      if (error) throw error;
      console.log(`✅ Address ${addressId} updated`);
      return true;
    } catch (error) {
      console.error('Update address error:', error);
      return false;
    }
  },

  /**
   * Format address object to full address string for display
   */
  formatAddressString(addressData: AddressData): string {
    const parts = [
      addressData.houseNo,
      addressData.street,
      addressData.barangay,
      addressData.cityMunicipality,
      addressData.province,
      addressData.region,
    ].filter(part => part && part.trim().length > 0);

    return parts.join(', ');
  },
};
