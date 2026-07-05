import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Header } from "../components/Header";
import { CustomButton } from "../components/CustomButton";
import { Avatar } from "../components/Avatar";
import { useAuth } from "../src/hooks/useAuth";
import { getExpenseDetails, type ExpenseWithPayer } from "../src/services/expenseService";
import { getGroupDetails, type GroupDetails } from "../src/services/groupService";
import { supabase } from "../src/lib/supabase";
import { formatCurrency } from "../src/utils/format";
import { deleteExpense, hasConfirmedSettlements } from "../src/services/splitService";
import { useTheme } from "../src/hooks/useTheme";
import { ColorTheme } from "../src/constants/theme";

type SplitWithProfile = {
  id: string;
  amount_owed: number;
  user_id: string;
  profiles: {
    full_name: string;
    email: string;
    avatar_url: string | null;
  } | null;
};

export default function ExpenseDetailsScreen() {
  const { expenseId, groupId } = useLocalSearchParams<{ expenseId: string; groupId: string }>();
  const { user: currentUser } = useAuth();
  const { theme } = useTheme();
  const styles = getStyles(theme);

  const [loading, setLoading] = useState(true);
  const [expense, setExpense] = useState<ExpenseWithPayer | null>(null);
  const [splits, setSplits] = useState<SplitWithProfile[]>([]);
  const [group, setGroup] = useState<GroupDetails | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const loadExpenseData = async () => {
    if (!expenseId || !groupId) return;
    setLoading(true);
    
    const [expenseRes, splitsRes, groupRes] = await Promise.all([
      getExpenseDetails(expenseId),
      supabase
        .from("expense_splits")
        .select(`
          id,
          amount_owed,
          user_id,
          profiles:user_id (
            full_name,
            email,
            avatar_url
          )
        `)
        .eq("expense_id", expenseId),
      getGroupDetails(groupId)
    ]);

    setLoading(false);

    if (expenseRes.error) {
      Alert.alert("Error", expenseRes.error);
      return;
    }

    setExpense(expenseRes.data);
    setSplits((splitsRes.data as unknown as SplitWithProfile[]) || []);
    if (groupRes.data) {
      setGroup(groupRes.data);
    }
  };

  useEffect(() => {
    loadExpenseData();
  }, [expenseId, groupId]);

  const handleDelete = async () => {
    if (!expenseId || !groupId) return;

    // 1. Check settlements guard first
    const { hasConfirmed, error: sError } = await hasConfirmedSettlements(groupId);
    if (sError) {
      Alert.alert("Error", sError);
      return;
    }
    if (hasConfirmed) {
      Alert.alert(
        "Action Blocked",
        "This expense cannot be deleted because settlements have already been recorded and confirmed in this group."
      );
      return;
    }

    Alert.alert(
      "Delete Expense",
      "Are you sure you want to delete this expense? This will recalculate everyone's balances.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setIsDeleting(true);
            const { error } = await deleteExpense(expenseId, groupId);
            setIsDeleting(false);
            if (error) {
              Alert.alert("Failed to delete expense", error);
            } else {
              Alert.alert("Success", "Expense deleted successfully!");
              router.back();
            }
          }
        }
      ]
    );
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

  if (!expense) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Expense not found.</Text>
          <CustomButton title="Go Back" onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    );
  }

  const formattedDate = new Date(expense.created_at).toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric"
  });

  const payerName = expense.paid_by === currentUser?.id ? "You" : (expense.profiles?.full_name || "Unknown");

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topRow}>
          <Pressable
            onPress={() => router.back()}
            style={styles.backButtonTextContainer}
          >
            <Text style={styles.backText}>← Back</Text>
          </Pressable>
        </View>

        <Header subtitle="Expense Details" title={expense.title} />

        <View style={styles.detailsCard}>
          <Text style={styles.amountText}>{formatCurrency(expense.amount)}</Text>
          <Text style={styles.titleText}>{expense.title}</Text>
          
          <View style={styles.divider} />
          
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Paid By</Text>
            <Text style={styles.metaValue}>{payerName}</Text>
          </View>
          
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Date Added</Text>
            <Text style={styles.metaValue}>{formattedDate}</Text>
          </View>

          {expense.notes ? (
            <View style={styles.notesSection}>
              <Text style={styles.notesLabel}>NOTES</Text>
              <Text style={styles.notesText}>{expense.notes}</Text>
            </View>
          ) : null}
        </View>

        <Text style={styles.sectionTitle}>Split Details</Text>
        
        <View style={styles.splitsCard}>
          {splits.map((split) => {
            const splitMemberName = split.user_id === currentUser?.id ? "You" : (split.profiles?.full_name || "Unknown");
            return (
              <View key={split.id} style={styles.splitRow}>
                <Avatar
                  avatarUrl={split.profiles?.avatar_url}
                  fullName={split.profiles?.full_name || "Unknown"}
                  email={split.profiles?.email}
                  size="small"
                />
                <View style={styles.splitInfo}>
                  <Text style={styles.splitName}>{splitMemberName}</Text>
                </View>
                <Text style={styles.splitShare}>
                  {formatCurrency(split.amount_owed)}
                </Text>
              </View>
            );
          })}
        </View>

        {currentUser?.id === expense.paid_by && (
          <View style={styles.actionContainer}>
            <CustomButton
              disabled={isDeleting}
              onPress={handleDelete}
              style={[styles.actionButton, styles.deleteButton]}
              title={isDeleting ? "Deleting..." : "Delete Expense"}
              variant="danger"
            />
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const getStyles = (theme: ColorTheme) => StyleSheet.create({
  safeArea: {
    backgroundColor: theme.background,
    flex: 1
  },
  content: {
    padding: 24,
    paddingBottom: 60
  },
  loadingContainer: {
    alignItems: "center",
    backgroundColor: theme.background,
    flex: 1,
    justifyContent: "center"
  },
  errorContainer: {
    alignItems: "center",
    backgroundColor: theme.background,
    flex: 1,
    justifyContent: "center",
    padding: 24
  },
  errorText: {
    color: theme.textMuted,
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 16
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 18
  },
  backButtonTextContainer: {
    paddingVertical: 8
  },
  backText: {
    color: theme.primaryDark,
    fontSize: 15,
    fontWeight: "800"
  },
  backButton: {
    backgroundColor: theme.primarySoft,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 8
  },
  backButtonText: {
    color: theme.primaryDark,
    fontWeight: "700"
  },
  detailsCard: {
    backgroundColor: theme.card,
    borderRadius: 22,
    padding: 24,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 18,
    elevation: 3,
    marginBottom: 24,
    alignItems: "center"
  },
  amountText: {
    fontSize: 32,
    fontWeight: "900",
    color: theme.text,
    marginBottom: 8
  },
  titleText: {
    fontSize: 18,
    fontWeight: "800",
    color: theme.textMuted,
    textAlign: "center"
  },
  divider: {
    backgroundColor: theme.border,
    height: 1,
    width: "100%",
    marginVertical: 20
  },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    paddingVertical: 8
  },
  metaLabel: {
    fontSize: 14,
    color: theme.textMuted,
    fontWeight: "600"
  },
  metaValue: {
    fontSize: 14,
    color: theme.text,
    fontWeight: "800"
  },
  notesSection: {
    width: "100%",
    marginTop: 14,
    backgroundColor: theme.input,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.border
  },
  notesLabel: {
    fontSize: 12,
    color: theme.textMuted,
    fontWeight: "800",
    marginBottom: 4
  },
  notesText: {
    fontSize: 14,
    color: theme.text,
    fontWeight: "600",
    lineHeight: 20
  },
  sectionTitle: {
    color: theme.text,
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 14
  },
  splitsCard: {
    backgroundColor: theme.card,
    borderRadius: 22,
    padding: 8,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 18,
    elevation: 3,
    marginBottom: 30
  },
  splitRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderBottomColor: theme.border,
    borderBottomWidth: 1
  },
  avatar: {
    alignItems: "center",
    backgroundColor: theme.primarySoft,
    borderRadius: 18,
    height: 36,
    justifyContent: "center",
    width: 36
  },
  avatarText: {
    color: theme.primaryDark,
    fontSize: 14,
    fontWeight: "800"
  },
  splitInfo: {
    flex: 1,
    marginLeft: 12
  },
  splitName: {
    fontSize: 15,
    fontWeight: "700",
    color: theme.text
  },
  splitShare: {
    fontSize: 15,
    fontWeight: "800",
    color: theme.danger
  },
  actionContainer: {
    flexDirection: "row",
    gap: 12
  },
  actionButton: {
    flex: 1
  },
  deleteButton: {
    backgroundColor: theme.dangerSoft,
    borderColor: theme.dangerSoft
  }
});
