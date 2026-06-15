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
import { colors } from "../../constants/colors";
import { useAuth } from "../../src/hooks/useAuth";
import {
  getDashboardData,
  type ActivityItem,
  type ActivityType,
  type DashboardData,
  type GroupSummary,
  type PendingAction,
} from "../../src/services/dashboardService";
import { formatCurrency } from "../../src/utils/format";

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

const ACTIVITY_CONFIG: Record<ActivityType, { icon: string; bg: string; color: string }> = {
  expense:               { icon: "₹",  bg: "#EAF1FF", color: colors.secondary },
  settlement_pending:    { icon: "⏳", bg: "#FEF3C7", color: "#D97706" },
  settlement_confirmed:  { icon: "✓",  bg: colors.primarySoft, color: colors.primary },
  settlement_rejected:   { icon: "✕",  bg: colors.dangerSoft, color: colors.danger },
  group_created:         { icon: "👥", bg: "#EDE9FE", color: "#7C3AED" },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function BalanceSummary({ data }: { data: DashboardData }) {
  const netPositive = data.netBalance >= 0;
  return (
    <View style={summaryStyles.wrapper}>
      {/* Hero: Net Balance */}
      <View style={[summaryStyles.heroCard, netPositive ? summaryStyles.heroPositive : summaryStyles.heroNegative]}>
        <Text style={summaryStyles.heroLabel}>Net Balance</Text>
        <Text style={[summaryStyles.heroAmount, { color: netPositive ? colors.primary : colors.danger }]}>
          {netPositive ? "+" : ""}{formatCurrency(Math.abs(data.netBalance))}
        </Text>
        <Text style={summaryStyles.heroHint}>
          {netPositive ? "Overall you are owed money" : "Overall you owe money"}
        </Text>
      </View>

      {/* Side cards */}
      <View style={summaryStyles.row}>
        <View style={[summaryStyles.sideCard, summaryStyles.sideCardDanger]}>
          <Text style={summaryStyles.sideLabel}>You Owe</Text>
          <Text style={[summaryStyles.sideAmount, { color: colors.danger }]}>
            {formatCurrency(data.totalOwed)}
          </Text>
        </View>
        <View style={[summaryStyles.sideCard, summaryStyles.sideCardGreen]}>
          <Text style={summaryStyles.sideLabel}>Owed to You</Text>
          <Text style={[summaryStyles.sideAmount, { color: colors.primary }]}>
            {formatCurrency(data.totalOwedToMe)}
          </Text>
        </View>
      </View>
    </View>
  );
}

function PendingActionsWidget({ actions }: { actions: PendingAction[] }) {
  if (actions.length === 0) return null;
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

function GroupRow({ summary }: { summary: GroupSummary }) {
  const hasBalance = Math.abs(summary.userNetBalance) > 0.01;
  const isPositive = summary.userNetBalance > 0;
  return (
    <Pressable
      onPress={() => router.push({ pathname: "/group-details", params: { id: summary.groupId } })}
      style={({ pressed }) => [groupRowStyles.card, pressed && groupRowStyles.cardPressed]}
    >
      <View style={groupRowStyles.badge}>
        <Text style={groupRowStyles.badgeText}>{summary.groupName.charAt(0).toUpperCase()}</Text>
      </View>
      <View style={groupRowStyles.info}>
        <Text style={groupRowStyles.name} numberOfLines={1}>{summary.groupName}</Text>
        <Text style={groupRowStyles.meta}>
          {summary.memberCount} member{summary.memberCount !== 1 ? "s" : ""} · {formatCurrency(summary.totalExpenses)} total
        </Text>
      </View>
      <View style={groupRowStyles.balance}>
        {hasBalance ? (
          <>
            <Text style={[groupRowStyles.balanceAmount, { color: isPositive ? colors.primary : colors.danger }]}>
              {isPositive ? "+" : ""}{formatCurrency(Math.abs(summary.userNetBalance))}
            </Text>
            <Text style={groupRowStyles.balanceLabel}>{isPositive ? "owed to you" : "you owe"}</Text>
          </>
        ) : (
          <Text style={groupRowStyles.settled}>Settled ✓</Text>
        )}
      </View>
    </Pressable>
  );
}

function ActivityRow({ item }: { item: ActivityItem }) {
  const config = ACTIVITY_CONFIG[item.type];
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
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [firstName, setFirstName] = useState("there");

  const loadDashboard = async (isRefreshing = false) => {
    if (!user) return;
    if (isRefreshing) setRefreshing(true);
    else setLoading(true);

    // Resolve first name
    const metaName = user.user_metadata?.full_name?.trim().split(" ")[0];
    if (metaName) setFirstName(metaName);

    const { data: dashData } = await getDashboardData(user.id);
    if (dashData) setData(dashData);

    setLoading(false);
    setRefreshing(false);
  };

  useFocusEffect(
    useCallback(() => {
      loadDashboard();
    }, [user])
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
            <RefreshControl colors={[colors.primary]} onRefresh={onRefresh} refreshing={refreshing} />
          }
          showsVerticalScrollIndicator={false}
        >
          <Header subtitle={`${greeting}, ${firstName}`} title="Dashboard" />

          {/* ── A: Overall Summary ───────────────────────── */}
          {data ? (
            <BalanceSummary data={data} />
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
              <View style={styles.card}>
                {data.groupSummaries.slice(0, 5).map((summary) => (
                  <GroupRow key={summary.groupId} summary={summary} />
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

const styles = StyleSheet.create({
  safeArea: { backgroundColor: colors.background, flex: 1 },
  wrapper: { flex: 1 },
  content: { padding: 20, paddingBottom: 120 },
  loadingContainer: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16 },
  loadingText: { color: colors.textMuted, fontSize: 15, fontWeight: "600" },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 28,
    marginBottom: 14,
  },
  sectionTitle: { color: colors.text, fontSize: 20, fontWeight: "900" },
  seeAll: { color: colors.primaryDark, fontSize: 14, fontWeight: "800" },
  card: {
    backgroundColor: colors.card,
    borderRadius: 22,
    overflow: "hidden",
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 18,
    elevation: 3,
  },
  emptyCard: {
    backgroundColor: colors.card,
    borderRadius: 22,
    padding: 24,
    alignItems: "center",
  },
  emptyText: { color: colors.textMuted, fontSize: 15, fontWeight: "600" },
  emptyState: { alignItems: "center", marginTop: 40, paddingHorizontal: 24 },
  emptyStateIcon: { fontSize: 48, marginBottom: 16 },
  emptyStateTitle: { color: colors.text, fontSize: 18, fontWeight: "800", marginBottom: 8 },
  emptyStateText: { color: colors.textMuted, fontSize: 14, lineHeight: 20, textAlign: "center" },
  fab: {
    position: "absolute",
    bottom: 22,
    right: 22,
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 6,
  },
  fabPressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  fabText: { color: colors.white, fontSize: 34, fontWeight: "500", marginTop: -3 },
});

const summaryStyles = StyleSheet.create({
  wrapper: { gap: 14 },
  heroCard: {
    borderRadius: 22,
    padding: 24,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.07,
    shadowRadius: 20,
    elevation: 4,
  },
  heroPositive: { backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: "#C6F0DC" },
  heroNegative: { backgroundColor: colors.dangerSoft, borderWidth: 1, borderColor: "#FCCFCF" },
  heroLabel: { color: colors.textMuted, fontSize: 13, fontWeight: "700", marginBottom: 6 },
  heroAmount: { fontSize: 40, fontWeight: "900", marginBottom: 4 },
  heroHint: { color: colors.textMuted, fontSize: 13, fontWeight: "500" },
  row: { flexDirection: "row", gap: 14 },
  sideCard: {
    flex: 1,
    borderRadius: 18,
    padding: 18,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 14,
    elevation: 3,
  },
  sideCardDanger: { backgroundColor: colors.card },
  sideCardGreen: { backgroundColor: colors.card },
  sideLabel: { color: colors.textMuted, fontSize: 12, fontWeight: "700", marginBottom: 8 },
  sideAmount: { fontSize: 22, fontWeight: "900" },
});

const pendingStyles = StyleSheet.create({
  container: {
    backgroundColor: "#FFFBEB",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#FDE68A",
    overflow: "hidden",
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 18,
    elevation: 3,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#FDE68A",
  },
  icon: { fontSize: 22 },
  headerText: { flex: 1 },
  title: { color: "#92400E", fontSize: 15, fontWeight: "800" },
  subtitle: { color: "#B45309", fontSize: 12, fontWeight: "500", marginTop: 2 },
  badge: {
    backgroundColor: "#F59E0B",
    borderRadius: 12,
    width: 24,
    height: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { color: colors.white, fontSize: 12, fontWeight: "900" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#FDE68A30",
  },
  rowPressed: { backgroundColor: "#FEF3C720" },
  rowLeft: { flex: 1 },
  payerName: { color: "#92400E", fontSize: 14, fontWeight: "700" },
  groupName: { color: "#B45309", fontSize: 12, marginTop: 2 },
  rowRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  amount: { color: "#92400E", fontSize: 15, fontWeight: "800" },
  arrow: { color: "#B45309", fontSize: 20 },
});

const groupRowStyles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  cardPressed: { backgroundColor: colors.input },
  badge: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: colors.primarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  badgeText: { color: colors.primaryDark, fontSize: 18, fontWeight: "900" },
  info: { flex: 1 },
  name: { color: colors.text, fontSize: 15, fontWeight: "800", marginBottom: 3 },
  meta: { color: colors.textMuted, fontSize: 12 },
  balance: { alignItems: "flex-end" },
  balanceAmount: { fontSize: 14, fontWeight: "800" },
  balanceLabel: { color: colors.textMuted, fontSize: 11, marginTop: 2 },
  settled: { color: colors.primary, fontSize: 13, fontWeight: "700" },
});

const activityStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowPressed: { backgroundColor: colors.input },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  iconText: { fontSize: 16, fontWeight: "800" },
  content: { flex: 1 },
  title: { color: colors.text, fontSize: 14, fontWeight: "700", marginBottom: 3 },
  subtitle: { color: colors.textMuted, fontSize: 12 },
  right: { alignItems: "flex-end", marginLeft: 10 },
  amount: { color: colors.text, fontSize: 13, fontWeight: "800", marginBottom: 3 },
  time: { color: colors.textMuted, fontSize: 11 },
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
    backgroundColor: colors.border,
  },
  skeletonLineLong: {
    width: "70%",
    height: 28,
    borderRadius: 8,
    backgroundColor: colors.border,
  },
  avatarCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.border,
  },
  heroCard: {
    height: 120,
    borderRadius: 22,
    backgroundColor: colors.border,
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
    backgroundColor: colors.border,
  },
  sectionHeader: {
    width: "50%",
    height: 20,
    borderRadius: 6,
    backgroundColor: colors.border,
    marginBottom: 14,
    marginTop: 14,
  },
  listCard: {
    backgroundColor: colors.card,
    borderRadius: 22,
    padding: 8,
    gap: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  listItem: {
    height: 60,
    borderRadius: 14,
    backgroundColor: colors.input,
  },
});
