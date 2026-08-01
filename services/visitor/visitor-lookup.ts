/**
 * Visitor Lookup Service
 * Prevents duplicate visitor records and detects returning visitors
 * after ID OCR (name + birthday).
 */

import { addressService } from '../address';
import { VISIT_TYPE } from '../office-flow/constants';
import { supabase } from '../supabase';
import { VISITOR_FILES_BUCKET } from '../storage/upload';

export interface VisitorSearchCriteria {
  firstName: string;
  lastName: string;
  contactNo?: string;
  /** ISO YYYY-MM-DD — preferred match when present */
  birthday?: string;
}

export interface ExistingVisitor {
  visitor_id: number;
  pass_number: string;
  control_number: string;
  first_name: string;
  last_name: string;
  contact_no: string;
  address_id: number | null;
  birthday?: string | null;
  visitor_photo_with_id_url?: string | null;
}

export type ReturningVisitorType = 'enrollee' | 'contractor' | 'normal';

export interface ReturningVisitorMatch {
  visitorId: number;
  firstName: string;
  lastName: string;
  contactNo: string;
  birthday: string;
  addressText: string;
  addressParts: {
    houseNo: string;
    street: string;
    barangay: string;
    cityMunicipality: string;
    province: string;
    region: string;
  };
  photoUrl: string | null;
  visitorType: ReturningVisitorType;
  visitTypeId: number;
  progress: {
    completedSteps: number;
    totalSteps: number;
    nextStepName: string | null;
    nextOfficeName: string | null;
    allCompleted: boolean;
  } | null;
  lastVisitSummary: string | null;
  /** Prefill helpers */
  passNumber: string;
  controlNumber: string;
}

const normalizeName = (value: string): string => value.trim().replace(/\s+/g, ' ');

const normalizeBirthday = (value?: string | null): string | null => {
  if (!value) return null;
  const trimmed = value.trim();
  const iso = trimmed.match(/^(\d{4}-\d{2}-\d{2})/);
  if (iso) return iso[1];
  // OCR sometimes returns YYYY/MM/DD
  const slash = trimmed.match(/^(\d{4})[\/.](\d{2})[\/.](\d{2})/);
  if (slash) return `${slash[1]}-${slash[2]}-${slash[3]}`;
  return null;
};

const formatAddressText = (parts: {
  houseNo?: string | null;
  street?: string | null;
  barangay?: string | null;
  cityMunicipality?: string | null;
  province?: string | null;
  region?: string | null;
}): string =>
  [
    parts.houseNo,
    parts.street,
    parts.barangay,
    parts.cityMunicipality,
    parts.province,
    parts.region,
  ]
    .map((p) => (p ?? '').trim())
    .filter(Boolean)
    .join(', ');

const visitTypeToKey = (visitTypeId: number | null | undefined): ReturningVisitorType => {
  if (visitTypeId === VISIT_TYPE.ENROLLEE) return 'enrollee';
  if (visitTypeId === VISIT_TYPE.CONTRACTOR) return 'contractor';
  return 'normal';
};

