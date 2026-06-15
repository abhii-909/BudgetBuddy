import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Header } from "../components/Header";
import { UserSearch } from "../components/UserSearch";
import { CustomButton } from "../components/CustomButton";
import { EmptyState } from "../components/EmptyState";
import { colors } from "../constants/colors";
import { useAuth } from "../src/hooks/useAuth";
import {
  addGroupMember,
  deleteGroup,
  getGroupDetails,
  getGroupMembers,
  type GroupDetails,
  type MemberProfile,
  type SearchedUser
} from "../src/services/groupService";
import { getGroupExpenses, type ExpenseWithPayer } from "../src/services/expenseService";
import { formatCurrency } from "../src/utils/format";
import {
  getGroupSplits,
  getGroupSettlements,
  calculateGroupBalances,
  createSettlementRequest,
  confirmSettlement,
  rejectSettlement,
  type GroupMemberBalance,
  type WhoOwesWhomSummary,
  type SettlementWithProfiles
} from "../src/services/splitService";

export default function GroupDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user: currentUser } = useAuth();
  
  const [group, setGroup] = useState<GroupDetails | null>(null);
  const [members, setMembers] = useState<MemberProfile[]>([]);
  const [expenses, setExpenses] = useState<ExpenseWithPayer[]>([]);
  const [balances, setBalances] = useState<GroupMemberBalance[]>([]);
  const [summaries, setSummaries] = useState<WhoOwesWhomSummary[]>([]);
  const [settlementsList, setSettlementsList] = useState<SettlementWithProfiles[]>([]);
  const [activeTab, setActiveTab] = useState<"expenses" | "balances" | "settlements">("expenses");
  
  // Settle Up Modal States
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [selectedDebtIndex, setSelectedDebtIndex] = useState<number | null>(null);
  const [showDebtSelect, setShowDebtSelect] = useState(false);
  const [settleAmount, setSettleAmount] = useState("");
  const [settleNotes, setSettleNotes] = useState("");
  const [settling, setSettling] = useState(false);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async (isRefreshing = false) => {
    if (!id) return;
    if (isRefreshing) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    const [groupRes, membersRes, expensesRes, splitsRes, settlementsRes] = await Promise.all([
      getGroupDetails(id),
      getGroupMembers(id),
      getGroupExpenses(id),
      getGroupSplits(id),
      getGroupSettlements(id)
    ]);

    setLoading(false);
    setRefreshing(false);

    if (groupRes.error) {
      Alert.alert("Error", groupRes.error);
    } else {
      setGroup(groupRes.data);
    }

    let loadedMembers: MemberProfile[] = [];
    if (membersRes.error) {
      console.error("Failed to load members:", membersRes.error);
    } else if (membersRes.data) {
      loadedMembers = membersRes.data;
      setMembers(loadedMembers);
    }

    let loadedExpenses: ExpenseWithPayer[] = [];
    if (expensesRes.error) {
      console.error("Failed to load expenses:", expensesRes.error);
    } else if (expensesRes.data) {
      loadedExpenses = expensesRes.data;
      setExpenses(loadedExpenses);
    }

    let loadedSplits: any[] = [];
    if (splitsRes.error) {
      console.error("Failed to load splits:", splitsRes.error);
    } else if (splitsRes.data) {
      loadedSplits = splitsRes.data;
    }

    let loadedSettlements: SettlementWithProfiles[] = [];
    if (settlementsRes.error) {
      console.error("Failed to load settlements:", settlementsRes.error);
    } else if (settlementsRes.data) {
      loadedSettlements = settlementsRes.data;
      setSettlementsList(loadedSettlements);
    }

    if (loadedMembers.length > 0) {
      const { balances: computedBalances, summaries: computedSummaries } = calculateGroupBalances(
        loadedMembers,
        loadedExpenses.map((e) => ({ id: e.id, amount: e.amount, paid_by: e.paid_by })),
        loadedSplits,
        loadedSettlements
      );
      setBalances(computedBalances);
      setSummaries(computedSummaries);
    }
  };

  useEffect(() => {
    loadData();
  }, [id]);

  const onRefresh = () => {
    loadData(true);
  };

  const handleAddMember = async (selectedUser: SearchedUser) => {
    if (!id || !currentUser) return;

    // 1. Prevent users from adding themselves
    if (selectedUser.id === currentUser.id) {
      Alert.alert("Warning", "You cannot add yourself to the group.");
      return;
    }

    const { error } = await addGroupMember(id, selectedUser.id);

    if (error) {
      Alert.alert("Failed to add member", error);
    } else {
      Alert.alert("Success", `${selectedUser.full_name} has been added to the group.`);
      loadData();
    }
  };

  const handleDeleteGroup = async () => {
    if (!id) return;
    Alert.alert(
      "Delete Group",
      "Are you sure you want to delete this group? All expenses and membership records will be permanently removed.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            setLoading(true);
            const { error } = await deleteGroup(id);
            setLoading(false);
            if (error) {
              Alert.alert("Failed to delete group", error);
            } else {
              Alert.alert("Success", "Group deleted successfully!");
              router.replace("/(tabs)/groups");
            }
          }
        }
      ]
    );
  };

  const handleSaveSettlement = async () => {
    if (!id) return;
    if (selectedDebtIndex === null) {
      Alert.alert("Validation Error", "Please select an active debt pairing.");
      return;
    }
    const selectedDebt = summaries[selectedDebtIndex];
    if (!selectedDebt) return;

    const amountVal = parseFloat(settleAmount);
    if (isNaN(amountVal) || amountVal <= 0) {
      Alert.alert("Validation Error", "Please enter a valid amount greater than 0.");
      return;
    }
    if (amountVal > selectedDebt.amount) {
      Alert.alert(
        "Validation Error",
        `Amount cannot exceed the outstanding debt of ${formatCurrency(selectedDebt.amount)}.`
      );
      return;
    }

    setSettling(true);
    const { error } = await createSettlementRequest(
      id,
      selectedDebt.fromUserId,
      selectedDebt.toUserId,
      amountVal,
      settleNotes
    );
    setSettling(false);

    if (error) {
      Alert.alert("Error recording settlement", error);
    } else {
      Alert.alert("Success", "Settlement request submitted! Awaiting receiver's approval.");
      setSelectedDebtIndex(null);
      setSettleAmount("");
      setSettleNotes("");
      setShowSettleModal(false);
      loadData();
    }
  };

  const memberIds = members.map((m) => m.user_id);

  const pendingApprovals = settlementsList.filter(
    (s) => s.status === "pending" && s.receiver_id === currentUser?.id
  );

  const handleConfirmSettlement = async (settlement: SettlementWithProfiles) => {
    if (!currentUser) return;
    if (settlement.status !== "pending") {
      Alert.alert("Error", "This settlement has already been processed.");
      return;
    }

    Alert.alert(
      "Confirm Settlement",
      `Are you sure you received ${formatCurrency(settlement.amount)} from ${settlement.payer?.full_name || "payer"}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          onPress: async () => {
            setLoading(true);
            const { error } = await confirmSettlement(settlement.id, currentUser.id);
            setLoading(false);
            if (error) {
              Alert.alert("Error", error);
              loadData();
            } else {
              Alert.alert("Success", "Settlement confirmed. Balances updated successfully.");
              loadData();
            }
          }
        }
      ]
    );
  };

  const handleRejectSettlement = async (settlement: SettlementWithProfiles) => {
    if (settlement.status !== "pending") {
      Alert.alert("Error", "This settlement has already been processed.");
      return;
    }

    Alert.alert(
      "Reject Settlement",
      `Are you sure you want to reject the settlement claim of ${formatCurrency(settlement.amount)} from ${settlement.payer?.full_name || "payer"}?`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reject",
          style: "destructive",
          onPress: async () => {
            setLoading(true);
            const { error } = await rejectSettlement(settlement.id);
            setLoading(false);
            if (error) {
              Alert.alert("Error", error);
              loadData();
            } else {
              Alert.alert("Success", "Settlement rejected.");
              loadData();
            }
          }
        }
      ]
    );
  };

  const renderPendingApprovals = () => {
    if (pendingApprovals.length === 0) return null;
    return (
      <View style={styles.pendingApprovalsContainer}>
        <Text style={styles.pendingTitle}>Pending Approvals</Text>
        {pendingApprovals.map((settlement) => {
          const payerName = settlement.payer?.full_name || "Unknown User";
          return (
            <View key={settlement.id} style={styles.pendingApprovalRow}>
              <View style={styles.pendingDetails}>
                <Text style={styles.pendingText}>
                  <Text style={styles.boldText}>{payerName}</Text> claims to have paid you{" "}
                  <Text style={styles.boldText}>{formatCurrency(settlement.amount)}</Text>
                </Text>
                {settlement.notes ? (
                  <Text style={styles.pendingNotes}>Note: {settlement.notes}</Text>
                ) : null}
              </View>
              <View style={styles.pendingActions}>
                <Pressable
                  onPress={() => handleConfirmSettlement(settlement)}
                  style={[styles.actionButton, styles.confirmButton]}
                >
                  <Text style={styles.actionButtonText}>Confirm</Text>
                </Pressable>
                <Pressable
                  onPress={() => handleRejectSettlement(settlement)}
                  style={[styles.actionButton, styles.rejectButton]}
                >
                  <Text style={[styles.actionButtonText, styles.rejectButtonText]}>Reject</Text>
                </Pressable>
              </View>
            </View>
          );
        })}
      </View>
    );
  };
  
  // Calculate total spent client-side
  const totalSpent = expenses.reduce((sum, item) => sum + parseFloat(item.amount as any), 0);

  if (loading && !group) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  const creatorName = group?.creator?.full_name || "Unknown Creator";

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        refreshControl={
          <RefreshControl
            colors={[colors.primary]}
            onRefresh={onRefresh}
            refreshing={refreshing}
          />
        }
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topRow}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backText}>Back</Text>
          </Pressable>
          {group && group.created_by === currentUser?.id ? (
            <Pressable onPress={handleDeleteGroup} style={styles.deleteButton}>
              <Text style={styles.deleteText}>Delete Group</Text>
            </Pressable>
          ) : null}
        </View>

        {group ? (
          <>
            <Header subtitle={`Created by ${creatorName}`} title={group.name} />

            {/* Total Spent & Members Stats Banner */}
            <View style={styles.statsCard}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{formatCurrency(totalSpent)}</Text>
                <Text style={styles.statLabel}>Total Spent</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{members.length}</Text>
                <Text style={styles.statLabel}>Members</Text>
              </View>
            </View>

            {/* Reusable User Search */}
            <UserSearch
              excludeUserIds={memberIds}
              onSelectUser={handleAddMember}
            />

            {/* Tab Bar */}
            <View style={styles.tabContainer}>
              <Pressable
                onPress={() => setActiveTab("expenses")}
                style={[styles.tabButton, activeTab === "expenses" && styles.tabButtonActive]}
              >
                <Text style={[styles.tabText, activeTab === "expenses" && styles.tabTextActive]}>
                  Expenses
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setActiveTab("balances")}
                style={[styles.tabButton, activeTab === "balances" && styles.tabButtonActive]}
              >
                <Text style={[styles.tabText, activeTab === "balances" && styles.tabTextActive]}>
                  Balances
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setActiveTab("settlements")}
                style={[styles.tabButton, activeTab === "settlements" && styles.tabButtonActive]}
              >
                <Text style={[styles.tabText, activeTab === "settlements" && styles.tabTextActive]}>
                  Settlements
                </Text>
              </Pressable>
            </View>

            {activeTab === "expenses" ? (
              <>
                {/* Expenses List Section */}
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Expenses</Text>
                  <Pressable
                    onPress={() => router.push({ pathname: "/(tabs)/add-expense", params: { groupId: group.id } })}
                    style={({ pressed }) => [styles.addExpenseLinkButton, pressed && styles.buttonPressed]}
                  >
                    <Text style={styles.addExpenseLinkText}>+ Add Expense</Text>
                  </Pressable>
                </View>

                <View style={styles.expensesCard}>
                  {expenses.length === 0 ? (
                    <EmptyState
                      actionText="Add Expense"
                      description="Add group expenses to start splitting them with members."
                      icon="🧾"
                      onActionPress={() =>
                        router.push({ pathname: "/(tabs)/add-expense", params: { groupId: group.id } })
                      }
                      title="No expenses yet"
                    />
                  ) : (
                    expenses.map((expense) => {
                      const payerName = expense.profiles?.full_name || "Unknown User";
                      const formattedAmount = formatCurrency(parseFloat(expense.amount as any));
                      const formattedExpenseDate = new Date(expense.created_at).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric"
                      });

                      return (
                        <Pressable
                          key={expense.id}
                          onPress={() =>
                            router.push({
                              pathname: "/expense-details",
                              params: { expenseId: expense.id, groupId: group.id }
                            })
                          }
                          style={({ pressed }) => [
                            styles.expenseRow,
                            pressed && styles.buttonPressed
                          ]}
                        >
                          <View style={styles.expenseDetails}>
                            <Text style={styles.expenseTitle}>{expense.title}</Text>
                            <Text style={styles.expenseMeta}>
                              Paid by {payerName} • {formattedExpenseDate}
                            </Text>
                            {expense.notes ? (
                              <Text style={styles.expenseNotes}>{expense.notes}</Text>
                            ) : null}
                          </View>
                          <Text style={styles.expenseAmount}>{formattedAmount}</Text>
                        </Pressable>
                      );
                    })
                  )}
                </View>
              </>
            ) : activeTab === "balances" ? (
              <>
                {/* Pending Approvals Dashboard */}
                {renderPendingApprovals()}

                {/* Balances Section */}
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Who Owes Whom</Text>
                  <Pressable
                    disabled={summaries.length === 0}
                    onPress={() => {
                      if (summaries.length > 0) {
                        setSelectedDebtIndex(0);
                        setSettleAmount(summaries[0].amount.toString());
                      } else {
                        setSelectedDebtIndex(null);
                        setSettleAmount("");
                      }
                      setSettleNotes("");
                      setShowSettleModal(true);
                    }}
                    style={({ pressed }) => [
                      styles.addExpenseLinkButton,
                      summaries.length === 0 && styles.disabledButton,
                      pressed && summaries.length > 0 && styles.buttonPressed
                    ]}
                  >
                    <Text style={[
                      styles.addExpenseLinkText,
                      summaries.length === 0 && styles.disabledButtonText
                    ]}>
                      Record Settlement
                    </Text>
                  </Pressable>
                </View>

                <View style={styles.balancesCard}>
                  {summaries.length === 0 ? (
                    <EmptyState
                      description="No active balances or pending settlements are remaining in this group."
                      icon="🎉"
                      title="Everyone is settled up!"
                    />
                  ) : (
                    summaries.map((summary, idx) => (
                      <View key={idx} style={styles.summaryRow}>
                        <View style={styles.summaryTextContainer}>
                          <Text style={styles.summaryText}>
                            <Text style={styles.boldText}>{summary.fromName}</Text> owes{" "}
                            <Text style={styles.boldText}>{summary.toName}</Text>
                          </Text>
                        </View>
                        <Text style={styles.summaryAmount}>{formatCurrency(summary.amount)}</Text>
                      </View>
                    ))
                  )}
                </View>

                <Text style={styles.sectionTitle}>Member Net Balances</Text>
                <View style={styles.balancesCard}>
                  {balances.map((bal) => {
                    const avatarInitial = bal.fullName.charAt(0).toUpperCase() || "U";
                    const isOwed = bal.netBalance > 0.01;
                    const isOwing = bal.netBalance < -0.01;

                    return (
                      <View key={bal.userId} style={styles.balanceRowItem}>
                        <View style={styles.avatar}>
                          <Text style={styles.avatarText}>{avatarInitial}</Text>
                        </View>
                        <View style={styles.memberInfo}>
                          <Text style={styles.name}>{bal.fullName}</Text>
                          <Text style={styles.email}>{bal.email}</Text>
                        </View>
                        <View style={styles.balanceStatus}>
                          {isOwed ? (
                            <Text style={[styles.statusText, styles.owedText]}>
                              gets back {formatCurrency(bal.netBalance)}
                            </Text>
                          ) : isOwing ? (
                            <Text style={[styles.statusText, styles.owesText]}>
                              owes {formatCurrency(Math.abs(bal.netBalance))}
                            </Text>
                          ) : (
                            <Text style={[styles.statusText, styles.settledText]}>
                              settled up
                            </Text>
                          )}
                        </View>
                      </View>
                    );
                  })}
                </View>
              </>
            ) : (
              <>
                {/* Pending Approvals also in Settlements tab */}
                {renderPendingApprovals()}

                {/* Settlements tab view */}
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Settlement History</Text>
                </View>

                <View style={styles.balancesCard}>
                  {settlementsList.length === 0 ? (
                    <EmptyState
                      description="Record settlement payments when members repay each other."
                      icon="⏳"
                      title="No settlements recorded yet"
                    />
                  ) : (
                    settlementsList.map((settlement) => {
                      const payerName = settlement.payer?.full_name || "Unknown User";
                      const receiverName = settlement.receiver?.full_name || "Unknown User";
                      const formattedAmount = formatCurrency(parseFloat(settlement.amount as any));
                      const formattedDate = new Date(settlement.settled_at).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric"
                      });

                      const badgeStyle = 
                        settlement.status === "confirmed" ? styles.badgeConfirmed :
                        settlement.status === "rejected" ? styles.badgeRejected :
                        styles.badgePending;

                      const badgeText = 
                        settlement.status.charAt(0).toUpperCase() + settlement.status.slice(1);

                      return (
                        <View key={settlement.id} style={styles.settlementHistoryRow}>
                          <View style={styles.settlementHistoryDetails}>
                            <View style={styles.settlementTitleRow}>
                              <Text style={styles.settlementTitle}>
                                <Text style={styles.boldText}>{payerName}</Text> → <Text style={styles.boldText}>{receiverName}</Text>
                              </Text>
                              <View style={[styles.badge, badgeStyle]}>
                                <Text style={styles.badgeText}>{badgeText}</Text>
                              </View>
                            </View>
                            <Text style={styles.settlementMeta}>
                              {formattedDate}
                            </Text>
                            {settlement.notes ? (
                              <Text style={styles.settlementNotes}>Note: {settlement.notes}</Text>
                            ) : null}
                          </View>
                          <View style={styles.settlementAmountContainer}>
                            <Text style={styles.settlementAmountText}>{formattedAmount}</Text>
                          </View>
                        </View>
                      );
                    })
                  )}
                </View>
              </>
            )}

            {/* Members Section */}
            <Text style={styles.sectionTitle}>Members</Text>
            <View style={styles.membersCard}>
              {members.map((member) => {
                const isOwner = member.user_id === group.created_by;
                const displayName = member.profiles?.full_name || "Unknown User";
                const displayEmail = member.profiles?.email || "";
                const avatarInitial = displayName.charAt(0).toUpperCase() || "U";

                return (
                  <View key={member.user_id} style={styles.memberRow}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>{avatarInitial}</Text>
                    </View>
                    <View style={styles.memberInfo}>
                      <View style={styles.nameRow}>
                        <Text style={styles.name}>{displayName}</Text>
                        {isOwner ? (
                          <View style={styles.ownerBadge}>
                            <Text style={styles.ownerText}>Owner</Text>
                          </View>
                        ) : null}
                      </View>
                      {displayEmail ? <Text style={styles.email}>{displayEmail}</Text> : null}
                    </View>
                  </View>
                );
              })}
            </View>
          </>
        ) : (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>Failed to load group details.</Text>
          </View>
        )}
      </ScrollView>

      {/* Settle Up Modal */}
      <Modal
        animationType="slide"
        transparent
        visible={showSettleModal}
        onRequestClose={() => setShowSettleModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Record Settlement</Text>

            <Text style={styles.label}>Select Debt Pairing</Text>
            <Pressable
              onPress={() => setShowDebtSelect(true)}
              style={styles.selector}
            >
              <Text style={[
                styles.selectorText,
                selectedDebtIndex === null && styles.placeholderText
              ]}>
                {selectedDebtIndex !== null && summaries[selectedDebtIndex]
                  ? `${summaries[selectedDebtIndex].fromName} owes ${summaries[selectedDebtIndex].toName} (max ${formatCurrency(summaries[selectedDebtIndex].amount)})`
                  : "Select active debt pairing"}
              </Text>
              <Text style={styles.selectorArrow}>v</Text>
            </Pressable>

            {selectedDebtIndex !== null && summaries[selectedDebtIndex] ? (
              <View style={styles.settlementSummaryContainer}>
                <View style={styles.settlementDetailRow}>
                  <Text style={styles.settlementDetailLabel}>Payer:</Text>
                  <Text style={styles.settlementDetailValue}>
                    {summaries[selectedDebtIndex].fromName}
                  </Text>
                </View>
                <View style={styles.settlementDetailRow}>
                  <Text style={styles.settlementDetailLabel}>Receiver:</Text>
                  <Text style={styles.settlementDetailValue}>
                    {summaries[selectedDebtIndex].toName}
                  </Text>
                </View>
                <View style={styles.settlementDetailRow}>
                  <Text style={styles.settlementDetailLabel}>Outstanding Debt:</Text>
                  <Text style={styles.settlementDetailValueBold}>
                    {formatCurrency(summaries[selectedDebtIndex].amount)}
                  </Text>
                </View>
              </View>
            ) : null}

            <Text style={styles.label}>Amount</Text>
            <TextInput
              keyboardType="decimal-pad"
              onChangeText={setSettleAmount}
              placeholder="₹0.00"
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              value={settleAmount}
            />

            <Text style={styles.label}>Notes (Optional)</Text>
            <TextInput
              onChangeText={setSettleNotes}
              placeholder="e.g. Paid via UPI, Cash, etc."
              placeholderTextColor={colors.textMuted}
              style={styles.input}
              value={settleNotes}
            />

            <View style={styles.modalButtonsRow}>
              <CustomButton
                disabled={settling}
                onPress={handleSaveSettlement}
                style={styles.modalSubmitButton}
                title={settling ? "Submitting..." : "Send Request"}
              />
              <CustomButton
                variant="ghost"
                onPress={() => setShowSettleModal(false)}
                style={styles.modalCancelButton}
                title="Cancel"
              />
            </View>
          </View>
        </View>

        {/* Debt Pairing Select Modal */}
        <Modal
          animationType="fade"
          transparent
          visible={showDebtSelect}
          onRequestClose={() => setShowDebtSelect(false)}
        >
          <Pressable
            style={styles.subModalOverlay}
            onPress={() => setShowDebtSelect(false)}
          >
            <View style={styles.subModalContent}>
              <Text style={styles.modalTitle}>Select Debt Pairing</Text>
              <ScrollView>
                {summaries.map((summary, idx) => (
                  <Pressable
                    key={idx}
                    onPress={() => {
                      setSelectedDebtIndex(idx);
                      setSettleAmount(summary.amount.toString());
                      setShowDebtSelect(false);
                    }}
                    style={styles.groupItem}
                  >
                    <Text style={styles.groupItemText}>
                      {summary.fromName} owes {summary.toName} ({formatCurrency(summary.amount)})
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </View>
          </Pressable>
        </Modal>
      </Modal>
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
  content: {
    padding: 24,
    paddingBottom: 60
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 18
  },
  backButton: {
    paddingVertical: 8
  },
  backText: {
    color: colors.primaryDark,
    fontSize: 15,
    fontWeight: "800"
  },
  deleteButton: {
    backgroundColor: colors.dangerSoft,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  deleteText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: "800"
  },
  statsCard: {
    backgroundColor: colors.card,
    borderRadius: 22,
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 18,
    padding: 18,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 18,
    elevation: 3
  },
  statItem: {
    alignItems: "center",
    flex: 1
  },
  statValue: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "900",
    marginBottom: 4
  },
  statLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "600"
  },
  statDivider: {
    backgroundColor: colors.border,
    width: 1,
    height: "80%",
    alignSelf: "center"
  },
  sectionHeader: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 14,
    marginTop: 24
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
    marginTop: 20,
    marginBottom: 14
  },
  addExpenseLinkButton: {
    backgroundColor: colors.primarySoft,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 20
  },
  addExpenseLinkText: {
    color: colors.primaryDark,
    fontSize: 13,
    fontWeight: "800"
  },
  buttonPressed: {
    opacity: 0.85
  },
  // Expenses styles
  expensesCard: {
    backgroundColor: colors.card,
    borderRadius: 22,
    padding: 8,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 18,
    elevation: 3,
    marginBottom: 14
  },
  expenseRow: {
    alignItems: "center",
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    padding: 14,
    justifyContent: "space-between"
  },
  expenseDetails: {
    flex: 1,
    marginRight: 14
  },
  expenseTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 4
  },
  expenseMeta: {
    color: colors.textMuted,
    fontSize: 12
  },
  expenseNotes: {
    color: colors.textMuted,
    fontSize: 12,
    fontStyle: "italic",
    marginTop: 4,
    backgroundColor: colors.input,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    alignSelf: "flex-start"
  },
  expenseAmount: {
    color: colors.danger,
    fontSize: 16,
    fontWeight: "900"
  },
  noExpensesText: {
    color: colors.textMuted,
    fontSize: 14,
    textAlign: "center",
    paddingVertical: 20,
    fontWeight: "600"
  },
  // Members list styles
  membersCard: {
    backgroundColor: colors.card,
    borderRadius: 22,
    padding: 8,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 18,
    elevation: 3
  },
  memberRow: {
    alignItems: "center",
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    padding: 14,
    justifyContent: "space-between"
  },
  avatar: {
    alignItems: "center",
    backgroundColor: colors.primarySoft,
    borderRadius: 22,
    height: 44,
    justifyContent: "center",
    width: 44
  },
  avatarText: {
    color: colors.primaryDark,
    fontSize: 16,
    fontWeight: "800"
  },
  memberInfo: {
    flex: 1,
    marginLeft: 14
  },
  nameRow: {
    alignItems: "center",
    flexDirection: "row",
    gap: 8,
    marginBottom: 4
  },
  name: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800"
  },
  ownerBadge: {
    backgroundColor: colors.primarySoft,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 2
  },
  ownerText: {
    color: colors.primaryDark,
    fontSize: 11,
    fontWeight: "800"
  },
  email: {
    color: colors.textMuted,
    fontSize: 13
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 40
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 15,
    fontWeight: "600"
  },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: colors.input,
    borderRadius: 16,
    padding: 4,
    marginVertical: 18,
    borderColor: colors.border,
    borderWidth: 1
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12
  },
  tabButtonActive: {
    backgroundColor: colors.card,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1
  },
  tabText: {
    fontSize: 14,
    fontWeight: "700",
    color: colors.textMuted
  },
  tabTextActive: {
    color: colors.text
  },
  balancesCard: {
    backgroundColor: colors.card,
    borderRadius: 22,
    padding: 8,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 18,
    elevation: 3,
    marginBottom: 20
  },
  summaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    borderBottomColor: colors.border,
    borderBottomWidth: 1
  },
  summaryTextContainer: {
    flex: 1,
    marginRight: 14
  },
  summaryText: {
    fontSize: 15,
    color: colors.text,
    fontWeight: "500"
  },
  boldText: {
    fontWeight: "800"
  },
  summaryAmount: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.danger
  },
  noDebtsText: {
    color: colors.primaryDark,
    fontSize: 14,
    textAlign: "center",
    paddingVertical: 20,
    fontWeight: "700"
  },
  balanceRowItem: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderBottomColor: colors.border,
    borderBottomWidth: 1
  },
  balanceStatus: {
    alignItems: "flex-end",
    marginLeft: 14
  },
  statusText: {
    fontSize: 14,
    fontWeight: "800"
  },
  owedText: {
    color: colors.primaryDark
  },
  owesText: {
    color: colors.danger
  },
  settledText: {
    color: colors.textMuted
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end"
  },
  modalContent: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 40,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 10
  },
  modalTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "900",
    marginBottom: 20,
    textAlign: "center"
  },
  label: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 8,
    marginTop: 14
  },
  selector: {
    alignItems: "center",
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 52,
    paddingHorizontal: 14,
    marginBottom: 10
  },
  selectorText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "600"
  },
  placeholderText: {
    color: colors.textMuted
  },
  selectorArrow: {
    color: colors.textMuted,
    fontSize: 20
  },
  input: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    color: colors.text,
    fontSize: 16,
    minHeight: 52,
    paddingHorizontal: 14,
    marginBottom: 20
  },
  modalButtonsRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 10
  },
  modalSubmitButton: {
    flex: 1
  },
  modalCancelButton: {
    flex: 1
  },
  subModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20
  },
  subModalContent: {
    backgroundColor: colors.background,
    borderRadius: 24,
    width: "100%",
    maxHeight: "70%",
    padding: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10
  },
  groupItem: {
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    paddingVertical: 16,
    paddingHorizontal: 8
  },
  groupItemText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "600"
  },
  settlementAmountText: {
    fontSize: 16,
    fontWeight: "800",
    color: colors.primaryDark
  },
  // Disabled state
  disabledButton: {
    backgroundColor: colors.border,
    borderColor: colors.border
  },
  disabledButtonText: {
    color: colors.textMuted
  },
  // Pending approvals styling
  pendingApprovalsContainer: {
    backgroundColor: colors.card,
    borderRadius: 22,
    padding: 16,
    marginBottom: 20,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.04,
    shadowRadius: 16,
    elevation: 2,
    borderWidth: 1,
    borderColor: colors.warning + "33" // transparent warning color
  },
  pendingTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: colors.warning,
    marginBottom: 12
  },
  pendingApprovalRow: {
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    paddingBottom: 12,
    marginBottom: 12,
    flexDirection: "column",
    gap: 10
  },
  pendingDetails: {
    flex: 1
  },
  pendingText: {
    fontSize: 14,
    color: colors.text,
    lineHeight: 20
  },
  pendingNotes: {
    fontSize: 12,
    color: colors.textMuted,
    fontStyle: "italic",
    marginTop: 4
  },
  pendingActions: {
    flexDirection: "row",
    gap: 8,
    alignSelf: "flex-end"
  },
  actionButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center"
  },
  confirmButton: {
    backgroundColor: colors.primary
  },
  rejectButton: {
    backgroundColor: colors.dangerSoft
  },
  actionButtonText: {
    fontSize: 13,
    fontWeight: "800",
    color: colors.white
  },
  rejectButtonText: {
    color: colors.danger
  },
  // Settlement history details styling
  settlementHistoryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 14,
    borderBottomColor: colors.border,
    borderBottomWidth: 1
  },
  settlementHistoryDetails: {
    flex: 1,
    marginRight: 14
  },
  settlementTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 4,
    flexWrap: "wrap"
  },
  settlementTitle: {
    fontSize: 15,
    color: colors.text
  },
  settlementMeta: {
    color: colors.textMuted,
    fontSize: 12
  },
  settlementNotes: {
    color: colors.textMuted,
    fontSize: 12,
    fontStyle: "italic",
    marginTop: 4
  },
  settlementAmountContainer: {
    alignItems: "flex-end"
  },
  badge: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 8
  },
  badgePending: {
    backgroundColor: "#FEF3C7" // Soft Yellow
  },
  badgeConfirmed: {
    backgroundColor: colors.primarySoft
  },
  badgeRejected: {
    backgroundColor: colors.dangerSoft
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "800"
  },
  // Settlement summary layout inside modal
  settlementSummaryContainer: {
    backgroundColor: colors.input,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderColor: colors.border,
    borderWidth: 1
  },
  settlementDetailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 6
  },
  settlementDetailLabel: {
    fontSize: 13,
    color: colors.textMuted,
    fontWeight: "600"
  },
  settlementDetailValue: {
    fontSize: 13,
    color: colors.text,
    fontWeight: "700"
  },
  settlementDetailValueBold: {
    fontSize: 14,
    color: colors.primaryDark,
    fontWeight: "900"
  }
});
