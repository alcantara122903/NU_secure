/**
 * Deep-link / email-link fallback for password reset.
 * Primary in-app flow is the OTP wizard in `forgot-password.tsx`.
 * Supports: nusecure://reset-password?email=...&token=...
 */
import { AUTH_ERROR_MESSAGES, ApiClientError } from '@/services/api';
import { AuthError, authService } from '@/services/authentication';
import { validateResetPasswordForm } from '@/utils/validation';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ImageBackground,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

function firstParam(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? '';
  }
  return value ?? '';
}

function getResetErrorMessage(error: unknown): string {
  if (error instanceof AuthError || error instanceof ApiClientError) {
    return error.message.trim() || AUTH_ERROR_MESSAGES.SERVER;
  }
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }
  return AUTH_ERROR_MESSAGES.SERVER;
}

export default function ResetPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    email?: string | string[];
    token?: string | string[];
  }>();
  const mountedRef = useRef(true);

  const email = useMemo(
    () => firstParam(params.email).trim().toLowerCase(),
    [params.email],
  );
  const token = useMemo(() => firstParam(params.token).trim(), [params.token]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errors, setErrors] = useState<{
    password?: string;
    passwordConfirmation?: string;
  }>({});

  const linkMissing = !email || !token;

  const goBackToLogin = useCallback(() => {
    router.replace('/(tabs)');
  }, [router]);

  const handleSubmit = useCallback(async () => {
    if (isLoading || isSuccess || linkMissing) {
      return;
    }

    const validation = validateResetPasswordForm(password, passwordConfirmation);
    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }

    setIsLoading(true);
    setErrors({});

    try {
      await authService.resetPassword({
        email,
        token,
        password,
        passwordConfirmation,
      });

      if (!mountedRef.current) {
        return;
      }

      setIsSuccess(true);
    } catch (error) {
      if (!mountedRef.current) {
        return;
      }
      Alert.alert('Reset Failed', getResetErrorMessage(error));
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [
    email,
    isLoading,
    isSuccess,
    linkMissing,
    password,
    passwordConfirmation,
    token,
  ]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#0A4DB3" />
      <ImageBackground
        source={require('@/assets/nu-building.png')}
        style={styles.background}
        resizeMode="cover"
      >
        <View style={styles.overlay} />
        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.headerSection}>
              <Text style={styles.appTitle}>NU-SECURE</Text>
              <Text style={styles.headerSubtitle}>
                Smart Visitor Monitoring System
              </Text>
            </View>

            <View style={styles.card}>
              <Image
                source={require('@/assets/nu-logo.png')}
                style={styles.logo}
                resizeMode="contain"
              />

              {linkMissing ? (
                <>
                  <Text style={styles.title}>Invalid Reset Link</Text>
                  <Text style={styles.subtitle}>
                    This password reset link is invalid or has already been used.
                    You can request a new verification code from Forgot Password.
                  </Text>
                  <TouchableOpacity
                    style={styles.primaryButton}
                    onPress={() => router.replace('/forgot-password')}
                    activeOpacity={0.9}
                  >
                    <Text style={styles.primaryButtonText}>Forgot Password</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={goBackToLogin}
                    style={styles.linkButton}
                  >
                    <Text style={styles.linkText}>Back to Sign In</Text>
                  </TouchableOpacity>
                </>
              ) : isSuccess ? (
                <>
                  <Text style={styles.title}>Password Reset Successful</Text>
                  <Text style={styles.subtitle}>
                    Your password has been changed successfully. For your
                    security, existing login sessions may have been signed out.
                    You can now sign in using your new password.
                  </Text>
                  <TouchableOpacity
                    style={styles.primaryButton}
                    onPress={goBackToLogin}
                    activeOpacity={0.9}
                  >
                    <Text style={styles.primaryButtonText}>Back to Sign In</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text style={styles.title}>Create New Password</Text>
                  <Text style={styles.subtitle}>
                    Your identity has been verified. Create a new password for
                    your account.
                  </Text>

                  <Text style={styles.label}>New Password</Text>
                  <View
                    style={[
                      styles.passwordRow,
                      errors.password ? styles.inputError : null,
                    ]}
                  >
                    <TextInput
                      style={styles.passwordInput}
                      placeholder="Enter new password"
                      placeholderTextColor="#94A3B8"
                      secureTextEntry={!showPassword}
                      editable={!isLoading}
                      value={password}
                      onChangeText={(text) => {
                        setPassword(text);
                        if (errors.password) {
                          setErrors((prev) => ({ ...prev, password: undefined }));
                        }
                      }}
                    />
                    <TouchableOpacity
                      onPress={() => setShowPassword((v) => !v)}
                      disabled={isLoading}
                    >
                      <Text style={styles.showText}>
                        {showPassword ? 'Hide' : 'Show'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  {errors.password ? (
                    <Text style={styles.errorText}>{errors.password}</Text>
                  ) : null}

                  <Text style={[styles.label, { marginTop: 14 }]}>
                    Confirm New Password
                  </Text>
                  <View
                    style={[
                      styles.passwordRow,
                      errors.passwordConfirmation ? styles.inputError : null,
                    ]}
                  >
                    <TextInput
                      style={styles.passwordInput}
                      placeholder="Confirm new password"
                      placeholderTextColor="#94A3B8"
                      secureTextEntry={!showConfirmPassword}
                      editable={!isLoading}
                      value={passwordConfirmation}
                      onChangeText={(text) => {
                        setPasswordConfirmation(text);
                        if (errors.passwordConfirmation) {
                          setErrors((prev) => ({
                            ...prev,
                            passwordConfirmation: undefined,
                          }));
                        }
                      }}
                    />
                    <TouchableOpacity
                      onPress={() => setShowConfirmPassword((v) => !v)}
                      disabled={isLoading}
                    >
                      <Text style={styles.showText}>
                        {showConfirmPassword ? 'Hide' : 'Show'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                  {errors.passwordConfirmation ? (
                    <Text style={styles.errorText}>
                      {errors.passwordConfirmation}
                    </Text>
                  ) : null}

                  <TouchableOpacity
                    style={[
                      styles.primaryButton,
                      isLoading ? styles.primaryButtonDisabled : null,
                      { marginTop: 20 },
                    ]}
                    onPress={() => void handleSubmit()}
                    activeOpacity={0.9}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.primaryButtonText}>Reset Password</Text>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={goBackToLogin}
                    style={styles.linkButton}
                    disabled={isLoading}
                  >
                    <Text style={styles.linkText}>Back to Sign In</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>

            <Text style={styles.footer}>
              National University - Secure Visitor Access
            </Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </ImageBackground>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#0A4DB3',
  },
  flex: {
    flex: 1,
  },
  background: {
    flex: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(6, 72, 168, 0.72)',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: 20,
  },
  appTitle: {
    fontSize: 26,
    fontWeight: '900',
    color: '#FFD914',
    letterSpacing: 1,
    textAlign: 'center',
  },
  headerSubtitle: {
    marginTop: 8,
    fontSize: 14,
    color: '#EAF2FF',
    textAlign: 'center',
    fontWeight: '500',
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.96)',
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 20,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  logo: {
    width: 78,
    height: 78,
    alignSelf: 'center',
    marginBottom: 10,
  },
  title: {
    fontSize: 22,
    fontWeight: '900',
    color: '#111827',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 18,
    fontWeight: '500',
  },
  label: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 8,
  },
  passwordRow: {
    minHeight: 50,
    borderWidth: 1.4,
    borderColor: '#D7DEE8',
    borderRadius: 14,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
  },
  passwordInput: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
    fontWeight: '600',
    paddingVertical: 12,
  },
  showText: {
    color: '#0A4DB3',
    fontSize: 14,
    fontWeight: '700',
    paddingLeft: 8,
  },
  inputError: {
    borderColor: '#FF6B6B',
  },
  errorText: {
    color: '#FF6B6B',
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 8,
    marginTop: 4,
  },
  primaryButton: {
    marginTop: 14,
    minHeight: 50,
    borderRadius: 14,
    backgroundColor: '#0A4DB3',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0A4DB3',
    shadowOpacity: 0.28,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  primaryButtonDisabled: {
    opacity: 0.75,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
  },
  linkButton: {
    alignSelf: 'center',
    marginTop: 16,
  },
  linkText: {
    color: '#0A4DB3',
    fontSize: 14,
    fontWeight: '700',
  },
  footer: {
    marginTop: 22,
    textAlign: 'center',
    color: '#EAF2FF',
    fontSize: 12,
    fontWeight: '500',
  },
});
