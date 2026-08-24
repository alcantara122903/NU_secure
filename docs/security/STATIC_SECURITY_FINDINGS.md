# Nu Secure — Static Security Findings Report

**Type:** Source-code static analysis (MobSF-style checklist)  
**Scope:** Mobile Expo / React Native app (`Nu_secure`) + related Supabase Edge Function source in this repo  
**Date:** 2026-08-24  
**Method:** Manual / automated pattern review of repository source (no live penetration of Supabase; **zero database load**)  
**Not the same as:** Official MobSF IPA/APK binary scan (requires Mac + IPA or Docker + APK)

> **For defense:** This report documents what a mobile security review looks for. Findings match known architecture limits and capstone mitigations already applied.

---

## 1. Executive summary

| Severity | Count | Notes |
|----------|------:|-------|
| Critical | 1 | Edge function trusts client identity (`scannedByUserId`) — documented future work |
| High | 2 | Anon-key Supabase access without per-user JWT; client-side role gate |
| Medium | 4 | Cleartext traffic flag; public progress PII; storage bucket risk; session fail-open offline |
| Low / Info | 5 | Permissions, residual `Math.random` for non-security IDs, logging hygiene improved |

**Overall (capstone context):** The team applied meaningful hardening (crypto QR tokens, OCR key off-device, read-only public progress, log gating, exact QR match). Remaining issues are mostly **backend authorization** gaps, appropriate to disclose as limitations rather than claim “fully secure.”

---

## 2. What was reviewed

| Area | Evidence locations |
|------|--------------------|
| Secrets / env | `.env.example`, OCR client, Supabase client |
| Session storage | `services/storage/secure-auth.ts` |
| Auth / roles | `services/authentication/auth.ts`, `contexts/auth-context.tsx`, `app/guard/_layout.tsx`, `app/office/_layout.tsx` |
| Network | `config/api.ts`, `app.json` (`usesCleartextTraffic`) |
| QR / tokens | `lib/generate-qr-token.ts`, `lib/qr-ticket-payload.ts` |
| Public progress | `services/enrollee-progress-tracker.ts` |
| OCR | `services/ocr/ocr-client.ts`, `supabase/functions/ocr-parse/` |
| Exit scan | `supabase/functions/office-exit-scan/`, `services/office-exit-api.ts` |
| Logging | Upload / OCR / exit-scan `__DEV__` gating |
| Permissions | `app.json` Android/iOS usage strings |

**Out of scope for this pass:** Live RLS probe, fuzzing, load testing (protects free-tier Supabase).

---

## 3. Findings

### F1 — Supabase anon key embedded in client (expected, still High residual risk)

| | |
|--|--|
| **Severity** | High |
| **Category** | Insecure / over-privileged API access |
| **Status** | Known limitation |

**Finding:** `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` ship in the mobile bundle. Mobile does not attach the Laravel Sanctum token to Supabase requests.

**Impact:** Anyone who extracts the publishable key can call Supabase REST as `anon`. Safety depends entirely on RLS policies.

**Mitigation today:** Documented; RLS enabled on project (verify policies separately).  
**Recommendation:** Laravel-issued short-lived JWT + stricter RLS (see `LIMITATIONS.md`).

---

### F2 — Client-supplied scanner identity on exit / check-in (Critical residual)

| | |
|--|--|
| **Severity** | Critical (server trust) |
| **Category** | Broken access control / spoofable identity |
| **Status** | Documented; partial QR fix only |

**Finding:** `office-exit-scan` and mobile check-in paths accept `scannedByUserId` from the client. Edge function uses service role.

**Impact:** A crafted client could claim another staff user’s ID if the function is reachable without Sanctum verification.

**Mitigation today:** Exact `qr_token` match (no `ilike` wildcard).  
**Recommendation:** Validate Sanctum bearer token server-side; derive user id from server, never from body.

---

### F3 — Role enforcement is primarily UI navigation (High)

| | |
|--|--|
| **Severity** | High |
| **Category** | Client-side authorization |
| **Status** | Partially mitigated |

