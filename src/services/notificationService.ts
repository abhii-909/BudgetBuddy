import { supabase } from "../lib/supabase";

export type NotificationType = "expense_added" | "settlement_recorded" | "member_joined";

export type Notification = {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  related_group_id: string | null;
  related_expense_id: string | null;
  related_settlement_id: string | null;
  is_read: boolean;
  created_at: string;
};

/**
 * Creates a notification for a specific user.
 */
export const createNotification = async (payload: {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  relatedGroupId?: string | null;
  relatedExpenseId?: string | null;
  relatedSettlementId?: string | null;
}) => {
  try {
    const { error } = await supabase.from("notifications").insert({
      user_id: payload.userId,
      type: payload.type,
      title: payload.title.trim(),
      message: payload.message.trim(),
      related_group_id: payload.relatedGroupId || null,
      related_expense_id: payload.relatedExpenseId || null,
      related_settlement_id: payload.relatedSettlementId || null,
      is_read: false,
    });
    if (error) throw error;
    return { error: null };
  } catch (error: any) {
    console.error("Error creating notification:", error);
    return { error: error.message || "Failed to create notification." };
  }
};

/**
 * Creates notifications for all members of a group except the trigger user.
 */
export const createGroupNotifications = async (
  groupId: string,
  triggerUserId: string,
  type: NotificationType,
  title: string,
  message: string,
  relatedFields?: {
    relatedExpenseId?: string;
    relatedSettlementId?: string;
  }
) => {
  try {
    // 1. Fetch group members
    const { data: members, error: membersError } = await supabase
      .from("group_members")
      .select("user_id")
      .eq("group_id", groupId);

    if (membersError) throw membersError;
    if (!members || members.length === 0) return { error: null };

    // 2. Filter out trigger user
    const recipientIds = members
      .map((m) => m.user_id)
      .filter((uid) => uid !== triggerUserId);

    if (recipientIds.length === 0) return { error: null };

    // 3. Batch insert notifications
    const notificationsPayload = recipientIds.map((uid) => ({
      user_id: uid,
      type,
      title,
      message,
      related_group_id: groupId,
      related_expense_id: relatedFields?.relatedExpenseId || null,
      related_settlement_id: relatedFields?.relatedSettlementId || null,
      is_read: false,
    }));

    const { error: insertError } = await supabase
      .from("notifications")
      .insert(notificationsPayload);

    if (insertError) throw insertError;
    return { error: null };
  } catch (error: any) {
    console.error("Error in createGroupNotifications:", error);
    return { error: error.message || "Failed to dispatch group notifications." };
  }
};

/**
 * Fetches all notifications for a user, sorted by newest first.
 */
export const getUserNotifications = async (
  userId: string
): Promise<{ data: Notification[] | null; error: string | null }> => {
  try {
    const { data, error } = await supabase
      .from("notifications")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) throw error;
    return { data: data as Notification[], error: null };
  } catch (error: any) {
    console.error("Error fetching user notifications:", error);
    return { data: null, error: error.message || "Failed to load notifications." };
  }
};

/**
 * Fetches unread notifications count for a user.
 */
export const getUnreadNotificationsCount = async (
  userId: string
): Promise<{ count: number; error: string | null }> => {
  try {
    const { count, error } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("is_read", false);

    if (error) throw error;
    return { count: count || 0, error: null };
  } catch (error: any) {
    console.error("Error getting unread count:", error);
    return { count: 0, error: error.message || "Failed to count unread notifications." };
  }
};

/**
 * Marks a specific notification as read.
 */
export const markNotificationAsRead = async (
  notificationId: string
): Promise<{ error: string | null }> => {
  try {
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("id", notificationId);

    if (error) throw error;
    return { error: null };
  } catch (error: any) {
    console.error("Error marking notification as read:", error);
    return { error: error.message || "Failed to mark notification as read." };
  }
};

/**
 * Marks all notifications for a user as read.
 */
export const markAllNotificationsAsRead = async (
  userId: string
): Promise<{ error: string | null }> => {
  try {
    const { error } = await supabase
      .from("notifications")
      .update({ is_read: true })
      .eq("user_id", userId)
      .eq("is_read", false);

    if (error) throw error;
    return { error: null };
  } catch (error: any) {
    console.error("Error marking all notifications as read:", error);
    return { error: error.message || "Failed to mark all notifications as read." };
  }
};
