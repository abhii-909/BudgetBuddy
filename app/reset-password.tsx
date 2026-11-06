import { router } from "expo-router";
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
import { useAuth } from "../src/hooks/useAuth";
import { useTheme } from "../src/hooks/useTheme";
import { ColorTheme } from "../src/constants/theme";
import { updatePassword } from "../src/services/authService";

const MIN_PASSWORD_LENGTH = 6;

export default function ResetPasswordScreen() {
  const { clearPasswordRecovery, logout } = useAuth();
  const { theme } = useTheme();
  const styles = getStyles(theme);

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [isSuccess, setIsSuccess] = useState(false);

  const [focusedField, setFocusedField] = useState<"password" | "confirmPassword" | null>(null);

  const handleUpdatePassword = async () => {
    setErrorMessage("");

    if (!password || !confirmPassword) {
      setErrorMessage("Please fill in both fields.");
      return;
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      setErrorMessage(`Password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("Passwords do not match.");
      return;
    }

    setLoading(true);

    const { error } = await updatePassword(password);

    setLoading(false);

    if (error) {
      setErrorMessage(error);
      return;
    }

    setIsSuccess(true);
    clearPasswordRecovery();
  };

  const handleGoToLogin = async () => {
    // Sign out of the temporary password recovery session so user logs in fresh
    await logout();
    router.replace("/login");
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
          <View style={styles.header}>
            <View style={styles.logo}>
              <Image source={require("../assets/icon.png")} style={styles.logoImage} />
            </View>
            <Text style={styles.title}>New Password</Text>
            <Text style={styles.subtitle}>
              Create a new secure password for your BudgetBuddy account.
            </Text>
          </View>

          <View style={styles.formCard}>
            {isSuccess ? (
              <View style={styles.successContainer}>
                <View style={styles.messageBoxSuccess}>
                  <Text style={styles.successTitle}>Password Updated!</Text>
                  <Text style={styles.successText}>
                    Your password has been updated successfully. You can now log in with your new password.
                  </Text>
                </View>

                <CustomButton
                  onPress={handleGoToLogin}
                  style={styles.submitButton}
                  title="Go to Login"
                />
              </View>
            ) : (
              <>
                <Text style={styles.label}>New Password</Text>
                <TextInput
                  onChangeText={setPassword}
                  onFocus={() => setFocusedField("password")}
                  onBlur={() => setFocusedField(null)}
                  placeholder="Enter new password"
                  placeholderTextColor={theme.textMuted}
                  secureTextEntry
                  style={[styles.input, focusedField === "password" && styles.inputFocused]}
                  value={password}
                />

                <Text style={styles.label}>Confirm New Password</Text>
                <TextInput
                  onChangeText={setConfirmPassword}
                  onFocus={() => setFocusedField("confirmPassword")}
                  onBlur={() => setFocusedField(null)}
                  placeholder="Re-enter new password"
                  placeholderTextColor={theme.textMuted}
                  secureTextEntry
                  style={[styles.input, focusedField === "confirmPassword" && styles.inputFocused]}
                  value={confirmPassword}
                />

                {errorMessage ? (
                  <View style={styles.messageBoxError}>
                    <Text style={styles.errorText}>{errorMessage}</Text>
                  </View>
                ) : null}

                <CustomButton
                  disabled={loading}
                  onPress={handleUpdatePassword}
                  style={styles.submitButton}
                  title={loading ? "Updating..." : "Update Password"}
                />

                <Pressable
                  onPress={handleGoToLogin}
                  style={styles.cancelLink}
                >
                  <Text style={styles.cancelText}>
                    Cancel and return to <Text style={styles.cancelTextStrong}>Login</Text>
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
      marginBottom: 16
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
