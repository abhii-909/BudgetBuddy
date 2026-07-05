import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
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
  getExpenseHistory,
  type DashboardExpense,
} from "../../src/services/dashboardService";
import { formatCurrency } from "../../src/utils/format";
import { useTheme } from "../../src/hooks/useTheme";
import { ColorTheme } from "../../src/constants/theme";

function formatDate(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86400000);
  if (diffDays === 0) return "Today";
  if (diffDays === 1) return "Yesterday";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export default function ExpenseHistoryScreen() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const styles = getStyles(theme);
  const [expenses, setExpenses] = useState<DashboardExpense[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadHistory = async (isRefreshing = false) => {
    if (!user) return;
    if (isRefreshing) setRefreshing(true);
    else setLoading(true);

    const { data } = await getExpenseHistory(user.id);
    setExpenses(data || []);

    setLoading(false);
    setRefreshing(false);
  };

  useFocusEffect(
    useCallback(() => {
      loadHistory();
    }, [user])
  );

  const onRefresh = () => loadHistory(true);

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl colors={[theme.primary]} onRefresh={onRefresh} refreshing={refreshing} />
        }
        showsVerticalScrollIndicator={false}
      >
        <Header subtitle="All shared spending across groups" title="History" />

        {loading ? (
          <View style={styles.skeletonContainer}>
            <View style={styles.skeletonCard} />
            <View style={styles.skeletonCard} />
            <View style={styles.skeletonCard} />
            <View style={styles.skeletonCard} />
          </View>
        ) : expenses.length === 0 ? (
          <EmptyState
            description="Add expenses in your groups and they will appear here."
            icon="🧾"
            title="No expenses yet"
          />
        ) : (
          <>
            <Text style={styles.count}>{expenses.length} expense{expenses.length !== 1 ? "s" : ""}</Text>
            {expenses.map((expense) => (
              <View key={expense.id} style={styles.card}>
                <View style={styles.iconBox}>
                  <Text style={styles.iconText}>₹</Text>
                </View>
                <View style={styles.cardContent}>
                  <Text style={styles.title} numberOfLines={1}>{expense.title}</Text>
                  <Text style={styles.meta}>
                    {formatDate(expense.created_at)} · Paid by {expense.payerName}
                  </Text>
                  <Text style={styles.groupTag}>{expense.groupName}</Text>
                </View>
                <Text style={styles.amount}>{formatCurrency(expense.amount)}</Text>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (theme: ColorTheme) => StyleSheet.create({
  safeArea: { backgroundColor: theme.background, flex: 1 },
  content: { padding: 20, paddingBottom: 110 },
  loadingWrapper: { alignItems: "center", justifyContent: "center", minHeight: 200 },
  emptyWrapper: { alignItems: "center", justifyContent: "center", marginTop: 60, paddingHorizontal: 24 },
  emptyIcon: { fontSize: 48, marginBottom: 16 },
  emptyTitle: { color: theme.text, fontSize: 18, fontWeight: "800", marginBottom: 8 },
  emptyText: { color: theme.textMuted, fontSize: 14, lineHeight: 20, textAlign: "center" },
  count: { color: theme.textMuted, fontSize: 13, fontWeight: "600", marginBottom: 14 },
  card: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: theme.card,
    borderRadius: 18,
    marginBottom: 12,
    padding: 14,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.05,
    shadowRadius: 14,
    elevation: 3,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: theme.secondarySoft,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  iconText: { color: theme.secondary, fontSize: 18, fontWeight: "900" },
  cardContent: { flex: 1 },
  title: { color: theme.text, fontSize: 15, fontWeight: "700", marginBottom: 3 },
  meta: { color: theme.textMuted, fontSize: 12, marginBottom: 4 },
  groupTag: {
    alignSelf: "flex-start",
    backgroundColor: theme.primarySoft,
    borderRadius: 8,
    color: theme.primaryDark,
    fontSize: 11,
    fontWeight: "700",
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  amount: { color: theme.text, fontSize: 15, fontWeight: "800", marginLeft: 10 },
  skeletonContainer: {
    gap: 12
  },
  skeletonCard: {
    height: 80,
    borderRadius: 20,
    backgroundColor: theme.border
  }
});
