import { router } from "expo-router";
import { useEffect, useState, useCallback } from "react";
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
import { CustomButton } from "../../components/CustomButton";
import { colors } from "../../constants/colors";
import { useAuth } from "../../src/hooks/useAuth";
import { supabase } from "../../src/lib/supabase";
import { getAvatarInitial } from "../../src/utils/avatar";
import { getDashboardData, type DashboardData } from "../../src/services/dashboardService";
import { formatCurrency } from "../../src/utils/format";

export default function ProfileScreen() {
  const { logout, user, updateDisplayName } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [savingName, setSavingName] = useState(false);

  // Data states
  const [profile, setProfile] = useState<{ full_name: string; email: string; created_at: string | null } | null>(null);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [settlementsCount, setSettlementsCount] = useState(0);

  // Edit Name Modal State
  const [showEditModal, setShowEditModal] = useState(false);
  const [newName, setNewName] = useState("");

  const loadProfileData = async (isRefreshing = false) => {
    if (!user) return;
    if (isRefreshing) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      // Parallel fetches: profile, dashboard details, and settlement count
      const [profileRes, dashboardRes, settlementsRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("full_name, email, created_at")
          .eq("id", user.id)
          .maybeSingle(),
        getDashboardData(user.id),
        supabase
          .from("settlements")
          .select("id", { count: "exact", head: true })
          .eq("status", "confirmed")
          .or(`payer_id.eq.${user.id},receiver_id.eq.${user.id}`)
      ]);

      if (profileRes.data) {
        setProfile(profileRes.data);
        setNewName(profileRes.data.full_name);
      }

      if (dashboardRes.data) {
        setDashboard(dashboardRes.data);
      }

      if (settlementsRes.count !== null) {
        setSettlementsCount(settlementsRes.count);
      }
    } catch (err) {
      console.error("Error loading profile details:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadProfileData();
  }, [user]);

  const onRefresh = () => {
    loadProfileData(true);
  };

  const handleLogout = async () => {
    setLoggingOut(true);
    const { error } = await logout();
    setLoggingOut(false);

    if (error) {
      Alert.alert("Logout failed", error);
      return;
    }
    router.replace("/login");
  };

  const handleUpdateName = async () => {
    if (!newName.trim()) {
      Alert.alert("Validation Error", "Please enter a valid display name.");
      return;
    }

    if (!user) return;
    setSavingName(true);

    try {
      // 1. Sync Supabase Auth user metadata
      const { error: authError } = await updateDisplayName(newName.trim());
      if (authError) throw new Error(authError);

      // 2. Update profiles table record
      const { error: dbError } = await supabase
        .from("profiles")
        .update({ full_name: newName.trim() })
        .eq("id", user.id);

      if (dbError) throw dbError;

      Alert.alert("Success", "Profile name updated successfully!");
      setShowEditModal(false);
      loadProfileData();
    } catch (error: any) {
      console.error("Failed to update display name:", error);
      Alert.alert("Update Failed", error.message || "Something went wrong.");
    } finally {
      setSavingName(false);
    }
  };

  // Derive Display Info
  const displayName = profile?.full_name || user?.user_metadata?.full_name || "User";
  const displayEmail = profile?.email || user?.email || "";
  const avatarText = getAvatarInitial(displayName, displayEmail);

  const memberSinceRaw = profile?.created_at || user?.created_at;
  const formattedMemberSince = memberSinceRaw
    ? new Date(memberSinceRaw).toLocaleDateString("en-US", { month: "short", year: "numeric" })
    : "";

  // Derive Stats from Dashboard Data
  const groupsCount = dashboard?.groupSummaries?.length || 0;
  const expensesCount = dashboard?.allExpenses?.filter((e) => e.paid_by === user?.id).length || 0;
  const pendingApprovalsCount = dashboard?.pendingActions?.length || 0;

  if (loading && !dashboard) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={styles.loadingText}>Loading Profile...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl colors={[colors.primary]} onRefresh={onRefresh} refreshing={refreshing} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Card Hero */}
        <View style={styles.heroCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{avatarText}</Text>
          </View>
          <View style={styles.heroDetails}>
            <Text style={styles.heroName}>{displayName}</Text>
            <Text style={styles.heroEmail}>{displayEmail}</Text>
            {formattedMemberSince ? (
              <Text style={styles.heroMemberSince}>Member since {formattedMemberSince}</Text>
            ) : null}
          </View>
        </View>

        {/* Financial Snapshot */}
        <Text style={styles.sectionTitle}>Financial Snapshot</Text>
        <View style={styles.snapshotCard}>
          <View style={styles.snapshotRow}>
            <View style={styles.snapshotItem}>
              <Text style={styles.snapshotLabel}>Total Owed To You</Text>
              <Text style={[styles.snapshotValue, { color: colors.primary }]}>
                {formatCurrency(dashboard?.totalOwedToMe || 0)}
              </Text>
            </View>
            <View style={styles.snapshotDivider} />
            <View style={styles.snapshotItem}>
              <Text style={styles.snapshotLabel}>Total You Owe</Text>
              <Text style={[styles.snapshotValue, { color: colors.danger }]}>
                {formatCurrency(dashboard?.totalOwed || 0)}
              </Text>
            </View>
          </View>
          <View style={styles.snapshotBottomRow}>
            <View style={styles.netBalanceBox}>
              <Text style={styles.snapshotSubLabel}>Net Position</Text>
              <Text
                style={[
                  styles.netBalanceValue,
                  (dashboard?.netBalance || 0) >= 0 ? { color: colors.primary } : { color: colors.danger }
                ]}
              >
                {(dashboard?.netBalance || 0) >= 0 ? "+" : ""}
                {formatCurrency(dashboard?.netBalance || 0)}
              </Text>
            </View>
            {pendingApprovalsCount > 0 ? (
              <View style={styles.pendingBadge}>
                <Text style={styles.pendingBadgeText}>
                  {pendingApprovalsCount} Action Required
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Statistics Section */}
        <Text style={styles.sectionTitle}>Activity & Stats</Text>
        <View style={styles.statsCard}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{groupsCount}</Text>
            <Text style={styles.statLabel}>Groups Joined</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{expensesCount}</Text>
            <Text style={styles.statLabel}>Expenses Paid</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{settlementsCount}</Text>
            <Text style={styles.statLabel}>Settled Items</Text>
          </View>
        </View>

        {/* Settings & Information */}
        <Text style={styles.sectionTitle}>Account Actions</Text>
        <View style={styles.settingsCard}>
          <Pressable onPress={() => setShowEditModal(true)} style={styles.settingRow}>
            <Text style={styles.settingText}>Change Display Name</Text>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        </View>

        <Text style={styles.sectionTitle}>Preferences</Text>
        <View style={styles.settingsCard}>
          <View style={styles.settingRowInfo}>
            <Text style={styles.settingText}>Notifications</Text>
            <Text style={styles.infoLabel}>Soon</Text>
          </View>
          <View style={styles.settingRowInfo}>
            <Text style={styles.settingText}>Dark Mode</Text>
            <Text style={styles.infoLabel}>Soon</Text>
          </View>
          <View style={styles.settingRowInfo}>
            <Text style={styles.settingText}>Help & Support</Text>
            <Text style={styles.chevron}>›</Text>
          </View>
        </View>

        {/* Logout Section */}
        <Text style={styles.sectionTitle}>Logout</Text>
        <CustomButton
          onPress={handleLogout}
          style={styles.logoutButton}
          title={loggingOut ? "Logging Out..." : "Log Out"}
          variant="danger"
        />
      </ScrollView>


      {/* Edit Name Modal */}
      <Modal
        animationType="fade"
        transparent
        visible={showEditModal}
        onRequestClose={() => setShowEditModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Change Display Name</Text>
            
            <Text style={styles.modalLabel}>Display Name</Text>
            <TextInput
              onChangeText={setNewName}
              placeholder="Enter your name"
              placeholderTextColor={colors.textMuted}
              style={styles.modalInput}
              value={newName}
            />

            <View style={styles.modalButtons}>
              <CustomButton
                disabled={savingName}
                onPress={() => setShowEditModal(false)}
                style={styles.modalButton}
                title="Cancel"
                variant="ghost"
              />
              <CustomButton
                disabled={savingName}
                onPress={handleUpdateName}
                style={styles.modalButton}
                title={savingName ? "Saving..." : "Save"}
              />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.background,
    flex: 1
  },
  content: {
    padding: 20,
    paddingBottom: 40
  },
  loadingContainer: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center"
  },
  loadingText: {
    color: colors.textMuted,
    fontSize: 15,
    fontWeight: "600",
    marginTop: 12
  },
  heroCard: {
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: 20,
    flexDirection: "row",
    marginBottom: 24,
    padding: 20,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 3
  },
  avatar: {
    alignItems: "center",
    backgroundColor: colors.primarySoft,
    borderRadius: 36,
    height: 72,
    justifyContent: "center",
    marginRight: 16,
    width: 72
  },
  avatarText: {
    color: colors.primaryDark,
    fontSize: 28,
    fontWeight: "900"
  },
  heroDetails: {
    flex: 1
  },
  heroName: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 4
  },
  heroEmail: {
    color: colors.textMuted,
    fontSize: 14,
    marginBottom: 6
  },
  heroMemberSince: {
    color: colors.textMuted,
    fontSize: 12,
    fontStyle: "italic"
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 12,
    marginTop: 18
  },
  snapshotCard: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 18,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 3,
    marginBottom: 10
  },
  snapshotRow: {
    flexDirection: "row",
    justifyContent: "space-between"
  },
  snapshotItem: {
    alignItems: "center",
    flex: 1
  },
  snapshotLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 6
  },
  snapshotValue: {
    fontSize: 18,
    fontWeight: "900"
  },
  snapshotDivider: {
    backgroundColor: colors.border,
    width: 1
  },
  snapshotBottomRow: {
    alignItems: "center",
    borderTopColor: colors.border,
    borderTopWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 14,
    paddingTop: 12
  },
  netBalanceBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8
  },
  snapshotSubLabel: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "600"
  },
  netBalanceValue: {
    fontSize: 16,
    fontWeight: "800"
  },
  pendingBadge: {
    backgroundColor: colors.warningSoft,
    borderColor: colors.warning,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  pendingBadgeText: {
    color: colors.warning,
    fontSize: 11,
    fontWeight: "700"
  },
  statsCard: {
    backgroundColor: colors.card,
    borderRadius: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 18,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 3,
    marginBottom: 10
  },
  statDivider: {
    backgroundColor: colors.border,
    width: 1
  },
  statItem: {
    alignItems: "center",
    flex: 1
  },
  statValue: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 4
  },
  statLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "600"
  },
  settingsCard: {
    backgroundColor: colors.card,
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 3,
    marginBottom: 10
  },
  settingRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 52,
    paddingHorizontal: 16
  },
  settingRowInfo: {
    alignItems: "center",
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 52,
    paddingHorizontal: 16
  },
  settingText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700"
  },
  chevron: {
    color: colors.textMuted,
    fontSize: 20,
    fontWeight: "800"
  },
  infoLabel: {
    color: colors.textMuted,
    fontSize: 12,
    fontWeight: "600"
  },
  logoutButton: {
    marginBottom: 20
  },
  modalOverlay: {
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
    flex: 1,
    justifyContent: "center"
  },
  modalContent: {
    backgroundColor: colors.card,
    borderRadius: 24,
    padding: 24,
    width: "85%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 10
  },
  modalTitle: {
    color: colors.text,
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 20,
    textAlign: "center"
  },
  modalLabel: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 8
  },
  modalInput: {
    backgroundColor: colors.input,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    color: colors.text,
    fontSize: 16,
    minHeight: 52,
    paddingHorizontal: 14,
    marginBottom: 20
  },
  modalButtons: {
    flexDirection: "row",
    gap: 12
  },
  modalButton: {
    flex: 1,
    minHeight: 48
  }
});
