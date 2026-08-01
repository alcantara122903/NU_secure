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
   * Create a new address record or return existing if duplicate
   * First checks if the exact same address already exists (deduplication)
   * If found, returns existing address_id. If not, creates new record.
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

      console.log('🔍 Checking for existing address with same details...');

      // STEP 1: Check if address already exists (deduplication)
      // PostgREST: use .is(col, null) for NULL — .eq(col, null) does not match IS NULL
      let existingQuery = supabase.from('address').select('address_id');
      const houseNo = addressData.houseNo?.trim() || null;
      const street = addressData.street?.trim() || null;
      const barangay = addressData.barangay?.trim() || null;
      const city = addressData.cityMunicipality?.trim() || null;
      const province = addressData.province?.trim() || null;
      const region = addressData.region?.trim() || null;

      existingQuery = houseNo == null ? existingQuery.is('house_no', null) : existingQuery.eq('house_no', houseNo);
      existingQuery = street == null ? existingQuery.is('street', null) : existingQuery.eq('street', street);
      existingQuery = barangay == null ? existingQuery.is('barangay', null) : existingQuery.eq('barangay', barangay);
      existingQuery = city == null ? existingQuery.is('city_municipality', null) : existingQuery.eq('city_municipality', city);
      existingQuery = province == null ? existingQuery.is('province', null) : existingQuery.eq('province', province);
      existingQuery = region == null ? existingQuery.is('region', null) : existingQuery.eq('region', region);

      const { data: existingAddresses, error: queryError } = await existingQuery;

      if (queryError) {
        console.error('❌ Error checking for existing address:', queryError);
        // Continue with new creation if check fails
      }

      // If exact address exists, reuse it
      if (existingAddresses && existingAddresses.length > 0) {
        const existingId = existingAddresses[0].address_id;
        console.log(`✅ Address already exists! Reusing address_id: ${existingId}`);
        return existingId;
      }

      // STEP 2: Address doesn't exist, create new one
      console.log('📝 Creating new address record...');
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

      console.log(`✅ New address created with ID: ${data.address_id}`);
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
   * Find existing address without creating a new one
   * Useful for checking if an address already exists
   * Returns address_id if found, null if not found
   */
  async findExistingAddress(addressData: AddressData): Promise<number | null> {
    try {
      // Don't search if all fields are empty
      const hasData = Object.values(addressData).some(val => val && val.trim().length > 0);
      if (!hasData) {
        console.warn('⚠️ Address data is empty, cannot search');
        return null;
      }

      console.log('🔍 Searching for existing address...');

      let searchQuery = supabase.from('address').select('address_id');
      const houseNo = addressData.houseNo?.trim() || null;
      const street = addressData.street?.trim() || null;
      const barangay = addressData.barangay?.trim() || null;
      const city = addressData.cityMunicipality?.trim() || null;
      const province = addressData.province?.trim() || null;
      const region = addressData.region?.trim() || null;

      searchQuery = houseNo == null ? searchQuery.is('house_no', null) : searchQuery.eq('house_no', houseNo);
      searchQuery = street == null ? searchQuery.is('street', null) : searchQuery.eq('street', street);
      searchQuery = barangay == null ? searchQuery.is('barangay', null) : searchQuery.eq('barangay', barangay);
      searchQuery = city == null ? searchQuery.is('city_municipality', null) : searchQuery.eq('city_municipality', city);
      searchQuery = province == null ? searchQuery.is('province', null) : searchQuery.eq('province', province);
      searchQuery = region == null ? searchQuery.is('region', null) : searchQuery.eq('region', region);

      const { data: existingAddresses, error } = await searchQuery;

      if (error) {
        console.error('❌ Error searching for address:', error);
        return null;
      }

      if (existingAddresses && existingAddresses.length > 0) {
        console.log(`✅ Found existing address_id: ${existingAddresses[0].address_id}`);
        return existingAddresses[0].address_id;
      }

      console.log('✅ No existing address found');
      return null;
    } catch (error) {
      console.error('Find address error:', error);
      return null;
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
