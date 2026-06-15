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
  profiles: { full_name: string; email: string } | null;
};

type BulkExpense = {
  id: string;
  title: string;
  amount: number;
  paid_by: string;
  group_id: string;
  created_at: string;
  profiles: { full_name: string; email: string } | null;
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
  payer: { full_name: string; email: string } | null;
  receiver: { full_name: string; email: string } | null;
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
    const { data: groupsData, error: groupsError } = await getUserGroups(userId);
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
    const [membersRes, expensesRes, settlementsRes] = await Promise.all([
      // Q2
      supabase
        .from("group_members")
        .select("user_id, group_id, profiles:user_id ( full_name, email )")
        .in("group_id", groupIds),

      // Q3
      supabase
        .from("expenses")
        .select("id, title, amount, paid_by, group_id, created_at, profiles:paid_by ( full_name, email )")
        .in("group_id", groupIds)
        .order("created_at", { ascending: false }),

      // Q4
      supabase
        .from("settlements")
        .select([
          "id", "group_id", "payer_id", "receiver_id", "amount",
          "status", "settled_at", "notes",
          "payer:payer_id ( full_name, email )",
          "receiver:receiver_id ( full_name, email )"
        ].join(", "))
        .in("group_id", groupIds)
        .order("settled_at", { ascending: false }),
    ]);

    const allMembers = (membersRes.data || []) as unknown as BulkMember[];
    const allExpenses = (expensesRes.data || []) as unknown as BulkExpense[];
    const allSettlements = (settlementsRes.data || []) as unknown as BulkSettlement[];

    // ── Round 2: expense_splits ───────────────────────────────────────────
    const expenseIds = allExpenses.map((e) => e.id);
    let allSplits: ExpenseSplit[] = [];
    if (expenseIds.length > 0) {
      const { data: splitsData } = await supabase
        .from("expense_splits")
        .select("id, expense_id, user_id, amount_owed")
        .in("expense_id", expenseIds);
      allSplits = (splitsData || []) as ExpenseSplit[];
    }

    // ── Partition by group ─────────────────────────────────────────────────
    const membersByGroup: Record<string, BulkMember[]> = {};
    const expensesByGroup: Record<string, BulkExpense[]> = {};
    const splitsByGroup: Record<string, ExpenseSplit[]> = {};
    const settlementsByGroup: Record<string, BulkSettlement[]> = {};

    groupIds.forEach((gid) => {
      membersByGroup[gid] = [];
      expensesByGroup[gid] = [];
      splitsByGroup[gid] = [];
      settlementsByGroup[gid] = [];
    });

    allMembers.forEach((m) => { if (membersByGroup[m.group_id]) membersByGroup[m.group_id].push(m); });
    allExpenses.forEach((e) => { if (expensesByGroup[e.group_id]) expensesByGroup[e.group_id].push(e); });

    const expenseGroupMap: Record<string, string> = {};
    allExpenses.forEach((e) => { expenseGroupMap[e.id] = e.group_id; });
    allSplits.forEach((s) => {
      const gid = expenseGroupMap[s.expense_id];
      if (gid && splitsByGroup[gid]) splitsByGroup[gid].push(s);
    });

    allSettlements.forEach((s) => { if (settlementsByGroup[s.group_id]) settlementsByGroup[s.group_id].push(s); });

    // ── Calculate per-group balances ───────────────────────────────────────
    let totalOwed = 0;
    let totalOwedToMe = 0;

    const groupSummaries: GroupSummary[] = groupIds.map((gid) => {
      const members = membersByGroup[gid];
      const expenses = expensesByGroup[gid];
      const splits = splitsByGroup[gid];
      const settlements = settlementsByGroup[gid];

      const { balances } = calculateGroupBalances(
        members as { user_id: string; profiles: { full_name: string; email: string } | null }[],
        expenses.map((e) => ({ id: e.id, amount: e.amount, paid_by: e.paid_by })),
        splits,
        settlements as unknown as Settlement[]
      );

      const userBalance = balances.find((b) => b.userId === userId);
      const userNetBalance = parseFloat((userBalance?.netBalance ?? 0).toFixed(2));

      if (userNetBalance < -0.01) totalOwed += Math.abs(userNetBalance);
      else if (userNetBalance > 0.01) totalOwedToMe += userNetBalance;

      const totalExpenses = expenses.reduce(
        (sum, e) => sum + parseFloat(e.amount as any),
        0
      );

      // Last activity = max(latest expense, latest settlement, group created_at)
      const candidates = [
        expenses[0]?.created_at,
        settlements[0]?.settled_at,
        groupCreatedAtMap[gid],
      ].filter(Boolean) as string[];
      const lastActivityAt = candidates.sort().reverse()[0];

      return {
        groupId: gid,
        groupName: groupNameMap[gid],
        memberCount: members.length,
        totalExpenses: parseFloat(totalExpenses.toFixed(2)),
        userNetBalance,
        lastActivityAt,
      };
    });

    groupSummaries.sort(
      (a, b) => new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime()
    );

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

    allExpenses.forEach((e) => {
      activityItems.push({
        id: `expense-${e.id}`,
        type: "expense",
        title: e.title,
        subtitle: `Paid by ${e.profiles?.full_name || "Someone"} · ${groupNameMap[e.group_id] || ""}`,
        amount: parseFloat(e.amount as any),
        timestamp: e.created_at,
        groupId: e.group_id,
        groupName: groupNameMap[e.group_id] || "",
      });
    });

    allSettlements.forEach((s) => {
      const type: ActivityType =
        s.status === "confirmed" ? "settlement_confirmed"
        : s.status === "rejected" ? "settlement_rejected"
        : "settlement_pending";

      activityItems.push({
        id: `settlement-${s.id}`,
        type,
        title: `${s.payer?.full_name || "Someone"} → ${s.receiver?.full_name || "Someone"}`,
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
    const pendingActions: PendingAction[] = allSettlements
      .filter((s) => s.status === "pending" && s.receiver_id === userId)
      .map((s) => ({
        settlementId: s.id,
        groupId: s.group_id,
        groupName: groupNameMap[s.group_id] || "",
        payerName: s.payer?.full_name || "Someone",
        amount: parseFloat(s.amount as any),
      }));

    // ── Flat expense list for History tab ─────────────────────────────────
    const allExpensesForHistory: DashboardExpense[] = allExpenses.map((e) => ({
      id: e.id,
      title: e.title,
      amount: parseFloat(e.amount as any),
      paid_by: e.paid_by,
      group_id: e.group_id,
      created_at: e.created_at,
      payerName: e.profiles?.full_name || "Unknown",
      groupName: groupNameMap[e.group_id] || "",
    }));

    return {
      data: {
        totalOwed: parseFloat(totalOwed.toFixed(2)),
        totalOwedToMe: parseFloat(totalOwedToMe.toFixed(2)),
        netBalance: parseFloat((totalOwedToMe - totalOwed).toFixed(2)),
        groupSummaries,
        recentActivity,
        pendingActions,
        allExpenses: allExpensesForHistory,
      },
      error: null,
    };
  } catch (err: any) {
    console.error("Error in getDashboardData:", err);
    return { data: null, error: err.message || "Failed to load dashboard data." };
  }
};
