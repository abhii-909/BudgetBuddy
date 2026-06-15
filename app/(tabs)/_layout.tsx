import { Ionicons } from "@expo/vector-icons";
import { Redirect, Tabs } from "expo-router";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { colors } from "../../constants/colors";
import { useAuth } from "../../src/hooks/useAuth";

type TabIconName = keyof typeof Ionicons.glyphMap;

function tabIcon(name: TabIconName) {
  return ({ color, size }: { color: string; size: number }) => (
    <Ionicons color={color} name={name} size={size} />
  );
}

export default function TabsLayout() {
  const { loading, session } = useAuth();

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (!session) {
    return <Redirect href="/login" />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "700"
        },
        tabBarStyle: {
          backgroundColor: colors.white,
          borderTopColor: colors.border,
          height: 82,
          paddingBottom: 22,
          paddingTop: 10
        }
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{ tabBarIcon: tabIcon("home"), title: "Dashboard" }}
      />
      <Tabs.Screen
        name="groups"
        options={{ tabBarIcon: tabIcon("people"), title: "Groups" }}
      />
      <Tabs.Screen
        name="add-expense"
        options={{ tabBarIcon: tabIcon("add-circle"), title: "Add" }}
      />
      <Tabs.Screen
        name="history"
        options={{ tabBarIcon: tabIcon("receipt"), title: "History" }}
      />
      <Tabs.Screen
        name="profile"
        options={{ tabBarIcon: tabIcon("person"), title: "Profile" }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    alignItems: "center",
    backgroundColor: colors.background,
    flex: 1,
    justifyContent: "center"
  }
});
