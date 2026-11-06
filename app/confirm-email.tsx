import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CustomButton } from "../components/CustomButton";
import { useTheme } from "../src/hooks/useTheme";
import { ColorTheme } from "../src/constants/theme";
import { resendConfirmation } from "../src/services/authService";

const COOLDOWN_SECONDS = 60;

export default function ConfirmEmailScreen() {
  const { theme } = useTheme();
  const styles = getStyles(theme);
  const params = useLocalSearchParams<{ email?: string }>();
  const email = typeof params.email === "string" ? params.email : "";

  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [message, setMessage] = useState<{ text: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => {
      setCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const handleResend = async () => {
    if (!email || cooldown > 0 || resending) return;

    setMessage(null);
    setResending(true);

    const { error } = await resendConfirmation(email);

    setResending(false);

    if (error) {
      setMessage({ text: error, type: "error" });
    } else {
      setCooldown(COOLDOWN_SECONDS);
      setMessage({
        text: "Confirmation email resent! Please check your inbox and spam folder.",
        type: "success"
      });
    }
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
            <Text style={styles.title}>Check Your Inbox</Text>
            <Text style={styles.subtitle}>
              We've sent a confirmation link to your email address. Please check your inbox and verify your account to continue.
            </Text>
          </View>

          <View style={styles.card}>
            <View style={styles.emailContainer}>
              <Text style={styles.emailLabel}>Registered Email</Text>
              <Text style={styles.emailText}>{email || "your email"}</Text>
            </View>

            {message ? (
              <View
                style={[
                  styles.messageBox,
                  message.type === "error" ? styles.messageBoxError : styles.messageBoxSuccess
                ]}
              >
                <Text
                  style={[
                    styles.messageText,
                    message.type === "error" ? styles.errorText : styles.successText
                  ]}
                >
                  {message.text}
                </Text>
              </View>
            ) : null}

            <CustomButton
              disabled={cooldown > 0 || resending}
              onPress={handleResend}
              style={styles.resendButton}
              title={
                resending
                  ? "Resending..."
                  : cooldown > 0
                  ? `Resend available in ${cooldown}s`
                  : "Resend Confirmation Email"
              }
              variant="secondary"
            />

            <Pressable
              onPress={() => router.replace("/login")}
              style={styles.backLink}
            >
              <Text style={styles.backLinkText}>
                Back to <Text style={styles.backLinkTextStrong}>Login</Text>
              </Text>
            </Pressable>
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
    card: {
      backgroundColor: theme.card,
      borderRadius: 24,
      padding: 20,
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.07,
      shadowRadius: 22,
      elevation: 5
    },
    emailContainer: {
      backgroundColor: theme.surface,
      borderColor: theme.border,
      borderRadius: 14,
      borderWidth: 1,
      marginBottom: 16,
      padding: 14
    },
    emailLabel: {
      color: theme.textMuted,
      fontSize: 12,
      fontWeight: "700",
      marginBottom: 4,
      textTransform: "uppercase"
    },
    emailText: {
      color: theme.text,
      fontSize: 16,
      fontWeight: "800"
    },
    messageBox: {
      borderRadius: 14,
      marginBottom: 16,
      padding: 12
    },
    messageBoxError: {
      backgroundColor: theme.dangerSoft
    },
    messageBoxSuccess: {
      backgroundColor: theme.primarySoft
    },
    messageText: {
      fontSize: 14,
      fontWeight: "700",
      lineHeight: 20
    },
    errorText: {
      color: theme.danger
    },
    successText: {
      color: theme.primaryDark
    },
    resendButton: {
      marginBottom: 16
    },
    backLink: {
      alignItems: "center",
      paddingVertical: 8
    },
    backLinkText: {
      color: theme.textMuted,
      fontSize: 14,
      fontWeight: "600"
    },
    backLinkTextStrong: {
      color: theme.primary,
      fontWeight: "800"
    }
  });
