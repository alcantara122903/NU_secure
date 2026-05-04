/**
 * Structured QR payload (v1) encoded on visitor tickets.
 * Scanners parse JSON for visit linkage, route display, and backward-compatible qr_token lookup.
 */

export type VisitorTicketKind = 'enrollee' | 'normal_visitor' | 'contractor';

export type QRRouteStopV1 = {
  order: number;
  office_id: number;
  office_name: string;
};

export type QRTicketPayloadV1 = {
  v: 1;
  kind: VisitorTicketKind;
  qr_token: string;
  visit_id: number;
  visitor_id: number;
  control_number?: string | null;
  /** Ordered offices the visitor should attend (enrollee steps or normal multi-office route). */
  route: QRRouteStopV1[];
};

export function buildQRTicketPayloadV1(params: {
  kind: VisitorTicketKind;
  qr_token: string;
  visit_id: number;
  visitor_id: number;
  control_number?: string | null;
  route: QRRouteStopV1[];
}): string {
  const payload: QRTicketPayloadV1 = {
    v: 1,
    kind: params.kind,
    qr_token: params.qr_token,
    visit_id: params.visit_id,
    visitor_id: params.visitor_id,
    control_number: params.control_number ?? undefined,
    route: params.route,
  };
  return JSON.stringify(payload);
}

const normalizeScanText = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

const parsePositiveInt = (value: unknown): number | null => {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
};

/**
 * Lenient scan parse (aligned with `office-exit-scan` parseRawQr): JSON keys in camelCase or snake_case,
 * pipe-delimited segments, URL query params, then plain token fallback — without requiring full v1 `route`.
 */
export function extractLooseQrScanFields(raw: string): {
  qr_token: string | null;
  visit_id: number | null;
  visitor_id: number | null;
  control_number: string | null;
  pass_number: string | null;
  qr_parts: string[];
} {
  const trimmed = raw.trim();
  const empty = {
    qr_token: null as string | null,
    visit_id: null as number | null,
    visitor_id: null as number | null,
    control_number: null as string | null,
    pass_number: null as string | null,
    qr_parts: [] as string[],
  };
  if (!trimmed) {
    return empty;
  }

  let qr_token: string | null = null;
  let visit_id: number | null = null;
  let visitor_id: number | null = null;
  let control_number: string | null = null;
  let pass_number: string | null = null;
  const qr_parts: string[] = [];

  if (trimmed.includes('|')) {
    const parts = trimmed
      .split('|')
      .map((p) => p.trim())
      .filter(Boolean);
    qr_parts.push(...parts);
    for (const part of parts) {
      if (!control_number && /^\d{4}-/.test(part)) {
        control_number = part;
      }
      if (!qr_token && /QR-/i.test(part)) {
        qr_token = part;
      }
    }
  }

  let parsedAsJsonObject = false;
  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (typeof parsed === 'string') {
      const t = parsed.trim();
      if (t) {
        qr_token = t;
      }
    } else if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      parsedAsJsonObject = true;
      const o = parsed as Record<string, unknown>;
      qr_token = normalizeScanText(o.qrToken || o.qr_token) || qr_token;
      control_number = normalizeScanText(o.controlNumber || o.control_number) || control_number;
      pass_number = normalizeScanText(o.passNumber || o.pass_number) || pass_number;
      visit_id = parsePositiveInt(o.visitId ?? o.visit_id) ?? visit_id;
      visitor_id = parsePositiveInt(o.visitorId ?? o.visitor_id) ?? visitor_id;
    }
  } catch {
    // not JSON
  }

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      const url = new URL(trimmed);
      qr_token =
        normalizeScanText(url.searchParams.get('qrToken')) ||
        normalizeScanText(url.searchParams.get('qr_token')) ||
        normalizeScanText(url.searchParams.get('token')) ||
        qr_token;
      control_number =
        normalizeScanText(url.searchParams.get('controlNumber')) ||
        normalizeScanText(url.searchParams.get('control_number')) ||
        control_number;
      pass_number =
        normalizeScanText(url.searchParams.get('passNumber')) ||
        normalizeScanText(url.searchParams.get('pass_number')) ||
        pass_number;
      visit_id = parsePositiveInt(url.searchParams.get('visitId') || url.searchParams.get('visit_id')) ?? visit_id;
      visitor_id =
        parsePositiveInt(url.searchParams.get('visitorId') || url.searchParams.get('visitor_id')) ?? visitor_id;
    } catch {
      // invalid URL
    }
  }

  if (!qr_token && !parsedAsJsonObject) {
    qr_token = trimmed;
  }

  return { qr_token, visit_id, visitor_id, control_number, pass_number, qr_parts };
}

export function parseQrTicketRaw(raw: string): {
  payload: QRTicketPayloadV1 | null;
  qr_token: string | null;
} {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { payload: null, qr_token: null };
  }
  try {
    const obj = JSON.parse(trimmed) as unknown;
    if (!obj || typeof obj !== 'object') {
      return { payload: null, qr_token: trimmed };
    }
    const o = obj as Record<string, unknown>;
    if (
      o.v === 1 &&
      typeof o.qr_token === 'string' &&
      typeof o.visit_id === 'number' &&
      typeof o.visitor_id === 'number' &&
      typeof o.kind === 'string' &&
      Array.isArray(o.route)
    ) {
      return {
        payload: o as unknown as QRTicketPayloadV1,
        qr_token: o.qr_token,
      };
    }
    const loose = extractLooseQrScanFields(trimmed);
    return {
      payload: null,
      qr_token: loose.qr_token || null,
    };
  } catch {
    // Plain token or legacy format
  }
  return { payload: null, qr_token: trimmed };
}
