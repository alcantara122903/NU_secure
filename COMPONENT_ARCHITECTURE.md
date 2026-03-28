# Login Page Component Architecture

## Component Structure

```
RootLayout (_layout.tsx)
│
├─ Stack Navigator
│  │
│  ├─ Login Screen (login.tsx)
│  │  └─ Entry Point
│  │
│  ├─ Forgot Password Screen (forgot-password.tsx)
│  │  └─ Password Recovery
│  │
│  └─ Tabs Layout ((tabs)/_layout.tsx)
│     └─ Protected Routes
│
└─ StatusBar
```

## Screen Hierarchy

### Login Screen Flow

```
SafeAreaView
├─ KeyboardAvoidingView                    # Keyboard handling
│  └─ ScrollView                           # Scrollable content
│     ├─ Logo Section                      # NU-SECURE branding
│     │  ├─ Badge (80x80)                 # Logo with blue background
│     │  ├─ Title ("NU-SECURE")           # Main heading
│     │  └─ Subtitle                      # Tagline
│     │
│     ├─ Form Card                         # White/surface container
│     │  ├─ Email Form Group               # Email input section
│     │  │  ├─ Label
│     │  │  ├─ TextInput Wrapper
│     │  │  │  └─ TextInput
│     │  │  └─ Error Text
│     │  │
│     │  ├─ Password Form Group            # Password input section
│     │  │  ├─ Label
│     │  │  ├─ TextInput Wrapper
│     │  │  │  ├─ TextInput
│     │  │  │  └─ Show/Hide Toggle
│     │  │  └─ Error Text
│     │  │
│     │  ├─ Sign In Button                 # Main action button
│     │  │  └─ Loading Indicator (conditional)
│     │  │
│     │  └─ Forgot Password Link           # Secondary action
│     │
│     └─ Footer Section                    # Info text
│        └─ Tagline

```

## Data Flow Diagram

```
┌─────────────────────────────────────┐
│     User Input (Email/Password)     │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│   Form Validation (validateLoginForm) │
│   - Email format check              │
│   - Password length check           │
└──────────────┬──────────────────────┘
               │
        ┌──────┴──────┐
        │             │
  Invalid          Valid
        │             │
        ▼             ▼
┌──────────┐  ┌──────────────────┐
│Set Errors│  │Call authService  │
│Display   │  │.login()          │
│Error Msgs│  └────────┬─────────┘
└──────────┘           │
              ┌────────┴────────┐
              │                 │
           Success           Error
              │                 │
              ▼                 ▼
         ┌─────────────┐  ┌────────────┐
         │Store Token  │  │Show Error  │
         │Navigate to  │  │Alert       │
         │Home (tabs)  │  │Reset Status│
         └─────────────┘  └────────────┘
```

## State Management

### Login Screen State

```
Component State:
├─ email: string              # "" → user input
├─ password: string           # "" → user input  
├─ status: AuthStatus         # 'idle' | 'loading' | 'success' | 'error'
├─ errors: {                  # Form validation errors
│  ├─ email?: string
│  └─ password?: string
└─ showPassword: boolean      # false → toggle visibility

Derived State:
├─ isLoading: boolean         # status === 'loading'
└─ isSuccess: boolean         # status === 'success'
```

## UI Components Hierarchy

```
Visual Hierarchy (top to bottom):

Level 1: Logo & Branding
├─ Badge: 80x80px
├─ Font: 28px bold
└─ Subtitle: 14px regular

Level 2: Form Container
├─ Padding: 24px
├─ Border Radius: 16px
├─ Shadow: 2-4px elevation
└─ Background: Surface color

Level 3: Form Fields
├─ Height: 48px
├─ Border Radius: 8px
├─ Border Width: 1px
└─ Padding Horizontal: 12px

Level 4: Buttons
├─ Height: 48px
├─ Border Radius: 8px
├─ Font Weight: 700
└─ Font Size: 16px

Level 5: Helper Text
├─ Email: 12px
├─ Forgot Password: 14px
└─ Footer: 12px
```

## Color Application

```
Component              Light              Dark
──────────────────────────────────────────────
Background            #F8FAFB            #0A0E27
Surface (Card)        #FFFFFF            #1A1F3A
Primary (Logo/BTN)    #003D99            #4D94FF
Text                  #1A1A1A            #FFFFFF
Text Secondary        #666666            #B0B0B0
Border                #E0E0E0            #2A3F5F
Error                 #FF6B6B            #FF6B6B (fixed)
```

## Responsive Behavior

