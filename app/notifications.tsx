import { Ionicons } from "@expo/vector-icons";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { EmptyState } from "../components/EmptyState";
import { useAuth } from "../src/hooks/useAuth";
import { useTheme } from "../src/hooks/useTheme";
import { ColorTheme } from "../src/constants/theme";
import {
  getUserNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
  type Notification,
} from "../src/services/notificationService";

function getNotificationIcon(type: string): string {
  switch (type) {
    case "expense_added":
      return "🧾";
    case "settlement_recorded":
      return "💰";
    case "member_joined":
      return "👥";
    default:
      return "🔔";
  }
}

export default function NotificationsScreen() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const styles = getStyles(theme);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchNotifications = async (isRefreshing = false) => {
    if (!user) return;
    if (isRefreshing) setRefreshing(true);
    else setLoading(true);

    const { data, error } = await getUserNotifications(user.id);
    if (data) {
      setNotifications(data);
    }

    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    fetchNotifications();
  }, [user]);

  const handleNotificationPress = async (notification: Notification) => {
    // Mark as read in background/optimistically
    if (!notification.is_read) {
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, is_read: true } : n))
      );
      await markNotificationAsRead(notification.id);
    }

    // Navigate to related screen
    if (notification.related_expense_id && notification.related_group_id) {
      router.push({
        pathname: "/expense-details",
        params: {
          expenseId: notification.related_expense_id,
          groupId: notification.related_group_id,
        },
      });
    } else if (notification.related_settlement_id && notification.related_group_id) {
      router.push({
        pathname: "/group-details",
        params: {
          id: notification.related_group_id,
          initialTab: "settlements",
        },
      });
    } else if (notification.related_group_id) {
      router.push({
        pathname: "/group-details",
        params: {
          id: notification.related_group_id,
        },
      });
    }
  };

  const handleMarkAllRead = async () => {
    if (!user || notifications.length === 0) return;

    // Optimistic update
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
    await markAllNotificationsAsRead(user.id);
  };

  const hasUnread = notifications.some((n) => !n.is_read);

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
        >
          <Ionicons name="arrow-back" size={24} color={theme.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Notifications</Text>
        <Pressable
          disabled={!hasUnread}
          onPress={handleMarkAllRead}
          style={({ pressed }) => [
            styles.markAllButton,
            pressed && styles.pressed,
          ]}
        >
          <Text style={[styles.markAllText, !hasUnread && styles.markAllDisabledText]}>
            Mark all read
          </Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(item) => item.id}
          refreshing={refreshing}
          onRefresh={() => fetchNotifications(true)}
          contentContainerStyle={styles.listContent}
          ListEmptyComponent={
            <EmptyState
              icon="🔔"
              title="All caught up!"
              description="We'll notify you when someone adds an expense or records a settlement."
            />
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => handleNotificationPress(item)}
              style={({ pressed }) => [
                styles.notificationRow,
                !item.is_read && styles.unreadRow,
                pressed && styles.pressed,
              ]}
            >
              <View style={styles.iconContainer}>
                <Text style={styles.icon}>{getNotificationIcon(item.type)}</Text>
              </View>
              <View style={styles.detailsContainer}>
                <View style={styles.titleRow}>
                  <Text
                    style={[styles.titleText, !item.is_read && styles.unreadText]}
                    numberOfLines={1}
                  >
                    {item.title}
                  </Text>
                  {!item.is_read && <View style={styles.unreadDot} />}
                </View>
                <Text
                  style={[styles.messageText, !item.is_read && styles.unreadMessageText]}
                >
                  {item.message}
                </Text>
                <Text style={styles.timeText}>
                  {new Date(item.created_at).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </Text>
              </View>
            </Pressable>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const getStyles = (theme: ColorTheme) => StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.background,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
    backgroundColor: theme.card,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "900",
    color: theme.text,
    flex: 1,
    marginLeft: 16,
  },
  markAllButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  markAllText: {
    fontSize: 13,
    fontWeight: "700",
    color: theme.primaryDark,
  },
  markAllDisabledText: {
    color: theme.textMuted,
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  notificationRow: {
    flexDirection: "row",
    padding: 16,
    borderRadius: 16,
    backgroundColor: theme.card,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: "flex-start",
  },
  unreadRow: {
    borderColor: theme.primarySoft,
    backgroundColor: theme.primarySoft,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: theme.input,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  icon: {
    fontSize: 18,
  },
  detailsContainer: {
    flex: 1,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  titleText: {
    fontSize: 14,
    fontWeight: "700",
    color: theme.textMuted,
    flex: 1,
  },
  unreadText: {
    color: theme.text,
    fontWeight: "900",
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: theme.primary,
    marginLeft: 8,
  },
  messageText: {
    fontSize: 13,
    color: theme.textMuted,
    lineHeight: 18,
    marginBottom: 6,
  },
  unreadMessageText: {
    color: theme.text,
  },
  timeText: {
    fontSize: 11,
    color: theme.textMuted,
  },
  pressed: {
    opacity: 0.7,
  },
  disabled: {
    opacity: 0.4,
  },
});
