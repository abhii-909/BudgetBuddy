import { router, useLocalSearchParams } from "expo-router";
import { useState } from "react";
import {
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
import { useTheme } from "../src/hooks/useTheme";
import { ColorTheme } from "../src/constants/theme";
import { requestPasswordReset } from "../src/services/authService";

const isValidEmail = (email: string) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

export default function ForgotPasswordScreen() {
  const { theme } = useTheme();
  const styles = getStyles(theme);
  const params = useLocalSearchParams<{ email?: string }>();
  const initialEmail = typeof params.email === "string" ? params.email : "";

  const [email, setEmail] = useState(initialEmail);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const handleSendReset = async () => {
    const trimmed = email.trim();
    setErrorMessage("");

    if (!trimmed) {
      setErrorMessage("Please enter your email address.");
      return;
    }

    if (!isValidEmail(trimmed)) {
      setErrorMessage("Please enter a valid email address.");
      return;
    }

    setLoading(true);

    const { error } = await requestPasswordReset(trimmed);

    setLoading(false);

    if (error) {
      setErrorMessage(error);
      return;
    }

    // Phase 5 requirements: Do not reveal whether an account exists.
    setSubmitted(true);
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
                router.replace("/login");
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
            <Text style={styles.title}>Reset Password</Text>
            <Text style={styles.subtitle}>
              Enter your account's email address and we'll send you a password reset link.
            </Text>
          </View>

          <View style={styles.formCard}>
            {submitted ? (
              <View style={styles.successContainer}>
                <View style={styles.messageBoxSuccess}>
                  <Text style={styles.successTitle}>Check Your Email</Text>
                  <Text style={styles.successText}>
                    If an account exists with this email, we've sent you a password reset link.
                  </Text>
                </View>

                <Pressable
                  onPress={() => router.replace("/login")}
                  style={styles.backToLoginButton}
                >
                  <Text style={styles.backToLoginText}>Back to Login</Text>
                </Pressable>
              </View>
            ) : (
              <>
                <Text style={styles.label}>Email Address</Text>
                <TextInput
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  onChangeText={setEmail}
                  onFocus={() => setIsFocused(true)}
                  onBlur={() => setIsFocused(false)}
                  placeholder="you@example.com"
                  placeholderTextColor={theme.textMuted}
                  style={[styles.input, isFocused && styles.inputFocused]}
                  value={email}
                />

                {errorMessage ? (
                  <View style={styles.messageBoxError}>
                    <Text style={styles.errorText}>{errorMessage}</Text>
                  </View>
                ) : null}

                <CustomButton
                  disabled={loading}
                  onPress={handleSendReset}
                  style={styles.submitButton}
                  title={loading ? "Sending Link..." : "Send Reset Link"}
                />

                <Pressable
                  onPress={() => router.replace("/login")}
                  style={styles.cancelLink}
                >
                  <Text style={styles.cancelText}>
                    Remember your password? <Text style={styles.cancelTextStrong}>Login</Text>
                  </Text>
                </Pressable>
              </>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const getStyles = (theme: ColorTheme) =>
  StyleSheet.create({
    safeArea: {
      backgroundColor: theme.background,
      flex: 1
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
    title: {
      color: theme.text,
      fontSize: 28,
      fontWeight: "900",
      marginBottom: 8,
      textAlign: "center"
    },
    subtitle: {
      color: theme.textMuted,
      fontSize: 15,
      lineHeight: 22,
      maxWidth: 320,
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
      marginTop: 4
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
      backgroundColor: theme.surface
    },
    messageBoxError: {
      backgroundColor: theme.dangerSoft,
      borderRadius: 14,
      marginTop: 18,
      padding: 12
    },
    errorText: {
      color: theme.danger,
      fontSize: 14,
      fontWeight: "700",
      lineHeight: 20
    },
    successContainer: {
      paddingVertical: 8
    },
    messageBoxSuccess: {
      backgroundColor: theme.primarySoft,
      borderRadius: 14,
      padding: 16,
      marginBottom: 20
    },
    successTitle: {
      color: theme.primaryDark,
      fontSize: 16,
      fontWeight: "800",
      marginBottom: 6
    },
    successText: {
      color: theme.primaryDark,
      fontSize: 14,
      fontWeight: "600",
      lineHeight: 20
    },
    backToLoginButton: {
      backgroundColor: theme.primary,
      borderRadius: 14,
      paddingVertical: 14,
      alignItems: "center"
    },
    backToLoginText: {
      color: theme.white,
      fontSize: 16,
      fontWeight: "800"
    },
    submitButton: {
      marginTop: 20
    },
    cancelLink: {
      alignItems: "center",
      marginTop: 18,
      paddingVertical: 6
    },
    cancelText: {
      color: theme.textMuted,
      fontSize: 14,
      fontWeight: "600"
    },
    cancelTextStrong: {
      color: theme.primary,
      fontWeight: "800"
    }
  });
