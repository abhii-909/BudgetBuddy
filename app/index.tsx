import { Redirect, router } from "expo-router";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CustomButton } from "../components/CustomButton";
import { colors } from "../constants/colors";
import { useAuth } from "../src/hooks/useAuth";

export default function WelcomeScreen() {
  const { session, loading } = useAuth();

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
          <ActivityIndicator color={colors.primary} size="large" />
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
            <Text style={styles.logoText}>💰</Text>
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
    backgroundColor: colors.primary,
    borderRadius: 34,
    height: 88,
    justifyContent: "center",
    marginBottom: 24,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    width: 88
  },
  logoText: {
    color: colors.white,
    fontSize: 28,
    fontWeight: "900"
  },
  appName: {
    color: colors.text,
    fontSize: 38,
    fontWeight: "900",
    marginBottom: 10
  },
  tagline: {
    color: colors.textMuted,
    fontSize: 18,
    fontWeight: "600"
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 28,
    padding: 22,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.08,
    shadowRadius: 24,
    elevation: 5
  },
  cardTitle: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "900",
    lineHeight: 28,
    marginBottom: 8
  },
  cardText: {
    color: colors.textMuted,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 22
  },
  secondaryButton: {
    marginTop: 12
  }
});
