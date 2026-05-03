/**
 * Office Service
 * Handles office lookup and ID mapping
 */

import { supabase } from "./database/supabase";

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
      .from("office")
      .select("office_id, office_name, floor, is_active")
      .eq("is_active", true);

    if (error) {
      console.error("Error fetching offices:", error);
      return [];
    }

    officesCache = data || [];
    return officesCache;
  } catch (error) {
    console.error("Error in fetchOffices:", error);
    return [];
  }
}

/**
 * Get office ID by name
 */
export async function getOfficeIdByName(
  officeName: string,
): Promise<number | null> {
  const offices = await fetchOffices();
  const office = offices.find((o) => o.office_name === officeName);
  return office?.office_id || null;
}

/**
 * Get office name by ID
 */
export async function getOfficeNameById(
  officeId: number,
): Promise<string | null> {
  const offices = await fetchOffices();
  const office = offices.find((o) => o.office_id === officeId);
  return office?.office_name || null;
}

function normalizeOfficeInput(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/\u2019/g, "'");
}

/**
 * Map free-typed destination text to an active office (for contractor entry).
 * Uses case-insensitive match, then a single unambiguous substring match on DB names.
 */
export async function resolveOfficeFromUserInput(
  input: string,
): Promise<{ office_id: number; office_name: string } | null> {
  const raw = input.trim();
  if (!raw) return null;

  const list = await fetchOffices();
  if (!list.length) return null;

  const t = normalizeOfficeInput(raw);
  const fold = (s: string) => normalizeOfficeInput(s).replace(/'/g, "");

  const exact = list.find((o) => normalizeOfficeInput(o.office_name) === t);
  if (exact) {
    return { office_id: exact.office_id, office_name: exact.office_name };
  }

  const exactFold = list.find((o) => fold(o.office_name) === fold(raw));
  if (exactFold) {
    return {
      office_id: exactFold.office_id,
      office_name: exactFold.office_name,
    };
  }

  const containsUser = list.filter((o) =>
    normalizeOfficeInput(o.office_name).includes(t),
  );
  if (containsUser.length === 1) {
    const o = containsUser[0];
    return { office_id: o.office_id, office_name: o.office_name };
  }
  if (containsUser.length > 1) {
    return null;
  }

  const userContainsName = list.filter((o) => {
    const on = normalizeOfficeInput(o.office_name);
    return t.includes(on) && on.length >= 4;
  });
  if (userContainsName.length === 1) {
    const o = userContainsName[0];
    return { office_id: o.office_id, office_name: o.office_name };
  }

  return null;
}

/**
 * Convert office names to IDs
 */
export async function getOfficeIds(officeNames: string[]): Promise<number[]> {
  const offices = await fetchOffices();
  return officeNames
    .map((name) => {
      const office = offices.find((o) => o.office_name === name);
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
  resolveOfficeFromUserInput,
  clearOfficeCache,
};
