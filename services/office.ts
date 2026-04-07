/**
 * Office Service
 * Handles office lookup and ID mapping
 */

import { supabase } from './database/supabase';

export interface Office {
  office_id: number;
  office_name: string;
  floor?: string;
  is_active?: boolean;
}

// Cache for offices to avoid repeated DB queries
let officesCache: Office[] | null = null;

/**
 * Fetch all offices from database
 */
export async function fetchOffices(): Promise<Office[]> {
  if (officesCache) {
    return officesCache;
  }

  try {
    const { data, error } = await supabase
      .from('office')
      .select('office_id, office_name, floor, is_active')
      .eq('is_active', true);

    if (error) {
      console.error('Error fetching offices:', error);
      return [];
    }

    officesCache = data || [];
    return officesCache;
  } catch (error) {
    console.error('Error in fetchOffices:', error);
    return [];
  }
}

/**
 * Get office ID by name
 */
export async function getOfficeIdByName(officeName: string): Promise<number | null> {
  const offices = await fetchOffices();
  const office = offices.find(o => o.office_name === officeName);
  return office?.office_id || null;
}

/**
 * Get office name by ID
 */
export async function getOfficeNameById(officeId: number): Promise<string | null> {
  const offices = await fetchOffices();
  const office = offices.find(o => o.office_id === officeId);
  return office?.office_name || null;
}

/**
 * Convert office names to IDs
 */
export async function getOfficeIds(officeNames: string[]): Promise<number[]> {
  const offices = await fetchOffices();
  return officeNames
    .map(name => {
      const office = offices.find(o => o.office_name === name);
      return office?.office_id;
    })
    .filter((id): id is number => id !== undefined);
}

/**
 * Refresh office cache
 */
export function clearOfficeCache(): void {
  officesCache = null;
}

export const officeService = {
  fetchOffices,
  getOfficeIdByName,
  getOfficeNameById,
  getOfficeIds,
  clearOfficeCache,
};
