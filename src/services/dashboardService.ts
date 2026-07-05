import { supabase } from "../lib/supabase";
import { getUserGroups } from "./groupService";
import { calculateGroupBalances, type ExpenseSplit, type Settlement } from "./splitService";

// ─── Public Types ─────────────────────────────────────────────────────────────

export type GroupSummary = {
  groupId: string;
  groupName: string;
  memberCount: number;
  totalExpenses: number;
  userNetBalance: number;
  lastActivityAt: string;
};

export type ActivityType =
  | "expense"
  | "settlement_pending"
  | "settlement_confirmed"
  | "settlement_rejected"
  | "group_created";

export type ActivityItem = {
  id: string;
  type: ActivityType;
  title: string;
  subtitle: string;
  amount: number | null;
  timestamp: string;
  groupId: string;
  groupName: string;
};

export type PendingAction = {
  settlementId: string;
  groupId: string;
  groupName: string;
  payerName: string;
  amount: number;
};

export type DashboardExpense = {
  id: string;
  title: string;
  amount: number;
  paid_by: string;
  group_id: string;
  created_at: string;
  payerName: string;
  groupName: string;
};

export type DashboardData = {
  totalOwed: number;
  totalOwedToMe: number;
  netBalance: number;
  groupSummaries: GroupSummary[];
  recentActivity: ActivityItem[];
  pendingActions: PendingAction[];
  allExpenses: DashboardExpense[];
};

// ─── Internal Bulk Types ──────────────────────────────────────────────────────

type BulkMember = {
  user_id: string;
  group_id: string;
  profiles: { full_name: string; email: string; avatar_url: string | null } | null;
};

type BulkExpense = {
  id: string;
  title: string;
  amount: number;
  paid_by: string;
  group_id: string;
  created_at: string;
  profiles: { full_name: string; email: string; avatar_url: string | null } | null;
};

type BulkSettlement = {
  id: string;
  group_id: string;
  payer_id: string;
  receiver_id: string;
  amount: number;
  status: string;
  settled_at: string;
  notes: string | null;
  payer: { full_name: string; email: string; avatar_url: string | null } | null;
  receiver: { full_name: string; email: string; avatar_url: string | null } | null;
};

// ─── Empty Result ─────────────────────────────────────────────────────────────

const emptyDashboard: DashboardData = {
  totalOwed: 0,
  totalOwedToMe: 0,
  netBalance: 0,
  groupSummaries: [],
  recentActivity: [],
  pendingActions: [],
  allExpenses: [],
};

// ─── Main Service ─────────────────────────────────────────────────────────────

/**
 * Fetches all dashboard data for a user in 5 queries across 2 parallel rounds.
 *
 * Round 1 (parallel, triggered by groupIds):
 *   Q1  getUserGroups        — group list + member counts + expense amounts
 *   Q2  group_members.in()   — all members + profiles for all groups
 *   Q3  expenses.in()        — all expenses + payer profiles, newest first
 *   Q4  settlements.in()     — all settlements + payer/receiver profiles
 *
 * Round 2 (sequential — requires expenseIds from Q3):
 *   Q5  expense_splits.in()  — all splits for the balance engine
 *
 * Zero N+1 pattern. Query count is constant regardless of group count.
 */
