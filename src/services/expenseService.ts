import { supabase } from "../lib/supabase";

export type Expense = {
  id: string;
  title: string;
  amount: number;
  paid_by: string;
  group_id: string;
  notes: string | null;
  created_at: string;
};

export type ExpenseWithPayer = Expense & {
  profiles: {
    full_name: string;
    email: string;
  } | null;
};

/**
 * Adds a new expense to the group.
 */
export const addExpense = async (
  title: string,
  amount: number,
  paidBy: string,
  groupId: string,
  notes?: string
): Promise<{ data: Expense | null; error: string | null }> => {
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

    const { data, error } = await supabase
      .from("expenses")
      .insert({
        title: title.trim(),
        amount,
        paid_by: paidBy,
        group_id: groupId,
        notes: notes?.trim() || null
      })
      .select()
      .single();

    if (error) throw error;
    return { data: data as Expense, error: null };
  } catch (error: any) {
    console.error("Error in addExpense service:", error);
    return { data: null, error: error.message || "Failed to add expense." };
  }
};

/**
 * Fetches all expenses inside a group.
 */
export const getGroupExpenses = async (
  groupId: string
): Promise<{ data: ExpenseWithPayer[] | null; error: string | null }> => {
  try {
    const { data, error } = await supabase
      .from("expenses")
      .select(`
        id,
        title,
        amount,
        paid_by,
        group_id,
        notes,
        created_at,
        profiles:paid_by (
          full_name,
          email
        )
      `)
      .eq("group_id", groupId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return { data: data as unknown as ExpenseWithPayer[], error: null };
  } catch (error: any) {
    console.error("Error in getGroupExpenses:", error);
    return { data: null, error: error.message || "Failed to retrieve group expenses." };
  }
};

/**
 * Fetches details of a single expense.
 */
export const getExpenseDetails = async (
  expenseId: string
): Promise<{ data: ExpenseWithPayer | null; error: string | null }> => {
  try {
    const { data, error } = await supabase
      .from("expenses")
      .select(`
        id,
        title,
        amount,
        paid_by,
        group_id,
        notes,
        created_at,
        profiles:paid_by (
          full_name,
          email
        )
      `)
      .eq("id", expenseId)
      .single();

    if (error) throw error;
    return { data: data as unknown as ExpenseWithPayer, error: null };
  } catch (error: any) {
    console.error("Error in getExpenseDetails:", error);
    return { data: null, error: error.message || "Failed to load expense details." };
  }
};