```
Screen Size         Padding    Column Width   Notes
────────────────────────────────────────────────
Small (320px)       16px       288px         Mobile phones
Medium (375px)      20px       335px         iPhones SE-XS
Large (414px)       20px       374px         iPhone X+
XL (768px)          20px       728px         Tablets
XXL (1024px)        40px       944px         Web

Form Elements:
- Min height: 48px (touch target)
- Min width: 100% of container
- Max width: 500px (tablets+)
```

## State Transitions

```
                    ┌────────────────────┐
                    │  Initial State     │
                    │  status: 'idle'    │
                    │  errors: {}        │
                    └──────────┬─────────┘
                               │
                    ┌──────────▼──────────┐
                    │ User clicks Submit  │
                    └──────────┬──────────┘
                              │
                    ┌─────────▼──────────┐
                    │ Validate Form      │
                    └──────────┬─────────┘
                         │     │
                   Invalid │    Valid
                         │    │
                    ┌────▼──┐─┐───────────┐
                    │       │           │
              Set Errors   Set Loading  │
              Display      status:     │
              Msgs         'loading'   │
                           │          │
                    ┌──────▼──────────┘
                    │
            ┌───────▼────────┐
            │ API Request    │
            └───────┬────────┘
                    │
            ┌───────┴────────┐
            │                │
        Success           Failure
            │                │
      ┌─────▼───────┐    ┌──▼─────────┐
      │status:      │    │status:      │
      │'success'    │    │'error'      │
      │Navigate     │    │Show Alert   │
      │(tabs)       │    │Log Error    │
      └─────────────┘    └─────────────┘
```

## Form Validation Rules

```
Email Field:
├─ Empty Check
│  ├─ Condition: email.trim() === ''
│  └─ Error: "Email is required"
│
└─ Format Check
   ├─ Regex: /^[^\s@]+@[^\s@]+\.[^\s@]+$/
   └─ Error: "Please enter a valid email"

Password Field:
├─ Empty Check
│  ├─ Condition: password === ''
│  └─ Error: "Password is required"
│
└─ Length Check
   ├─ Condition: password.length < 6
   └─ Error: "Password must be at least 6 characters"
```

## API Integration Points

```
authService.login(credentials)
│
├─ Input: { email: string, password: string }
├─ Method: POST
├─ URL: ${API_BASE_URL}/auth/login
├─ Headers: Content-Type: application/json
│
└─ Output: Promise<AuthResponse>
   ├─ success: boolean
   ├─ message?: string
   ├─ token?: string
   └─ user?: User
```

## Performance Considerations

```
Optimization Strategies:

1. Memoization
   └─ useCallback for handleLogin (dependencies: [email, password, router])

2. Conditional Rendering
   ├─ ActivityIndicator (when isLoading)
   ├─ Error text (when error exists)
   └─ Logo animation (could be added)

3. Input Optimization
   ├─ keyboardType for email field
   ├─ secureTextEntry for password
   ├─ autoCapitalize: 'none'
   └─ autoComplete hints

4. ScrollView Performance
   ├─ scrollEnabled={Platform.OS !== 'web'}
   ├─ showsVerticalScrollIndicator={false}
   └─ contentContainerStyle for flex: 1

5. Platform-Specific Rendering
   └─ Optimized shadows per platform (iOS/Android/Web)
```

## Accessibility Features

```
Screen Reader Support:
├─ Proper accessibility labels
├─ Logical tab order
├─ Form structure
│  ├─ Label → Input → Error pairing
│  └─ ARIA roles for buttons
└─ Self-describing buttons

Touch Targets:
├─ Minimum height: 48px
├─ Proper padding for tapping
└─ Clear visual feedback

Visual Design:
├─ Color contrast > 4.5:1
├─ Clear error indication
├─ Readable font sizes (14-16px)
└─ Proper spacing

Keyboard Support:
├─ Proper keyboard type per field
├─ Return key behavior
├─ Keyboard avoidance
└─ Dismissal on submit
```

## Error Handling Flow

```
Try to Login
│
└─▶ Try-Catch Block
   │
   ├─ Try:
   │  ├─ Fetch from API
   │  ├─ Parse response
   │  └─ Handle success
   │
   └─ Catch:
      ├─ Log error
      ├─ Set status: 'error'
      ├─ Show Alert
      └─ Allow user to retry
```

---

**Created**: 2024
**Component Count**: 2 main screens
**Files**: 3 (login.tsx, forgot-password.tsx, _layout.tsx modified)
