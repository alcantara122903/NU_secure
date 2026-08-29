# NU-SECURE Mobile App

Smart visitor monitoring system for **Guard** and **Office Staff** — built with Expo (React Native), Laravel Sanctum auth, and Supabase.

## Quick start

1. Install dependencies:

   ```bash
   npm install
   ```

2. Create `.env.local` in the project root:

   ```env
   EXPO_PUBLIC_API_URL=https://www.nu-secure.com
   EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
   ```

   Use `www.nu-secure.com` or `api.nu-secure.com` — bare `nu-secure.com` returns 405 on login POST.

3. Start the app:

   ```bash
   npx expo start
   ```

   Same Wi‑Fi (LAN) or tunnel for physical device:

   ```bash
   npx expo start --tunnel
   ```

## Project structure

| Folder | Purpose |
|--------|---------|
| `app/` | Screens (Expo Router) — login, guard, office, enrollee progress |
| `services/` | API, auth, OCR, visitor registration, Supabase |
| `components/` | UI components |
| `docs/security/` | Security overview, threats, test checklist |
| `docs/backend/` | Laravel integration notes |
| `docs/DATABASE_SCHEMA.md` | Database table reference |
| `supabase/functions/` | Edge functions (`ocr-parse`, `office-exit-scan`) |

## Scripts

```bash
npm run start    # expo start
npm run android  # expo run:android
npm run ios      # expo run:ios
npm run lint     # eslint
```

## Security

See [`docs/security/`](docs/security/) for architecture, mitigations, limitations, and defense demo checklist.

OCR proxy setup: [`docs/security/OCR_EDGE_FUNCTION.md`](docs/security/OCR_EDGE_FUNCTION.md)

## Roles

| role_id | Role | Mobile |
|---------|------|--------|
| 1 | Admin | Web portal only |
| 2 | Guard | Register visitors, exit scan |
| 3 | Office Staff | Office portal, check-in scan |