export const getDashboardData = async (
  userId: string
): Promise<{ data: DashboardData | null; error: string | null }> => {
  try {
    // ── Round 1a: groups ──────────────────────────────────────────────────
    const groupsStart = Date.now();
    const { data: groupsData, error: groupsError } = await getUserGroups(userId);
    console.log(`[BudgetBuddy] Group Fetch Time took: ${Date.now() - groupsStart}ms`);
    if (groupsError) throw new Error(groupsError);
    if (!groupsData || groupsData.length === 0) {
      return { data: emptyDashboard, error: null };
    }

    const groupIds = groupsData.map((g) => g.id);

    const groupNameMap: Record<string, string> = {};
    const groupCreatedAtMap: Record<string, string> = {};
    groupsData.forEach((g) => {
      groupNameMap[g.id] = g.name;
      groupCreatedAtMap[g.id] = g.created_at;
    });

    // ── Round 1b: parallel bulk fetches ───────────────────────────────────
    const parallelStart = Date.now();
    const [
      membersRes,
      userExpensesRes,
      userSplitsRes,
      userSettlementsRes,
      recentExpensesRes,
      recentSettlementsRes,
      latestExpsRes,
      latestSetsRes,
      pendingSettlementsRes
    ] = await Promise.all([
      // 1. Members (without profiles join to save weight)
      supabase
        .from("group_members")
        .select("user_id, group_id")
        .in("group_id", groupIds),
      // 2. User paid expenses (for balance calculation)
      supabase
        .from("expenses")
        .select("id, amount, paid_by, group_id")
        .eq("paid_by", userId)
        .in("group_id", groupIds),
      // 3. User splits (for balance calculation)
      supabase
        .from("expense_splits")
        .select("id, expense_id, user_id, amount_owed, expenses!inner(group_id)")
        .eq("user_id", userId)
        .in("expenses.group_id", groupIds),
      // 4. User confirmed settlements (for balance calculation)
      supabase
        .from("settlements")
        .select("id, group_id, payer_id, receiver_id, amount, status")
        .eq("status", "confirmed")
        .in("group_id", groupIds)
        .or(`payer_id.eq.${userId},receiver_id.eq.${userId}`),
      // 5. Recent expenses (limit 20)
      supabase
        .from("expenses")
        .select("id, title, amount, paid_by, group_id, created_at, profiles:paid_by ( full_name, email, avatar_url )")
        .in("group_id", groupIds)
        .order("created_at", { ascending: false })
        .limit(20),
      // 6. Recent settlements (limit 20)
      supabase
        .from("settlements")
        .select("id, group_id, payer_id, receiver_id, amount, status, settled_at, notes, payer:payer_id ( full_name, email, avatar_url ), receiver:receiver_id ( full_name, email, avatar_url )")
        .in("group_id", groupIds)
        .order("settled_at", { ascending: false })
        .limit(20),
      // 7. Latest expense timestamps (limit 50)
      supabase
        .from("expenses")
        .select("group_id, created_at")
        .in("group_id", groupIds)
        .order("created_at", { ascending: false })
        .limit(50),
      // 8. Latest settlement timestamps (limit 50)
      supabase
        .from("settlements")
        .select("group_id, settled_at")
        .in("group_id", groupIds)
        .order("settled_at", { ascending: false })
        .limit(50),
      // 9. Pending settlements (user is receiver)
      supabase
        .from("settlements")
        .select("id, group_id, payer_id, receiver_id, amount, status, settled_at, notes, payer:payer_id ( full_name, email, avatar_url )")
        .eq("status", "pending")
        .eq("receiver_id", userId)
        .in("group_id", groupIds),
    ]);
    console.log(`[BudgetBuddy] Parallel Fetch took: ${Date.now() - parallelStart}ms`);

    const allMembers = (membersRes.data || []) as any[];
    const userExpenses = (userExpensesRes.data || []) as any[];
    const userSplits = (userSplitsRes.data || []).map((s: any) => ({
      id: s.id,
      expense_id: s.expense_id,
      user_id: s.user_id,
      amount_owed: s.amount_owed
    }));
    const userSettlements = (userSettlementsRes.data || []) as any[];
    const recentExpenses = (recentExpensesRes.data || []) as any[];
    const recentSettlements = (recentSettlementsRes.data || []) as any[];
    const latestExps = (latestExpsRes.data || []) as any[];
    const latestSets = (latestSetsRes.data || []) as any[];
    const pendingSettlements = (pendingSettlementsRes.data || []) as any[];

    // ── Partition by group ─────────────────────────────────────────────────
    const membersByGroup: Record<string, any[]> = {};
    const userExpensesByGroup: Record<string, any[]> = {};
    const userSplitsByGroup: Record<string, ExpenseSplit[]> = {};
    const userSettlementsByGroup: Record<string, any[]> = {};
    const latestExpenseAtMap: Record<string, string> = {};
    const latestSettlementAtMap: Record<string, string> = {};

    groupIds.forEach((gid) => {
      membersByGroup[gid] = [];
      userExpensesByGroup[gid] = [];
      userSplitsByGroup[gid] = [];
      userSettlementsByGroup[gid] = [];
    });

    allMembers.forEach((m) => { if (membersByGroup[m.group_id]) membersByGroup[m.group_id].push(m); });
    userExpenses.forEach((e) => { if (userExpensesByGroup[e.group_id]) userExpensesByGroup[e.group_id].push(e); });
    
    userSplitsRes.data?.forEach((s: any, idx) => {
      const gid = s.expenses?.group_id;
      if (gid && userSplitsByGroup[gid]) {
        userSplitsByGroup[gid].push(userSplits[idx]);
      }
    });

    userSettlements.forEach((s) => { if (userSettlementsByGroup[s.group_id]) userSettlementsByGroup[s.group_id].push(s); });

    latestExps.forEach((e) => {
      if (!latestExpenseAtMap[e.group_id]) latestExpenseAtMap[e.group_id] = e.created_at;
    });
    latestSets.forEach((s) => {
      if (!latestSettlementAtMap[s.group_id]) latestSettlementAtMap[s.group_id] = s.settled_at;
    });

    // ── Calculate per-group balances ───────────────────────────────────────
    const balanceCalcStart = Date.now();
    let totalOwed = 0;
    let totalOwedToMe = 0;

    const groupSummaries: GroupSummary[] = groupIds.map((gid) => {
      const groupMembers = membersByGroup[gid].map((m) => ({ user_id: m.user_id, profiles: null }));
      const groupExpenses = userExpensesByGroup[gid];
      const groupSplits = userSplitsByGroup[gid];
      const groupSettlements = userSettlementsByGroup[gid];

      const { balances } = calculateGroupBalances(
        groupMembers,
        groupExpenses,
        groupSplits,
        groupSettlements
      );

      const userBalance = balances.find((b) => b.userId === userId);
      const userNetBalance = parseFloat((userBalance?.netBalance ?? 0).toFixed(2));

      if (userNetBalance < -0.01) totalOwed += Math.abs(userNetBalance);
      else if (userNetBalance > 0.01) totalOwedToMe += userNetBalance;

      // Group totals are pre-calculated in getUserGroups (expenses(amount))
      const targetGroup = groupsData.find((g) => g.id === gid);
      const totalExpenses = (targetGroup?.expenses || []).reduce(
        (sum, e) => sum + parseFloat(e.amount as any),
        0
      );

      // Last activity = max(latest expense, latest settlement, group created_at)
      const candidates = [
        latestExpenseAtMap[gid],
        latestSettlementAtMap[gid],
        groupCreatedAtMap[gid],
      ].filter(Boolean) as string[];
      const lastActivityAt = candidates.sort().reverse()[0];

      return {
        groupId: gid,
        groupName: groupNameMap[gid],
        memberCount: groupMembers.length,
        totalExpenses: parseFloat(totalExpenses.toFixed(2)),
        userNetBalance,
        lastActivityAt,
      };
    });

    groupSummaries.sort(
      (a, b) => new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime()
    );
    console.log(`[BudgetBuddy] Balance Calculation took: ${Date.now() - balanceCalcStart}ms`);

    // ── Build activity feed ────────────────────────────────────────────────
    const activityItems: ActivityItem[] = [];

    groupsData.forEach((g) => {
      activityItems.push({
        id: `group-${g.id}`,
        type: "group_created",
        title: `"${g.name}" created`,
        subtitle: g.name,
        amount: null,
        timestamp: g.created_at,
        groupId: g.id,
        groupName: g.name,
      });
    });

    recentExpenses.forEach((e) => {
      const payerName = e.paid_by === userId ? "You" : (e.profiles?.full_name || "Someone");
      activityItems.push({
        id: `expense-${e.id}`,
        type: "expense",
        title: e.title,
        subtitle: `Paid by ${payerName} · ${groupNameMap[e.group_id] || ""}`,
        amount: parseFloat(e.amount as any),
        timestamp: e.created_at,
        groupId: e.group_id,
        groupName: groupNameMap[e.group_id] || "",
      });
    });

    recentSettlements.forEach((s) => {
      const type: ActivityType =
        s.status === "confirmed" ? "settlement_confirmed"
        : s.status === "rejected" ? "settlement_rejected"
        : "settlement_pending";

      const payerName = s.payer_id === userId ? "You" : (s.payer?.full_name || "Someone");
      const receiverName = s.receiver_id === userId ? "You" : (s.receiver?.full_name || "Someone");

      activityItems.push({
        id: `settlement-${s.id}`,
        type,
        title: `${payerName} → ${receiverName}`,
        subtitle: `Payment ${s.status} · ${groupNameMap[s.group_id] || ""}`,
        amount: parseFloat(s.amount as any),
        timestamp: s.settled_at,
        groupId: s.group_id,
        groupName: groupNameMap[s.group_id] || "",
      });
    });

    const recentActivity = activityItems
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 20);

    // ── Pending actions ────────────────────────────────────────────────────
    const pendingActions: PendingAction[] = pendingSettlements.map((s) => ({
      settlementId: s.id,
      groupId: s.group_id,
      groupName: groupNameMap[s.group_id] || "",
      payerName: s.payer?.full_name || "Someone",
      amount: parseFloat(s.amount as any),
    }));

    // ── Flat user-paid expenses for Profile screen stats ───────────────────
    const allExpensesForStats: DashboardExpense[] = userExpenses.map((e) => ({
      id: e.id,
      title: "",
      amount: 0,
      paid_by: e.paid_by,
      group_id: e.group_id,
      created_at: "",
      payerName: "",
      groupName: "",
    }));

    return {
      data: {
        totalOwed: parseFloat(totalOwed.toFixed(2)),
        totalOwedToMe: parseFloat(totalOwedToMe.toFixed(2)),
        netBalance: parseFloat((totalOwedToMe - totalOwed).toFixed(2)),
        groupSummaries,
        recentActivity,
        pendingActions,
        allExpenses: allExpensesForStats,
      },
      error: null,
    };
  } catch (err: any) {
    console.error("Error in getDashboardData:", err);
    return { data: null, error: err.message || "Failed to load dashboard data." };
  }
};

