import { AUTH_ERROR_MESSAGES, ApiClientError } from '@/services/api';
import { AuthError, authService } from '@/services/authentication';
import {
  maskEmailForDisplay,
  validateForgotPasswordForm,
  validateResetPasswordForm,
  validateResetVerificationCode,
} from '@/utils/validation';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ImageBackground,
  KeyboardAvoidingView,
  NativeSyntheticEvent,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TextInputKeyPressEventData,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type Step = 'email' | 'verify' | 'password' | 'success';

const STEPS: { key: Step; label: string }[] = [
  { key: 'email', label: 'Email' },
  { key: 'verify', label: 'Verify' },
  { key: 'password', label: 'Password' },
];

function getErrorMessage(error: unknown): string {
  if (error instanceof AuthError || error instanceof ApiClientError) {
    return error.message.trim() || AUTH_ERROR_MESSAGES.SERVER;
  }
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }
  return AUTH_ERROR_MESSAGES.SERVER;
}

function stepIndex(step: Step): number {
  if (step === 'success') return 3;
  return STEPS.findIndex((s) => s.key === step);
}

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const mountedRef = useRef(true);
  const codeInputRefs = useRef<Array<TextInput | null>>([]);

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [codeDigits, setCodeDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [resetToken, setResetToken] = useState('');
  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [emailError, setEmailError] = useState<string | undefined>();
  const [codeError, setCodeError] = useState<string | undefined>();
  const [passwordErrors, setPasswordErrors] = useState<{
    password?: string;
    passwordConfirmation?: string;
  }>({});
  const [codeSentNotice, setCodeSentNotice] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (resendSeconds <= 0) return;
    const timer = setTimeout(() => setResendSeconds((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendSeconds]);

  const goBackToLogin = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/(tabs)');
  }, [router]);

  const codeValue = codeDigits.join('');

  const sendVerificationCode = useCallback(async () => {
    if (isLoading) return;

    const validation = validateForgotPasswordForm(email);
    if (!validation.isValid) {
      setEmailError(validation.errors.email);
      return;
    }

    setIsLoading(true);
    setEmailError(undefined);

    try {
      await authService.forgotPassword(email);
      if (!mountedRef.current) return;
      setCodeSentNotice(true);
      setCodeDigits(['', '', '', '', '', '']);
      setCodeError(undefined);
      setResendSeconds(60);
      setStep('verify');
      setTimeout(() => codeInputRefs.current[0]?.focus(), 250);
    } catch (error) {
      if (!mountedRef.current) return;
      Alert.alert('Request Failed', getErrorMessage(error));
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  }, [email, isLoading]);

  const resendCode = useCallback(async () => {
    if (isLoading || resendSeconds > 0) return;
    setIsLoading(true);
    setCodeError(undefined);
    try {
      await authService.resendResetCode(email);
      if (!mountedRef.current) return;
      setCodeSentNotice(true);
      setCodeDigits(['', '', '', '', '', '']);
      setResendSeconds(60);
      Alert.alert(
        'Code Sent',
        'If an account exists for this email, a new verification code has been sent.',
      );
      setTimeout(() => codeInputRefs.current[0]?.focus(), 200);
    } catch (error) {
      if (!mountedRef.current) return;
      Alert.alert('Resend Failed', getErrorMessage(error));
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  }, [email, isLoading, resendSeconds]);

  const verifyCode = useCallback(async () => {
    if (isLoading) return;
    const codeErr = validateResetVerificationCode(codeValue);
    if (codeErr) {
      setCodeError(codeErr);
      return;
    }

    setIsLoading(true);
    setCodeError(undefined);

    try {
      const result = await authService.verifyResetCode({
        email,
        code: codeValue,
      });
      if (!mountedRef.current) return;
      setResetToken(result.token);
      setPassword('');
      setPasswordConfirmation('');
      setPasswordErrors({});
      setStep('password');
    } catch (error) {
      if (!mountedRef.current) return;
      setCodeError(getErrorMessage(error));
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  }, [codeValue, email, isLoading]);

  const submitNewPassword = useCallback(async () => {
    if (isLoading) return;
    if (!resetToken) {
      Alert.alert(
        'Session Expired',
        'Please verify your email code again before setting a new password.',
      );
      setStep('verify');
      return;
    }

    const validation = validateResetPasswordForm(password, passwordConfirmation);
    if (!validation.isValid) {
      setPasswordErrors(validation.errors);
      return;
    }

    setIsLoading(true);
    setPasswordErrors({});

    try {
      await authService.resetPassword({
        email,
        token: resetToken,
        password,
        passwordConfirmation,
      });
      if (!mountedRef.current) return;
      setStep('success');
    } catch (error) {
      if (!mountedRef.current) return;
      Alert.alert('Reset Failed', getErrorMessage(error));
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  }, [
    email,
    isLoading,
    password,
    passwordConfirmation,
    resetToken,
  ]);

  const onCodeChange = (index: number, text: string) => {
    const cleaned = text.replace(/\D/g, '');
    if (cleaned.length > 1) {
      // Paste support
      const chars = cleaned.slice(0, 6).split('');
      const next = ['', '', '', '', '', ''];
      chars.forEach((c, i) => {
        next[i] = c;
      });
      setCodeDigits(next);
      setCodeError(undefined);
      const focusAt = Math.min(chars.length, 5);
      codeInputRefs.current[focusAt]?.focus();
      return;
    }

    const next = [...codeDigits];
    next[index] = cleaned.slice(-1);
    setCodeDigits(next);
    setCodeError(undefined);
    if (cleaned && index < 5) {
      codeInputRefs.current[index + 1]?.focus();
    }
  };

  const onCodeKeyPress = (
    index: number,
    e: NativeSyntheticEvent<TextInputKeyPressEventData>,
  ) => {
    if (e.nativeEvent.key === 'Backspace' && !codeDigits[index] && index > 0) {
      codeInputRefs.current[index - 1]?.focus();
    }
  };

  const currentIdx = stepIndex(step);

  const renderStepper = () => {
    if (step === 'success') return null;
    return (
      <View style={styles.stepper}>
        {STEPS.map((s, index) => {
          const done = index < currentIdx;
          const active = index === currentIdx;
          return (
            <View key={s.key} style={styles.stepItem}>
              {index > 0 ? (
                <View
                  style={[
                    styles.stepLine,
                    done || active ? styles.stepLineDone : null,
                  ]}
                />
              ) : (
                <View style={styles.stepLineSpacer} />
              )}
              <View style={styles.stepCircleCol}>
                <View
                  style={[
                    styles.stepCircle,
                    done && styles.stepCircleDone,
                    active && styles.stepCircleActive,
                  ]}
                >
                  {done ? (
                    <Text style={styles.stepCheck}>✓</Text>
                  ) : (
                    <View
                      style={[
                        styles.stepDot,
                        active ? styles.stepDotActive : styles.stepDotIdle,
                      ]}
                    />
                  )}
                </View>
                <Text
                  style={[
                    styles.stepLabel,
                    done && styles.stepLabelDone,
                    active && styles.stepLabelActive,
                  ]}
                >
                  {s.label}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    );
  };

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

              {renderStepper()}

              {step === 'email' ? (
                <>
                  <Text style={styles.title}>Forgot Password</Text>
                  <Text style={styles.subtitle}>
                    Enter the email address associated with your account. We will
                    send you a verification code.
                  </Text>

                  <Text style={styles.label}>Email Address</Text>
                  <TextInput
                    style={[styles.input, emailError ? styles.inputError : null]}
                    placeholder="Enter your email"
                    placeholderTextColor="#94A3B8"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                    editable={!isLoading}
                    value={email}
                    onChangeText={(text) => {
                      setEmail(text);
                      if (emailError) setEmailError(undefined);
                    }}
                  />
                  {emailError ? (
                    <Text style={styles.errorText}>{emailError}</Text>
                  ) : null}

                  <TouchableOpacity
                    style={[
                      styles.primaryButton,
                      isLoading ? styles.primaryButtonDisabled : null,
                    ]}
                    onPress={() => void sendVerificationCode()}
                    activeOpacity={0.9}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.primaryButtonText}>
                        Send Verification Code
                      </Text>
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
              ) : null}

              {step === 'verify' ? (
                <>
                  {codeSentNotice ? (
                    <View style={styles.noticeBanner}>
                      <Text style={styles.noticeText}>
                        If an account exists for this email, a verification code
                        has been sent.
                      </Text>
                    </View>
                  ) : null}

                  <Text style={styles.title}>Verify Your Email</Text>
                  <Text style={styles.subtitle}>
                    We sent a 6-digit verification code to:
                  </Text>
                  <Text style={styles.maskedEmail}>
                    {maskEmailForDisplay(email)}
                  </Text>

                  <Text style={styles.label}>Enter Verification Code</Text>
                  <View style={styles.codeRow}>
                    {codeDigits.map((digit, index) => (
                      <TextInput
                        key={`code-${index}`}
                        ref={(ref) => {
                          codeInputRefs.current[index] = ref;
                        }}
                        style={[
                          styles.codeBox,
                          digit ? styles.codeBoxFilled : null,
                          codeError ? styles.codeBoxError : null,
                        ]}
                        value={digit}
                        onChangeText={(text) => onCodeChange(index, text)}
                        onKeyPress={(e) => onCodeKeyPress(index, e)}
                        keyboardType="number-pad"
                        maxLength={index === 0 ? 6 : 1}
                        editable={!isLoading}
                        selectTextOnFocus
                        textContentType="oneTimeCode"
                        autoComplete="sms-otp"
                      />
                    ))}
                  </View>
                  {codeError ? (
                    <Text style={styles.errorText}>{codeError}</Text>
                  ) : null}

                  <TouchableOpacity
                    style={[
                      styles.primaryButton,
                      isLoading ? styles.primaryButtonDisabled : null,
                    ]}
                    onPress={() => void verifyCode()}
                    activeOpacity={0.9}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.primaryButtonText}>Verify Code</Text>
                    )}
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => void resendCode()}
                    style={styles.linkButton}
                    disabled={isLoading || resendSeconds > 0}
                  >
                    <Text
                      style={[
                        styles.linkText,
                        resendSeconds > 0 ? styles.linkTextMuted : null,
                      ]}
                    >
                      {resendSeconds > 0
                        ? `Resend Code (${resendSeconds}s)`
                        : 'Resend Code'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => {
                      setStep('email');
                      setCodeDigits(['', '', '', '', '', '']);
                      setCodeError(undefined);
                      setResetToken('');
                    }}
                    style={styles.linkButtonTight}
                    disabled={isLoading}
                  >
                    <Text style={styles.linkText}>Change Email</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={goBackToLogin}
                    style={styles.linkButtonTight}
                    disabled={isLoading}
                  >
                    <Text style={styles.linkText}>Back to Sign In</Text>
                  </TouchableOpacity>
                </>
              ) : null}

              {step === 'password' ? (
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
                      passwordErrors.password ? styles.inputError : null,
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
                        if (passwordErrors.password) {
                          setPasswordErrors((prev) => ({
                            ...prev,
                            password: undefined,
                          }));
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
                  {passwordErrors.password ? (
                    <Text style={styles.errorText}>
                      {passwordErrors.password}
                    </Text>
                  ) : null}

                  <Text style={[styles.label, { marginTop: 14 }]}>
                    Confirm New Password
                  </Text>
                  <View
                    style={[
                      styles.passwordRow,
                      passwordErrors.passwordConfirmation
                        ? styles.inputError
                        : null,
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
                        if (passwordErrors.passwordConfirmation) {
                          setPasswordErrors((prev) => ({
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
                  {passwordErrors.passwordConfirmation ? (
                    <Text style={styles.errorText}>
                      {passwordErrors.passwordConfirmation}
                    </Text>
                  ) : null}

                  <TouchableOpacity
                    style={[
                      styles.primaryButton,
                      isLoading ? styles.primaryButtonDisabled : null,
                      { marginTop: 20 },
                    ]}
                    onPress={() => void submitNewPassword()}
                    activeOpacity={0.9}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <Text style={styles.primaryButtonText}>
                        Reset Password
                      </Text>
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
              ) : null}

              {step === 'success' ? (
                <>
                  <Text style={styles.title}>Password Reset Successful</Text>
                  <Text style={styles.successBody}>
                    Your password has been changed successfully. For your
                    security, existing login sessions may have been signed out.
                    You can now sign in using your new password.
                  </Text>
                  <TouchableOpacity
                    style={styles.primaryButton}
                    onPress={goBackToLogin}
                    activeOpacity={0.9}
                  >
                    <Text style={styles.primaryButtonText}>
                      Back to Sign In
                    </Text>
                  </TouchableOpacity>
                </>
              ) : null}
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
  stepper: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'center',
    marginBottom: 18,
    paddingHorizontal: 4,
  },
  stepItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  stepLine: {
    height: 2,
    flex: 1,
    backgroundColor: '#D1D5DB',
    marginTop: 15,
    marginRight: 4,
  },
  stepLineDone: {
    backgroundColor: '#22C55E',
  },
  stepLineSpacer: {
    width: 0,
  },
  stepCircleCol: {
    alignItems: 'center',
    minWidth: 56,
  },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCircleActive: {
    backgroundColor: '#0648A8',
  },
  stepCircleDone: {
    backgroundColor: '#22C55E',
  },
  stepDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  stepDotActive: {
    backgroundColor: '#FFFFFF',
  },
  stepDotIdle: {
    backgroundColor: '#9CA3AF',
  },
  stepCheck: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  stepLabel: {
    marginTop: 6,
    fontSize: 12,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  stepLabelActive: {
    color: '#0648A8',
    fontWeight: '800',
  },
  stepLabelDone: {
    color: '#16A34A',
    fontWeight: '700',
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
  maskedEmail: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0B2F6B',
    textAlign: 'center',
    marginTop: -10,
    marginBottom: 18,
  },
  label: {
    fontSize: 14,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 8,
  },
  input: {
    minHeight: 50,
    borderWidth: 1.4,
    borderColor: '#D7DEE8',
    borderRadius: 14,
    paddingHorizontal: 14,
    fontSize: 14,
    color: '#111827',
    fontWeight: '600',
    backgroundColor: '#F9FAFB',
    marginBottom: 6,
  },
  inputError: {
    borderColor: '#FF6B6B',
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
  errorText: {
    color: '#FF6B6B',
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 8,
  },
  noticeBanner: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#86EFAC',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 16,
  },
  noticeText: {
    color: '#166534',
    fontSize: 13,
    lineHeight: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
  codeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginBottom: 10,
  },
  codeBox: {
    flex: 1,
    minHeight: 52,
    borderWidth: 1.5,
    borderColor: '#D7DEE8',
    borderRadius: 12,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '800',
    color: '#0B2F6B',
    backgroundColor: '#F9FAFB',
  },
  codeBoxFilled: {
    borderColor: '#0A4DB3',
  },
  codeBoxError: {
    borderColor: '#FF6B6B',
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
  linkButtonTight: {
    alignSelf: 'center',
    marginTop: 10,
  },
  linkText: {
    color: '#0A4DB3',
    fontSize: 14,
    fontWeight: '700',
  },
  linkTextMuted: {
    color: '#94A3B8',
  },
  successBody: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 8,
    fontWeight: '500',
  },
  footer: {
    marginTop: 22,
    textAlign: 'center',
    color: '#EAF2FF',
    fontSize: 12,
    fontWeight: '500',
  },
});
