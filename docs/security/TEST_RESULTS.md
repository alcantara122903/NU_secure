# Security Test Checklist (Capstone Defense)

Use this checklist before your defense demo. Record pass/fail and keep screenshots where noted.

## Automated / manual checks

| # | Test | How to verify | Expected | Pass |
|---|------|---------------|----------|------|
| 1 | QR token generation | Register any visitor type | New token format `QR-{timestamp}-{random}`; random part not predictable | ☐ |
| 2 | No QR token in logs | Register enrollee; check Metro/console | QR token string NOT printed in production log path | ☐ |
| 3 | QR payload has no PII | Inspect QR JSON on normal visitor ticket | Only `control_number` + `qr_token` | ☐ |
| 4 | Enrollee progress read-only | Open progress URL without login | Page loads; no expectation sync errors; visit data unchanged in DB | ☐ |
| 5 | Guard login | Login as guard | Redirect to guard dashboard | ☐ |
| 6 | Office login | Login as office staff | Redirect to office portal | ☐ |
| 7 | Admin blocked on mobile | Login as admin | Error: web portal only | ☐ |
| 8 | Exit scan still works | Scan valid QR at guard exit | Visit closes successfully | ☐ |
| 9 | Secure storage | Login; restart app | Session restored (native device) | ☐ |

## Optional (document in slides if done)

| # | Test | How | Expected | Pass |
|---|------|-----|----------|------|
| 10 | Anon key write test | curl/Postman INSERT to `visit` with anon key | Document actual RLS behavior (allow/deny) | ☐ |
| 11 | OCR key in bundle | Search built JS / `strings` on APK | Key present today — note as limitation | ☐ |

### Example: anon key write test (optional)

Replace placeholders with your project values. **Do not commit real keys.**

```bash
curl -X POST "https://YOUR_PROJECT.supabase.co/rest/v1/visit" \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=minimal" \
  -d '{"qr_token":"TEST-SECURITY-AUDIT"}'
```

- **403 / RLS error** → policies blocking anonymous insert (good)
- **201 Created** → document as open risk in defense (see LIMITATIONS.md)

## Edge function redeploy

If you use hosted `office-exit-scan`, redeploy after the `ilike` fix:

```bash
supabase functions deploy office-exit-scan
```

Verify exit scan from office portal after deploy.

## Demo script (3–5 minutes)

1. **Architecture** — show trust boundary diagram from `SECURITY_OVERVIEW.md`
2. **Login** — guard account → secure session
3. **Register visitor** — show QR ticket; explain no PII in QR
4. **Progress URL** — enrollee tracker loads without login; mention read-only fix
5. **Limitations** — one slide from `LIMITATIONS.md` (OCR key, future JWT bridge)

## Screenshot suggestions for appendix

- [ ] QR ticket screen (blur face if needed)
- [ ] Decoded QR JSON (token + control number only)
- [ ] Enrollee progress page
- [ ] Login screen / role-based redirect
- [ ] File tree showing `docs/security/` folder
