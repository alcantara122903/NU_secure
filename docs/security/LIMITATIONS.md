# Security Limitations and Future Work

Honest scope boundaries for capstone defense. Acknowledging limitations demonstrates security maturity.

## Current limitations

### 1. Mobile Supabase client uses anon key without per-user identity

The app authenticates with **Laravel Sanctum** but the Supabase JS client is created with only `EXPO_PUBLIC_SUPABASE_ANON_KEY`. The Laravel bearer token is **not** attached to Supabase requests.

**Implication:** RLS cannot use `auth.uid()` from Supabase Auth. Policies must rely on other mechanisms, or `anon` may have broad access.

**Future work:** Laravel issues a short-lived JWT signed with the Supabase JWT secret containing `user_id` and `role_id`. Mobile attaches it to the Supabase client. RLS policies enforce role and office scope.

**Why not done now:** Requires coordinated Laravel + mobile + RLS policy changes; high regression risk one week before defense.

---

### 2. Role checks are primarily client-side for navigation

`app/guard/_layout.tsx` and `app/office/_layout.tsx` redirect by `role_id`. A modified client could reach wrong screens.

**Implication:** UI separation is not security enforcement.

**Mitigation today:** Login rejects admin and invalid roles; `/api/user` re-validates on session restore (when network available).

**Future work:** Enforce roles in RLS or Laravel API for every write.

---

### 3. OCR API key in mobile bundle

**Update:** Mobile now prefers Supabase Edge Function `ocr-parse` (`services/ocr/ocr-client.ts`). Set `OCR_SPACE_API_KEY` in Supabase secrets and deploy the function. Remove `EXPO_PUBLIC_OCR_API_KEY` from `.env.local` for production builds.

**Remaining gap:** Direct OCR fallback still works if `EXPO_PUBLIC_OCR_API_KEY` is set (local dev). Edge function should be deployed before defense demo.

**Setup:** See `docs/security/OCR_EDGE_FUNCTION.md`.

---

### 4. Edge function authentication

**Update (safe pack):** `office-exit-scan` now requires header `x-sanctum-token` (Laravel Sanctum bearer). The function calls `GET {LARAVEL_API_BASE_URL}/api/user` and uses the **server-returned** `user_id` for `scanned_by_user_id`. Client `scannedByUserId` is no longer trusted as the source of truth.

**Deploy:** `supabase functions deploy office-exit-scan --project-ref <your-ref>`  
**Optional secret:** `LARAVEL_API_BASE_URL` (defaults to `https://nu-secure.com`).

**Remaining gap:** Guard exit uses a direct DB path (not this edge function). Full JWT + RLS for all Supabase writes remains future work.

**Partial fix applied earlier:** Removed wildcard QR `ilike` lookup.

---

### 5. Public enrollee progress page

Route: `/enrollee/progress/[token]` — no login required.

**Discloses:** Visitor first/last name, pass number, control number, office route progress (by design for enrollee convenience).

**Fixed:** Page no longer performs database writes on load.

**Future work:** Reduce to initials only; rate-limit lookups; optional short-lived signed URLs.

---

### 6. Visitor photo storage

Photos upload to Supabase Storage bucket `visitor-file`. If the bucket is public, URLs may be guessable.

**Future work:** Private bucket; Laravel admin serves signed URLs; mobile uses signed URLs for display.

**Website impact:** Admin portal must be updated before making bucket private (Laravel uses direct Postgres — DB access unaffected).

---

### 7. Web platform session storage

On web, expo-secure-store may be unavailable; fallback is in-memory storage. Supabase client config references `localStorage` for unused Supabase Auth slot.

**Implication:** Web build is less hardened than native; primary deployment target is mobile.

---

### 8. Client-supplied audit fields

Fields such as `guard_user_id`, `scanned_by_user_id`, and timestamps are set by mobile code today.

**Future work:** Database triggers or RLS `WITH CHECK` clauses binding values to JWT claims.

---

## What was intentionally out of scope (capstone timeline)

| Item | Reason |
|------|--------|
| Full RLS rewrite | Risk of breaking mobile demo |
| Supabase Auth migration | User requested custom auth remain |
| Secret rotation in repo | Operational task for deployer |
| Private storage migration | Requires Laravel admin changes |
| Full MobSF IPA binary scan | Needs Mac + IPA (or EAS); see STATIC_SECURITY_FINDINGS.md for source review |

---

## Recommended post-capstone roadmap

1. Laravel Supabase JWT endpoint + mobile client header
2. Revoke `anon` write policies table-by-table
3. OCR Laravel proxy + key rotation
4. Edge function Sanctum verification
5. Private storage + signed URLs on admin web

---

## Defense talking points

When asked *"Is it fully secure?"*:

> "We applied defense in depth within project scope: secure session storage, opaque QR tokens, no PII in QR payloads, read-only public progress page, and documented gaps with a production roadmap. The admin web uses server-side database access; mobile uses RLS-enabled Supabase with identified improvements for per-user authorization."
