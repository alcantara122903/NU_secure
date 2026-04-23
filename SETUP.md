# Nu_Secure Project Setup Guide

## Prerequisites

### **Node.js (v24.14.0)** - REQUIRED

Your team must use **Node.js v24.14.0** to avoid dependency conflicts.

#### **Windows Installation:**

1. Download from: https://nodejs.org/download/release/v24.14.0/
   - Choose: **node-v24.14.0-x64.msi** (64-bit)
2. Run the installer and follow the prompts
3. Restart your terminal
4. Verify installation:
   ```bash
   node --version  # Should show: v24.14.0
   npm --version
   ```

#### **macOS Installation:**

```bash
# Using Homebrew
brew install node@24

# Or download directly from:
# https://nodejs.org/download/release/v24.14.0/node-v24.14.0-darwin-x64.tar.gz
```

#### **Linux Installation:**

```bash
# Using NVM (Node Version Manager)
nvm install 24.14.0
nvm use 24.14.0
```

---

## Project Setup (After Node Installation)

### **1. Clone Repository**

```bash
git clone https://github.com/alcantara122903/NU_secure.git
cd NU_secure
```

### **2. Install Dependencies**

```bash
npm install
```

This will:
- Install all 45+ packages
- Use exact versions from `package-lock.json`
- Apply npm compatibility settings from `.npmrc`

### **3. Environment Variables**

Create `.env.local` in project root:

```bash
EXPO_PUBLIC_OCR_API_KEY=your-ocr-space-key
EXPO_PUBLIC_SUPABASE_URL=your-supabase-url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
```

**⚠️ Important:** Add `.env.local` to `.gitignore` - never commit environment variables!

### **4. Start Development**

```bash
# Start Expo development server
npm start

# Or run on specific platform:
npm run android   # Android emulator
npm run ios       # iOS simulator
npm run web       # Web browser
```

---

## Project Structure

```
Nu_secure/
├── app/                    # Expo Router (file-based routing)
├── services/              # Business logic
│   ├── visitor/          # Visitor management & deduplication
│   ├── address.ts        # Address deduplication
│   ├── auth.ts          # Authentication
│   ├── camera.ts        # Camera/gallery
│   └── ocr/             # OCR & ID parsing
├── components/           # Reusable UI components
├── constants/           # Colors, theme
├── hooks/              # Custom React hooks
├── types/              # TypeScript interfaces
├── utils/              # Utility functions
├── .nvmrc             # Node version lock (v24.14.0)
├── .npmrc             # npm configuration
└── package.json       # Dependencies
```

---

## Key Configuration Files

| File | Purpose | Do Not Modify |
|------|---------|---|
| `.nvmrc` | Locks Node version to v24.14.0 | ✓ Team must use this version |
| `.npmrc` | npm compatibility (`legacy-peer-deps=true`) | ✓ Required for dependency resolution |
| `package-lock.json` | Locks exact package versions | ✓ Ensures consistency across team |
| `.vscode/settings.json` | VS Code workspace settings | Optional - can customize |

---

## Troubleshooting

### "npm ERR! ERESOLVE unable to resolve dependency tree"

**Solution:** Don't modify `.npmrc`. It has `legacy-peer-deps=true` for a reason.

```bash
# Clean install
rm -rf node_modules package-lock.json
npm install
```

### "Module not found" errors after clone

```bash
npm install
```

### TypeScript compilation errors

```bash
# Check for errors
npx tsc --noEmit

# All should be fixed - if not, report to team lead
```

### Port already in use (8081)

```bash
# Windows - kill process on port 8081
netstat -ano | findstr :8081
taskkill /PID <PID> /F

# macOS/Linux
lsof -i :8081
kill -9 <PID>
```

---

## Development Workflow

### **Before Starting Work**

```bash
git pull origin main
npm install
```

### **Create Feature Branch**

```bash
git checkout -b feature/your-feature-name
```

### **Commit Changes**

```bash
git add .
git commit -m "feat: Your feature description"
```

### **Push and Create Pull Request**

```bash
git push origin feature/your-feature-name
```

---

## Team Standards

### **Code Quality**

```bash
# Check linting
npm run lint

# Fix linting issues
npx expo lint --fix
```

### **TypeScript**

- All code must be TypeScript
- Strict mode enabled
- Use explicit types

### **Commit Messages**

Format: `type: description`

Examples:
- `feat: Add visitor deduplication`
- `fix: Prevent duplicate enrollee records`
- `chore: Update dependencies`
- `docs: Add setup guide`

---

## Support

If you encounter issues:

1. Check this guide first
2. Verify Node version: `node --version`
3. Try clean install: `rm -rf node_modules && npm install`
4. Report issues to the team lead with:
   - Node version
   - npm version
   - Error message
   - Steps to reproduce

---

## Status

✅ TypeScript: Zero compilation errors  
✅ Dependencies: 45 packages, all locked  
✅ Node Version: v24.14.0  
✅ npm: Compatible with legacy peer dependencies  
✅ Ready for team collaboration  

Happy coding! 🚀
