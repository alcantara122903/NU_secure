import { AUTH_ERROR_MESSAGES, ApiClientError } from '@/services/api';
import { AuthError, authService } from '@/services/authentication';
import { validateForgotPasswordForm } from '@/utils/validation';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
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

function getForgotErrorMessage(error: unknown): string {
  if (error instanceof AuthError || error instanceof ApiClientError) {
    return error.message.trim() || AUTH_ERROR_MESSAGES.SERVER;
  }
  if (error instanceof Error && error.message.trim()) {
    return error.message.trim();
  }
  return AUTH_ERROR_MESSAGES.SERVER;
}

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const mountedRef = useRef(true);
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState<{ email?: string }>({});
  const [isLoading, setIsLoading] = useState(false);
  const [sentMessage, setSentMessage] = useState<string | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const handleSubmit = useCallback(async () => {
    if (isLoading) {
      return;
    }

    const validation = validateForgotPasswordForm(email);
    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }

    setIsLoading(true);
    setErrors({});
    setSentMessage(null);

    try {
      const result = await authService.forgotPassword(email);
      if (!mountedRef.current) {
        return;
      }
      setSentMessage(result.message);
      Alert.alert('Check your email', result.message);
    } catch (error) {
      if (!mountedRef.current) {
        return;
      }
      Alert.alert('Request Failed', getForgotErrorMessage(error));
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [email, isLoading]);

  const goBackToLogin = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/(tabs)');
  }, [router]);

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

              <Text style={styles.title}>Forgot Password</Text>
              <Text style={styles.description}>
                Enter your registered email address and we&apos;ll send you instructions to reset
                your password.
              </Text>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Email Address</Text>
                <View
                  style={[styles.inputWrapper, errors.email ? styles.inputWrapperError : null]}
                >
                  <Ionicons
                    name="mail-outline"
                    size={20}
                    color="#6B7280"
                    style={styles.inputIcon}
                  />
                  <TextInput
                    style={styles.input}
                    placeholder="Enter your email"
                    placeholderTextColor="#9CA3AF"
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoComplete="email"
                    editable={!isLoading}
                    value={email}
                    onChangeText={(text) => {
                      setEmail(text);
                      if (errors.email) {
                        setErrors({});
                      }
                    }}
                  />
                </View>
                {errors.email ? <Text style={styles.errorText}>{errors.email}</Text> : null}
              </View>

              {sentMessage ? <Text style={styles.successText}>{sentMessage}</Text> : null}

              <TouchableOpacity
                style={[styles.primaryButton, isLoading ? styles.primaryButtonDisabled : null]}
                onPress={handleSubmit}
                activeOpacity={0.9}
                disabled={isLoading}
              >
                {isLoading ? (
                  <View style={styles.buttonContent}>
                    <ActivityIndicator color="#FFFFFF" size="small" />
                    <Text style={styles.primaryButtonText}>Sending...</Text>
                  </View>
                ) : (
                  <Text style={styles.primaryButtonText}>Send Reset Link</Text>
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
  errorText: {
    color: '#FF6B6B',
    fontSize: 12,
    marginTop: 6,
    fontWeight: '500',
  },
  successText: {
    color: '#047857',
    fontSize: 13,
    marginBottom: 14,
    lineHeight: 18,
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
