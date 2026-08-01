/**
 * Enrollee browser progress URL encoded into QR tickets.
 * Example: https://www.nu-secure.com/enrollee/progress/QR-1785168364753-INGWRJ
 */

export const ENROLLEE_PROGRESS_BASE_URL =
  'https://www.nu-secure.com/enrollee/progress';

const QR_TOKEN_REGEX = /QR-[A-Za-z0-9_-]+/i;

/** Build the public progress URL for a visit `qr_token`. */
export function buildEnrolleeProgressUrl(qrToken: string): string {
  const token = (qrToken || '').trim();
  if (!token) {
    return ENROLLEE_PROGRESS_BASE_URL;
  }
  // Avoid double-prefix if already a full URL
  if (/^https?:\/\//i.test(token)) {
    const extracted = extractQrTokenFromAnyScan(token);
    if (extracted) {
      return `${ENROLLEE_PROGRESS_BASE_URL}/${extracted}`;
    }
    return token;
  }
  const pathToken = token.replace(/^\/+/, '');
  return `${ENROLLEE_PROGRESS_BASE_URL}/${pathToken}`;
}

/**
 * Extract `QR-...` from a progress URL, JSON, or plain token.
 * Uses regex first so React Native scanners still work when `new URL()` fails.
 */
export function extractQrTokenFromAnyScan(raw: string): string | null {
  const trimmed = (raw || '').trim();
  if (!trimmed) {
    return null;
  }

  // Fast path: any QR-… token embedded in the scan text (URL, path, plain)
  const embedded = trimmed.match(QR_TOKEN_REGEX);
  if (embedded?.[0]) {
    return embedded[0];
  }

  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const url = new URL(trimmed);
      const fromQuery =
        url.searchParams.get('qrToken') ||
        url.searchParams.get('qr_token') ||
        url.searchParams.get('token');
      if (fromQuery?.trim()) {
        const q = fromQuery.trim().match(QR_TOKEN_REGEX);
        return q?.[0] || fromQuery.trim();
      }

      const segments = url.pathname.split('/').filter(Boolean);
      const progressIdx = segments.findIndex((s) => s.toLowerCase() === 'progress');
      if (progressIdx >= 0 && segments[progressIdx + 1]) {
        const seg = decodeURIComponent(segments[progressIdx + 1]);
        const m = seg.match(QR_TOKEN_REGEX);
        return m?.[0] || seg;
      }

      const last = segments[segments.length - 1];
      if (last) {
        const seg = decodeURIComponent(last);
        const m = seg.match(QR_TOKEN_REGEX);
        if (m) {
          return m[0];
        }
      }
    } catch {
      // fall through
    }
  }

  if (!trimmed.includes('{') && trimmed.length > 0 && trimmed.length < 200) {
    // Plain legacy token without QR- prefix
    if (!/^https?:\/\//i.test(trimmed)) {
      return trimmed;
    }
  }

  return null;
}
