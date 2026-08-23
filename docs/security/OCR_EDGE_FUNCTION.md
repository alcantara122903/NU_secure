# OCR Edge Function — Setup & Testing

The mobile app calls **`ocr-parse`** on Supabase instead of OCR.Space directly.  
The OCR API key lives in **Supabase secrets**, not in `EXPO_PUBLIC_OCR_API_KEY`.

---

## 1. One-time setup (Supabase Dashboard + CLI)

### A. Set secret on Supabase

1. Open [Supabase Dashboard](https://supabase.com/dashboard) → your project  
2. **Project Settings** → **Edge Functions** → **Secrets**  
3. Add:

| Name | Value |
|------|--------|
| `OCR_SPACE_API_KEY` | Your OCR.Space API key (same as old mobile key) |

Or via CLI (after `supabase login`):

```bash
supabase secrets set OCR_SPACE_API_KEY=YOUR_OCR_KEY_HERE --project-ref aykaivlsluzllarfyyaq
```

### B. Deploy function

From project root:

```bash
cd c:\Nu_Secure\Nu_secure
supabase functions deploy ocr-parse --project-ref aykaivlsluzllarfyyaq
```

---

## 2. Mobile app (.env.local)

**Production (recommended after deploy):**

Remove or comment out the mobile OCR key:

```env
# EXPO_PUBLIC_OCR_API_KEY=   ← remove for production builds
EXPO_PUBLIC_SUPABASE_URL=...
EXPO_PUBLIC_SUPABASE_ANON_KEY=...
EXPO_PUBLIC_API_URL=...
```

**Local dev (optional fallback):**  
Keep `EXPO_PUBLIC_OCR_API_KEY` only if you have **not** deployed `ocr-parse` yet. The app will warn and use direct OCR as fallback.

Restart Expo after changing env:

```bash
npx expo start -c
```

---

## 3. How to test

### Test A — Connection (quick)

1. Run app: `npx expo start`
2. Go to visitor registration → ID scan flow (or wherever diagnostics run)
3. **Expected:** OCR works; Metro log shows no direct OCR key error

Or invoke from terminal (replace URL and anon key from `.env.local`):

```bash
curl -X POST "https://aykaivlsluzllarfyyaq.supabase.co/functions/v1/ocr-parse" ^
  -H "Authorization: Bearer YOUR_ANON_KEY" ^
  -H "apikey: YOUR_ANON_KEY" ^
  -H "Content-Type: application/json" ^
  -d "{\"test\":true}"
```

**Expected JSON:**

```json
{"success":true,"message":"OCR proxy reachable (OCR.Space OK)"}
```

### Test B — Real ID scan (main test)

1. Login as **guard**
2. **Register visitor** → capture **ID photo**
3. **Expected:** Name/address fields auto-fill (same as before)
4. **Fail signs:**
   - Empty fields + error in console
   - Message about `OCR_SPACE_API_KEY not configured` → set Supabase secret
   - `404` on function → run deploy command

### Test C — Key not in app (security check)

After removing `EXPO_PUBLIC_OCR_API_KEY` from `.env.local`:

1. Rebuild/restart: `npx expo start -c`
2. Scan ID again → should still work **if** function is deployed
3. For capstone: note that OCR key is no longer required in mobile env

---

## 4. Troubleshooting

| Problem | Fix |
|---------|-----|
| `OCR_SPACE_API_KEY is not configured` | Add secret in Supabase + redeploy |
| `404` / function not found | `supabase functions deploy ocr-parse` |
| Still uses direct OCR warning | Function not deployed; deploy or keep dev key temporarily |
| Timeout | Retry; check image size / internet |
| Works on WiFi, not mobile data | Check Supabase URL reachable |

---

## 5. Capstone defense line

> “OCR API keys were removed from the mobile bundle. ID images are sent to a Supabase Edge Function that calls OCR.Space server-side, so third-party credentials are not embedded in the React Native app.”
