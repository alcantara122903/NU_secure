import { AUTH_ERROR_MESSAGES, ApiClientError } from '@/services/api';
import { AuthError, authService } from '@/services/authentication';
import { validateResetPasswordForm } from '@/utils/validation';
import Ionicons from '@expo/vector-icons/Ionicons';
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
  const params = useLocalSearchParams<{ email?: string | string[]; token?: string | string[] }>();
  const mountedRef = useRef(true);

  const email = useMemo(() => firstParam(params.email).trim().toLowerCase(), [params.email]);
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
      const result = await authService.resetPassword({
        email,
        token,
        password,
        passwordConfirmation,
      });

      if (!mountedRef.current) {
        return;
      }

      setIsSuccess(true);
      Alert.alert('Password Reset', result.message, [
        {
          text: 'Back to Login',
          onPress: goBackToLogin,
        },
      ]);
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
    goBackToLogin,
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
              <Text style={styles.subtitle}>Smart Visitor Monitoring System</Text>
            </View>

            <View style={styles.card}>
              <Image
                source={require('@/assets/nu-logo.png')}
                style={styles.logo}
                resizeMode="contain"
              />

              <Text style={styles.title}>Reset Password</Text>

              {linkMissing ? (
                <>
                  <Text style={styles.description}>
                    This password reset link is invalid or has already been used.
                  </Text>
                  <TouchableOpacity
                    style={styles.primaryButton}
                    onPress={goBackToLogin}
                    activeOpacity={0.9}
                  >
                    <Text style={styles.primaryButtonText}>Back to Login</Text>
                  </TouchableOpacity>
                </>
              ) : isSuccess ? (
                <>
                  <Text style={styles.successText}>
                    Your password has been reset successfully. You can now sign in using your new
                    password.
                  </Text>
                  <TouchableOpacity
                    style={styles.primaryButton}
                    onPress={goBackToLogin}
                    activeOpacity={0.9}
                  >
                    <Text style={styles.primaryButtonText}>Back to Login</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  <Text style={styles.description}>
                    Choose a new password for {email}. Use at least 8 characters with uppercase,
                    lowercase, and a number.
                  </Text>

                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>New Password</Text>
                    <View
                      style={[
                        styles.inputWrapper,
                        errors.password ? styles.inputWrapperError : null,
                      ]}
                    >
                      <Ionicons
                        name="lock-closed-outline"
                        size={20}
                        color="#6B7280"
                        style={styles.inputIcon}
                      />
                      <TextInput
                        style={styles.input}
                        placeholder="Enter new password"
                        placeholderTextColor="#9CA3AF"
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
                        onPress={() => setShowPassword((prev) => !prev)}
                        style={styles.eyeButton}
                        disabled={isLoading}
                      >
                        <Ionicons
                          name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                          size={22}
                          color="#4B5563"
                        />
                      </TouchableOpacity>
                    </View>
                    {errors.password ? (
                      <Text style={styles.errorText}>{errors.password}</Text>
                    ) : null}
                  </View>

                  <View style={styles.inputGroup}>
                    <Text style={styles.label}>Confirm New Password</Text>
                    <View
                      style={[
                        styles.inputWrapper,
                        errors.passwordConfirmation ? styles.inputWrapperError : null,
                      ]}
                    >
                      <Ionicons
                        name="lock-closed-outline"
                        size={20}
                        color="#6B7280"
                        style={styles.inputIcon}
                      />
                      <TextInput
                        style={styles.input}
                        placeholder="Confirm new password"
                        placeholderTextColor="#9CA3AF"
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
                        onPress={() => setShowConfirmPassword((prev) => !prev)}
                        style={styles.eyeButton}
                        disabled={isLoading}
                      >
                        <Ionicons
                          name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                          size={22}
                          color="#4B5563"
                        />
                      </TouchableOpacity>
                    </View>
                    {errors.passwordConfirmation ? (
                      <Text style={styles.errorText}>{errors.passwordConfirmation}</Text>
                    ) : null}
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.primaryButton,
                      isLoading ? styles.primaryButtonDisabled : null,
                    ]}
                    onPress={handleSubmit}
                    activeOpacity={0.9}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <View style={styles.buttonContent}>
                        <ActivityIndicator color="#FFFFFF" size="small" />
                        <Text style={styles.primaryButtonText}>Resetting...</Text>
                      </View>
                    ) : (
                      <Text style={styles.primaryButtonText}>Reset Password</Text>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={goBackToLogin}
                    style={styles.backButton}
                    activeOpacity={0.8}
                    disabled={isLoading}
                  >
                    <Text style={styles.backText}>Back to Login</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
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
    ...StyleSheet.absoluteFillObject,
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
  subtitle: {
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
  },
  description: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 18,
    lineHeight: 18,
  },
  inputGroup: {
    marginBottom: 14,
  },
  label: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 50,
    borderRadius: 14,
    borderWidth: 1.4,
    borderColor: '#D7DEE8',
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 12,
  },
  inputWrapperError: {
    borderColor: '#FF6B6B',
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: '#111827',
    fontWeight: '600',
  },
  eyeButton: {
    paddingLeft: 6,
    paddingVertical: 4,
  },
  errorText: {
    color: '#FF6B6B',
    fontSize: 12,
    marginTop: 6,
    fontWeight: '500',
  },
  successText: {
    color: '#047857',
    fontSize: 14,
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 18,
    lineHeight: 20,
    fontWeight: '600',
  },
  primaryButton: {
    backgroundColor: '#0A4DB3',
    minHeight: 50,
    borderRadius: 14,
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
  buttonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '900',
  },
  backButton: {
    alignSelf: 'center',
    marginTop: 18,
  },
  backText: {
    color: '#0A4DB3',
    fontSize: 14,
    fontWeight: '700',
  },
});
