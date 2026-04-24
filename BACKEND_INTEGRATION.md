# Expo App Backend Integration

## Setup

**1. Find your Computer's IP:**
- Windows: Open Command Prompt → type `ipconfig` → find "IPv4 Address" (e.g., `192.168.1.100`)

**2. Update API Config:**
- Edit `config/api.ts`
- Set `EXPO_PUBLIC_API_URL` in `.env.local` to your PC's LAN IPv4 address
- Use the same port Laravel is actually listening on

```typescript
const API_BASE_URL = 'http://YOUR_IP:3000';
```

**3. Ensure Backend is Running:**
```bash
php artisan serve --host=0.0.0.0 --port=3000
```
If you keep Laravel on the default port instead, use `--port=8000` and update `EXPO_PUBLIC_API_URL` to match.

**4. Test Connectivity First:**
Add a temporary route that returns JSON:

```php
Route::get('/test', function () {
  return response()->json([
    'success' => true,
    'message' => 'Laravel API reachable',
    'timestamp' => now()->toDateTimeString(),
  ]);
});
```

From the phone, open `http://YOUR_PC_IP:3000/api/test` in the browser or call it from the app.

**5. Run Expo on Phone:**
```bash
cd Nu_secure
npx expo start
```
Scan QR code on your phone

**6. Phone Must Be on Same WiFi Network**

**7. Android HTTP Note:**
- If your API is plain `http://`, make sure the Android app allows cleartext traffic.
- This repo now sets `android.usesCleartextTraffic = true` in `app.json`.

---

## Integration

The Expo app now has:
- `config/api.ts` - Backend URL configuration
- `services/visitor/visitor-api.ts` - API client that calls backend

When registering a visitor, the app will:
1. Extract data from ID via OCR
2. Call `POST /api/visitors/register` on backend
3. Backend handles database transaction
4. Returns visitor, visit, and optional enrollee/contractor IDs

---

## API Payload Example

```json
{
  "type": "enrollee",
  "firstName": "Juan",
  "lastName": "Dela Cruz",
  "contactNo": "09123456789",
  "addressId": 1,
  "guardUserId": 5,
  "visitTypeId": 1,
  "purposeReason": "Enrollment",
  "primaryOfficeId": 2,
  "qrToken": "QR-abc123",
  "enrolleeStatusId": 1
}
```
