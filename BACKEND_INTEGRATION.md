# Expo App Backend Integration

## Setup

**1. Find your Computer's IP:**
- Windows: Open Command Prompt → type `ipconfig` → find "IPv4 Address" (e.g., `192.168.1.100`)

**2. Update API Config:**
- Edit `config/api.ts`
- Replace `192.168.1.100` with your actual IP

```typescript
const API_BASE_URL = 'http://YOUR_IP:3000';
```

**3. Ensure Backend is Running:**
```bash
cd backend
npm run dev
```
Should show: `🚀 Backend running on http://0.0.0.0:3000`

**4. Run Expo on Phone:**
```bash
cd Nu_secure
npx expo start
```
Scan QR code on your phone

**5. Phone Must Be on Same WiFi Network**

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
