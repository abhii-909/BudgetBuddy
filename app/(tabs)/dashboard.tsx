import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Header } from "../../components/Header";
import { EmptyState } from "../../components/EmptyState";
import { useAuth } from "../../src/hooks/useAuth";
import {
  getDashboardData,
  type ActivityItem,
  type ActivityType,
  type DashboardData,
  type GroupSummary,
  type PendingAction,
} from "../../src/services/dashboardService";
import { getUnreadNotificationsCount } from "../../src/services/notificationService";
import { formatCurrency } from "../../src/utils/format";
import { Avatar } from "../../components/Avatar";
import { useTheme } from "../../src/hooks/useTheme";
import { ColorTheme } from "../../src/constants/theme";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(timestamp: string): string {
  const now = new Date();
  const then = new Date(timestamp);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return then.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function getActivityConfig(theme: ColorTheme, isDark: boolean): Record<ActivityType, { icon: string; bg: string; color: string }> {
  return {
    expense: { icon: "₹", bg: isDark ? theme.card : theme.secondarySoft, color: theme.secondary },
    settlement_pending: { icon: "⏳", bg: theme.warningSoft, color: theme.warning },
    settlement_confirmed: { icon: "✓", bg: theme.primarySoft, color: theme.primary },
    settlement_rejected: { icon: "✕", bg: theme.dangerSoft, color: theme.danger },
    group_created: { icon: "👥", bg: isDark ? theme.card : theme.primarySoft, color: theme.primary },
  };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function DashboardHero({
  greeting,
  firstName,
  data,
  onAvatarPress,
  avatarUrl,
  fullName,
  email,
  unreadCount,
}: {
  greeting: string;
  firstName: string;
  data: DashboardData;
  onAvatarPress?: () => void;
  avatarUrl?: string | null;
  fullName: string;
  email: string;
  unreadCount: number;
}) {
  const { theme } = useTheme();
  const { heroStyles } = getStyles(theme);
  const netPositive = data.netBalance >= 0;
  return (
    <View style={heroStyles.container}>
      {/* Header Greeting Row */}
      <View style={heroStyles.headerRow}>
        <View style={heroStyles.headerTextContent}>
          <Text style={heroStyles.greeting}>{greeting},</Text>
          <Text style={heroStyles.name} numberOfLines={1}>{firstName} 👋</Text>
        </View>
        <View style={heroStyles.actionsRow}>
          <Pressable
            onPress={() => router.push("/notifications")}
            style={({ pressed }) => [
              heroStyles.notificationBell,
              pressed && heroStyles.pressed,
            ]}
          >
            <Ionicons name="notifications-outline" size={24} color={theme.text} />
            {unreadCount > 0 && (
              <View style={heroStyles.badge}>
                <Text style={heroStyles.badgeText}>
                  {unreadCount > 99 ? "99+" : unreadCount}
                </Text>
              </View>
            )}
          </Pressable>
          <Avatar
            avatarUrl={avatarUrl}
            fullName={fullName}
            email={email}
            size="medium"
            onPress={onAvatarPress}
          />
        </View>
      </View>

      {/* Unified Dashboard Hero Section Card */}
      <View style={[heroStyles.card, netPositive ? heroStyles.cardPositive : heroStyles.cardNegative]}>
        <Text style={heroStyles.netLabel}>NET BALANCE</Text>
        <Text style={[heroStyles.netAmount, { color: netPositive ? theme.primaryDark : theme.danger }]}>
          {netPositive ? "+" : ""}{formatCurrency(data.netBalance)}
        </Text>
        <Text style={heroStyles.netHint}>
          {netPositive ? "Overall, you are owed money" : "Overall, you owe money"}
        </Text>

        <View style={heroStyles.divider} />

        <View style={heroStyles.bottomRow}>
          <View style={heroStyles.subCard}>
            <Text style={heroStyles.subLabel}>Owed to You</Text>
            <Text style={[heroStyles.subAmount, { color: theme.primaryDark }]}>
              {formatCurrency(data.totalOwedToMe)}
            </Text>
          </View>
          <View style={heroStyles.verticalDivider} />
          <View style={heroStyles.subCard}>
            <Text style={heroStyles.subLabel}>You Owe</Text>
            <Text style={[heroStyles.subAmount, { color: theme.danger }]}>
              {formatCurrency(data.totalOwed)}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

function PendingActionsWidget({ actions }: { actions: PendingAction[] }) {
  if (actions.length === 0) return null;
  const { theme } = useTheme();
  const { pendingStyles } = getStyles(theme);
  return (
    <View style={pendingStyles.container}>
      <View style={pendingStyles.header}>
        <Text style={pendingStyles.icon}>⏳</Text>
        <View style={pendingStyles.headerText}>
          <Text style={pendingStyles.title}>Pending Approvals</Text>
          <Text style={pendingStyles.subtitle}>
            {actions.length} settlement{actions.length > 1 ? "s" : ""} awaiting your approval
          </Text>
        </View>
        <View style={pendingStyles.badge}>
          <Text style={pendingStyles.badgeText}>{actions.length}</Text>
        </View>
      </View>
      {actions.map((action) => (
        <Pressable
          key={action.settlementId}
          onPress={() => router.push({ pathname: "/group-details", params: { id: action.groupId } })}
          style={({ pressed }) => [pendingStyles.row, pressed && pendingStyles.rowPressed]}
        >
          <View style={pendingStyles.rowLeft}>
            <Text style={pendingStyles.payerName}>{action.payerName}</Text>
            <Text style={pendingStyles.groupName}>in {action.groupName}</Text>
          </View>
          <View style={pendingStyles.rowRight}>
            <Text style={pendingStyles.amount}>{formatCurrency(action.amount)}</Text>
            <Text style={pendingStyles.arrow}>›</Text>
          </View>
        </Pressable>
      ))}
    </View>
  );
}

function GroupCard({ summary }: { summary: GroupSummary }) {
  const { theme } = useTheme();
  const { groupCardStyles } = getStyles(theme);
  const hasBalance = Math.abs(summary.userNetBalance) > 0.01;
  const isPositive = summary.userNetBalance > 0;
  const formattedLastActivity = summary.lastActivityAt ? relativeTime(summary.lastActivityAt) : null;

  return (
    <Pressable
      onPress={() => router.push({ pathname: "/group-details", params: { id: summary.groupId } })}
      style={({ pressed }) => [
        groupCardStyles.card,
        pressed && groupCardStyles.cardPressed,
      ]}
    >
      <View style={groupCardStyles.topRow}>
        <View style={groupCardStyles.titleContainer}>
          <View style={groupCardStyles.avatar}>
            <Text style={groupCardStyles.avatarText}>{summary.groupName.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={groupCardStyles.nameContainer}>
            <Text style={groupCardStyles.name} numberOfLines={1}>{summary.groupName}</Text>
            <Text style={groupCardStyles.memberCount}>
              {summary.memberCount} member{summary.memberCount !== 1 ? "s" : ""} · {formatCurrency(summary.totalExpenses)} total
            </Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
      </View>

      <View style={groupCardStyles.divider} />

      <View style={groupCardStyles.bottomRow}>
        <View style={groupCardStyles.activityContainer}>
          <Text style={groupCardStyles.activityLabel}>LAST ACTIVITY</Text>
          <Text style={groupCardStyles.activityTime}>
            {formattedLastActivity || "No activity yet"}
          </Text>
        </View>
        <View style={groupCardStyles.balanceContainer}>
          <Text style={groupCardStyles.balanceLabel}>YOUR BALANCE</Text>
          {hasBalance ? (
            <Text style={[groupCardStyles.balanceAmount, { color: isPositive ? theme.primary : theme.danger }]}>
              {isPositive ? "+" : ""}{formatCurrency(summary.userNetBalance)}
            </Text>
          ) : (
            <Text style={groupCardStyles.settledText}>Settled ✓</Text>
          )}
        </View>
      </View>
    </Pressable>
  );
}


function ActivityRow({ item }: { item: ActivityItem }) {
  const { theme, isDark } = useTheme();
  const { activityStyles } = getStyles(theme);
  const config = getActivityConfig(theme, isDark)[item.type];
  return (
    <Pressable
      onPress={() => router.push({ pathname: "/group-details", params: { id: item.groupId } })}
      style={({ pressed }) => [activityStyles.row, pressed && activityStyles.rowPressed]}
    >
      <View style={[activityStyles.iconBox, { backgroundColor: config.bg }]}>
        <Text style={[activityStyles.iconText, { color: config.color }]}>{config.icon}</Text>
      </View>
      <View style={activityStyles.content}>
        <Text style={activityStyles.title} numberOfLines={1}>{item.title}</Text>
        <Text style={activityStyles.subtitle} numberOfLines={1}>{item.subtitle}</Text>
      </View>
      <View style={activityStyles.right}>
        {item.amount !== null && (
          <Text style={activityStyles.amount}>{formatCurrency(item.amount)}</Text>
        )}
        <Text style={activityStyles.time}>{relativeTime(item.timestamp)}</Text>
      </View>
    </Pressable>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function DashboardScreen() {
  const { user, profile } = useAuth();
  const { theme, isDark } = useTheme();
  const allStyles = getStyles(theme);
  const { styles, skeletonStyles } = allStyles;
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [firstName, setFirstName] = useState("there");
  const [unreadCount, setUnreadCount] = useState(0);

  const loadDashboard = async (isRefreshing = false) => {
    if (!user) return;
    if (isRefreshing) setRefreshing(true);
    else setLoading(true);

    // Resolve first name
    const metaName = (profile?.full_name || user.user_metadata?.full_name)?.trim().split(" ")[0];
    if (metaName) setFirstName(metaName);

    const dashStart = Date.now();
    const [dashRes, countRes] = await Promise.all([
      getDashboardData(user.id),
      getUnreadNotificationsCount(user.id)
    ]);

    if (dashRes.data) setData(dashRes.data);
    setUnreadCount(countRes.count || 0);

    console.log(`[BudgetBuddy] Dashboard Load Time took: ${Date.now() - dashStart}ms`);

    setLoading(false);
    setRefreshing(false);

    if (typeof global !== "undefined" && (global as any).startupStartTime) {
      const duration = Date.now() - (global as any).startupStartTime;
      console.log(`[BudgetBuddy] TOTAL STARTUP TIME UNTIL DASHBOARD USABLE: ${duration}ms`);
      (global as any).startupStartTime = null; // Clear it to only log once on cold startup
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadDashboard();
    }, [user, profile])
  );

  const onRefresh = () => loadDashboard(true);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 17) return "Good afternoon";
    return "Good evening";
  })();

  if (loading && !data) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.wrapper}>
          <ScrollView contentContainerStyle={styles.content} scrollEnabled={false}>
            <View style={skeletonStyles.headerRow}>
              <View style={skeletonStyles.headerText}>
                <View style={skeletonStyles.skeletonLineShort} />
                <View style={skeletonStyles.skeletonLineLong} />
              </View>
              <View style={skeletonStyles.avatarCircle} />
            </View>
            <View style={skeletonStyles.heroCard} />
            <View style={skeletonStyles.row}>
              <View style={skeletonStyles.sideCard} />
              <View style={skeletonStyles.sideCard} />
            </View>
            <View style={skeletonStyles.sectionHeader} />
            <View style={skeletonStyles.listCard}>
              <View style={skeletonStyles.listItem} />
              <View style={skeletonStyles.listItem} />
              <View style={skeletonStyles.listItem} />
            </View>
          </ScrollView>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.wrapper}>
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={
            <RefreshControl colors={[theme.primary]} onRefresh={onRefresh} refreshing={refreshing} />
          }
          showsVerticalScrollIndicator={false}
        >
          {/* ── A: Overall Summary / Unified Hero ───────────────────────── */}
          {data ? (
            <DashboardHero
              greeting={greeting}
              firstName={firstName}
              data={data}
              onAvatarPress={() => router.push("/(tabs)/profile")}
              avatarUrl={profile?.avatar_url}
              fullName={profile?.full_name || user?.user_metadata?.full_name || ""}
              email={profile?.email || user?.email || ""}
              unreadCount={unreadCount}
            />
          ) : (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyText}>No groups yet. Create one to get started.</Text>
            </View>
          )}

          {/* ── B: Pending Actions ───────────────────────── */}
          {data && data.pendingActions.length > 0 && (
            <>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Pending Approvals</Text>
              </View>
              <PendingActionsWidget actions={data.pendingActions} />
            </>
          )}

          {/* ── C: Active Groups ─────────────────────────── */}
          {data && data.groupSummaries.length > 0 && (
            <>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Your Groups</Text>
                <Pressable onPress={() => router.push("/(tabs)/groups")}>
                  <Text style={styles.seeAll}>See all</Text>
                </Pressable>
              </View>
              <View style={styles.groupsContainer}>
                {data.groupSummaries.slice(0, 5).map((summary) => (
                  <GroupCard key={summary.groupId} summary={summary} />
                ))}
              </View>
            </>
          )}

          {/* ── D: Recent Activity ───────────────────────── */}
          {data && data.recentActivity.length > 0 && (
            <>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Recent Activity</Text>
                <Pressable onPress={() => router.push("/(tabs)/history")}>
                  <Text style={styles.seeAll}>See all</Text>
                </Pressable>
              </View>
              <View style={styles.card}>
                {data.recentActivity.slice(0, 8).map((item) => (
                  <ActivityRow key={item.id} item={item} />
                ))}
              </View>
            </>
          )}

          {data && data.groupSummaries.length === 0 && (
            <EmptyState
              actionText="Create Group"
              description="Create a group and add expenses to see your financial summary here."
              icon="💸"
              onActionPress={() => router.push("/create-group")}
              title="No activity yet"
            />
          )}

        </ScrollView>

        {/* FAB */}
        <Pressable
          onPress={() => router.push("/(tabs)/add-expense")}
          style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
        >
          <Text style={styles.fabText}>+</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const getStyles = (theme: ColorTheme) => {
  const styles = StyleSheet.create({
    safeArea: { backgroundColor: theme.background, flex: 1 },
    wrapper: { flex: 1 },
    content: { padding: 20, paddingBottom: 160 },
    loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
    loadingText: { color: theme.textMuted, fontSize: 15, fontWeight: "600" },
    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginTop: 34,
      marginBottom: 16,
    },
    sectionTitle: { color: theme.text, fontSize: 20, fontWeight: "800", letterSpacing: -0.5 },
    seeAll: { color: theme.primaryDark, fontSize: 14, fontWeight: "700" },
    groupsContainer: {
      marginBottom: 8,
    },
    card: {
      backgroundColor: theme.card,
      borderRadius: 24,
      overflow: "hidden",
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.04,
      shadowRadius: 20,
      elevation: 2,
      borderWidth: 1,
      borderColor: theme.border,
      marginBottom: 16,
    },
    emptyCard: {
      backgroundColor: theme.card,
      borderRadius: 24,
      padding: 24,
      alignItems: "center",
      borderWidth: 1,
      borderColor: theme.border,
    },
    emptyText: { color: theme.textMuted, fontSize: 15, fontWeight: "600" },
    emptyState: { alignItems: "center", marginTop: 40, paddingHorizontal: 24 },
    emptyStateIcon: { fontSize: 48, marginBottom: 16 },
    emptyStateTitle: { color: theme.text, fontSize: 18, fontWeight: "800", marginBottom: 8 },
    emptyStateText: { color: theme.textMuted, fontSize: 14, lineHeight: 20, textAlign: "center" },
    fab: {
      position: "absolute",
      bottom: 12,
      right: 22,
      width: 64,
      height: 64,
      borderRadius: 32,
      backgroundColor: theme.primary,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: theme.primary,
      shadowOffset: { width: 0, height: 12 },
      shadowOpacity: 0.3,
      shadowRadius: 20,
      elevation: 6,
    },
    fabPressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
    fabText: { color: theme.white, fontSize: 34, fontWeight: "500", marginTop: -3 },
  });

  const heroStyles = StyleSheet.create({
    container: {
      marginBottom: 10,
    },
    headerRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 28,
    },
    actionsRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 16,
    },
    notificationBell: {
      position: "relative",
      width: 44,
      height: 44,
      borderRadius: 22,
      backgroundColor: theme.surface,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1,
      borderColor: theme.border,
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.08,
      shadowRadius: 10,
      elevation: 2,
    },
    pressed: {
      opacity: 0.75,
    },
    badge: {
      position: "absolute",
      top: -4,
      right: -4,
      backgroundColor: theme.danger,
      borderRadius: 9,
      minWidth: 18,
      height: 18,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 4,
    },
    badgeText: {
      color: theme.white,
      fontSize: 10,
      fontWeight: "900",
    },
    headerTextContent: {
      flex: 1,
      marginRight: 12,
    },
    greeting: {
      color: theme.textMuted,
      fontSize: 15,
      fontWeight: "600",
      marginBottom: 6,
    },
    name: {
      color: theme.text,
      fontSize: 34,
      fontWeight: "900",
      letterSpacing: -1,
    },
    avatar: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: theme.primarySoft,
      alignItems: "center",
      justifyContent: "center",
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.05,
      shadowRadius: 10,
      elevation: 2,
    },
    avatarPressed: {
      opacity: 0.72,
    },
    avatarText: {
      color: theme.primaryDark,
      fontSize: 18,
      fontWeight: "800",
    },
    card: {
      backgroundColor: theme.card,
      borderRadius: 28,
      padding: 28,
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 16 },
      shadowOpacity: 0.08,
      shadowRadius: 30,
      elevation: 4,
      borderWidth: 1,
      borderColor: theme.border,
      marginBottom: 24,
    },
    cardPositive: {
      borderLeftWidth: 6,
      borderLeftColor: theme.primary,
    },
    cardNegative: {
      borderLeftWidth: 6,
      borderLeftColor: theme.danger,
    },
    netLabel: {
      color: theme.textMuted,
      fontSize: 12,
      fontWeight: "800",
      letterSpacing: 1.5,
      marginBottom: 8,
    },
    netAmount: {
      fontSize: 44,
      fontWeight: "900",
      letterSpacing: -1.5,
      marginBottom: 6,
    },
    netHint: {
      color: theme.textMuted,
      fontSize: 13,
      fontWeight: "600",
    },
    divider: {
      height: 1,
      backgroundColor: theme.divider,
      marginVertical: 24,
    },
    bottomRow: {
      flexDirection: "row",
      alignItems: "center",
    },
    subCard: {
      flex: 1,
    },
    verticalDivider: {
      width: 1,
      height: 36,
      backgroundColor: theme.divider,
      marginHorizontal: 16,
    },
    subLabel: {
      color: theme.textMuted,
      fontSize: 12,
      fontWeight: "600",
      marginBottom: 6,
    },
    subAmount: {
      fontSize: 22,
      fontWeight: "800",
      letterSpacing: -0.5,
    },
  });

  const pendingStyles = StyleSheet.create({
    container: {
      backgroundColor: theme.card,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: theme.warningSoft,
      overflow: "hidden",
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.04,
      shadowRadius: 20,
      elevation: 2,
      marginBottom: 20,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      padding: 18,
      gap: 12,
      borderBottomWidth: 1,
      borderBottomColor: theme.warningSoft,
    },
    icon: { fontSize: 20 },
    headerText: { flex: 1 },
    title: { color: theme.warning, fontSize: 15, fontWeight: "800" },
    subtitle: { color: theme.textMuted, fontSize: 12, fontWeight: "500", marginTop: 2 },
    badge: {
      backgroundColor: theme.warning,
      borderRadius: 10,
      minWidth: 20,
      height: 20,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: 6,
    },
    badgeText: { color: theme.white, fontSize: 11, fontWeight: "900" },
    row: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 18,
      paddingVertical: 14,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    rowPressed: { backgroundColor: theme.warningSoft },
    rowLeft: { flex: 1 },
    payerName: { color: theme.text, fontSize: 14, fontWeight: "700" },
    groupName: { color: theme.textMuted, fontSize: 12, marginTop: 2 },
    rowRight: { flexDirection: "row", alignItems: "center", gap: 8 },
    amount: { color: theme.warning, fontSize: 14, fontWeight: "800" },
    arrow: { color: theme.textMuted, fontSize: 18 },
  });

  const groupCardStyles = StyleSheet.create({
    card: {
      backgroundColor: theme.card,
      borderRadius: 24,
      padding: 20,
      marginBottom: 16,
      borderWidth: 1,
      borderColor: theme.border,
      shadowColor: theme.shadow,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.04,
      shadowRadius: 20,
      elevation: 2,
    },
    cardPressed: {
      opacity: 0.88,
      transform: [{ scale: 0.995 }],
    },
    topRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
    },
    titleContainer: {
      flexDirection: "row",
      alignItems: "center",
      flex: 1,
      marginRight: 12,
    },
    avatar: {
      width: 42,
      height: 42,
      borderRadius: 14,
      backgroundColor: theme.primarySoft,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 12,
    },
    avatarText: {
      color: theme.primaryDark,
      fontSize: 16,
      fontWeight: "900",
    },
    nameContainer: {
      flex: 1,
    },
    name: {
      color: theme.text,
      fontSize: 16,
      fontWeight: "800",
      marginBottom: 2,
    },
    memberCount: {
      color: theme.textMuted,
      fontSize: 12,
      fontWeight: "500",
    },
    divider: {
      height: 1,
      backgroundColor: theme.divider,
      marginVertical: 16,
    },
    bottomRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
    },
    activityContainer: {
      flex: 1,
    },
    activityLabel: {
      color: theme.textMuted,
      fontSize: 10,
      fontWeight: "800",
      letterSpacing: 1.0,
      marginBottom: 4,
    },
    activityTime: {
      color: theme.text,
      fontSize: 13,
      fontWeight: "600",
    },
    balanceContainer: {
      alignItems: "flex-end",
    },
    balanceLabel: {
      color: theme.textMuted,
      fontSize: 10,
      fontWeight: "800",
      letterSpacing: 1.0,
      marginBottom: 4,
    },
    balanceAmount: {
      fontSize: 15,
      fontWeight: "800",
    },
    settledText: {
      color: theme.primary,
      fontSize: 13,
      fontWeight: "700",
    },
  });

  const activityStyles = StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 20,
      paddingVertical: 16,
      borderBottomWidth: 1,
      borderBottomColor: theme.border,
    },
    rowPressed: { backgroundColor: theme.input },
    iconBox: {
      width: 44,
      height: 44,
      borderRadius: 14,
      alignItems: "center",
      justifyContent: "center",
      marginRight: 14,
    },
    iconText: { fontSize: 16, fontWeight: "800" },
    content: { flex: 1 },
    title: { color: theme.text, fontSize: 14, fontWeight: "700", marginBottom: 4 },
    subtitle: { color: theme.textMuted, fontSize: 12, fontWeight: "500" },
    right: { alignItems: "flex-end", marginLeft: 12 },
    amount: { color: theme.text, fontSize: 14, fontWeight: "800", marginBottom: 4 },
    time: { color: theme.textMuted, fontSize: 11, fontWeight: "500" },
  });

  const skeletonStyles = StyleSheet.create({
    headerRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 24,
    },
    headerText: {
      flex: 1,
      gap: 8,
    },
    skeletonLineShort: {
      width: "40%",
      height: 14,
      borderRadius: 6,
      backgroundColor: theme.border,
    },
    skeletonLineLong: {
      width: "70%",
      height: 28,
      borderRadius: 8,
      backgroundColor: theme.border,
    },
    avatarCircle: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: theme.border,
    },
    heroCard: {
      height: 120,
      borderRadius: 22,
      backgroundColor: theme.border,
      marginBottom: 14,
    },
    row: {
      flexDirection: "row",
      gap: 14,
      marginBottom: 24,
    },
    sideCard: {
      flex: 1,
      height: 80,
      borderRadius: 18,
      backgroundColor: theme.border,
    },
    sectionHeader: {
      width: "50%",
      height: 20,
      borderRadius: 6,
      backgroundColor: theme.border,
      marginBottom: 14,
      marginTop: 14,
    },
    listCard: {
      backgroundColor: theme.card,
      borderRadius: 22,
      padding: 8,
      gap: 12,
      borderWidth: 1,
      borderColor: theme.border,
    },
    listItem: {
      height: 60,
      borderRadius: 14,
      backgroundColor: theme.input,
    },
  });

  return { styles, heroStyles, pendingStyles, groupCardStyles, activityStyles, skeletonStyles };
};
