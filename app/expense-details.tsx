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
import { CustomButton } from "../components/CustomButton";
import { Header } from "../components/Header";
import { colors } from "../constants/colors";
import { useAuth } from "../src/hooks/useAuth";
import { getGroupDetails, type GroupDetails } from "../src/services/groupService";
import { getExpenseDetails } from "../src/services/expenseService";
import { deleteExpense, hasConfirmedSettlements } from "../src/services/splitService";
import { formatCurrency } from "../src/utils/format";
import { supabase } from "../src/lib/supabase";

type SplitWithProfile = {
  id: string;
  amount_owed: number;
  user_id: string;
  profiles: {
    full_name: string;
    email: string;
  } | null;
};

export default function ExpenseDetailsScreen() {
  const { expenseId, groupId } = useLocalSearchParams<{ expenseId: string; groupId: string }>();
  const { user: currentUser } = useAuth();

  const [loading, setLoading] = useState(true);
  const [expense, setExpense] = useState<any | null>(null);
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
            email
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
      "Are you sure you want to delete this expense? All splits will be permanently removed and net balances will update automatically.",
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
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  if (!expense) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Expense not found.</Text>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const payerName = expense.profiles?.full_name || "Unknown User";
  const formattedAmount = formatCurrency(parseFloat(expense.amount));
  const formattedDate = new Date(expense.created_at).toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric"
  });

  // Permissions Check: Current user is the payer OR group creator
  const canModify = currentUser?.id === expense.paid_by || currentUser?.id === group?.created_by;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topRow}>
          <Pressable onPress={() => router.back()} style={styles.backButtonTextContainer}>
            <Text style={styles.backText}>Back</Text>
          </Pressable>
        </View>

        <Header subtitle="Detailed split details" title="Expense Details" />

        {/* Main Details Card */}
        <View style={styles.detailsCard}>
          <Text style={styles.amountText}>{formattedAmount}</Text>
          <Text style={styles.titleText}>{expense.title}</Text>
          
          <View style={styles.divider} />
          
          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Paid By</Text>
            <Text style={styles.metaValue}>{payerName}</Text>
          </View>

          <View style={styles.metaRow}>
            <Text style={styles.metaLabel}>Date</Text>
            <Text style={styles.metaValue}>{formattedDate}</Text>
          </View>

          {expense.notes ? (
            <View style={styles.notesSection}>
              <Text style={styles.notesLabel}>Notes</Text>
              <Text style={styles.notesText}>{expense.notes}</Text>
            </View>
          ) : null}
        </View>

        {/* Splits/Participants Card */}
        <Text style={styles.sectionTitle}>Split Details</Text>
        <View style={styles.splitsCard}>
          {splits.map((split) => {
            const memberName = split.profiles?.full_name || "Unknown User";
            const initial = memberName.charAt(0).toUpperCase();
            return (
              <View key={split.id} style={styles.splitRow}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{initial}</Text>
                </View>
                <View style={styles.splitInfo}>
                  <Text style={styles.splitName}>{memberName}</Text>
                </View>
                <Text style={styles.splitShare}>{formatCurrency(split.amount_owed)}</Text>
              </View>
            );
          })}
        </View>

        {/* Edit and Delete Buttons (Payer or Creator only) */}
        {canModify ? (
          <View style={styles.actionContainer}>
            <CustomButton
              onPress={() =>
                router.push({
                  pathname: "/(tabs)/add-expense",
                  params: { expenseId: expense.id, groupId: groupId }
                })
              }
              style={styles.actionButton}
              title="Edit Expense"
            />
            <CustomButton
              disabled={isDeleting}
              onPress={handleDelete}
              style={[styles.actionButton, styles.deleteButton]}
              title={isDeleting ? "Deleting..." : "Delete Expense"}
              variant="ghost"
            />
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.background,
    flex: 1
  },
  content: {
    padding: 24,
    paddingBottom: 60
  },
  loadingContainer: {
    alignItems: "center",
    backgroundColor: colors.background,
    flex: 1,
    justifyContent: "center"
  },
  errorContainer: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
    padding: 24
  },
  errorText: {
    color: colors.textMuted,
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
    color: colors.primaryDark,
    fontSize: 15,
    fontWeight: "800"
  },
  backButton: {
    backgroundColor: colors.primarySoft,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 8
  },
  backButtonText: {
    color: colors.primaryDark,
    fontWeight: "700"
  },
  detailsCard: {
    backgroundColor: colors.card,
    borderRadius: 22,
    padding: 24,
    shadowColor: colors.shadow,
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
    color: colors.text,
    marginBottom: 8
  },
  titleText: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.textMuted,
    textAlign: "center"
  },
  divider: {
    backgroundColor: colors.border,
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
    color: colors.textMuted,
    fontWeight: "600"
  },
  metaValue: {
    fontSize: 14,
    color: colors.text,
    fontWeight: "800"
  },
  notesSection: {
    width: "100%",
    marginTop: 14,
    backgroundColor: colors.input,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border
  },
  notesLabel: {
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: "800",
    marginBottom: 4
  },
  notesText: {
    fontSize: 14,
    color: colors.text,
    fontWeight: "600",
    lineHeight: 20
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 14
  },
  splitsCard: {
    backgroundColor: colors.card,
    borderRadius: 22,
    padding: 8,
    shadowColor: colors.shadow,
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
    borderBottomColor: colors.border,
    borderBottomWidth: 1
  },
  avatar: {
    alignItems: "center",
    backgroundColor: colors.primarySoft,
    borderRadius: 18,
    height: 36,
    justifyContent: "center",
    width: 36
  },
  avatarText: {
    color: colors.primaryDark,
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
    color: colors.text
  },
  splitShare: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.danger
  },
  actionContainer: {
    flexDirection: "row",
    gap: 12
  },
  actionButton: {
    flex: 1
  },
  deleteButton: {
    backgroundColor: colors.dangerSoft,
    borderColor: colors.dangerSoft
  }
});
