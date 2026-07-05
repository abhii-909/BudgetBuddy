import { supabase } from "../lib/supabase";
import { createNotification, createGroupNotifications } from "./notificationService";

export type Group = {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
};

export type GroupDetails = Group & {
  creator: {
    full_name: string;
    email: string;
  } | null;
};

export type MemberProfile = {
  user_id: string;
  joined_at: string;
  profiles: {
    full_name: string;
    email: string;
    avatar_url: string | null;
  } | null;
};

export type SearchedUser = {
  id: string;
  full_name: string;
  email: string;
  avatar_url: string | null;
};

export type CreateGroupResponse = {
  data: Group | null;
  error: string | null;
};

export type GetGroupsResponse = {
  data: (Group & { 
    group_members: { user_id: string }[];
    expenses: { amount: number }[];
  })[] | null;
  error: string | null;
};

/**
 * Creates a new group and automatically joins the creator as the first member.
 */
export const createGroup = async (name: string, creatorId: string): Promise<CreateGroupResponse> => {
  try {
    if (!name.trim()) {
      throw new Error("Group name cannot be empty.");
    }

    // 1. Insert into groups
    const { data: groupData, error: groupError } = await supabase
      .from("groups")
      .insert({
        name: name.trim(),
        created_by: creatorId
      })
      .select()
      .single();

    if (groupError) {
      throw groupError;
    }

    if (!groupData) {
      throw new Error("Group was created but no data was returned.");
    }

    // 2. Insert creator into group_members
    const { error: memberError } = await supabase
      .from("group_members")
      .insert({
        group_id: groupData.id,
        user_id: creatorId
      });

    if (memberError) {
      // Rollback the created group to avoid orphaned groups
      await supabase.from("groups").delete().eq("id", groupData.id);
      throw memberError;
    }

    return { data: groupData, error: null };
  } catch (error: any) {
    console.error("Error in createGroup service:", error);
    return {
      data: null,
      error: error.message || "Failed to create group."
    };
  }
};

/**
 * Fetches all groups that the user is a member of.
 */
export const getUserGroups = async (userId: string): Promise<GetGroupsResponse> => {
  try {
    // 1. Get group IDs the user belongs to
    const { data: memberGroups, error: memberError } = await supabase
      .from("group_members")
      .select("group_id")
      .eq("user_id", userId);

    if (memberError) throw memberError;
    const groupIds = memberGroups?.map((m) => m.group_id) || [];

    if (groupIds.length === 0) {
      return { data: [], error: null };
    }

    // 2. Fetch groups details and all member associations for counting
    const { data, error } = await supabase
      .from("groups")
      .select(`
        id,
        name,
        created_by,
        created_at,
        group_members(user_id),
        expenses(amount)
      `)
      .in("id", groupIds)
      .order("created_at", { ascending: false });

    if (error) {
      throw error;
    }

    return { data: data as any, error: null };
  } catch (error: any) {
    console.error("Error in getUserGroups service:", error);
    return {
      data: null,
      error: error.message || "Failed to retrieve groups."
    };
  }
};

/**
 * Fetches a single group's details including the creator's profile data.
 */
export const getGroupDetails = async (groupId: string): Promise<{ data: GroupDetails | null; error: string | null }> => {
  try {
    const { data, error } = await supabase
      .from("groups")
      .select(`
        id,
        name,
        created_by,
        created_at,
        creator:created_by (
          full_name,
          email
        )
      `)
      .eq("id", groupId)
      .single();

    if (error) throw error;
    return { data: data as unknown as GroupDetails, error: null };
  } catch (error: any) {
    console.error("Error in getGroupDetails:", error);
    return { data: null, error: error.message || "Failed to load group details." };
  }
};

/**
 * Fetches all members of a group with their profiles.
 */
export const getGroupMembers = async (groupId: string): Promise<{ data: MemberProfile[] | null; error: string | null }> => {
  try {
    const { data, error } = await supabase
      .from("group_members")
      .select(`
        user_id,
        joined_at,
        profiles:user_id (
          full_name,
          email,
          avatar_url
        )
      `)
      .eq("group_id", groupId);

    if (error) throw error;
    return { data: data as unknown as MemberProfile[], error: null };
  } catch (error: any) {
    console.error("Error in getGroupMembers:", error);
    return { data: null, error: error.message || "Failed to load group members." };
  }
};

/**
 * Searches profiles by exact email match or case-insensitive partial full name match.
 */
export const searchUsers = async (query: string): Promise<{ data: SearchedUser[] | null; error: string | null }> => {
  try {
    if (!query.trim()) return { data: [], error: null };

    const trimmedQuery = query.trim();
    const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedQuery);

    let supabaseQuery = supabase.from("profiles").select("id, full_name, email, avatar_url");

    if (isEmail) {
      supabaseQuery = supabaseQuery.eq("email", trimmedQuery.toLowerCase());
    } else {
      supabaseQuery = supabaseQuery.ilike("full_name", `%${trimmedQuery}%`);
    }

    const { data, error } = await supabaseQuery.limit(5);

    if (error) throw error;
    return { data: data as SearchedUser[], error: null };
  } catch (error: any) {
    console.error("Error in searchUsers:", error);
    return { data: null, error: error.message || "Failed to search users." };
  }
};

/**
 * Adds an existing user to group_members. Handles unique constraint violations.
 */
export const addGroupMember = async (groupId: string, userId: string): Promise<{ error: string | null }> => {
  try {
    const { error } = await supabase
      .from("group_members")
      .insert({
        group_id: groupId,
        user_id: userId
      });

    if (error) {
      // Postgres UNIQUE constraint violation code is 23505
      if (error.code === "23505") {
        throw new Error("This user is already a member of this group.");
      }
      throw error;
    }

    // Dispatch background notifications
    (async () => {
      try {
        const [groupRes, joinedUserRes] = await Promise.all([
          supabase.from("groups").select("name").eq("id", groupId).single(),
          supabase.from("profiles").select("full_name").eq("id", userId).single()
        ]);
        const groupName = groupRes.data?.name || "Group";
        const joinedUserName = joinedUserRes.data?.full_name || "Someone";

        await createNotification({
          userId: userId,
          type: "member_joined",
          title: "Added to Group",
          message: `You have been added to the group "${groupName}".`,
          relatedGroupId: groupId
        });

        await createGroupNotifications(
          groupId,
          userId,
          "member_joined",
          "Member Joined Group",
          `${joinedUserName} joined the group "${groupName}".`
        );
      } catch (err) {
        console.error("Failed to send member joined notifications:", err);
      }
    })();

    return { error: null };
  } catch (error: any) {
    console.error("Error in addGroupMember:", error);
    return { error: error.message || "Failed to add member." };
  }
};

/**
 * Deletes a group from the database.
 * Cascading foreign keys handle clean up of group_members and expenses.
 */
export const deleteGroup = async (groupId: string): Promise<{ error: string | null }> => {
  try {
    const { error } = await supabase
      .from("groups")
      .delete()
      .eq("id", groupId);

    if (error) throw error;
    return { error: null };
  } catch (error: any) {
    console.error("Error in deleteGroup service:", error);
    return { error: error.message || "Failed to delete group." };
  }
};