export const getExpenseHistory = async (
  userId: string
): Promise<{ data: DashboardExpense[] | null; error: string | null }> => {
  try {
    const { data: groupsData, error: groupsError } = await getUserGroups(userId);
    if (groupsError) throw new Error(groupsError);
    if (!groupsData || groupsData.length === 0) {
      return { data: [], error: null };
    }
    const groupIds = groupsData.map((g) => g.id);
    const groupNameMap: Record<string, string> = {};
    groupsData.forEach((g) => {
      groupNameMap[g.id] = g.name;
    });

    const { data: expensesData, error: expensesError } = await supabase
      .from("expenses")
      .select("id, title, amount, paid_by, group_id, created_at, profiles:paid_by ( full_name, email, avatar_url )")
      .in("group_id", groupIds)
      .order("created_at", { ascending: false });

    if (expensesError) throw expensesError;

    const allExpensesForHistory: DashboardExpense[] = (expensesData || []).map((e: any) => ({
      id: e.id,
      title: e.title,
      amount: parseFloat(e.amount as any),
      paid_by: e.paid_by,
      group_id: e.group_id,
      created_at: e.created_at,
      payerName: e.paid_by === userId ? "You" : (e.profiles?.full_name || "Unknown"),
      groupName: groupNameMap[e.group_id] || "",
    }));

    return { data: allExpensesForHistory, error: null };
  } catch (err: any) {
    console.error("Error in getExpenseHistory:", err);
    return { data: null, error: err.message || "Failed to load history." };
  }
};