**Finding:** Guard/Office layouts redirect by `role_id`. Admin (`role_id = 1`) is rejected at login with a clear message.

**Impact:** Modified client could open wrong screens; data writes may still succeed if RLS/API allow.

**Mitigation today:** Login role filter; `/api/user` re-check when network works.  
**Gap:** On network failure during restore, cached `role_id` may still be trusted (fail-open) — see F7.

---

### F4 — Android cleartext traffic allowed (Medium)

| | |
|--|--|
| **Severity** | Medium |
| **Category** | Cleartext / MITM exposure |
| **Status** | Config present |

**Finding:** `app.json` sets `"usesCleartextTraffic": true` (Android). `.env.example` shows `http://` local API URL for development.

**Impact:** On Android release builds, HTTP (non-TLS) endpoints could be used if misconfigured, enabling network interception.

**Recommendation:** Set `usesCleartextTraffic: false` for production; keep HTTPS (`https://nu-secure.com`) only. iOS App Transport Security is stricter by default — still avoid HTTP API URLs in production env.

---

### F5 — Public enrollee progress discloses visitor identity (Medium, by design)

| | |
|--|--|
| **Severity** | Medium |
| **Category** | Information disclosure |
| **Status** | Write risk fixed |

**Finding:** Public URL `/enrollee/progress/[token]` loads without login and can show name / pass / route progress.

**Mitigation today:** Tracker is **read-only** (no expectation sync writes on public load). QR tokens use crypto randomness.  
**Recommendation:** Rate limit; show initials only; optional signed short-lived links.

---

### F6 — Visitor photo storage may be publicly reachable (Medium)

| | |
|--|--|
| **Severity** | Medium |
| **Category** | Insecure data storage (cloud) |
| **Status** | Documented |

**Finding:** Photos upload to Supabase Storage bucket `visitor-file`. If the bucket is public, object paths/URLs may be guessable or enumerable.

**Recommendation:** Private bucket + signed URLs (requires Laravel admin coordination).

---

### F7 — Session restore fail-open on network errors (Medium)

| | |
|--|--|
| **Severity** | Medium |
| **Category** | Session management |
| **Status** | Optional hardening not done |

**Finding:** In `contexts/auth-context.tsx`, if `/api/user` fails for a non-unauthorized reason (e.g. offline), the app may continue with the **cached** profile from SecureStore.

**Impact:** Stale or tampered local `role_id` could remain trusted until next successful verify.

**Recommendation:** Fail-closed (force re-login when verify cannot complete). Trade-off: worse offline UX.

---

### F8 — OCR API key: preferred path is server-side (Low residual if configured)

| | |
|--|--|
| **Severity** | Low (if edge deployed; High if key left in mobile env) |
| **Category** | Hardcoded / bundled secrets |
| **Status** | Mitigated in architecture |

**Finding:** App prefers Supabase Edge Function `ocr-parse` with secret `OCR_SPACE_API_KEY`. Direct OCR via `EXPO_PUBLIC_OCR_API_KEY` remains a **dev fallback only**.

**Check before defense:** Production/dev `.env` must **not** set `EXPO_PUBLIC_OCR_API_KEY`. Confirm edge function is deployed.

---

### F9 — Sensitive logging largely gated (Info / Positive)

| | |
|--|--|
| **Severity** | Info (positive control) |
| **Category** | Insecure logging |

**Finding:** Verbose upload/OCR/exit-scan logs are gated with `__DEV__` or equivalent flags. QR tokens removed from success log paths in prior hardening.

**Residual:** Some visitor-flow `console.log` may remain outside upload/OCR; production builds still strip much of Metro logging, but prefer continued cleanup.

---

### F10 — Session token on native uses SecureStore (Info / Positive)

| | |
|--|--|
| **Severity** | Info (positive control) |
| **Category** | Insecure data storage (device) |

**Finding:** `expo-secure-store` used on iOS/Android for token + profile. Web falls back to in-memory Map (weaker; primary target is native).

**Passwords:** Not persisted; sent over HTTPS to Laravel login/reset APIs.

