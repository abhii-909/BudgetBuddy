import { Ionicons } from "@expo/vector-icons";
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
import { useAuth } from "../../src/hooks/useAuth";
import { supabase } from "../../src/lib/supabase";
import { Avatar } from "../../components/Avatar";
import { pickAndUploadAvatar, deleteAvatar } from "../../src/services/avatarService";
import { getDashboardData, type DashboardData } from "../../src/services/dashboardService";
import { formatCurrency } from "../../src/utils/format";
import { useTheme } from "../../src/hooks/useTheme";
import { ColorTheme } from "../../src/constants/theme";

export default function ProfileScreen() {
  const { logout, user, updateDisplayName, refreshProfile } = useAuth();
  const { theme, isDark, setThemeMode } = useTheme();
  const styles = getStyles(theme);
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [savingName, setSavingName] = useState(false);
  const [uploading, setUploading] = useState(false);

  // Data states
  const [profile, setProfile] = useState<{ full_name: string; email: string; created_at: string | null; avatar_url: string | null } | null>(null);
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
          .select("full_name, email, created_at, avatar_url")
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
      await refreshProfile();
      loadProfileData();
    } catch (error: any) {
      console.error("Failed to update display name:", error);
      Alert.alert("Update Failed", error.message || "Something went wrong.");
    } finally {
      setSavingName(false);
    }
  };

  const handleToggleTheme = async () => {
    // If currently dark, switch to light. If currently light, switch to dark.
    await setThemeMode(isDark ? "light" : "dark");
  };

  const handlePickAvatar = async () => {
    if (!user) return;
    setUploading(true);
    const { data: storagePath, error } = await pickAndUploadAvatar(user.id);
    setUploading(false);

    if (error) {
      Alert.alert("Upload Error", error);
    } else if (storagePath) {
      // Immediately reflect the new avatar in local state (before the network round-trip)
      setProfile(prev => prev ? { ...prev, avatar_url: storagePath } : null);
      // Synchronize auth context so Dashboard header also updates
      await refreshProfile();
      // Re-fetch profile to confirm the saved state from the database
      await loadProfileData();
    }
  };

  const handleRemoveAvatar = () => {
    if (!user) return;

    Alert.alert(
      "Remove Profile Photo?",
      "Your profile photo will be deleted and your initials will be displayed instead.",
      [
        {
          text: "Cancel",
          style: "cancel"
        },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            setUploading(true);
            const { success, error } = await deleteAvatar(user.id);
            setUploading(false);

            if (!success || error) {
              Alert.alert("Error Removing Photo", error || "Failed to delete avatar.");
            } else {
              setProfile(prev => prev ? { ...prev, avatar_url: null } : null);
              await refreshProfile();
              loadProfileData();
            }
          }
        }
      ]
    );
  };

  // Derive Display Info
  const displayName = profile?.full_name || user?.user_metadata?.full_name || "User";
  const displayEmail = profile?.email || user?.email || "";

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
          <ActivityIndicator color={theme.primary} size="large" />
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
          <RefreshControl colors={[theme.primary]} onRefresh={onRefresh} refreshing={refreshing} />
        }
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Header Row with Theme Toggle */}
        <View style={styles.headerRow}>
          <Text style={styles.headerTitle}>Profile</Text>
          <Pressable
            accessibilityLabel={isDark ? "Switch to light mode" : "Switch to dark mode"}
            accessibilityRole="button"
            onPress={handleToggleTheme}
            style={({ pressed }) => [
              styles.themeToggleButton,
              pressed && styles.themeToggleButtonPressed
            ]}
          >
            <Ionicons
              name={isDark ? "sunny-outline" : "moon-outline"}
              size={22}
              color={isDark ? "#F59E0B" : theme.text}
            />
          </Pressable>
        </View>

        {/* Profile Card Hero */}
        <View style={styles.heroCard}>
          <View style={styles.avatarContainer}>
            <Avatar
              avatarUrl={profile?.avatar_url}
              fullName={displayName}
              email={displayEmail}
              size="large"
              onPress={handlePickAvatar}
              loading={uploading}
            />
            <Pressable onPress={handlePickAvatar} disabled={uploading}>
              <Text style={styles.changePhotoText}>
                {profile?.avatar_url ? "Change Photo" : "Upload Photo"}
              </Text>
            </Pressable>
            {profile?.avatar_url ? (
              <Pressable onPress={handleRemoveAvatar} disabled={uploading}>
                <Text style={styles.removePhotoText}>Remove Photo</Text>
              </Pressable>
            ) : null}
          </View>
          <View style={styles.heroDetails}>
            <Text style={styles.heroName}>{displayName}</Text>
            <Text style={styles.heroEmail}>{displayEmail}</Text>
            {formattedMemberSince ? (
              <Text style={styles.heroMemberSince}>Member since {formattedMemberSince}</Text>
            ) : null}
          </View>
        </View>

        {/* Your Balance */}
        <Text style={styles.sectionTitle}>Your Balance</Text>
        <View style={styles.snapshotCard}>
          <View style={styles.snapshotRow}>
            <View style={styles.snapshotItem}>
              <Text style={styles.snapshotLabel}>To Receive</Text>
              <Text style={[styles.snapshotValue, { color: theme.primary }]}>
                {formatCurrency(dashboard?.totalOwedToMe || 0)}
              </Text>
            </View>
            <View style={styles.snapshotDivider} />
            <View style={styles.snapshotItem}>
              <Text style={styles.snapshotLabel}>To Pay</Text>
              <Text style={[styles.snapshotValue, { color: theme.danger }]}>
                {formatCurrency(dashboard?.totalOwed || 0)}
              </Text>
            </View>
          </View>
          <View style={styles.snapshotBottomRow}>
            <View style={styles.netBalanceBox}>
              <Text style={styles.snapshotSubLabel}>Net Balance</Text>
              <Text
                style={[
                  styles.netBalanceValue,
                  (dashboard?.netBalance || 0) >= 0 ? { color: theme.primary } : { color: theme.danger }
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

        {/* Your Activity Section */}
        <Text style={styles.sectionTitle}>Your Activity</Text>
        <View style={styles.statsCard}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{groupsCount}</Text>
            <Text style={styles.statLabel}>Groups</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{expensesCount}</Text>
            <Text style={styles.statLabel}>Expenses</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{settlementsCount}</Text>
            <Text style={styles.statLabel}>Settlements</Text>
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

        {/* Logout Section */}
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
              placeholderTextColor={theme.textMuted}
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
const getStyles = (theme: ColorTheme) => StyleSheet.create({
  safeArea: {
    backgroundColor: theme.background,
    flex: 1
  },
  content: {
    padding: 20,
    paddingBottom: 40
  },
  headerRow: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20
  },
  headerTitle: {
    color: theme.text,
    fontSize: 26,
    fontWeight: "900"
  },
  themeToggleButton: {
    alignItems: "center",
    backgroundColor: theme.surface,
    borderColor: theme.border,
    borderRadius: 22,
    borderWidth: 1,
    elevation: 2,
    height: 44,
    justifyContent: "center",
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 10,
    width: 44
  },
  themeToggleButtonPressed: {
    opacity: 0.75,
    transform: [{ scale: 0.95 }]
  },
  loadingContainer: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center"
  },
  loadingText: {
    color: theme.textMuted,
    fontSize: 15,
    fontWeight: "600",
    marginTop: 12
  },
  heroCard: {
    alignItems: "center",
    backgroundColor: theme.card,
    borderRadius: 20,
    flexDirection: "row",
    marginBottom: 24,
    padding: 20,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 3
  },
  avatarContainer: {
    alignItems: "center",
    marginRight: 16,
    gap: 8
  },
  changePhotoText: {
    color: theme.primary,
    fontSize: 12,
    fontWeight: "700"
  },
  removePhotoText: {
    color: theme.danger,
    fontSize: 12,
    fontWeight: "700"
  },
  heroDetails: {
    flex: 1
  },
  heroName: {
    color: theme.text,
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 4
  },
  heroEmail: {
    color: theme.textMuted,
    fontSize: 14,
    marginBottom: 6
  },
  heroMemberSince: {
    color: theme.textMuted,
    fontSize: 12,
    fontStyle: "italic"
  },
  sectionTitle: {
    color: theme.text,
    fontSize: 18,
    fontWeight: "900",
    marginBottom: 16,
    marginTop: 26
  },
  snapshotCard: {
    backgroundColor: theme.card,
    borderRadius: 20,
    padding: 18,
    shadowColor: theme.shadow,
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
    color: theme.textMuted,
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 6
  },
  snapshotValue: {
    fontSize: 18,
    fontWeight: "900"
  },
  snapshotDivider: {
    backgroundColor: theme.border,
    width: 1
  },
  snapshotBottomRow: {
    alignItems: "center",
    borderTopColor: theme.border,
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
    color: theme.textMuted,
    fontSize: 13,
    fontWeight: "600"
  },
  netBalanceValue: {
    fontSize: 16,
    fontWeight: "800"
  },
  pendingBadge: {
    backgroundColor: theme.warningSoft,
    borderColor: theme.warning,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4
  },
  pendingBadgeText: {
    color: theme.warning,
    fontSize: 11,
    fontWeight: "700"
  },
  statsCard: {
    backgroundColor: theme.card,
    borderRadius: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 18,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 3,
    marginBottom: 10
  },
  statDivider: {
    backgroundColor: theme.border,
    width: 1
  },
  statItem: {
    alignItems: "center",
    flex: 1
  },
  statValue: {
    color: theme.text,
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 4
  },
  statLabel: {
    color: theme.textMuted,
    fontSize: 12,
    fontWeight: "600"
  },
  settingsCard: {
    backgroundColor: theme.card,
    borderRadius: 20,
    overflow: "hidden",
    shadowColor: theme.shadow,
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
    borderBottomColor: theme.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    minHeight: 52,
    paddingHorizontal: 16
  },
  settingText: {
    color: theme.text,
    fontSize: 14,
    fontWeight: "700"
  },
  chevron: {
    color: theme.textMuted,
    fontSize: 20,
    fontWeight: "800"
  },
  infoLabel: {
    color: theme.textMuted,
    fontSize: 12,
    fontWeight: "600"
  },
  logoutButton: {
    marginTop: 24,
    marginBottom: 20
  },
  modalOverlay: {
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.5)",
    flex: 1,
    justifyContent: "center"
  },
  modalContent: {
    backgroundColor: theme.card,
    borderRadius: 24,
    padding: 24,
    width: "85%",
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 10
  },
  modalTitle: {
    color: theme.text,
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 20,
    textAlign: "center"
  },
  modalLabel: {
    color: theme.text,
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 8
  },
  modalInput: {
    backgroundColor: theme.input,
    borderColor: theme.border,
    borderRadius: 14,
    borderWidth: 1,
    color: theme.text,
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
