import { Colors } from '@/constants/colors';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { authService } from '@/services/auth';
import { authSessionService } from '@/services/auth-session';
import type { AuthStatus } from '@/types/auth';
import { validateLoginForm } from '@/utils/validation';
import { useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function LoginScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme || 'light'];
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState<AuthStatus>('idle');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = useCallback(async () => {
    // Validate form
    const validation = validateLoginForm(email, password);
    
    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }

    setStatus('loading');
    setErrors({});

    try {
      const response = await authService.login({
        email: email.toLowerCase().trim(),
        password,
      });

      if (response.success) {
        if (response.user) {
          authSessionService.setSession({
            token: response.token,
            user: response.user,
            userProfile: response.userProfile,
          });
        }

        setStatus('success');
        // Navigate to dashboard based on role from database
        setTimeout(() => {
          router.push(response.dashboard);
        }, 200);
      } else {
        setStatus('error');
        Alert.alert('Login Failed', response.message || 'Please try again');
      }
    } catch (error) {
      setStatus('error');
      const errorMessage = error instanceof Error ? error.message : 'An error occurred';
      console.error('Login error details:', errorMessage);
      Alert.alert('Login Error', errorMessage);
    }
  }, [email, password, router]);

  const isLoading = status === 'loading';

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.primary }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          scrollEnabled={Platform.OS !== 'web'}
        >
          {/* Header Section */}
          <View style={styles.headerSection}>
            <Text style={styles.appTitle}>NU-SECURE</Text>
            <Text style={styles.appSubtitle}>
              Smart Visitor Monitoring System
            </Text>
          </View>

          {/* Form Card */}
          <View style={[styles.formCard, { backgroundColor: colors.surface }]}>
            {/* Logo Section - Inside Card */}
            <View style={styles.logoSectionInCard}>
              <Image 
                source={require('@/assets/images/icon.png')}
                style={styles.logoBadge}
                resizeMode="contain"
              />
            </View>

            {/* Email Field */}
            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: colors.text }]}>Email</Text>
              <View
                style={[
                  styles.inputWrapper,
                  {
                    borderColor: errors.email ? '#FF6B6B' : colors.border,
                    backgroundColor: colors.background,
                  },
                ]}
              >
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  placeholder="Enter your email"
                  placeholderTextColor={colors.textSecondary}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  editable={!isLoading}
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    if (errors.email) {
                      setErrors({ ...errors, email: undefined });
                    }
                  }}
                  accessibilityLabel="Email input"
                />
              </View>
              {errors.email && (
                <Text style={styles.errorText}>{errors.email}</Text>
              )}
            </View>

            {/* Password Field */}
            <View style={styles.formGroup}>
              <Text style={[styles.label, { color: colors.text }]}>Password</Text>
              <View
                style={[
                  styles.inputWrapper,
                  {
                    borderColor: errors.password ? '#FF6B6B' : colors.border,
                    backgroundColor: colors.background,
                  },
                ]}
              >
                <TextInput
                  style={[styles.input, { color: colors.text }]}
                  placeholder="Enter your password"
                  placeholderTextColor={colors.textSecondary}
                  secureTextEntry={!showPassword}
                  editable={!isLoading}
                  value={password}
                  onChangeText={(text) => {
                    setPassword(text);
                    if (errors.password) {
                      setErrors({ ...errors, password: undefined });
                    }
                  }}
                  accessibilityLabel="Password input"
                />
                <TouchableOpacity
                  onPress={() => setShowPassword(!showPassword)}
                  accessible={true}
                  accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
                  disabled={isLoading}
                >
                  <Text style={[styles.togglePasswordText, { color: colors.primary }]}>
                    {showPassword ? '👁️' : '👁️‍🗨️'}
                  </Text>
                </TouchableOpacity>
              </View>
              {errors.password && (
                <Text style={styles.errorText}>{errors.password}</Text>
              )}
            </View>

            {/* Sign In Button */}
            <TouchableOpacity
              style={[
                styles.signInButton,
                {
                  backgroundColor: '#5A5A5A',
                  opacity: isLoading ? 0.7 : 1,
                },
              ]}
              onPress={handleLogin}
              disabled={isLoading}
              activeOpacity={0.8}
              accessibilityLabel="Sign in button"
              accessibilityRole="button"
            >
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={styles.signInButtonText}>Sign In</Text>
              )}
            </TouchableOpacity>

            {/* Forgot Password Link */}
            <TouchableOpacity
              onPress={() => Alert.alert('Forgot Password', 'Feature coming soon')}
              disabled={isLoading}
              accessible={true}
              accessibilityLabel="Forgot password link"
              accessibilityRole="button"
            >
              <Text style={[styles.forgotPasswordLink, { color: colors.primary }]}>
                Forgot password?
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: 32,
  },
  appTitle: {
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 8,
    color: '#FFD700',
  },
  appSubtitle: {
    fontSize: 14,
    fontWeight: '400',
    letterSpacing: 0.5,
    color: '#E0E0E0',
  },
  logoSectionInCard: {
    alignItems: 'center',
    marginBottom: 24,
    paddingTop: 8,
  },
  logoBadge: {
    width: 90,
    height: 90,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
      },
      android: {
        elevation: 5,
      },
      web: {
        boxShadow: '0px 4px 8px rgba(0, 0, 0, 0.15)',
      },
    }),
  },
  formCard: {
    borderRadius: 16,
    padding: 24,
    marginBottom: 32,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
      },
      android: {
        elevation: 3,
      },
      web: {
        boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.1)',
      },
    }),
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
    letterSpacing: 0.5,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    height: 48,
  },
  input: {
    flex: 1,
    fontSize: 14,
    fontWeight: '500',
  },
  togglePasswordText: {
    fontSize: 18,
    marginLeft: 8,
  },
  errorText: {
    color: '#FF6B6B',
    fontSize: 12,
    marginTop: 6,
    fontWeight: '500',
  },
  signInButton: {
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 16,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
      },
      android: {
        elevation: 4,
      },
      web: {
        boxShadow: '0px 4px 12px rgba(0, 0, 0, 0.2)',
      },
    }),
  },
  signInButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  forgotPasswordLink: {
    fontSize: 14,
    fontWeight: '500',
    textAlignVertical: 'center',
    textAlign: 'center',
    paddingVertical: 8,
  },
});