/** Resolve stored path or absolute URL for Image display (signed first, then public). */
const resolvePhotoUri = async (
  raw: string | null | undefined,
): Promise<string | null> => {
  const value = (raw || '').trim();
  if (!value) return null;

  if (value.startsWith('http://') || value.startsWith('https://')) {
    return value;
  }

  const trimmed = value.replace(/^\/+/, '');
  let storagePath = trimmed;
  if (trimmed.startsWith('visitor-files/')) {
    storagePath = trimmed.slice('visitor-files/'.length);
  } else if (trimmed.startsWith('visitor-file/')) {
    storagePath = trimmed.slice('visitor-file/'.length);
  } else if (trimmed.startsWith(`${VISITOR_FILES_BUCKET}/`)) {
    storagePath = trimmed.slice(VISITOR_FILES_BUCKET.length + 1);
  }
  if (!storagePath) return null;

  // Prefer signed URL so private buckets still show in the modal
  try {
    const { data: signed, error } = await supabase.storage
      .from(VISITOR_FILES_BUCKET)
      .createSignedUrl(storagePath, 60 * 60);
    if (!error && signed?.signedUrl) {
      return signed.signedUrl;
    }
  } catch (err) {
    console.warn('⚠️ Signed photo URL failed:', err);
  }

  const { data: publicData } = supabase.storage
    .from(VISITOR_FILES_BUCKET)
    .getPublicUrl(storagePath);
  if (publicData?.publicUrl) {
    return publicData.publicUrl;
  }

  const supabaseUrl = (process.env.EXPO_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
  if (supabaseUrl) {
    return `${supabaseUrl}/storage/v1/object/public/${VISITOR_FILES_BUCKET}/${storagePath}`;
  }

  return null;
};

/** Prefer any same-person row that already has a saved face photo path. */
const pickBestPhotoRaw = (rows: any[]): string | null => {
  for (const row of rows) {
    const raw = row?.visitor_photo_with_id_url;
    if (typeof raw === 'string' && raw.trim().length > 0) {
      return raw.trim();
    }
  }
  return null;
};

const mapExistingVisitor = (visitor: any): ExistingVisitor => ({
  visitor_id: visitor.visitor_id,
  pass_number: visitor.pass_number,
  control_number: visitor.control_number,
  first_name: visitor.first_name,
  last_name: visitor.last_name,
  contact_no: visitor.contact_no,
  address_id: visitor.address_id,
  birthday: visitor.birthday ?? null,
  visitor_photo_with_id_url: visitor.visitor_photo_with_id_url ?? null,
});

export const visitorLookupService = {
  /**
   * Find existing visitor by first name, last name, and optional contact / birthday.
   */
  async findExistingVisitor(criteria: VisitorSearchCriteria): Promise<ExistingVisitor | null> {
    try {
      console.log('\n🔍 Searching for existing visitor record...');
      console.log(`   First Name: ${criteria.firstName}`);
      console.log(`   Last Name: ${criteria.lastName}`);
      console.log(`   Contact: ${criteria.contactNo || 'N/A'}`);
      console.log(`   Birthday: ${criteria.birthday || 'N/A'}`);

      const firstName = normalizeName(criteria.firstName);
      const lastName = normalizeName(criteria.lastName);
      if (!firstName || !lastName) return null;

      const { data: sameNameVisitors, error } = await supabase
        .from('visitor')
        .select('*')
        .ilike('first_name', firstName)
        .ilike('last_name', lastName)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Error searching for visitor:', error);
        return null;
      }

      if (!sameNameVisitors || sameNameVisitors.length === 0) {
        console.log('✅ No existing visitor found');
        return null;
      }

      const birthday = normalizeBirthday(criteria.birthday);
      const byBirthday =
        birthday != null
          ? sameNameVisitors.filter(
              (v) => normalizeBirthday(v.birthday) === birthday,
            )
          : [];

      const pool = byBirthday.length > 0 ? byBirthday : sameNameVisitors;

      const contact = criteria.contactNo?.trim();
      const preferredByContact =
        contact != null && contact.length > 0
          ? pool.find((v) => String(v.contact_no ?? '').trim() === contact)
          : null;

      const visitorIds = pool
        .map((v) => v.visitor_id)
        .filter((id): id is number => typeof id === 'number' && Number.isFinite(id));

      let preferredByEnrolleeVisitorId: number | null = null;
      if (visitorIds.length > 0) {
        const { data: enrolleeRows } = await supabase
          .from('enrollee')
          .select('visitor_id, updated_at')
          .in('visitor_id', visitorIds)
          .order('updated_at', { ascending: false });

        const firstMatch = (enrolleeRows ?? []).find(
          (r) => typeof r.visitor_id === 'number' && visitorIds.includes(r.visitor_id),
        );
        preferredByEnrolleeVisitorId = firstMatch?.visitor_id ?? null;
      }

      const preferredByEnrollee =
        preferredByEnrolleeVisitorId != null
          ? pool.find((v) => Number(v.visitor_id) === Number(preferredByEnrolleeVisitorId))
          : null;

      const visitor = preferredByContact ?? preferredByEnrollee ?? pool[0];
      console.log(`✅ Found existing visitor!`);
      console.log(`   Visitor ID: ${visitor.visitor_id}`);
      console.log(`   Birthday match used: ${byBirthday.length > 0 ? 'yes' : 'no'}`);

      return mapExistingVisitor(visitor);
    } catch (error) {
      console.error('❌ Visitor lookup error:', error);
      return null;
    }
  },

  /**
   * After ID OCR: match by first name + last name + birthday and build
   * a returning-visitor payload (type, photo, address, enrollee progress).
   */
  async findReturningByNameAndBirthday(criteria: {
    firstName: string;
    lastName: string;
    birthday: string;
  }): Promise<ReturningVisitorMatch | null> {
    try {
      const firstName = normalizeName(criteria.firstName);
      const lastName = normalizeName(criteria.lastName);
      const birthday = normalizeBirthday(criteria.birthday);

      if (!firstName || !lastName || !birthday) {
        console.log('⏭️ Skipping returning lookup — need name + birthday');
        return null;
      }

      console.log('\n🔎 Returning visitor lookup (name + birthday)...');
      console.log(`   ${firstName} ${lastName} · ${birthday}`);

      const { data: candidates, error } = await supabase
        .from('visitor')
        .select('*')
        .ilike('first_name', firstName)
        .ilike('last_name', lastName)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('❌ Returning lookup error:', error);
        return null;
      }

      const matches = (candidates ?? []).filter(
        (v) => normalizeBirthday(v.birthday) === birthday,
      );

      if (matches.length === 0) {
        console.log('✅ No returning visitor with same name + birthday');
        return null;
      }

      // Prefer a row that already has a validation photo saved
      matches.sort((a, b) => {
        const aPhoto = String(a.visitor_photo_with_id_url ?? '').trim() ? 1 : 0;
        const bPhoto = String(b.visitor_photo_with_id_url ?? '').trim() ? 1 : 0;
        return bPhoto - aPhoto;
      });

      const visitorIds = matches.map((v) => v.visitor_id as number);

      // Prefer unfinished enrollee progress
      const { data: enrolleeRows } = await supabase
        .from('enrollee')
        .select('enrollee_id, visitor_id, updated_at')
        .in('visitor_id', visitorIds)
        .order('updated_at', { ascending: false });

      let chosen = matches[0];
      let enrolleeId: number | null = null;
      let visitTypeId: number = VISIT_TYPE.NORMAL;
      let progress: ReturningVisitorMatch['progress'] = null;
      let lastVisitSummary: string | null = null;

      for (const row of enrolleeRows ?? []) {
        const summary = await this.buildEnrolleeProgress(row.enrollee_id);
        if (summary && !summary.allCompleted) {
          const visitor = matches.find(
            (v) => Number(v.visitor_id) === Number(row.visitor_id),
          );
          if (visitor) {
            chosen = visitor;
            enrolleeId = row.enrollee_id;
            visitTypeId = VISIT_TYPE.ENROLLEE;
            progress = summary;
            break;
          }
        }
      }

      // If no unfinished enrollee, use most recent visit type
      if (visitTypeId !== VISIT_TYPE.ENROLLEE || !progress) {
        const { data: recentVisits } = await supabase
          .from('visit')
          .select(
            `
            visit_id,
            visit_type_id,
            purpose_reason,
            entry_time,
            visitor_id,
            visit_type(visit_type_name),
            primary_office:office(office_name)
          `,
          )
          .in('visitor_id', visitorIds)
          .order('entry_time', { ascending: false })
          .limit(5);

        const latest = (recentVisits ?? []).find((v) =>
          visitorIds.includes(v.visitor_id),
        );

        if (latest) {
          const visitor = matches.find(
            (v) => Number(v.visitor_id) === Number(latest.visitor_id),
          );
          if (visitor) chosen = visitor;
          visitTypeId = Number(latest.visit_type_id) || VISIT_TYPE.NORMAL;

          // If enrollee but progress was complete / missing, still try summary
          if (visitTypeId === VISIT_TYPE.ENROLLEE && !progress) {
            const enrolleeForVisitor = (enrolleeRows ?? []).find(
              (e) => Number(e.visitor_id) === Number(chosen.visitor_id),
            );
            if (enrolleeForVisitor?.enrollee_id != null) {
              enrolleeId = enrolleeForVisitor.enrollee_id;
              progress = await this.buildEnrolleeProgress(
                enrolleeForVisitor.enrollee_id,
              );
            }
          }

          const typeName =
            (latest.visit_type as any)?.visit_type_name ||
            visitTypeToKey(visitTypeId);
          const officeName = (latest.primary_office as any)?.office_name;
          lastVisitSummary = officeName
            ? `Last visit: ${typeName} · ${officeName}`
            : `Last visit: ${typeName}`;
        } else if ((enrolleeRows ?? []).length > 0) {
          visitTypeId = VISIT_TYPE.ENROLLEE;
          const first = enrolleeRows![0];
          const visitor = matches.find(
            (v) => Number(v.visitor_id) === Number(first.visitor_id),
          );
          if (visitor) chosen = visitor;
          if (first.enrollee_id != null) {
            enrolleeId = first.enrollee_id;
            progress = await this.buildEnrolleeProgress(first.enrollee_id);
          }
          lastVisitSummary = 'Previously registered as Enrollee';
        }
      }

      let addressParts = {
        houseNo: '',
        street: '',
        barangay: '',
        cityMunicipality: '',
        province: '',
        region: '',
      };
      let addressText = '';
      if (chosen.address_id) {
        const addr = await addressService.getAddress(chosen.address_id);
        if (addr) {
          addressParts = {
            houseNo: addr.houseNo || '',
            street: addr.street || '',
            barangay: addr.barangay || '',
            cityMunicipality: addr.cityMunicipality || '',
            province: addr.province || '',
            region: addr.region || '',
          };
          addressText = formatAddressText(addressParts);
        }
      }

      const rawPhoto =
        (typeof chosen.visitor_photo_with_id_url === 'string' &&
        chosen.visitor_photo_with_id_url.trim().length > 0
          ? chosen.visitor_photo_with_id_url.trim()
          : null) || pickBestPhotoRaw(matches);
      const photoUrl = await resolvePhotoUri(rawPhoto);

      console.log(
        `   Raw photo field: ${rawPhoto ? rawPhoto.slice(0, 120) : '(empty)'}`,
      );
      console.log(`   Resolved photo URL: ${photoUrl ? 'yes' : 'no'}`);

      const match: ReturningVisitorMatch = {
        visitorId: chosen.visitor_id,
        firstName: chosen.first_name || firstName,
        lastName: chosen.last_name || lastName,
        contactNo: String(chosen.contact_no ?? ''),
        birthday,
        addressText,
        addressParts,
        photoUrl,
        visitorType: visitTypeToKey(visitTypeId),
        visitTypeId,
        progress,
        lastVisitSummary,
        passNumber: String(chosen.pass_number ?? ''),
        controlNumber: String(chosen.control_number ?? ''),
      };

      console.log('✅ Returning visitor match:');
      console.log(`   ID: ${match.visitorId} · type: ${match.visitorType}`);
      console.log(`   Photo URL: ${match.photoUrl ? 'yes' : 'no'}`);
      return match;
    } catch (error) {
      console.error('❌ findReturningByNameAndBirthday error:', error);
      return null;
    }
  },

  async buildEnrolleeProgress(
    enrolleeId: number,
  ): Promise<ReturningVisitorMatch['progress']> {
    try {
      const { data: steps, error } = await supabase
        .from('enrollee_progress')
        .select(
          `
          progress_id,
          completed_at,
          step:enrollee_step(
            step_id,
            step_name,
            step_order,
            office_id
          )
        `,
        )
        .eq('enrollee_id', enrolleeId);

      if (error || !steps || steps.length === 0) {
        return null;
      }

      const pickStep = (row: any) => (Array.isArray(row?.step) ? row.step[0] : row?.step);
      const sorted = [...steps].sort(
        (a: any, b: any) => (pickStep(a)?.step_order ?? 0) - (pickStep(b)?.step_order ?? 0),
      );

      const completedSteps = sorted.filter((s: any) => s.completed_at != null).length;
      const totalSteps = sorted.length;
      const next = sorted.find((s: any) => s.completed_at == null);
      const nextStep = pickStep(next);

      let nextOfficeName: string | null = null;
      if (nextStep?.office_id != null) {
        const { data: officeRow } = await supabase
          .from('office')
          .select('office_name')
          .eq('office_id', nextStep.office_id)
          .maybeSingle();
        nextOfficeName = officeRow?.office_name ?? null;
      }

      return {
        completedSteps,
        totalSteps,
        nextStepName: nextStep?.step_name ?? null,
        nextOfficeName,
        allCompleted: completedSteps === totalSteps,
      };
    } catch (error) {
      console.error('❌ buildEnrolleeProgress error:', error);
      return null;
    }
  },

  async findVisitorsByFirstName(firstName: string): Promise<ExistingVisitor[]> {
    try {
      const { data: visitors, error } = await supabase
        .from('visitor')
        .select('*')
        .ilike('first_name', `%${firstName}%`);

      if (error || !visitors) return [];
      return visitors.map(mapExistingVisitor);
    } catch (error) {
      console.error('❌ Error in findVisitorsByFirstName:', error);
      return [];
    }
  },

  async findVisitorByContact(contactNo: string): Promise<ExistingVisitor | null> {
    try {
      const { data: visitors, error } = await supabase
        .from('visitor')
        .select('*')
        .eq('contact_no', contactNo);

      if (error || !visitors || visitors.length === 0) return null;
      return mapExistingVisitor(visitors[0]);
    } catch (error) {
      console.error('❌ Error in findVisitorByContact:', error);
      return null;
    }
  },

  async getVisitorVisits(visitorId: number): Promise<any[]> {
    try {
      const { data: visits, error } = await supabase
        .from('visit')
        .select(
          `
          visit_id,
          visit_type_id,
          entry_time,
          exit_time,
          qr_token,
          purpose_reason,
          visit_type(visit_type_name),
          primary_office:office(office_name)
        `,
        )
        .eq('visitor_id', visitorId)
        .order('entry_time', { ascending: false });

      if (error) return [];
      return visits || [];
    } catch (error) {
      console.error('❌ Error in getVisitorVisits:', error);
      return [];
    }
  },
};
