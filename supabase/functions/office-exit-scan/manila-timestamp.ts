/**
 * Mirror of `lib/supabase-timestamp-ph.ts` — kept here so the Edge bundle
 * includes it when deploying this function.
 */
export const PH_TIME_ZONE = 'Asia/Manila' as const;

function pad2(value: string | undefined, fallback: string): string {
  const v = value ?? fallback;
  return v.length >= 2 ? v : v.padStart(2, '0');
}

export function toSupabaseTimestampPh(date: Date = new Date()): string {
  const dtf = new Intl.DateTimeFormat('en-CA', {
    timeZone: PH_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
  const parts = dtf.formatToParts(date);
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value])) as Record<
    string,
    string | undefined
  >;
  const y = map.year;
  const mo = pad2(map.month, '01');
  const da = pad2(map.day, '01');
  const h = pad2(map.hour, '00');
  const m = pad2(map.minute, '00');
  const s = pad2(map.second, '00');
  return `${y}-${mo}-${da}T${h}:${m}:${s}+08:00`;
}
