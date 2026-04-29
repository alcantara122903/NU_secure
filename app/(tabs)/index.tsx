import { authService } from "@/services/auth";
import { authSessionService } from "@/services/auth-session";
import type { AuthStatus } from "@/types/auth";
import { validateLoginForm } from "@/utils/validation";
import Ionicons from "@expo/vector-icons/Ionicons";
import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function LoginScreen() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<AuthStatus>("idle");
  const [errors, setErrors] = useState<{ email?: string; password?: string }>(
    {},
  );
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = useCallback(async () => {
    // Validate form
    const validation = validateLoginForm(email, password);

    if (!validation.isValid) {
      setErrors(validation.errors);
      return;
    }

    setStatus("loading");
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

        setStatus("success");
        // Navigate to dashboard based on role from database
        setTimeout(() => {
          router.push(response.dashboard);
        }, 200);
      } else {
        setStatus("error");
        Alert.alert("Login Failed", response.message || "Please try again");
      }
    } catch (error) {
      setStatus("error");
      const errorMessage =
        error instanceof Error ? error.message : "An error occurred";
      console.error("Login error details:", errorMessage);
      Alert.alert("Login Error", errorMessage);
    }
  }, [email, password, router]);

  const isLoading = status === "loading";
  const handleForgotPassword = useCallback(() => {
    Alert.alert("Forgot Password", "Feature coming soon");
  }, []);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle="light-content" backgroundColor="#0A4DB3" />

      <ImageBackground
        source={require("@/assets/nu-building.png")}
        style={styles.background}
        resizeMode="cover"
      >
        <View style={styles.overlay} />

        <KeyboardAvoidingView
          style={styles.flex}
          behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            scrollEnabled={Platform.OS !== "web"}
          >
            <View style={styles.headerSection}>
              <Text style={styles.appTitle}>NU-SECURE</Text>
              <Text style={styles.subtitle}>Smart Visitor Monitoring System</Text>
            </View>

            <View style={styles.card}>
              <Image
                source={require("@/assets/nu-logo.png")}
                style={styles.logo}
                resizeMode="contain"
              />

              <Text style={styles.welcomeTitle}>Welcome Back</Text>
              <Text style={styles.welcomeSubtitle}>
                Sign in to continue to the Guard Portal
              </Text>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Email</Text>
                <View
                  style={[
                    styles.inputWrapper,
                    errors.email ? styles.inputWrapperError : null,
                  ]}
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
                        setErrors({ ...errors, email: undefined });
                      }
                    }}
                  />
                </View>
                {errors.email ? <Text style={styles.errorText}>{errors.email}</Text> : null}
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Password</Text>
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
                    placeholder="Enter your password"
                    placeholderTextColor="#9CA3AF"
                    secureTextEntry={!showPassword}
                    editable={!isLoading}
                    value={password}
                    onChangeText={(text) => {
                      setPassword(text);
                      if (errors.password) {
                        setErrors({ ...errors, password: undefined });
                      }
                    }}
                  />

                  <TouchableOpacity
                    onPress={() => setShowPassword(!showPassword)}
                    style={styles.eyeButton}
                    disabled={isLoading}
                  >
                    <Ionicons
                      name={showPassword ? "eye-off-outline" : "eye-outline"}
                      size={22}
                      color="#4B5563"
                    />
                  </TouchableOpacity>
                </View>
                {errors.password ? <Text style={styles.errorText}>{errors.password}</Text> : null}
              </View>

              <TouchableOpacity
                onPress={handleForgotPassword}
                style={styles.forgotButton}
                activeOpacity={0.8}
                disabled={isLoading}
              >
                <Text style={styles.forgotText}>Forgot password?</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.signInButton, isLoading ? styles.signInButtonDisabled : null]}
                onPress={handleLogin}
                activeOpacity={0.9}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#FFFFFF" size="small" />
                ) : (
                  <Text style={styles.signInButtonText}>Sign In</Text>
                )}
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
    backgroundColor: "#0A4DB3",
  },

  flex: {
    flex: 1,
  },

  background: {
    flex: 1,
  },

  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(6, 72, 168, 0.72)",
  },

  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 24,
  },

  headerSection: {
    alignItems: "center",
    marginBottom: 20,
  },

  appTitle: {
    fontSize: 26,
    fontWeight: "900",
    color: "#FFD914",
    letterSpacing: 1,
    textAlign: "center",
  },

  subtitle: {
    marginTop: 8,
    fontSize: 14,
    color: "#EAF2FF",
    textAlign: "center",
    fontWeight: "500",
  },

  card: {
    backgroundColor: "rgba(255,255,255,0.96)",
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingVertical: 20,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },

  logo: {
    width: 78,
    height: 78,
    alignSelf: "center",
    marginBottom: 10,
  },

  welcomeTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: "#111827",
    textAlign: "center",
  },

  welcomeSubtitle: {
    fontSize: 13,
    color: "#6B7280",
    textAlign: "center",
    marginTop: 6,
    marginBottom: 18,
    lineHeight: 18,
  },

  inputGroup: {
    marginBottom: 14,
  },

  label: {
    fontSize: 14,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 8,
  },

  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 50,
    borderRadius: 14,
    borderWidth: 1.4,
    borderColor: "#D7DEE8",
    backgroundColor: "#F9FAFB",
    paddingHorizontal: 12,
  },

  inputWrapperError: {
    borderColor: "#FF6B6B",
  },

  inputIcon: {
    marginRight: 8,
  },

  input: {
    flex: 1,
    fontSize: 14,
    color: "#111827",
    fontWeight: "600",
  },

  eyeButton: {
    paddingLeft: 6,
    paddingVertical: 4,
  },

  errorText: {
    color: "#FF6B6B",
    fontSize: 12,
    marginTop: 6,
    fontWeight: "500",
  },

  forgotButton: {
    alignSelf: "flex-end",
    marginBottom: 16,
  },

  forgotText: {
    color: "#0A4DB3",
    fontSize: 13,
    fontWeight: "700",
  },

  signInButton: {
    backgroundColor: "#0A4DB3",
    minHeight: 50,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#0A4DB3",
    shadowOpacity: 0.28,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 5,
  },

  signInButtonDisabled: {
    opacity: 0.75,
  },

  signInButtonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "900",
  },
});
