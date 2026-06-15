import { supabase } from "../lib/supabase";

export type ExpenseSplit = {
  id: string;
  expense_id: string;
  user_id: string;
  amount_owed: number;
};

export type Settlement = {
  id: string;
  group_id: string;
  payer_id: string;
  receiver_id: string;
  amount: number;
  settled_at: string;
  status: string;
  confirmed_at: string | null;
  confirmed_by: string | null;
  notes: string | null;
};

export type SettlementWithProfiles = Settlement & {
  payer: {
    full_name: string;
    email: string;
  } | null;
  receiver: {
    full_name: string;
    email: string;
  } | null;
};

export type GroupMemberBalance = {
  userId: string;
  fullName: string;
  email: string;
  netBalance: number; // Positive means they are owed money, negative means they owe money
};

export type WhoOwesWhomSummary = {
  fromUserId: string;
  fromName: string;
  toUserId: string;
  toName: string;
  amount: number;
};

/**
 * Creates an expense and its corresponding splits.
 */
export const addExpenseWithSplits = async (
  title: string,
  amount: number,
  paidBy: string,
  groupId: string,
  participantIds: string[],
  notes?: string
): Promise<{ data: { expenseId: string } | null; error: string | null }> => {
  try {
    if (!title.trim()) {
      throw new Error("Expense title cannot be empty.");
    }
    if (isNaN(amount) || amount <= 0) {
      throw new Error("Amount must be a positive number.");
    }
    if (!groupId) {
      throw new Error("A group must be selected.");
    }
    if (participantIds.length === 0) {
      throw new Error("At least one participant must be selected.");
    }

    // 1. Insert the parent expense
    const { data: expenseData, error: expenseError } = await supabase
      .from("expenses")
      .insert({
        title: title.trim(),
        amount,
        paid_by: paidBy,
        group_id: groupId,
        notes: notes?.trim() || null
      })
      .select("id")
      .single();

    if (expenseError) throw expenseError;
    if (!expenseData) throw new Error("No expense data returned.");

    const expenseId = expenseData.id;

    // 2. Prepare splits (equally divided)
    const splitAmount = parseFloat((amount / participantIds.length).toFixed(2));
    
    // To handle rounding errors, adjust the last person's share slightly if needed
    const totalSplitsAmount = splitAmount * participantIds.length;
    const difference = parseFloat((amount - totalSplitsAmount).toFixed(2));

    const splitsPayload = participantIds.map((userId, idx) => {
      // Add the rounding difference to the first participant
      const share = idx === 0 ? parseFloat((splitAmount + difference).toFixed(2)) : splitAmount;
      return {
        expense_id: expenseId,
        user_id: userId,
        amount_owed: share
      };
    });

    // 3. Batch insert the splits
    const { error: splitsError } = await supabase
      .from("expense_splits")
      .insert(splitsPayload);

    if (splitsError) {
      // Rollback the expense to keep integrity
      await supabase.from("expenses").delete().eq("id", expenseId);
      throw splitsError;
    }

    return { data: { expenseId }, error: null };
  } catch (error: any) {
    console.error("Error in addExpenseWithSplits service:", error);
    return { data: null, error: error.message || "Failed to add split expense." };
  }
};

/**
 * Fetches all splits for a group's expenses.
 */
export const getGroupSplits = async (groupId: string): Promise<{ data: ExpenseSplit[] | null; error: string | null }> => {
  try {
    // 1. Fetch expenses in the group to get their IDs
    const { data: expenses, error: expError } = await supabase
      .from("expenses")
      .select("id")
      .eq("group_id", groupId);

    if (expError) throw expError;
    const expenseIds = expenses?.map((e) => e.id) || [];

    if (expenseIds.length === 0) {
      return { data: [], error: null };
    }

    // 2. Fetch splits matching these expense IDs
    const { data: splits, error: splitsError } = await supabase
      .from("expense_splits")
      .select("id, expense_id, user_id, amount_owed")
      .in("expense_id", expenseIds);

    if (splitsError) throw splitsError;
    return { data: splits as ExpenseSplit[], error: null };
  } catch (error: any) {
    console.error("Error in getGroupSplits:", error);
    return { data: null, error: error.message || "Failed to load splits." };
  }
};

