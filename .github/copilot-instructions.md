# Nu_Secure Project Guidelines

## Project Overview

**Nu_Secure** is an Expo-based React Native visitor management system with identity verification. It captures visitor information via ID document scanning with OCR-powered extraction, supports 17 Philippine ID types, and manages visitor records in Supabase.

**Tech Stack:**
- React Native 0.81.5 with Expo ~54.0
- TypeScript 5.9
- Expo Router (file-based routing)
- Supabase for authentication and data persistence
- OCR.Space API for document text extraction
- Tesseract.js for optional local OCR

## Quick Start

**Install & Run:**
```bash
npm install
npx expo start
```

**Platform-specific:**
- Android: `npm run android`
- iOS: `npm run ios`
- Web: `npm run web`

**Linting:**
```bash
npm run lint
```

**Reset project template:**
```bash
npm run reset-project
```

## Architecture

### File Structure

- **`app/`** — Expo Router-based navigation (file-based routing)
  - `(tabs)/` — Tab-based main interface
  - `guard/` — Security guard portal (dashboard, visitor registration, alerts)
  - `office/` — Office admin portal
  - Routes map directly to UI screens

- **`services/`** — Core business logic (feature-specific services)
  - `auth.ts` — Supabase authentication
  - `supabase.ts` — Supabase client initialization
  - `camera.ts` — Camera/gallery/file picker
  - `ocr-service.ts` — OCR.Space API integration for document text extraction
  - `id-type-detector.ts` — Analyzes OCR text to detect ID document type (PhilSys, Passport, Driver's License, etc.)
  - `id-multi-parser.ts` — Type-specific parsers for 17 Philippine ID types; main extraction logic
  - `enrollee.ts` — Visitor registration/enrollment orchestration
  - `address.ts` — Address formatting utilities
  - `validation.ts` — Field validation rules

- **`components/`** — Reusable React components
  - `ui/` — Base UI components (collapsible, icons)
  - Theme-aware components (ThemedText, ThemedView)

- **`constants/`** — Static configuration
  - `colors.ts` — Color palette (light/dark modes)
  - `theme.ts` — Theme definitions

- **`hooks/`** — Custom React hooks
  - `use-color-scheme.ts` — Platform-specific theme detection
  - `use-theme-color.ts` — Theme-aware color selection

- **`types/`** — TypeScript interfaces
  - `auth.ts` — Authentication types (User, AuthSession)
  - `enrollee.ts` — Visitor/enrollee types

- **`utils/`** — Utility functions
  - `ocr-diagnostics.ts` — OCR debugging and logging
  - `ocr-service.ts` — OCR connectivity tests
  - `validation.ts` — Field validation

- **`BACKEND_OCR_SERVICE.js`** — Express backend for OCR processing (optional legacy support)

### Key Services (Domain Logic)

#### OCR & ID Parsing System

**Data Flow:**
1. User captures/uploads ID image via camera
2. `ocr-service.ts` sends to OCR.Space API → returns raw text
3. `id-type-detector.ts` analyzes text → detects document type (e.g., Driver's License, PhilSys ID)
4. `id-multi-parser.ts` routes to type-specific parser → extracts `firstName`, `lastName`, `address`
5. `enrollee.ts` orchestrates → saves to Supabase or shows manual entry fallback
6. User can edit all fields before final submission

**Supported ID Types (17):**
PhilSys, Passport, Driver's License, UMID, PRC ID, TIN ID, Postal ID, Voter's ID, Senior Citizen ID, PWD ID, PhilHealth ID, SSS ID, School ID, Company/Employee ID, Barangay ID/Clearance, Police Clearance, NBI Clearance.

**Error Handling:**
- No OCR text → Show "Enter manually" message
- Partial extraction → Return available fields (e.g., address found but no names)
- Network failures → Graceful fallback to manual entry
- Validation requires ≥1 field extracted before accepting OCR result

**See:** `/memories/repo/ocr-integration.md` and `/memories/repo/parser-fix-label-detection.md` for detailed integration notes.

#### Authentication (`services/auth.ts`)

- Supabase JWT-based auth
- User session persistence
- Role-based access (guard vs. office admin)

#### Visitor Enrollment (`services/enrollee.ts`)

- Orchestrates ID capture → OCR extraction → field parsing → Supabase save
- Supports partial extraction (incomplete OCR results still usable)
- Returns `EnrolleeData` with optional fields

## Code Conventions

### TypeScript

- **Strict mode enabled** (`tsconfig.json` has `"strict": true`)
- Use explicit type annotations for service functions
- Prefer `interface` over `type` for object contracts
- Path alias `@/*` resolves to project root

### Services Layer

- Keep services **focused and single-responsibility**
- Export main utility functions and interfaces
- Services should be **stateless** (delegation to Supabase/API)
- Error handling: Return `null` or throw with descriptive messages; avoid silent failures
- **Logging:** Use `console.log` with context prefixes (e.g., `console.log('[OCR] ...', value)` for debugging in id-multi-parser)

### React Components

- Use **functional components only**
- Hooks: `useEffect`, `useState`, custom hooks from `hooks/`
- Components that depend on theme must use `useThemeColor` hook
- Keep styling theme-aware (light/dark modes)

### OCR & Parsing (Critical Domain Logic)

- **Partial results expected:** Parser may extract only address, or only name—don't require all fields
- **Label-based + pattern-based:** Try explicit "FIRSTNAME:" labels first; fallback to line classification
- **Blacklist shared keywords:** REPUBLIC, PHILIPPINES, DRIVER, DEPARTMENT (prevents header extraction)
- **Confidence scoring:** Return `high`/`medium`/`low` based on keyword matches
- **Test with diverse IDs:** Include clear photos, glare, partial visibility, OCR errors
- **Debug output:** Log extraction attempts, confidence reasoning, and parsed values

See [id-multi-parser.ts](services/id-multi-parser.ts) for parser patterns applied to all ID types.

## Environment Setup

### Required Environment Variables (`.env.local`)
```
EXPO_PUBLIC_OCR_API_KEY=<your-ocr-space-key>
EXPO_PUBLIC_SUPABASE_URL=<your-supabase-url>
EXPO_PUBLIC_SUPABASE_ANON_KEY=<your-supabase-anon-key>
```

**Note:** `EXPO_PUBLIC_*` prefix makes variables available to frontend bundles.

### Initial Setup Issues

- **Expo start fails:** Run `npm install` first; use `--tunnel` mode if local network unavailable
- **Supabase connection errors:** Verify environment variables and API keys
- **OCR API key missing:** Feature degrades to manual entry (not a blocker)
- **TypeScript errors:** Run `npx tsc --noEmit` to verify compilation

## Development Workflow

1. **Feature branch:** Create feature branch from `main`
2. **Local testing:** `npx expo start` on target platform (Android/iOS/web)
3. **Type checking:** `npx tsc --noEmit` before committing
4. **Linting:** `npm run lint` and fix violations
5. **Supabase schema:** Test with actual Supabase project; verify visitor/enrollee tables
6. **Commit message:** Include feature/fix scope (e.g., "feat: OCR timeout handling for slow networks")

## Testing Strategy

- **Manual testing:** Capture real IDs (photo + gallery + camera) to validate OCR extraction
- **Edge cases:** Blurry images, glare, partial visibility, rotated IDs
- **Parser validation:** Log output shows extraction confidence and reasoning
- **Cross-platform:** Test on Android, iOS, and web (layout/platform-specific behavior)

## Platform-Specific Notes

### iOS
- Requires camera + photo library permissions in Xcode
- Simulators may have camera limitations; test on real devices when possible

### Android
- Adaptive icons use `android-icon-*.png` assets
- Edge-to-edge layout enabled (`edgeToEdgeEnabled: true`)

### Web
- Static output (CSR); hosted file paths depend on deployment
- OCR works but camera access depends on browser permissions

## Links & Resources

- [Expo documentation](https://docs.expo.dev/)
- [Expo Router guide](https://docs.expo.dev/router/introduction/)
- [Supabase JS client](https://supabase.com/docs/reference/javascript/)
- [OCR.Space API](https://ocr.space/ocrapi)
- Project memory: `/memories/repo/ocr-integration.md` (OCR setup and data flow)
- Project memory: `/memories/repo/parser-fix-label-detection.md` (Multi-ID parser system)

## Common Tasks

**Add a new visitor field:**
1. Update Supabase schema (`visitor` table)
2. Update `types/enrollee.ts` interface
3. Update relevant parser in `services/id-multi-parser.ts` if field should be auto-extracted
4. Update UI form in `app/guard/register-visitor.tsx`

**Add support for a new ID type:**
1. Add ID type to `IDType` enum in `services/id-type-detector.ts`
2. Implement parser function in `services/id-multi-parser.ts` (use existing parsers as template)
3. Add keywords to detector in `id-type-detector.ts`
4. Test with sample IDs of that type

**Debug OCR extraction:**
1. Enable logging in `services/id-multi-parser.ts` and `utils/ocr-diagnostics.ts`
2. Check raw OCR text in browser console
3. Verify ID type detection in logs
4. Step through parser logic with console output