---

### F11 — QR tokens crypto-random; payload avoids full PII (Info / Positive)

| | |
|--|--|
| **Severity** | Info (positive control) |
| **Category** | Weak randomness / PII in QR |

**Finding:**
- Tokens: `expo-crypto` `getRandomBytesAsync` → `QR-{timestamp}-{hex}`.
- Normal/contractor scan JSON: `control_number` + `qr_token` (no name/phone/address).
- Enrollee may encode progress URL / structured route metadata (office names, ids) — **not** full home address PII.

**Note:** Pass/control numbers and office route are operational identifiers, not full visitor dossiers.

---

### F12 — Broad device permissions (Low / Info)

| | |
|--|--|
| **Severity** | Low |
| **Category** | Unnecessary permissions |

**Finding (Android declared):** Camera, Bluetooth (+ connect/scan), fine location.  
**iOS usage strings:** Camera, Bluetooth (printing).

**Justification:** ID capture, QR scan, thermal printer. Location often comes with Bluetooth scan on Android — review if fine location can be dropped for release.

---

### F13 — Non-security `Math.random` still used (Info)

| | |
|--|--|
| **Severity** | Info |
| **Category** | Weak randomness (non-auth) |

**Finding:** `Math.random` still used for pass-number style digits / photo filename suffix — **not** for `qr_token`.

**Recommendation:** Optional: use crypto for all identifiers; low priority vs F1–F2.

---

## 4. OWASP Mobile Top 10 mapping (simplified)

| OWASP M-risk | Related findings |
|--------------|------------------|
| M1 Improper platform usage | F4 cleartext; F12 permissions |
| M2 Insecure data storage | F6 storage; F10 SecureStore (good on native) |
| M3 Insecure communication | F4; API uses HTTPS when configured correctly |
| M4 Insecure authentication | F3, F7 |
| M5 Insufficient cryptography | F11 positive for QR; F13 minor |
| M6 Insecure authorization | F1, F2, F3 |
| M7 Client code quality / secrets | F8 OCR path; env gitignored |
| M8 Code tampering | Client always untrusted — rely on server |
| M9 Reverse engineering | Anon key extractable by design (`EXPO_PUBLIC_*`) |
| M10 Extraneous functionality | F9 logging; diagnostics utilities |

---

## 5. Positive controls already implemented

1. Crypto QR token generation (`lib/generate-qr-token.ts`)  
2. Compact QR without name/phone/address for normal/contractor tickets  
3. Public enrollee progress **read-only**  
4. OCR key preferred in Supabase secrets (`ocr-parse`)  
5. Exact QR match in exit-scan edge function source (redeploy if not live)  
6. Admin blocked on mobile login  
7. Native SecureStore for session  
8. Verbose upload/OCR logs gated with `__DEV__`  
9. `.env*.local` in `.gitignore`  
10. Security documentation set under `docs/security/`

---

## 6. Safe testing note (free Supabase)

This analysis **did not**:
- Run ZAP active scan against Supabase  
- Mass-insert/fuzz `visit` or storage  
- Enumerate progress tokens at scale  

Those actions can exhaust free-tier limits. Prefer this report + manual demo checklist in `TEST_RESULTS.md`.

---

## 7. Defense one-liner

> “We performed a static security review of the mobile codebase (MobSF-style checklist). Critical remaining risks are server-side authorization (anon key + edge function identity), which we document with a production roadmap. Within capstone scope we hardened QR entropy, removed public write paths, moved OCR secrets off-device, secured session storage, and reduced sensitive logging.”

---

## 8. Related documents

- [SECURITY_OVERVIEW.md](./SECURITY_OVERVIEW.md)  
- [THREATS_AND_MITIGATIONS.md](./THREATS_AND_MITIGATIONS.md)  
- [LIMITATIONS.md](./LIMITATIONS.md)  
- [TEST_RESULTS.md](./TEST_RESULTS.md)  
- [OCR_EDGE_FUNCTION.md](./OCR_EDGE_FUNCTION.md)  