/**
 * Fetches all settlements recorded for a group, including profiles for payer and receiver.
 */
export const getGroupSettlements = async (groupId: string): Promise<{ data: SettlementWithProfiles[] | null; error: string | null }> => {
  try {
    const { data, error } = await supabase
      .from("settlements")
      .select(`
        id,
        group_id,
        payer_id,
        receiver_id,
        amount,
        settled_at,
        status,
        notes,
        confirmed_at,
        confirmed_by,
        payer:payer_id (
          full_name,
          email
        ),
        receiver:receiver_id (
          full_name,
          email
        )
      `)
      .eq("group_id", groupId)
      .order("settled_at", { ascending: false });

    if (error) throw error;
    return { data: data as unknown as SettlementWithProfiles[], error: null };
  } catch (error: any) {
    console.error("Error in getGroupSettlements:", error);
    return { data: null, error: error.message || "Failed to load settlements." };
  }
};

/**
 * Creates a pending settlement request between two group members.
 */
export const createSettlementRequest = async (
  groupId: string,
  payerId: string,
  receiverId: string,
  amount: number,
  notes?: string
): Promise<{ error: string | null }> => {
  try {
    if (!groupId) {
      throw new Error("Group ID is required.");
    }
    if (!payerId || !receiverId) {
      throw new Error("Payer and receiver are required.");
    }
    if (payerId === receiverId) {
      throw new Error("Payer and receiver cannot be the same person.");
    }
    if (isNaN(amount) || amount <= 0) {
      throw new Error("Settlement amount must be greater than 0.");
    }

    const { error } = await supabase
      .from("settlements")
      .insert({
        group_id: groupId,
        payer_id: payerId,
        receiver_id: receiverId,
        amount,
        status: "pending",
        notes: notes?.trim() || null,
        settled_at: new Date().toISOString()
      });

    if (error) throw error;
    return { error: null };
  } catch (error: any) {
    console.error("Error in createSettlementRequest service:", error);
    return { error: error.message || "Failed to submit settlement request." };
  }
};

/**
 * Confirms a pending settlement. Only receiver should call this.
 */
export const confirmSettlement = async (
  settlementId: string,
  userId: string
): Promise<{ error: string | null }> => {
  try {
    const { data: settlement, error: fetchError } = await supabase
      .from("settlements")
      .select("status")
      .eq("id", settlementId)
      .single();

    if (fetchError) throw fetchError;
    if (!settlement) {
      throw new Error("Settlement not found.");
    }
    if (settlement.status !== "pending") {
      throw new Error("This settlement has already been processed.");
    }

    const { error } = await supabase
      .from("settlements")
      .update({
        status: "confirmed",
        confirmed_at: new Date().toISOString(),
        confirmed_by: userId
      })
      .eq("id", settlementId);

    if (error) throw error;
    return { error: null };
  } catch (error: any) {
    console.error("Error in confirmSettlement service:", error);
    return { error: error.message || "Failed to confirm settlement." };
  }
};

/**
 * Rejects a pending settlement. Only receiver should call this.
 */
export const rejectSettlement = async (
  settlementId: string
): Promise<{ error: string | null }> => {
  try {
    const { data: settlement, error: fetchError } = await supabase
      .from("settlements")
      .select("status")
      .eq("id", settlementId)
      .single();

    if (fetchError) throw fetchError;
    if (!settlement) {
      throw new Error("Settlement not found.");
    }
    if (settlement.status !== "pending") {
      throw new Error("This settlement has already been processed.");
    }

    const { error } = await supabase
      .from("settlements")
      .update({
        status: "rejected"
      })
      .eq("id", settlementId);

    if (error) throw error;
    return { error: null };
  } catch (error: any) {
    console.error("Error in rejectSettlement service:", error);
    return { error: error.message || "Failed to reject settlement." };
  }
};

