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
  } catch {
    // Plain token or legacy format
  }
  return { payload: null, qr_token: trimmed };
}
