import { Ionicons } from "@expo/vector-icons";
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
import { Avatar } from "../components/Avatar";
import { useAuth } from "../src/hooks/useAuth";
import { useTheme } from "../src/hooks/useTheme";
import { ColorTheme } from "../src/constants/theme";
import { supabase } from "../src/lib/supabase";
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
  const { theme } = useTheme();
  const colors = theme; // alias for backward compatibility
  const styles = getStyles(colors);
  const { id, initialTab } = useLocalSearchParams<{ id: string; initialTab?: string }>();
  const { user: currentUser } = useAuth();
  
  const [allExpensesCalc, setAllExpensesCalc] = useState<{ id: string; amount: number; paid_by: string }[]>([]);
  
  const [group, setGroup] = useState<GroupDetails | null>(null);
  const [members, setMembers] = useState<MemberProfile[]>([]);
  const [expenses, setExpenses] = useState<ExpenseWithPayer[]>([]);
  const [balances, setBalances] = useState<GroupMemberBalance[]>([]);
  const [summaries, setSummaries] = useState<WhoOwesWhomSummary[]>([]);
  const [settlementsList, setSettlementsList] = useState<SettlementWithProfiles[]>([]);
  const [activeTab, setActiveTab] = useState<"expenses" | "balances" | "settlements">(
    (initialTab as any) || "expenses"
  );
  
  // Settle Up Modal States
  const [showSettleModal, setShowSettleModal] = useState(false);
  const [selectedDebtIndex, setSelectedDebtIndex] = useState<number | null>(null);
  const [showDebtSelect, setShowDebtSelect] = useState(false);
  const [settleAmount, setSettleAmount] = useState("");
  const [settleNotes, setSettleNotes] = useState("");
  const [settling, setSettling] = useState(false);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  // Pagination States
  const [expensesHasMore, setExpensesHasMore] = useState(true);
  const [loadingMoreExpenses, setLoadingMoreExpenses] = useState(false);
  const [settlementsHasMore, setSettlementsHasMore] = useState(true);
  const [loadingMoreSettlements, setLoadingMoreSettlements] = useState(false);

  const loadMoreExpenses = async () => {
    if (loadingMoreExpenses || !expensesHasMore || !id) return;
    setLoadingMoreExpenses(true);
    const nextOffset = expenses.length;
    const res = await getGroupExpenses(id, 20, nextOffset);
    if (res.data) {
      setExpenses((prev) => [...prev, ...(res.data || [])]);
      setExpensesHasMore(res.hasMore ?? false);
    }
    setLoadingMoreExpenses(false);
  };

  const loadMoreSettlements = async () => {
    if (loadingMoreSettlements || !settlementsHasMore || !id) return;
    setLoadingMoreSettlements(true);
    const nextOffset = settlementsList.length;
    const res = await getGroupSettlements(id, 20, nextOffset);
    if (res.data) {
      setSettlementsList((prev) => [...prev, ...(res.data || [])]);
      setSettlementsHasMore(res.hasMore ?? false);
    }
    setLoadingMoreSettlements(false);
  };

  const handleScroll = (event: any) => {
    const { layoutMeasurement, contentOffset, contentSize } = event.nativeEvent;
    const isCloseToBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 100;
    if (isCloseToBottom) {
      if (activeTab === "expenses") {
        loadMoreExpenses();
      } else if (activeTab === "settlements") {
        loadMoreSettlements();
      }
    }
  };

  const loadData = async (isRefreshing = false) => {
    if (!id) return;
    if (isRefreshing) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setExpensesHasMore(true);
    setSettlementsHasMore(true);

    const [
      groupRes,
      membersRes,
      expensesRes,
      splitsRes,
      settlementsRes,
      allExpensesCalcRes,
      allSettlementsCalcRes
    ] = await Promise.all([
      getGroupDetails(id),
      getGroupMembers(id),
      getGroupExpenses(id, 20, 0),
      getGroupSplits(id),
      getGroupSettlements(id, 20, 0),
      supabase
        .from("expenses")
        .select("id, amount, paid_by")
        .eq("group_id", id),
      supabase
        .from("settlements")
        .select("id, payer_id, receiver_id, amount, status")
        .eq("group_id", id)
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
      setExpensesHasMore(expensesRes.hasMore ?? false);
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
      setSettlementsHasMore(settlementsRes.hasMore ?? false);
    }

    const calcExpenses = allExpensesCalcRes.data || [];
    setAllExpensesCalc(calcExpenses);

    const calcSettlements = allSettlementsCalcRes.data || [];

    if (loadedMembers.length > 0) {
      const { balances: computedBalances, summaries: computedSummaries } = calculateGroupBalances(
        loadedMembers,
        calcExpenses.map((e) => ({ id: e.id, amount: e.amount, paid_by: e.paid_by })),
        loadedSplits,
        calcSettlements as any
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

  const handleLeaveGroup = async () => {
    if (!id || !currentUser?.id) return;
    Alert.alert(
      "Leave Group",
      "Are you sure you want to leave this group?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Leave",
          style: "destructive",
          onPress: async () => {
            setLoading(true);
            const { error } = await supabase
              .from("group_members")
              .delete()
              .eq("group_id", id)
              .eq("user_id", currentUser.id);
            setLoading(false);
            if (error) {
              Alert.alert("Failed to leave group", error.message);
            } else {
              Alert.alert("Success", "You have left the group successfully!");
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
          const payerName = settlement.payer_id === currentUser?.id ? "You" : (settlement.payer?.full_name || "Unknown User");
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
  
  // Calculate total spent client-side using all calculated expenses
  const totalSpent = allExpensesCalc.reduce((sum, item) => sum + parseFloat(item.amount as any), 0);

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
        onScroll={handleScroll}
        scrollEventThrottle={400}
      >
        <View style={styles.topRow}>
          <Pressable onPress={() => router.back()} style={styles.backButton}>
            <Ionicons name="chevron-back" size={24} color={colors.primaryDark} />
            <Text style={styles.backText}>Back</Text>
          </Pressable>

          <View style={styles.menuContainer}>
            <Pressable onPress={() => setShowMenu(!showMenu)} style={styles.menuButton}>
              <Ionicons name="ellipsis-vertical" size={22} color={colors.text} />
            </Pressable>

            {showMenu && (
              <>
                <Pressable style={styles.menuOverlay} onPress={() => setShowMenu(false)} />
                <View style={styles.dropdownMenu}>
                  {group && group.created_by === currentUser?.id ? (
                    <Pressable
                      onPress={() => {
                        setShowMenu(false);
                        handleDeleteGroup();
                      }}
                      style={styles.menuItem}
                    >
                      <Ionicons name="trash-outline" size={16} color={colors.danger} style={{ marginRight: 8 }} />
                      <Text style={[styles.menuItemText, styles.destructiveItemText]}>Delete Group</Text>
                    </Pressable>
                  ) : (
                    <Pressable
                      onPress={() => {
                        setShowMenu(false);
                        handleLeaveGroup();
                      }}
                      style={styles.menuItem}
                    >
                      <Ionicons name="log-out-outline" size={16} color={colors.danger} style={{ marginRight: 8 }} />
                      <Text style={[styles.menuItemText, styles.destructiveItemText]}>Leave Group</Text>
                    </Pressable>
                  )}
                </View>
              </>
            )}
          </View>
        </View>

        {group ? (
          <>
            {/* Unified Group Details Hero Premium Card */}
            <View style={styles.premiumHeroCard}>
              <Text style={styles.groupCreatorLabel}>
                {group.created_by === currentUser?.id ? "Created by You" : `Created by ${creatorName}`}
              </Text>
              <Text style={styles.groupNameText} numberOfLines={2}>{group.name}</Text>
              
              <View style={styles.heroStatsContainer}>
                <View style={styles.heroStatColumn}>
                  <Text style={styles.heroStatValue}>{formatCurrency(totalSpent)}</Text>
                  <Text style={styles.heroStatLabel}>Total Spent</Text>
                </View>
                <View style={styles.heroStatDivider} />
                <View style={styles.heroStatColumn}>
                  <Text style={styles.heroStatValue}>{members.length}</Text>
                  <Text style={styles.heroStatLabel}>Members</Text>
                </View>
              </View>
            </View>

            {/* Reusable User Search */}
            {activeTab === "expenses" && (
              <UserSearch
                excludeUserIds={memberIds}
                onSelectUser={handleAddMember}
              />
            )}


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
                  {expenses.length > 0 && (
                    <Pressable
                      onPress={() => router.push({ pathname: "/(tabs)/add-expense", params: { groupId: group.id } })}
                      style={({ pressed }) => [styles.addExpenseLinkButton, pressed && styles.buttonPressed]}
                    >
                      <Text style={styles.addExpenseLinkText}>+ Add Expense</Text>
                    </Pressable>
                  )}
                </View>

                <View style={styles.expensesContainer}>
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
                      const payerName = expense.paid_by === currentUser?.id ? "You" : (expense.profiles?.full_name || "Unknown User");
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
                            styles.expenseCardItem,
                            pressed && styles.buttonPressed
                          ]}
                        >
                          <View style={styles.expenseLeft}>
                            <View style={styles.expenseIconBox}>
                              <Text style={styles.expenseIcon}>🧾</Text>
                            </View>
                            <View style={styles.expenseDetails}>
                              <Text style={styles.expenseTitle}>{expense.title}</Text>
                              <Text style={styles.expenseMeta}>
                                Paid by <Text style={styles.boldText}>{payerName}</Text> • {formattedExpenseDate}
                              </Text>
                              {expense.notes ? (
                                <Text style={styles.expenseNotes}>{expense.notes}</Text>
                              ) : null}
                            </View>
                          </View>
                          <View style={styles.expenseRight}>
                            <Text style={styles.expenseAmount}>{formattedAmount}</Text>
                            <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                          </View>
                        </Pressable>
                      );
                    })
                  )}
                  {loadingMoreExpenses && (
                    <View style={styles.loadingMoreContainer}>
                      <ActivityIndicator size="small" color={colors.primary} />
                    </View>
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

                <View style={styles.debtsContainer}>
                  {summaries.length === 0 ? (
                    <EmptyState
                      description="No active balances or pending settlements are remaining in this group."
                      icon="🎉"
                      title="Everyone is settled up!"
                    />
                  ) : (
                    summaries.map((summary, idx) => {
                      const isFromCurrentUser = summary.fromUserId === currentUser?.id;
                      const isToCurrentUser = summary.toUserId === currentUser?.id;
                      const fromDisplayName = isFromCurrentUser ? "You" : summary.fromName;
                      const toDisplayName = isToCurrentUser ? "You" : summary.toName;

                      const fromMember = members.find((m) => m.user_id === summary.fromUserId);
                      const toMember = members.find((m) => m.user_id === summary.toUserId);

                      return (
                        <View key={idx} style={styles.debtCardItem}>
                          <View style={styles.debtMainRow}>
                            <View style={styles.debtActor}>
                              <Avatar
                                avatarUrl={fromMember?.profiles?.avatar_url}
                                fullName={fromMember?.profiles?.full_name || fromDisplayName}
                                email={fromMember?.profiles?.email || ""}
                                size="small"
                              />
                              <Text style={styles.debtActorName} numberOfLines={1}>
                                {fromDisplayName}
                              </Text>
                            </View>
                            
                            <View style={styles.debtArrowContainer}>
                              <Ionicons name="arrow-forward" size={16} color={colors.textMuted} />
                            </View>

                            <View style={styles.debtActor}>
                              <Avatar
                                avatarUrl={toMember?.profiles?.avatar_url}
                                fullName={toMember?.profiles?.full_name || toDisplayName}
                                email={toMember?.profiles?.email || ""}
                                size="small"
                              />
                              <Text style={styles.debtActorName} numberOfLines={1}>
                                {toDisplayName}
                              </Text>
                            </View>
                          </View>
                          
                          <View style={[
                            styles.debtAmountBadge,
                            isFromCurrentUser && styles.badgeOwe,
                            isToCurrentUser && styles.badgeOwed,
                            !isFromCurrentUser && !isToCurrentUser && styles.badgeNeutral
                          ]}>
                            <Text style={[
                              styles.debtAmountText,
                              isFromCurrentUser && styles.textOwe,
                              isToCurrentUser && styles.textOwed,
                              !isFromCurrentUser && !isToCurrentUser && styles.textNeutral
                            ]}>
                              {formatCurrency(summary.amount)}
                            </Text>
                          </View>
                        </View>
                      );
                    })
                  )}
                </View>


                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Member Net Balances</Text>
                </View>
                <View style={styles.balancesCard}>
                  {balances.map((bal, index) => {
                    const isCurrentUser = bal.userId === currentUser?.id;
                    const displayName = isCurrentUser ? "You" : bal.fullName;
                    const isOwed = bal.netBalance > 0.01;
                    const isOwing = bal.netBalance < -0.01;
                    const isLast = index === balances.length - 1;

                    return (
                      <View key={bal.userId} style={[styles.balanceRowItem, isLast && { borderBottomWidth: 0 }]}>
                        <Avatar
                          avatarUrl={bal.avatar_url}
                          fullName={bal.fullName}
                          email={bal.email}
                          size="medium"
                        />
                        <View style={styles.memberInfo}>
                          <Text style={styles.name}>{displayName}</Text>
                          <Text style={styles.email}>{bal.email}</Text>
                        </View>
                        <View style={styles.balanceStatus}>
                          {isOwed ? (
                            <Text style={[styles.statusText, styles.owedText]}>
                              {isCurrentUser ? "get back" : "gets back"} {formatCurrency(bal.netBalance)}
                            </Text>
                          ) : isOwing ? (
                            <Text style={[styles.statusText, styles.owesText]}>
                              {isCurrentUser ? "owe" : "owes"} {formatCurrency(Math.abs(bal.netBalance))}
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
                    settlementsList.map((settlement, index) => {
                      const payerName = settlement.payer_id === currentUser?.id ? "You" : (settlement.payer?.full_name || "Unknown User");
                      const receiverName = settlement.receiver_id === currentUser?.id ? "You" : (settlement.receiver?.full_name || "Unknown User");
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
                      const isLast = index === settlementsList.length - 1;

                      return (
                        <View key={settlement.id} style={[styles.settlementHistoryRow, isLast && { borderBottomWidth: 0 }]}>
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
                  {loadingMoreSettlements && (
                    <View style={styles.loadingMoreContainer}>
                      <ActivityIndicator size="small" color={colors.primary} />
                    </View>
                  )}
                </View>
              </>
            )}

            {/* Members Section */}
            {activeTab === "expenses" && (
              <>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Members</Text>
                </View>
                <View style={styles.membersCard}>
                  {members.map((member, index) => {
                    const isOwner = member.user_id === group.created_by;
                    const isCurrentUser = member.user_id === currentUser?.id;
                    const displayName = isCurrentUser ? "You" : (member.profiles?.full_name || "Unknown User");
                    const displayEmail = member.profiles?.email || "";
                    const isLast = index === members.length - 1;

                    return (
                      <View key={member.user_id} style={[styles.memberRow, isLast && { borderBottomWidth: 0 }]}>
                        <Avatar
                          avatarUrl={member.profiles?.avatar_url}
                          fullName={member.profiles?.full_name || "Unknown User"}
                          email={displayEmail}
                          size="medium"
                        />
                        <View style={styles.memberInfo}>
                          <Text style={styles.name}>{displayName}</Text>
                          {displayEmail ? (
                            <Text style={styles.email} numberOfLines={1} ellipsizeMode="tail">
                              {displayEmail}
                            </Text>
                          ) : null}
                        </View>
                        {isOwner ? (
                          <View style={styles.ownerBadge}>
                            <Text style={styles.ownerText}>Owner</Text>
                          </View>
                        ) : null}
                      </View>
                    );
                  })}
                </View>
              </>
            )}
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
                  ? `${summaries[selectedDebtIndex].fromUserId === currentUser?.id ? "You" : summaries[selectedDebtIndex].fromName} ${summaries[selectedDebtIndex].fromUserId === currentUser?.id ? "owe" : "owes"} ${summaries[selectedDebtIndex].toUserId === currentUser?.id ? "You" : summaries[selectedDebtIndex].toName} (max ${formatCurrency(summaries[selectedDebtIndex].amount)})`
                  : "Select active debt pairing"}
              </Text>
              <Text style={styles.selectorArrow}>v</Text>
            </Pressable>

            {selectedDebtIndex !== null && summaries[selectedDebtIndex] ? (
              <View style={styles.settlementSummaryContainer}>
                <View style={styles.settlementDetailRow}>
                  <Text style={styles.settlementDetailLabel}>Payer:</Text>
                  <Text style={styles.settlementDetailValue}>
                    {summaries[selectedDebtIndex].fromUserId === currentUser?.id ? "You" : summaries[selectedDebtIndex].fromName}
                  </Text>
                </View>
                <View style={styles.settlementDetailRow}>
                  <Text style={styles.settlementDetailLabel}>Receiver:</Text>
                  <Text style={styles.settlementDetailValue}>
                    {summaries[selectedDebtIndex].toUserId === currentUser?.id ? "You" : summaries[selectedDebtIndex].toName}
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
                {summaries.map((summary, idx) => {
                  const fromDisplayName = summary.fromUserId === currentUser?.id ? "You" : summary.fromName;
                  const toDisplayName = summary.toUserId === currentUser?.id ? "You" : summary.toName;
                  const verb = summary.fromUserId === currentUser?.id ? "owe" : "owes";

                  return (
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
                        {fromDisplayName} {verb} {toDisplayName} ({formatCurrency(summary.amount)})
                      </Text>
                    </Pressable>
                  );
                })}

              </ScrollView>
            </View>
          </Pressable>
        </Modal>
      </Modal>
    </SafeAreaView>
  );
}

const getStyles = (colors: ColorTheme) => StyleSheet.create({
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
    padding: 20,
    paddingBottom: 80
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16
  },
  backButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingVertical: 8,
    marginLeft: -4
  },
  backText: {
    color: colors.primaryDark,
    fontSize: 15,
    fontWeight: "700"
  },
  menuContainer: {
    position: "relative",
    zIndex: 1000
  },
  menuButton: {
    padding: 8,
    marginRight: -8
  },
  menuOverlay: {
    position: "absolute",
    top: -500,
    bottom: -1000,
    left: -1000,
    right: -500,
    zIndex: 999
  },
  dropdownMenu: {
    position: "absolute",
    top: 36,
    right: 0,
    backgroundColor: colors.card,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 6,
    minWidth: 160,
    zIndex: 1000,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 5
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12
  },
  menuItemText: {
    fontSize: 14,
    color: colors.text,
    fontWeight: "600"
  },
  destructiveMenuItem: {
    borderTopWidth: 1,
    borderTopColor: colors.border
  },
  destructiveItemText: {
    color: colors.danger
  },
  premiumHeroCard: {
    backgroundColor: colors.card,
    borderRadius: 28,
    padding: 28,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.08,
    shadowRadius: 30,
    elevation: 4,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 16
  },
  groupCreatorLabel: {
    color: colors.textMuted,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.2,
    marginBottom: 8
  },
  groupNameText: {
    color: colors.text,
    fontSize: 32,
    fontWeight: "900",
    letterSpacing: -1,
    marginBottom: 20
  },
  heroStatsContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.input,
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderWidth: 1,
    borderColor: colors.border
  },
  heroStatColumn: {
    flex: 1
  },
  heroStatValue: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "900",
    letterSpacing: -0.5,
    marginBottom: 4
  },
  heroStatLabel: {
    color: colors.textMuted,
    fontSize: 11,
    fontWeight: "600"
  },
  heroStatDivider: {
    width: 1,
    height: 28,
    backgroundColor: colors.divider,
    marginHorizontal: 16
  },
  tabContainer: {
    flexDirection: "row",
    backgroundColor: colors.input,
    borderRadius: 14,
    padding: 4,
    marginTop: 8,
    marginBottom: 16
  },
  tabButton: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10
  },
  tabButtonActive: {
    backgroundColor: colors.card,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2
  },
  tabText: {
    fontSize: 13,
    fontWeight: "700",
    color: colors.textMuted
  },
  tabTextActive: {
    color: colors.text
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
    marginBottom: 10
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 19,
    fontWeight: "600",
    letterSpacing: -0.3
  },
  addExpenseLinkButton: {
    backgroundColor: colors.primarySoft,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  addExpenseLinkText: {
    color: colors.primaryDark,
    fontSize: 13,
    fontWeight: "700"
  },
  buttonPressed: {
    opacity: 0.82
  },
  expensesContainer: {
    marginBottom: 28
  },
  expenseCardItem: {
    backgroundColor: colors.card,
    borderRadius: 24,
    padding: 18,
    marginBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.04,
    shadowRadius: 18,
    elevation: 2
  },
  expenseLeft: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 12
  },
  expenseIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.input,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 14
  },
  expenseIcon: {
    fontSize: 18
  },
  expenseDetails: {
    flex: 1
  },
  expenseTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 3
  },
  expenseMeta: {
    color: colors.textMuted,
    fontSize: 12
  },
  expenseNotes: {
    color: colors.textMuted,
    fontSize: 11,
    fontStyle: "italic",
    marginTop: 4,
    backgroundColor: colors.input,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: "flex-start",
    borderWidth: 1,
    borderColor: colors.border
  },
  expenseRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  expenseAmount: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800"
  },
  debtsContainer: {
    marginBottom: 28
  },
  debtCardItem: {
    backgroundColor: colors.card,
    borderRadius: 24,
    padding: 16,
    marginBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.04,
    shadowRadius: 18,
    elevation: 2
  },
  debtMainRow: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    marginRight: 12,
    gap: 10
  },
  debtActor: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
    gap: 8
  },
  debtActorName: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "700",
    flex: 1
  },
  debtArrowContainer: {
    width: 24,
    alignItems: "center",
    justifyContent: "center"
  },
  debtAmountBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 10
  },
  debtAmountText: {
    fontSize: 13,
    fontWeight: "800"
  },
  badgeOwe: {
    backgroundColor: colors.dangerSoft
  },
  badgeOwed: {
    backgroundColor: colors.primarySoft
  },
  badgeNeutral: {
    backgroundColor: colors.input
  },
  textOwe: {
    color: colors.danger
  },
  textOwed: {
    color: colors.primaryDark
  },
  textNeutral: {
    color: colors.textMuted
  },
  balancesCard: {
    backgroundColor: colors.card,
    borderRadius: 24,
    padding: 8,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.04,
    shadowRadius: 20,
    elevation: 2,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 28
  },
  balanceRowItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomColor: colors.border,
    borderBottomWidth: 1
  },
  balanceStatus: {
    alignItems: "flex-end",
    marginLeft: 14
  },
  statusText: {
    fontSize: 13,
    fontWeight: "800"
  },
  owedText: {
    color: colors.primary
  },
  owesText: {
    color: colors.danger
  },
  settledText: {
    color: colors.textMuted
  },
  membersCard: {
    backgroundColor: colors.card,
    borderRadius: 24,
    padding: 8,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.04,
    shadowRadius: 20,
    elevation: 2,
    borderWidth: 1,
    borderColor: colors.border
  },
  memberRow: {
    alignItems: "center",
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    paddingHorizontal: 16,
    paddingVertical: 14
  },
  memberInfo: {
    flex: 1,
    marginLeft: 18
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
    fontWeight: "600",
    marginBottom: 2
  },
  ownerBadge: {
    backgroundColor: colors.primarySoft,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: "center"
  },
  ownerText: {
    color: colors.primaryDark,
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5
  },
  email: {
    color: colors.textMuted,
    fontSize: 12
  },
  boldText: {
    fontWeight: "800"
  },
  pendingApprovalsContainer: {
    backgroundColor: colors.card,
    borderRadius: 24,
    padding: 20,
    marginBottom: 20,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.04,
    shadowRadius: 20,
    elevation: 2,
    borderWidth: 1,
    borderColor: colors.warningSoft
  },
  pendingTitle: {
    fontSize: 15,
    fontWeight: "800",
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
    fontSize: 13,
    color: colors.text,
    lineHeight: 18
  },
  pendingNotes: {
    fontSize: 11,
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
  settlementHistoryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
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
    fontSize: 14,
    color: colors.text
  },
  settlementMeta: {
    color: colors.textMuted,
    fontSize: 12
  },
  settlementNotes: {
    color: colors.textMuted,
    fontSize: 11,
    fontStyle: "italic",
    marginTop: 4
  },
  settlementAmountContainer: {
    alignItems: "flex-end"
  },
  settlementAmountText: {
    fontSize: 15,
    fontWeight: "800",
    color: colors.primaryDark
  },
  badge: {
    paddingVertical: 2,
    paddingHorizontal: 8,
    borderRadius: 6
  },
  badgePending: {
    backgroundColor: colors.warningSoft
  },
  badgeConfirmed: {
    backgroundColor: colors.primarySoft
  },
  badgeRejected: {
    backgroundColor: colors.dangerSoft
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "800"
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
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: -10 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 10
  },
  modalTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 20,
    textAlign: "center",
    letterSpacing: -0.5
  },
  label: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 8,
    marginTop: 14
  },
  selector: {
    alignItems: "center",
    backgroundColor: colors.input,
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
    fontSize: 15,
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
    backgroundColor: colors.input,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    color: colors.text,
    fontSize: 15,
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
    shadowColor: colors.shadow,
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
    fontSize: 15,
    fontWeight: "600"
  },
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
    fontSize: 12,
    color: colors.textMuted,
    fontWeight: "600"
  },
  settlementDetailValue: {
    fontSize: 12,
    color: colors.text,
    fontWeight: "700"
  },
  settlementDetailValueBold: {
    fontSize: 13,
    color: colors.primaryDark,
    fontWeight: "900"
  },
  disabledButton: {
    backgroundColor: colors.border,
    borderColor: colors.border
  },
  disabledButtonText: {
    color: colors.textMuted
  },
  loadingMoreContainer: {
    paddingVertical: 16,
    alignItems: "center",
    justifyContent: "center"
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
  }
});
