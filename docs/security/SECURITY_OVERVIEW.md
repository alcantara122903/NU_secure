# Nu Secure — Security Overview

## System summary

**Nu Secure** is a visitor management system for a campus or facility. It supports guard registration, office check-in/exit scanning, enrollee routing, and an admin web portal.

| Component | Technology | Role |
|-----------|------------|------|
| Mobile app | React Native (Expo) | Guard and Office Staff workflows |
| Admin web | Laravel | Admin portal, reports, user management |
| API / auth | Laravel Sanctum | Login, session tokens, password reset |
| Database | Supabase (PostgreSQL) | Visitor, visit, scan, and routing data |
| Storage | Supabase Storage (`visitor-file`) | Visitor face/ID photos |
| OCR | OCR.Space (via mobile; Laravel on web) | ID document text extraction |

## Trust boundaries

```
┌─────────────────┐     Bearer token      ┌─────────────────┐
│  Mobile App     │ ───────────────────►  │  Laravel API    │
│  (untrusted)    │                       │  (trusted)      │
└────────┬────────┘                       └────────┬────────┘
         │                                         │
         │ anon / publishable key                  │ postgres (direct)
         ▼                                         ▼
┌─────────────────────────────────────────────────────────────┐
│                    Supabase (PostgreSQL + Storage)           │
│                    RLS enabled on tables                     │
└─────────────────────────────────────────────────────────────┘
```

- **Mobile app** is treated as an untrusted client. Users can modify local storage or network requests.
- **Laravel** validates credentials and issues Sanctum bearer tokens. Admin web connects to Postgres directly (bypasses RLS).
- **Supabase** stores operational data. Row Level Security (RLS) is enabled; effectiveness depends on policies and how the mobile client authenticates.

## Authentication

### Mobile (custom auth — not Supabase Auth)

1. User logs in with email/password → `POST /api/login` (Laravel Sanctum).
2. Laravel returns a bearer token and user profile (`role_id`, `user_id`, etc.).
3. Token and profile are stored in **expo-secure-store** on iOS/Android (`services/storage/secure-auth.ts`).
4. In-memory session mirrors token for API calls (`services/auth-session.ts`).
5. Allowed mobile roles: **Guard** (`role_id = 2`), **Office Staff** (`role_id = 3`). Admin (`role_id = 1`) is blocked on mobile.

### Route protection (client-side)

- `app/guard/_layout.tsx` — Guard-only screens.
- `app/office/_layout.tsx` — Office Staff-only screens.

These prevent casual navigation only. **Database policies** are the intended enforcement layer for data access.

## Authorization (roles)

| role_id | Role | Mobile access |
|---------|------|---------------|
| 1 | Admin | Web portal only |
| 2 | Guard | Register visitors, dashboard, exit scan |
| 3 | Office Staff | Office portal, check-in scan |

## Sensitive data

| Data | Location | Protection |
|------|----------|------------|
| Session token | expo-secure-store | Encrypted on device |
| Visitor PII | Supabase `visitor` | RLS + app access control |
| ID photos | Supabase Storage | Bucket policies |
| QR visit token | QR code / URL | Opaque token, not full PII |
| OCR API key | Mobile `.env.local` | Known limitation — see LIMITATIONS.md |

## QR ticket design

QR codes encode **visit identifiers**, not full visitor records:

- **Normal / contractor:** JSON with `control_number` and `qr_token` only.
- **Enrollee:** Public progress URL containing `qr_token`.

Full name, contact, and address remain in the database and are loaded after an authorized scan or staff action.

## Security improvements (capstone scope)

Recent changes documented in `THREATS_AND_MITIGATIONS.md`:

- Cryptographically secure QR token generation (`lib/generate-qr-token.ts`)
- Removed QR token logging in production paths
- Public enrollee progress page is read-only (no DB writes on load)
- Edge function: exact QR token match (no wildcard `ilike` lookup)

## Related documents

- [THREATS_AND_MITIGATIONS.md](./THREATS_AND_MITIGATIONS.md)
- [LIMITATIONS.md](./LIMITATIONS.md)
- [TEST_RESULTS.md](./TEST_RESULTS.md)
