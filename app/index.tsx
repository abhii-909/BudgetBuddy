import { Redirect, router } from "expo-router";
import { ActivityIndicator, Image, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CustomButton } from "../components/CustomButton";
import { useAuth } from "../src/hooks/useAuth";
import { useTheme } from "../src/hooks/useTheme";
import { ColorTheme } from "../src/constants/theme";

export default function WelcomeScreen() {
  const { session, loading } = useAuth();
  const { theme } = useTheme();
  const styles = getStyles(theme);

  const openLogin = () => {
    router.push("/login");
  };

  const openSignup = () => {
    router.push("/signup");
  };

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

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <View style={styles.hero}>
          <View style={styles.logo}>
            <Image source={require("../assets/icon.png")} style={styles.logoImage} />
          </View>
          <Text style={styles.appName}>BudgetBuddy</Text>
          <Text style={styles.tagline}>Split expenses with friends</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Track shared spending without the math.</Text>
          <Text style={styles.cardText}>
            Create groups, add bills, and see who owes what in one simple place.
          </Text>
          <CustomButton title="Login" onPress={openLogin} />
          <CustomButton
            title="Sign Up"
            onPress={openSignup}
            style={styles.secondaryButton}
            variant="ghost"
          />
        </View>
      </View>
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
  container: {
    flex: 1,
    justifyContent: "space-between",
    padding: 24
  },
  hero: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center"
  },
  logo: {
    alignItems: "center",
    backgroundColor: theme.primary,
    borderRadius: 34,
    height: 88,
    justifyContent: "center",
    marginBottom: 24,
    shadowColor: theme.primary,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    width: 88
  },
  logoImage: {
    width: "100%",
    height: "100%",
    borderRadius: 34
  },
  logoText: {
    color: theme.white,
    fontSize: 28,
    fontWeight: "900"
  },
  appName: {
    color: theme.text,
    fontSize: 38,
    fontWeight: "900",
    marginBottom: 10
  },
  tagline: {
    color: theme.textMuted,
    fontSize: 18,
    fontWeight: "600"
  },
  card: {
    backgroundColor: theme.card,
    borderRadius: 28,
    padding: 22,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 5
  },
  cardTitle: {
    color: theme.text,
    fontSize: 22,
    fontWeight: "900",
    lineHeight: 28,
    marginBottom: 8
  },
  cardText: {
    color: theme.textMuted,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 22
  },
  secondaryButton: {
    marginTop: 12
  }
});
