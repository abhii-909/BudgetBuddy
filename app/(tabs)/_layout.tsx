import { Ionicons } from "@expo/vector-icons";
import { Redirect, Tabs } from "expo-router";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuth } from "../../src/hooks/useAuth";
import { useTheme } from "../../src/hooks/useTheme";

type TabIconName = keyof typeof Ionicons.glyphMap;

function tabIcon(name: TabIconName) {
  return ({ color, size }: { color: string; size: number }) => (
    <Ionicons color={color} name={name} size={size} />
  );
}

export default function TabsLayout() {
  const { loading, session } = useAuth();
  const { theme, isDark } = useTheme();
  const insets = useSafeAreaInsets();

  if (loading) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: theme.background }]}>
        <ActivityIndicator color={theme.primary} size="large" />
      </View>
    );
  }

  if (!session) {
    return <Redirect href="/login" />;
  }

  const bottomInset = insets.bottom || 12;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.textMuted,
        tabBarHideOnKeyboard: true,
        tabBarItemStyle: {
          borderRadius: 12,
          marginHorizontal: 4,
          marginVertical: 6
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "700"
        },
        tabBarStyle: {
          backgroundColor: theme.card,
          borderTopColor: theme.border,
          height: 60 + bottomInset,
          paddingBottom: bottomInset,
          paddingHorizontal: 6,
          paddingTop: 6,
          shadowColor: theme.shadow,
          shadowOffset: { width: 0, height: -8 },
          shadowOpacity: isDark ? 0.28 : 0.08,
          shadowRadius: 18
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
    flex: 1,
    justifyContent: "center"
  }
});