/**
 * Calculates net balances and who owes whom for a group.
 */
export const calculateGroupBalances = (
  members: { user_id: string; profiles: { full_name: string; email: string } | null }[],
  expenses: { id: string; amount: number; paid_by: string }[],
  splits: ExpenseSplit[],
  settlements: Settlement[]
): { balances: GroupMemberBalance[]; summaries: WhoOwesWhomSummary[] } => {
  // 1. Initialize balances map for all group members
  const balanceMap: { [userId: string]: { fullName: string; email: string; paid: number; owes: number; settledPaid: number; settledRecv: number } } = {};

  members.forEach((m) => {
    balanceMap[m.user_id] = {
      fullName: m.profiles?.full_name || "Unknown User",
      email: m.profiles?.email || "",
      paid: 0,
      owes: 0,
      settledPaid: 0,
      settledRecv: 0
    };
  });

  // 2. Aggregate paid amounts from expenses
  expenses.forEach((e) => {
    if (balanceMap[e.paid_by]) {
      balanceMap[e.paid_by].paid += parseFloat(e.amount as any);
    }
  });

  // 3. Aggregate owed amounts from splits
  splits.forEach((s) => {
    if (balanceMap[s.user_id]) {
      balanceMap[s.user_id].owes += parseFloat(s.amount_owed as any);
    }
  });

  // 4. Aggregate settlements
  settlements.forEach((set) => {
    if (set.status === "confirmed") {
      if (balanceMap[set.payer_id]) {
        balanceMap[set.payer_id].settledPaid += parseFloat(set.amount as any);
      }
      if (balanceMap[set.receiver_id]) {
        balanceMap[set.receiver_id].settledRecv += parseFloat(set.amount as any);
      }
    }
  });

  // 5. Calculate final net balances
  const balances: GroupMemberBalance[] = Object.keys(balanceMap).map((userId) => {
    const u = balanceMap[userId];
    // Net balance = (Paid directly) - (What you owe) + (What you settled/paid back) - (What others settled/paid you)
    const netBalance = u.paid - u.owes + u.settledPaid - u.settledRecv;
    return {
      userId,
      fullName: u.fullName,
      email: u.email,
      netBalance: parseFloat(netBalance.toFixed(2))
    };
  });

  // 6. Calculate Who Owes Whom summaries (Splitwise settlement algorithm)
  const summaries: WhoOwesWhomSummary[] = [];

  // Separate members into debtors (net balance < 0) and creditors (net balance > 0)
  const debtors = balances
    .filter((b) => b.netBalance < -0.01)
    .map((b) => ({ ...b, balance: Math.abs(b.netBalance) }))
    .sort((a, b) => b.balance - a.balance); // largest debts first

  const creditors = balances
    .filter((b) => b.netBalance > 0.01)
    .map((b) => ({ ...b, balance: b.netBalance }))
    .sort((a, b) => b.balance - a.balance); // largest credits first

  let dIdx = 0;
  let cIdx = 0;

  while (dIdx < debtors.length && cIdx < creditors.length) {
    const debtor = debtors[dIdx];
    const creditor = creditors[cIdx];

    const amountToSettle = Math.min(debtor.balance, creditor.balance);

    if (amountToSettle > 0.01) {
      summaries.push({
        fromUserId: debtor.userId,
        fromName: debtor.fullName,
        toUserId: creditor.userId,
        toName: creditor.fullName,
        amount: parseFloat(amountToSettle.toFixed(2))
      });
    }

    debtor.balance -= amountToSettle;
    creditor.balance -= amountToSettle;

    if (debtor.balance < 0.01) dIdx++;
    if (creditor.balance < 0.01) cIdx++;
  }

  return { balances, summaries };
};

/**
 * Updates an expense and its splits.
 */
