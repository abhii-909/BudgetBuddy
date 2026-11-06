import { router, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../src/hooks/useAuth";
import { useTheme } from "../src/hooks/useTheme";
import { ColorTheme } from "../src/constants/theme";

export default function AuthCallbackScreen() {
  const { theme } = useTheme();
  const styles = getStyles(theme);
  const { session, isPasswordRecovery } = useAuth();
  const params = useLocalSearchParams<{ type?: string; error?: string; error_description?: string }>();

  useEffect(() => {
    // If an error is returned in URL parameters
    if (params.error || params.error_description) {
      console.error("[AuthCallback] Error in callback params:", params.error, params.error_description);
      router.replace("/login");
      return;
    }

    // If password recovery link was opened
    if (params.type === "recovery" || isPasswordRecovery) {
      router.replace("/reset-password");
      return;
    }

    // If already authenticated with active session
    if (session) {
      router.replace("/(tabs)/dashboard");
    }
  }, [session, isPasswordRecovery, params]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <ActivityIndicator color={theme.primary} size="large" />
        <Text style={styles.title}>Verifying your account...</Text>
        <Text style={styles.subtitle}>Please wait while we log you into BudgetBuddy.</Text>
      </View>
    </SafeAreaView>
  );
}

const getStyles = (theme: ColorTheme) =>
  StyleSheet.create({
    safeArea: {
      backgroundColor: theme.background,
      flex: 1
    },
    container: {
      alignItems: "center",
      flex: 1,
      justifyContent: "center",
      padding: 24
    },
    title: {
      color: theme.text,
      fontSize: 18,
      fontWeight: "800",
      marginTop: 20,
      textAlign: "center"
    },
    subtitle: {
      color: theme.textMuted,
      fontSize: 14,
      marginTop: 8,
      textAlign: "center"
    }
  });
