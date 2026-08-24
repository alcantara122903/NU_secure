# Threats and Mitigations

This document maps common threats to Nu Secure controls. Severity reflects impact before capstone hardening.

## Summary table

| # | Threat | Risk | Mitigation | Status |
|---|--------|------|------------|--------|
| T1 | Stolen Supabase anon key used to forge visits/exits | Critical | RLS policies; future JWT bridge | Partial — RLS enabled, mobile uses anon key |
| T2 | Spoofed guard/staff identity on DB writes | High | Server-derived user IDs in RLS/API | Partial — client supplies IDs today |
| T3 | QR token guessing / enumeration | High | Crypto-random tokens | **Implemented** |
| T4 | Wildcard QR scan matches wrong visit | High | Exact `eq` match in edge function | **Implemented** |
| T5 | PII embedded in QR code | Medium | Token-only payload design | **Implemented** (by design) |
| T6 | Public progress page mutates database | Medium | Removed sync writes on public load | **Implemented** |
| T7 | Session token theft from device | Medium | expo-secure-store | **Implemented** (native) |
| T8 | OCR API key extracted from app bundle | High | Supabase Edge Function `ocr-parse` | **Implemented** — deploy + remove mobile key |
| T9 | Role bypass via tampered local profile | High | RLS by role; periodic `/api/user` verify | Partial |
| T10 | Secrets in application logs | Medium | Removed QR token logs; `__DEV__` gating (upload/OCR/exit-scan) | **Implemented** |
| T11 | Edge function trusts client `scannedByUserId` | Critical | Verify Laravel token server-side | Planned |
| T12 | Visitor photos publicly accessible | Medium | Private bucket + signed URLs | Planned |

---

## T1 — Abuse of Supabase anon key

**Threat:** Attacker extracts `EXPO_PUBLIC_SUPABASE_ANON_KEY` from the app and calls the REST API directly.

**Impact:** Unauthorized reads/writes if RLS allows `anon` to mutate tables.

**Controls:**
- RLS enabled on Supabase tables (project configuration).
- Publishable key is intended for client use; policies must deny unsafe operations.

**Capstone action:** Documented. Full fix (Laravel-signed JWT + restrictive RLS) scoped as future work due to defense timeline.

---

## T3 — Weak QR token generation

**Threat:** Predictable tokens (`Math.random()` + timestamp) allow guessing valid visit tokens.

**Impact:** Unauthorized access to enrollee progress page or visit lookup.

**Mitigation implemented:**
- `lib/generate-qr-token.ts` uses `expo-crypto` `getRandomBytesAsync`.
- Used by normal visitor, contractor, and enrollee registration flows.

**Files changed:**
- `lib/generate-qr-token.ts`
- `services/visitor/normal-visitor.ts`
- `services/visitor/contractor.ts`
- `app/guard/register-visitor.tsx`

---

## T4 — Wildcard QR matching

**Threat:** SQL `ilike` on `qr_token` treats `%` as wildcard; malicious scan input could match arbitrary visits.

**Impact:** Incorrect exit scan or visit resolution.

**Mitigation implemented:**
- Removed `ilike` fallback in `supabase/functions/office-exit-scan/index.ts`.
- Lookup uses exact `eq('qr_token', value)` only.

**Note:** Redeploy edge function to Supabase for production effect.

---

## T6 — Public page database writes

**Threat:** Unauthenticated enrollee progress URL triggered `syncOfficeExpectationsForEnrolleeVisit`, mutating routing data.

**Impact:** Data integrity risk; unauthenticated write path.

**Mitigation implemented:**
- `services/enrollee-progress-tracker.ts` loads progress read-only.
- Expectation repair/sync remains available through authenticated guard flows.

---

## T10 — Sensitive logging

**Threat:** QR tokens and scan payloads logged to device console; accessible via debugging tools.

**Mitigation implemented:**
- Removed `qr_token` from success logs in visitor services.
- Exit scan request logs gated behind `__DEV__`.
- Enrollee registration logs no longer print QR token.

---

## T5 — PII in QR codes

**Threat:** Encoding name, phone, or address in QR exposes data to anyone who photographs the ticket.

**Control (existing design):**
- `lib/qr-ticket-payload.ts` — normal/contractor JSON contains only `control_number` and `qr_token`.
- Enrollee QR encodes progress URL with token only.

**Demo for defense:** Scan or inspect QR JSON — no personal fields present.

---

## T7 — Session storage

**Threat:** Tokens stored in plain AsyncStorage or logs.

**Control:**
- `services/storage/secure-auth.ts` — expo-secure-store on native platforms.
- Passwords never persisted; sent once to Laravel over HTTPS.

---

## Items documented but not fully implemented (see LIMITATIONS.md)

- T1/T2/T9: Per-user Supabase JWT from Laravel + role-based RLS
- T8: OCR edge function deployed; remove mobile key from production builds
- T11: Edge function caller authentication
- T12: Private storage bucket with signed URLs

These are appropriate **future work** for a production rollout and were deprioritized one week before capstone defense to avoid breaking the live demo.
