import { Redirect, router } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
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
import { colors } from "../constants/colors";
import { useAuth } from "../src/hooks/useAuth";

const MIN_PASSWORD_LENGTH = 6;

const isValidEmail = (email: string) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

export default function SignupScreen() {
  const { signup, session, loading } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loadingSignup, setLoadingSignup] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [focusedField, setFocusedField] = useState<"fullName" | "email" | "password" | "confirmPassword" | null>(null);

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.primary} size="large" />
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

    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    setLoadingSignup(true);

    const { error } = await signup(fullName.trim(), email.trim(), password);

    setLoadingSignup(false);

    if (error) {
      setErrorMessage(error);
      return;
    }

    setSuccessMessage(
      "Account created successfully. Please check your email to confirm your account."
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
          >
            <Text style={styles.backText}>← Back</Text>
          </Pressable>

          <View style={styles.header}>
            <View style={styles.logo}>
              <Text style={styles.logoText}>BB</Text>
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
              placeholderTextColor={colors.textMuted}
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
              placeholderTextColor={colors.textMuted}
              style={[styles.input, focusedField === "email" && styles.inputFocused]}
              value={email}
            />

            <Text style={styles.label}>Password</Text>
            <TextInput
              onChangeText={setPassword}
              onFocus={() => setFocusedField("password")}
              onBlur={() => setFocusedField(null)}
              placeholder="Create a password"
              placeholderTextColor={colors.textMuted}
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
              placeholderTextColor={colors.textMuted}
              secureTextEntry
              style={[styles.input, focusedField === "confirmPassword" && styles.inputFocused]}
              value={confirmPassword}
            />


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

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.background,
    flex: 1
  },
  loadingContainer: {
    alignItems: "center",
    backgroundColor: colors.background,
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
    color: colors.primaryDark,
    fontSize: 15,
    fontWeight: "800"
  },
  header: {
    alignItems: "center",
    marginBottom: 24
  },
  logo: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 24,
    height: 64,
    justifyContent: "center",
    marginBottom: 18,
    width: 64
  },
  logoText: {
    color: colors.white,
    fontSize: 20,
    fontWeight: "900"
  },
  title: {
    color: colors.text,
    fontSize: 30,
    fontWeight: "900",
    marginBottom: 8
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
    maxWidth: 300,
    textAlign: "center"
  },
  formCard: {
    backgroundColor: colors.card,
    borderRadius: 24,
    padding: 20,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.07,
    shadowRadius: 22,
    elevation: 5
  },
  label: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 8,
    marginTop: 14
  },
  input: {
    backgroundColor: colors.input,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    color: colors.text,
    fontSize: 16,
    minHeight: 52,
    paddingHorizontal: 14
  },
  inputFocused: {
    borderColor: colors.primary,
    backgroundColor: colors.white
  },

  messageBoxError: {
    backgroundColor: colors.dangerSoft,
    borderRadius: 14,
    marginTop: 18,
    padding: 12
  },
  messageBoxSuccess: {
    backgroundColor: colors.primarySoft,
    borderRadius: 14,
    marginTop: 18,
    padding: 12
  },
  errorText: {
    color: colors.danger,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20
  },
  successText: {
    color: colors.primaryDark,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20
  },
  submitButton: {
    marginTop: 20
  }
});