export const updateExpenseWithSplits = async (
  expenseId: string,
  title: string,
  amount: number,
  groupId: string,
  participantIds: string[],
  notes?: string
): Promise<{ error: string | null }> => {
  try {
    if (!expenseId) {
      throw new Error("Expense ID is required.");
    }
    if (!title.trim()) {
      throw new Error("Expense title cannot be empty.");
    }
    if (isNaN(amount) || amount <= 0) {
      throw new Error("Amount must be a positive number.");
    }
    if (participantIds.length === 0) {
      throw new Error("At least one participant must be selected.");
    }

    // 1. Check if group has confirmed settlements
    const { hasConfirmed, error: sError } = await hasConfirmedSettlements(groupId);
    if (sError) throw new Error(sError);
    if (hasConfirmed) {
      throw new Error("This expense cannot be edited because settlements have already been recorded and confirmed in this group.");
    }

    // 2. Update the parent expense
    const { error: expenseError } = await supabase
      .from("expenses")
      .update({
        title: title.trim(),
        amount,
        notes: notes?.trim() || null
      })
      .eq("id", expenseId);

    if (expenseError) throw expenseError;

    // 3. Delete existing splits
    const { error: deleteError } = await supabase
      .from("expense_splits")
      .delete()
      .eq("expense_id", expenseId);

    if (deleteError) throw deleteError;

    // 4. Prepare new splits (equally divided)
    const splitAmount = parseFloat((amount / participantIds.length).toFixed(2));
    const totalSplitsAmount = splitAmount * participantIds.length;
    const difference = parseFloat((amount - totalSplitsAmount).toFixed(2));

    const splitsPayload = participantIds.map((userId, idx) => {
      const share = idx === 0 ? parseFloat((splitAmount + difference).toFixed(2)) : splitAmount;
      return {
        expense_id: expenseId,
        user_id: userId,
        amount_owed: share
      };
    });

    // 5. Batch insert splits
    const { error: splitsError } = await supabase
      .from("expense_splits")
      .insert(splitsPayload);

    if (splitsError) throw splitsError;

    return { error: null };
  } catch (error: any) {
    console.error("Error in updateExpenseWithSplits service:", error);
    return { error: error.message || "Failed to update expense." };
  }
};

/**
 * Deletes an expense and its associated splits.
 */
export const deleteExpense = async (
  expenseId: string,
  groupId: string
): Promise<{ error: string | null }> => {
  try {
    if (!expenseId) {
      throw new Error("Expense ID is required.");
    }

    // 1. Check if group has confirmed settlements
    const { hasConfirmed, error: sError } = await hasConfirmedSettlements(groupId);
    if (sError) throw new Error(sError);
    if (hasConfirmed) {
      throw new Error("This expense cannot be deleted because settlements have already been recorded and confirmed in this group.");
    }

    // 2. Delete splits first (defense-in-depth for missing cascade constraints)
    const { error: splitsError } = await supabase
      .from("expense_splits")
      .delete()
      .eq("expense_id", expenseId);

    if (splitsError) throw splitsError;

    // 3. Delete parent expense
    const { error } = await supabase
      .from("expenses")
      .delete()
      .eq("id", expenseId);

    if (error) throw error;

    return { error: null };
  } catch (error: any) {
    console.error("Error in deleteExpense service:", error);
    return { error: error.message || "Failed to delete expense." };
  }
};

/**
 * Checks if a group has any confirmed settlements.
 */
export const hasConfirmedSettlements = async (
  groupId: string
): Promise<{ hasConfirmed: boolean; error: string | null }> => {
  try {
    const { data, error } = await supabase
      .from("settlements")
      .select("id")
      .eq("group_id", groupId)
      .eq("status", "confirmed")
      .limit(1);

    if (error) throw error;
    return { hasConfirmed: data && data.length > 0, error: null };
  } catch (error: any) {
    console.error("Error in hasConfirmedSettlements:", error);
    return { hasConfirmed: false, error: error.message || "Failed to check group settlements." };
  }
};
