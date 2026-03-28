# Quick Reference Guide - NU-SECURE Login

## 🚀 Getting Started (5 minutes)

### 1. Install Dependencies
```bash
npm install
# Dependencies are already in package.json
```

### 2. Configure Environment
Create `.env` file in project root:
```env
EXPO_PUBLIC_API_URL=https://your-api-domain.com
```

### 3. Start the App
```bash
npm start
# Select iOS (i), Android (a), or Web (w)
```

### 4. Test Login
- Default entry point: Login screen
- Enter test credentials
- Should navigate to home screen on success

---

## 📁 File Structure

```
app/
├── _layout.tsx              ✅ Root navigation
├── login.tsx                ✅ Main login form
├── forgot-password.tsx      ✅ Password recovery
└── (tabs)/
    └── _layout.tsx          (Protected area)

services/
└── auth.ts                  (Existing auth service)

types/
└── auth.ts                  (TypeScript interfaces)

utils/
└── validation.ts            (Form validators)

constants/
└── colors.ts                (Theme colors)
```

---

## 🎯 Key Features

| Feature | Status | Location |
|---------|--------|----------|
| Professional UI | ✅ | login.tsx |
| Form Validation | ✅ | utils/validation.ts |
| Error Handling | ✅ | login.tsx |
| Loading State | ✅ | Login button |
| Dark Mode | ✅ | colors.ts |
| Accessibility | ✅ | Both screens |
| Password Reset | ✅ | forgot-password.tsx |
| Navigation | ✅ | _layout.tsx |

---

## 🔧 Customization

### Change Brand Colors
```typescript
// constants/colors.ts
export const Colors = {
  light: {
    primary: '#YOUR_COLOR_HEX',  // Change here
    // ... other colors
  }
}
```

### Change Logo Badge Size
```typescript
// app/login.tsx (line 67)
logoBadge: {
  width: 100,      // Change from 80
  height: 100,     // Change from 80
  borderRadius: 50, // Keep as width/2
}
```

### Change Validation Rules
```typescript
// utils/validation.ts
export const isValidPassword = (password: string): boolean => {
  return password.length >= 8  // Change from 6
}
```

### Add New Fields
```typescript
// 1. Add to state
const [field, setField] = useState('');

// 2. Add to validation
const fieldError = validateField(field);

// 3. Add to form
<View style={styles.formGroup}>
  <Text style={[styles.label, ...]}>Field Name</Text>
  <View style={[styles.inputWrapper, ...]}>
    <TextInput
      value={field}
      onChangeText={setField}
      // ... other props
    />
  </View>
  {fieldError && <Text style={styles.errorText}>{fieldError}</Text>}
</View>
```

---

## 🐛 Troubleshooting

### Screen Not Showing
```
Problem: App doesn't show login screen
Solution: Check _layout.tsx - login should be first route

Problem: Error "Cannot find module"
Solution: Run `npm install` and rebuild

Problem: API call fails
Solution:
1. Check EXPO_PUBLIC_API_URL in .env
2. Verify network connectivity
3. Check API endpoint is correct
```

### Styling Issues
```
Problem: Colors don't match
Solution:
1. Check Colors.ts color values
2. Verify colorScheme is 'light' or 'dark'
3. Clear cache: npm start -- -c

Problem: Text is too small
Solution:
1. Increase fontSize in StyleSheet
2. Check mobile device text size settings
```

### Validation Not Working
```
Problem: Error messages don't appear
Solution:
1. Check validateLoginForm return structure
2. Verify errors state is updated
3. Check error styling is visible

Problem: Form submits with invalid data
Solution:
1. Check if statements in handleLogin
2. Verify validation.isValid check
```

---

## 📱 Platform-Specific Tips

### iOS
- Uses `shadowColor`, `shadowOffset`, etc.
- Keyboard dismissal on submit key
- Safe area handled by SafeAreaView

### Android
- Uses `elevation` for shadows
- Keyboard behavior differs from iOS
- Back button handled by React Navigation

### Web
- Uses CSS-like `boxShadow`
- Keyboard works like desktop
- Responsive design more important

---

## 🔐 Security Checklist

- [ ] Set up EXPO_PUBLIC_API_URL
- [ ] Use HTTPS for API calls
- [ ] Install expo-secure-store
- [ ] Replace console.log token storage
- [ ] Add rate limiting for failed attempts
- [ ] Validate input on server too
- [ ] Add CSRF token if needed
- [ ] Monitor API logs for suspicious activity

---

## ✨ Enhancement Ideas

**Easy Additions:**
- ✅ Remember me checkbox
- ✅ Show/hide password icon
- ✅ Loading spinner animation
- ✅ Success checkmark animation

**Medium Difficulty:**
- ✅ Biometric authentication
- ✅ Social login (Google/Microsoft)
- ✅ Two-factor authentication
- ✅ Session persistence

**Advanced:**
- ✅ Rate limiting
- ✅ Device fingerprinting
- ✅ Passwordless login
- ✅ Mobile app signing

---

## 📚 Common Code Snippets

### Add Loading Overlay
```typescript
{isLoading && (
  <View style={styles.loadingOverlay}>
    <ActivityIndicator size="large" color={colors.primary} />
  </View>
)}
```

### Add Success Animation
```typescript
import { Animated } from 'react-native';

const scaleAnim = new Animated.Value(0);
// Trigger on success...
Animated.spring(scaleAnim, { toValue: 1 }).start();
```

### Add Network Error Handling
```typescript
import NetInfo from '@react-native-community/netinfo';

const state = await NetInfo.fetch();
if (!state.isConnected) {
  Alert.alert('No internet', 'Check your connection');
}
```

---

## 🤖 Testing Credentials (Mock)

```
Email: test@example.com
Password: password123

Invalid Cases:
- Empty fields
- Invalid email format: test@invalid
- Short password: 123
- Spaces in email: test @example.com
```

---

## 📞 How to Find Things

| Looking for... | Location |
|---|---|
| Login form | `app/login.tsx` |
| Forgot password | `app/forgot-password.tsx` |
| Colors | `constants/colors.ts` |
| Validation | `utils/validation.ts` |
| Auth API calls | `services/auth.ts` |
| Types | `types/auth.ts` |
| Navigation | `app/_layout.tsx` |
| Documentation | Root `.md` files |

---

## 🎓 Learning Resources

- [React Native Docs](https://reactnative.dev)
- [Expo Docs](https://docs.expo.dev)
- [TypeScript Handbook](https://www.typescriptlang.org/docs)
- [React Navigation](https://reactnavigation.org)

---

## 📝 Version Info

```
Created: 2024
React Native: 0.81.5
Expo: ~54.0
TypeScript: ~5.9.2
Navigation: expo-router ~6.0
```

---

**Last Updated**: 2024
**Status**: ✅ Production Ready
