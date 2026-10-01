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
      <View style={styles.stepperWrap}>
        <View style={styles.stepperTrack}>
          <View style={styles.stepperBaseLine} />
          <View
            style={[
              styles.stepperProgressLine,
              {
                width:
                  currentIdx <= 0
                    ? '0%'
                    : currentIdx >= 2
                      ? '100%'
                      : '50%',
              },
            ]}
          />
          <View style={styles.stepperNodes}>
            {STEPS.map((s, index) => {
              const done = index < currentIdx;
              const active = index === currentIdx;
              return (
                <View key={s.key} style={styles.stepNode}>
                  <View
                    style={[
                      styles.stepCircle,
                      done && styles.stepCircleDone,
                      active && styles.stepCircleActive,
                    ]}
                  >
                    {done ? (
                      <Text style={styles.stepCheck}>✓</Text>
                    ) : active ? (
                      <View style={styles.stepDotActive} />
                    ) : (
                      <Text style={styles.stepNumber}>{index + 1}</Text>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        </View>
        <View style={styles.stepperLabels}>
          {STEPS.map((s, index) => {
            const done = index < currentIdx;
            const active = index === currentIdx;
            return (
              <Text
                key={`label-${s.key}`}
                style={[
                  styles.stepLabel,
                  done && styles.stepLabelDone,
                  active && styles.stepLabelActive,
                ]}
              >
                {s.label}
              </Text>
            );
          })}
        </View>
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
                    Enter the email address associated with your account. We
                    will send you a verification code.
                  </Text>

                  <View style={styles.fieldGroup}>
                    <Text style={styles.label}>Email Address</Text>
                    <TextInput
                      style={[
                        styles.input,
                        emailError ? styles.inputError : null,
                      ]}
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
                  </View>

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
                    hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}
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
                        If an account exists for this email, a verification
                        code has been sent.
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

                  <View style={styles.fieldGroup}>
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
                  </View>

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

                  <View style={styles.verifyActions}>
                    <TouchableOpacity
                      style={styles.verifyActionRow}
                      onPress={() => void resendCode()}
                      disabled={isLoading || resendSeconds > 0}
                      activeOpacity={0.75}
                    >
                      <Text
                        style={[
                          styles.verifyActionPrimary,
                          resendSeconds > 0
                            ? styles.verifyActionDisabled
                            : null,
                        ]}
                      >
                        {resendSeconds > 0
                          ? `Resend code in ${resendSeconds}s`
                          : 'Resend Code'}
                      </Text>
                    </TouchableOpacity>

                    <View style={styles.verifyDivider} />

                    <View style={styles.verifySecondaryRow}>
                      <TouchableOpacity
                        onPress={() => {
                          setStep('email');
                          setCodeDigits(['', '', '', '', '', '']);
                          setCodeError(undefined);
                          setResetToken('');
                        }}
                        disabled={isLoading}
                        activeOpacity={0.75}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Text style={styles.verifyActionLink}>
                          Change Email
                        </Text>
                      </TouchableOpacity>

                      <Text style={styles.verifyDot}>·</Text>

                      <TouchableOpacity
                        onPress={goBackToLogin}
                        disabled={isLoading}
                        activeOpacity={0.75}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Text style={styles.verifyActionMuted}>
                          Back to Sign In
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </>
              ) : null}

              {step === 'password' ? (
                <>
                  <Text style={styles.title}>Create New Password</Text>
                  <Text style={styles.subtitle}>
                    Your identity has been verified. Create a new password for
                    your account.
                  </Text>

                  <View style={styles.fieldGroup}>
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
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
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
                    ) : (
                      <Text style={styles.helperText}>
                        At least 8 characters, with uppercase, lowercase, and a
                        number.
                      </Text>
                    )}
                  </View>

                  <View style={styles.fieldGroup}>
                    <Text style={styles.label}>Confirm New Password</Text>
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
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
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
                  </View>

                  <TouchableOpacity
                    style={[
                      styles.primaryButton,
                      isLoading ? styles.primaryButtonDisabled : null,
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
                    hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}
                  >
                    <Text style={styles.linkText}>Back to Sign In</Text>
                  </TouchableOpacity>
                </>
              ) : null}

              {step === 'success' ? (
                <>
                  <View style={styles.successIcon}>
                    <Text style={styles.successIconCheck}>✓</Text>
                  </View>
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
    paddingHorizontal: 22,
    paddingVertical: 28,
  },
  headerSection: {
    alignItems: 'center',
    marginBottom: 22,
  },
  appTitle: {
    fontSize: 28,
    fontWeight: '900',
    color: '#FFD914',
    letterSpacing: 1.2,
    textAlign: 'center',
  },
  headerSubtitle: {
    marginTop: 6,
    fontSize: 14,
    color: '#EAF2FF',
    textAlign: 'center',
    fontWeight: '500',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingHorizontal: 22,
    paddingTop: 24,
    paddingBottom: 26,
    shadowColor: '#041E42',
    shadowOpacity: 0.22,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  logo: {
    width: 72,
    height: 72,
    alignSelf: 'center',
    marginBottom: 18,
  },
  stepperWrap: {
    marginBottom: 22,
    paddingHorizontal: 6,
  },
  stepperTrack: {
    height: 36,
    justifyContent: 'center',
    marginBottom: 8,
  },
  stepperBaseLine: {
    position: 'absolute',
    left: 18,
    right: 18,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#E5E7EB',
  },
  stepperProgressLine: {
    position: 'absolute',
    left: 18,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#16A34A',
  },
  stepperNodes: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  stepNode: {
    width: 36,
    alignItems: 'center',
  },
  stepCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: '#F3F4F6',
    borderWidth: 2,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepCircleActive: {
    backgroundColor: '#0A4DB3',
    borderColor: '#0A4DB3',
    shadowColor: '#0A4DB3',
    shadowOpacity: 0.35,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  stepCircleDone: {
    backgroundColor: '#16A34A',
    borderColor: '#16A34A',
  },
  stepDotActive: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#FFFFFF',
  },
  stepNumber: {
    color: '#9CA3AF',
    fontSize: 13,
    fontWeight: '800',
  },
  stepCheck: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  stepperLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stepLabel: {
    width: 72,
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  stepLabelActive: {
    color: '#0A4DB3',
    fontWeight: '800',
  },
  stepLabelDone: {
    color: '#15803D',
    fontWeight: '700',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#0B2F6B',
    textAlign: 'center',
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 21,
    marginBottom: 22,
    fontWeight: '500',
    paddingHorizontal: 4,
  },
  maskedEmail: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0A4DB3',
    textAlign: 'center',
    marginTop: -14,
    marginBottom: 20,
  },
  fieldGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 8,
    letterSpacing: 0.2,
  },
  input: {
    minHeight: 52,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 16,
    fontSize: 15,
    color: '#0F172A',
    fontWeight: '600',
    backgroundColor: '#F8FAFC',
  },
  inputError: {
    borderColor: '#F87171',
    backgroundColor: '#FEF2F2',
  },
  passwordRow: {
    minHeight: 52,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F8FAFC',
  },
  passwordInput: {
    flex: 1,
    fontSize: 15,
    color: '#0F172A',
    fontWeight: '600',
    paddingVertical: 12,
  },
  showText: {
    color: '#0A4DB3',
    fontSize: 13,
    fontWeight: '700',
    paddingLeft: 10,
  },
  helperText: {
    marginTop: 8,
    fontSize: 12,
    lineHeight: 17,
    color: '#94A3B8',
    fontWeight: '500',
  },
  errorText: {
    color: '#DC2626',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 8,
  },
  noticeBanner: {
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 18,
  },
  noticeText: {
    color: '#166534',
    fontSize: 13,
    lineHeight: 19,
    fontWeight: '600',
    textAlign: 'center',
  },
  codeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  codeBox: {
    flex: 1,
    minHeight: 54,
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    textAlign: 'center',
    fontSize: 20,
    fontWeight: '800',
    color: '#0B2F6B',
    backgroundColor: '#F8FAFC',
  },
  codeBoxFilled: {
    borderColor: '#0A4DB3',
    backgroundColor: '#EFF6FF',
  },
  codeBoxError: {
    borderColor: '#F87171',
    backgroundColor: '#FEF2F2',
  },
  primaryButton: {
    marginTop: 6,
    minHeight: 52,
    borderRadius: 14,
    backgroundColor: '#0A4DB3',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0A4DB3',
    shadowOpacity: 0.3,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },
  primaryButtonDisabled: {
    opacity: 0.72,
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  linkButton: {
    alignSelf: 'center',
    marginTop: 18,
  },
  linkStack: {
    alignItems: 'center',
    marginTop: 18,
    gap: 14,
  },
  verifyActions: {
    marginTop: 20,
    alignItems: 'center',
  },
  verifyActionRow: {
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  verifyActionPrimary: {
    color: '#0A4DB3',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.1,
  },
  verifyActionDisabled: {
    color: '#94A3B8',
    fontWeight: '600',
  },
  verifyDivider: {
    width: '72%',
    height: StyleSheet.hairlineWidth,
    backgroundColor: '#E2E8F0',
    marginVertical: 14,
  },
  verifySecondaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
  },
  verifyActionLink: {
    color: '#0A4DB3',
    fontSize: 13,
    fontWeight: '700',
  },
  verifyActionMuted: {
    color: '#64748B',
    fontSize: 13,
    fontWeight: '600',
  },
  verifyDot: {
    color: '#CBD5E1',
    fontSize: 16,
    fontWeight: '700',
    marginTop: -1,
  },
  linkText: {
    color: '#0A4DB3',
    fontSize: 14,
    fontWeight: '700',
  },
  linkTextSecondary: {
    color: '#64748B',
    fontSize: 14,
    fontWeight: '600',
  },
  linkTextMuted: {
    color: '#94A3B8',
  },
  successIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#ECFDF5',
    borderWidth: 2,
    borderColor: '#86EFAC',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 16,
  },
  successIconCheck: {
    color: '#16A34A',
    fontSize: 28,
    fontWeight: '800',
  },
  successBody: {
    fontSize: 14,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 10,
    fontWeight: '500',
    paddingHorizontal: 4,
  },
  footer: {
    marginTop: 24,
    textAlign: 'center',
    color: 'rgba(234, 242, 255, 0.9)',
    fontSize: 12,
    fontWeight: '500',
  },
});
