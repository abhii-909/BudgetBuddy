import { Redirect, router } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CustomButton } from "../components/CustomButton";
import { useAuth } from "../src/hooks/useAuth";
import { useTheme } from "../src/hooks/useTheme";
import { ColorTheme } from "../src/constants/theme";

const MIN_PASSWORD_LENGTH = 6;

const isValidEmail = (email: string) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

export default function SignupScreen() {
  const { signup, session, loading } = useAuth();
  const { theme } = useTheme();
  const styles = getStyles(theme);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loadingSignup, setLoadingSignup] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [isDuplicateAccount, setIsDuplicateAccount] = useState(false);
  const [duplicateEmail, setDuplicateEmail] = useState("");

  const [focusedField, setFocusedField] = useState<"fullName" | "email" | "password" | "confirmPassword" | null>(null);

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={theme.primary} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (session) {
    return <Redirect href="/(tabs)/dashboard" />;
  }

  const validateForm = () => {
    if (!fullName.trim() || !email.trim() || !password || !confirmPassword) {
      return "Please fill in all fields.";
    }

    if (!isValidEmail(email.trim())) {
      return "Please enter a valid email address.";
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
    }

    if (password !== confirmPassword) {
      return "Passwords do not match.";
    }

    return "";
  };

  const handleSignup = async () => {
    const validationError = validateForm();

    setErrorMessage("");
    setSuccessMessage("");
    setIsDuplicateAccount(false);

    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    setLoadingSignup(true);

    const trimmedEmail = email.trim();
    const result = await signup(fullName.trim(), trimmedEmail, password);

    setLoadingSignup(false);

    if (result.error) {
      // Check if error message explicitly points to duplicate user
      if (
        result.error.toLowerCase().includes("already registered") ||
        result.error.toLowerCase().includes("user already exists")
      ) {
        setIsDuplicateAccount(true);
        setDuplicateEmail(trimmedEmail);
        return;
      }
      setErrorMessage(result.error);
      return;
    }

    if (result.isDuplicate) {
      setIsDuplicateAccount(true);
      setDuplicateEmail(trimmedEmail);
      return;
    }

    // Success: navigate to the confirmation link notification screen
    router.push({
      pathname: "/confirm-email",
      params: { email: trimmedEmail }
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Pressable
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace("/");
              }
            }}
            style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
          >
            <Text style={styles.backText}>← Back</Text>
          </Pressable>

          <View style={styles.header}>
            <View style={styles.logo}>
              <Image source={require("../assets/icon.png")} style={styles.logoImage} />
            </View>
            <Text style={styles.title}>Create Account</Text>
            <Text style={styles.subtitle}>
              Start splitting expenses with friends in a few taps.
            </Text>
          </View>

          <View style={styles.formCard}>
            <Text style={styles.label}>Full Name</Text>
            <TextInput
              autoCapitalize="words"
              onChangeText={setFullName}
              onFocus={() => setFocusedField("fullName")}
              onBlur={() => setFocusedField(null)}
              placeholder="Enter your full name"
              placeholderTextColor={theme.textMuted}
              style={[styles.input, focusedField === "fullName" && styles.inputFocused]}
              value={fullName}
            />

            <Text style={styles.label}>Email</Text>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              onChangeText={setEmail}
              onFocus={() => setFocusedField("email")}
              onBlur={() => setFocusedField(null)}
              placeholder="you@example.com"
              placeholderTextColor={theme.textMuted}
              style={[styles.input, focusedField === "email" && styles.inputFocused]}
              value={email}
            />

            <Text style={styles.label}>Password</Text>
            <TextInput
              onChangeText={setPassword}
              onFocus={() => setFocusedField("password")}
              onBlur={() => setFocusedField(null)}
              placeholder="Create a password"
              placeholderTextColor={theme.textMuted}
              secureTextEntry
              style={[styles.input, focusedField === "password" && styles.inputFocused]}
              value={password}
            />

            <Text style={styles.label}>Confirm Password</Text>
            <TextInput
              onChangeText={setConfirmPassword}
              onFocus={() => setFocusedField("confirmPassword")}
              onBlur={() => setFocusedField(null)}
              placeholder="Re-enter your password"
              placeholderTextColor={theme.textMuted}
              secureTextEntry
              style={[styles.input, focusedField === "confirmPassword" && styles.inputFocused]}
              value={confirmPassword}
            />


            {isDuplicateAccount ? (
              <View style={styles.duplicateBox}>
                <Text style={styles.duplicateTitle}>An account with this email already exists.</Text>
                <Text style={styles.duplicateSubtitle}>
                  Would you like to log in or reset your password?
                </Text>
                <View style={styles.duplicateActions}>
                  <Pressable
                    onPress={() => router.push("/login")}
                    style={styles.duplicateButton}
                  >
                    <Text style={styles.duplicateButtonText}>Go to Login</Text>
                  </Pressable>
                  <Pressable
                    onPress={() =>
                      router.push({
                        pathname: "/forgot-password",
                        params: { email: duplicateEmail }
                      })
                    }
                    style={styles.duplicateButtonSecondary}
                  >
                    <Text style={styles.duplicateButtonSecondaryText}>Forgot Password?</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}

            {errorMessage ? (
              <View style={styles.messageBoxError}>
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            ) : null}

            {successMessage ? (
              <View style={styles.messageBoxSuccess}>
                <Text style={styles.successText}>{successMessage}</Text>
              </View>
            ) : null}

            <CustomButton
              onPress={() => {
                if (!loadingSignup) {
                  handleSignup();
                }
              }}
              style={styles.submitButton}
              title={loadingSignup ? "Creating Account..." : "Create Account"}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const getStyles = (theme: ColorTheme) => StyleSheet.create({
  safeArea: {
    backgroundColor: theme.background,
    flex: 1
  },
  loadingContainer: {
    alignItems: "center",
    backgroundColor: theme.background,
    flex: 1,
    justifyContent: "center"
  },
  keyboardView: {
    flex: 1
  },
  content: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 24
  },
  backButton: {
    alignSelf: "flex-start",
    marginBottom: 18,
    paddingVertical: 8
  },
  backButtonPressed: {
    opacity: 0.7
  },
  backText: {
    color: theme.primaryDark,
    fontSize: 15,
    fontWeight: "800"
  },
  header: {
    alignItems: "center",
    marginBottom: 24
  },
  logo: {
    alignItems: "center",
    backgroundColor: theme.card,
    borderRadius: 20,
    height: 64,
    justifyContent: "center",
    marginBottom: 18,
    borderWidth: 1,
    borderColor: theme.border,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.06,
    shadowRadius: 12,
    elevation: 3,
    width: 64
  },
  logoImage: {
    width: "82%",
    height: "82%",
    borderRadius: 14
  },
  logoText: {
    color: theme.white,
    fontSize: 20,
    fontWeight: "900"
  },
  title: {
    color: theme.text,
    fontSize: 30,
    fontWeight: "900",
    marginBottom: 8
  },
  subtitle: {
    color: theme.textMuted,
    fontSize: 15,
    lineHeight: 22,
    maxWidth: 300,
    textAlign: "center"
  },
  formCard: {
    backgroundColor: theme.card,
    borderRadius: 24,
    padding: 20,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.07,
    shadowRadius: 22,
    elevation: 5
  },
  label: {
    color: theme.text,
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 8,
    marginTop: 14
  },
  input: {
    backgroundColor: theme.input,
    borderColor: theme.border,
    borderRadius: 14,
    borderWidth: 1,
    color: theme.text,
    fontSize: 16,
    minHeight: 52,
    paddingHorizontal: 14
  },
  inputFocused: {
    borderColor: theme.primary,
    backgroundColor: theme.white
  },
  messageBoxError: {
    backgroundColor: theme.dangerSoft,
    borderRadius: 14,
    marginTop: 18,
    padding: 12
  },
  messageBoxSuccess: {
    backgroundColor: theme.primarySoft,
    borderRadius: 14,
    marginTop: 18,
    padding: 12
  },
  duplicateBox: {
    backgroundColor: theme.warningSoft,
    borderColor: theme.warning,
    borderRadius: 14,
    borderWidth: 1,
    marginTop: 18,
    padding: 14
  },
  duplicateTitle: {
    color: theme.warning,
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 4
  },
  duplicateSubtitle: {
    color: theme.text,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 12
  },
  duplicateActions: {
    flexDirection: "row",
    gap: 10
  },
  duplicateButton: {
    backgroundColor: theme.primary,
    borderRadius: 10,
    flex: 1,
    paddingVertical: 10,
    alignItems: "center"
  },
  duplicateButtonText: {
    color: theme.white,
    fontSize: 13,
    fontWeight: "800"
  },
  duplicateButtonSecondary: {
    backgroundColor: theme.surface,
    borderColor: theme.border,
    borderRadius: 10,
    borderWidth: 1,
    flex: 1,
    paddingVertical: 10,
    alignItems: "center"
  },
  duplicateButtonSecondaryText: {
    color: theme.text,
    fontSize: 13,
    fontWeight: "700"
  },
  errorText: {
    color: theme.danger,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20
  },
  successText: {
    color: theme.primaryDark,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20
  },
  submitButton: {
    marginTop: 20
  }
});
