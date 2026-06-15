import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CustomButton } from "../../components/CustomButton";
import { Header } from "../../components/Header";
import { colors } from "../../constants/colors";
import { useAuth } from "../../src/hooks/useAuth";
import { getUserGroups, getGroupMembers, type Group } from "../../src/services/groupService";
import { getExpenseDetails } from "../../src/services/expenseService";
import { addExpenseWithSplits, updateExpenseWithSplits, hasConfirmedSettlements } from "../../src/services/splitService";
import { supabase } from "../../src/lib/supabase";

export default function AddExpenseScreen() {
  const { groupId, expenseId } = useLocalSearchParams<{ groupId: string; expenseId: string }>();
  const { user } = useAuth();
  const isEditMode = !!expenseId;

  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [notes, setNotes] = useState("");
  const [splitEqually, setSplitEqually] = useState(true);

  const [groupMembers, setGroupMembers] = useState<any[]>([]);
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);

  const [groups, setGroups] = useState<(Group & { group_members: { user_id: string }[] })[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [isEditingBlocked, setIsEditingBlocked] = useState(false);
  const [loadingExpense, setLoadingExpense] = useState(false);

  useEffect(() => {
    if (!user) return;

    const fetchInitialData = async () => {
      setLoadingGroups(true);
      const { data: groupsData, error: groupsError } = await getUserGroups(user.id);
      setLoadingGroups(false);

      let currentGroup: Group | null = null;

      if (!groupsError && groupsData) {
        setGroups(groupsData);
        
        if (groupId) {
          const matched = groupsData.find((g) => g.id === groupId);
          if (matched) {
            currentGroup = matched;
            setSelectedGroup(matched);
          }
        }
      }

      if (isEditMode && expenseId) {
        setLoadingExpense(true);
        const [expenseRes, splitsRes] = await Promise.all([
          getExpenseDetails(expenseId),
          supabase.from("expense_splits").select("user_id").eq("expense_id", expenseId)
        ]);
        setLoadingExpense(false);

        if (expenseRes.data) {
          const exp = expenseRes.data;
          setTitle(exp.title);
          setAmount(exp.amount.toString());
          setNotes(exp.notes || "");
          
          if (groupsData) {
            const matched = groupsData.find((g) => g.id === exp.group_id);
            if (matched) {
              currentGroup = matched;
              setSelectedGroup(matched);
            }
          }

          if (currentGroup) {
            setLoadingMembers(true);
            const { data: membersData } = await getGroupMembers(currentGroup.id);
            setLoadingMembers(false);

            if (membersData) {
              setGroupMembers(membersData);
              
              if (splitsRes.data) {
                const participantIds = splitsRes.data.map((s) => s.user_id);
                setSelectedParticipants(participantIds);
                
                const isEquallySplit = membersData.length === participantIds.length && 
                  membersData.every((m) => participantIds.includes(m.user_id));
                setSplitEqually(isEquallySplit);
              }
            }

            const { hasConfirmed } = await hasConfirmedSettlements(currentGroup.id);
            if (hasConfirmed) {
              setIsEditingBlocked(true);
            }
          }
        }
      }
    };

    fetchInitialData();
  }, [user, groupId, expenseId]);

  useEffect(() => {
    if (isEditMode || !selectedGroup) return;

    const fetchMembers = async () => {
      setLoadingMembers(true);
      const { data, error } = await getGroupMembers(selectedGroup.id);
      setLoadingMembers(false);

      if (!error && data) {
        setGroupMembers(data);
        setSelectedParticipants(data.map((m) => m.user_id));
      }
    };

    fetchMembers();
  }, [selectedGroup]);

  const handleSave = async () => {
    if (isEditingBlocked) {
      Alert.alert(
        "Action Blocked",
        "This expense cannot be edited because settlements have already been recorded and confirmed in this group."
      );
      return;
    }

    if (!title.trim()) {
      Alert.alert("Validation Error", "Please enter an expense title.");
      return;
    }

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      Alert.alert("Validation Error", "Please enter a valid amount greater than 0.");
      return;
    }

    if (!selectedGroup) {
      Alert.alert("Validation Error", "Please select a group.");
      return;
    }

    if (!user) {
      Alert.alert("Error", "You must be logged in to save an expense.");
      return;
    }

    const participants = splitEqually
      ? groupMembers.map((m) => m.user_id)
      : selectedParticipants;

    if (participants.length === 0) {
      Alert.alert("Validation Error", "Please select at least one participant to split the bill.");
      return;
    }

    setSaving(true);
    let res;
    if (isEditMode && expenseId) {
      res = await updateExpenseWithSplits(
        expenseId,
        title,
        numericAmount,
        selectedGroup.id,
        participants,
        notes
      );
    } else {
      res = await addExpenseWithSplits(
        title,
        numericAmount,
        user.id,
        selectedGroup.id,
        participants,
        notes
      );
    }
    setSaving(false);

    if (res.error) {
      Alert.alert("Failed to save expense", res.error);
    } else {
      Alert.alert(
        "Success", 
        isEditMode ? "Expense updated successfully!" : "Expense saved successfully!"
      );
      router.back();
    }
  };

  const isGroupLocked = !!groupId || isEditMode;

  if (loadingExpense) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Header 
          subtitle={isEditMode ? "Modify an existing shared bill" : "Create a new shared bill"} 
          title={isEditMode ? "Edit Expense" : "Add Expense"} 
        />

        <View style={styles.formCard}>
          {isEditingBlocked ? (
            <View style={styles.warningBanner}>
              <Text style={styles.warningText}>
                ⚠️ This expense cannot be edited because settlements have already been recorded and confirmed in this group.
              </Text>
            </View>
          ) : null}

          <Text style={styles.label}>Expense Title</Text>
          <TextInput
            editable={!isEditingBlocked}
            onChangeText={setTitle}
            placeholder="Dinner, rent, movie tickets..."
            placeholderTextColor={colors.textMuted}
            style={[styles.input, isEditingBlocked && styles.inputDisabled]}
            value={title}
          />

          <Text style={styles.label}>Amount</Text>
          <TextInput
            editable={!isEditingBlocked}
            keyboardType="decimal-pad"
            onChangeText={setAmount}
            placeholder="₹0.00"
            placeholderTextColor={colors.textMuted}
            style={[styles.input, isEditingBlocked && styles.inputDisabled]}
            value={amount}
          />

          <Text style={styles.label}>Group</Text>
          <Pressable
            disabled={isGroupLocked || loadingGroups || isEditingBlocked}
            onPress={() => setShowGroupModal(true)}
            style={[styles.selector, isGroupLocked && styles.selectorDisabled]}
          >
            {loadingGroups ? (
              <ActivityIndicator color={colors.primary} size="small" />
            ) : (
              <Text style={[styles.selectorText, !selectedGroup && styles.placeholderText]}>
                {selectedGroup ? selectedGroup.name : "Select a group"}
              </Text>
            )}
            {!isGroupLocked ? <Text style={styles.selectorArrow}>v</Text> : null}
          </Pressable>

          <Text style={styles.label}>Notes</Text>
          <TextInput
            editable={!isEditingBlocked}
            multiline
            onChangeText={setNotes}
            placeholder="Add optional notes"
            placeholderTextColor={colors.textMuted}
            style={[styles.input, styles.notes, isEditingBlocked && styles.inputDisabled]}
            textAlignVertical="top"
            value={notes}
          />

          <Text style={styles.label}>Split Type</Text>
          <View style={styles.splitTypeContainer}>
            <Pressable
              disabled={isEditingBlocked}
              onPress={() => setSplitEqually(true)}
              style={[
                styles.splitTypeOption, 
                splitEqually && styles.splitTypeOptionSelected,
                isEditingBlocked && styles.disabledOption
              ]}
            >
              <Text style={[styles.splitTypeOptionText, splitEqually && styles.splitTypeOptionTextSelected]}>
                Split Among All
              </Text>
            </Pressable>
            <Pressable
              disabled={isEditingBlocked}
              onPress={() => setSplitEqually(false)}
              style={[
                styles.splitTypeOption, 
                !splitEqually && styles.splitTypeOptionSelected,
                isEditingBlocked && styles.disabledOption
              ]}
            >
              <Text style={[styles.splitTypeOptionText, !splitEqually && styles.splitTypeOptionTextSelected]}>
                Selected Members
              </Text>
            </Pressable>
          </View>

          {!splitEqually && selectedGroup ? (
            <View style={styles.checklistContainer}>
              <Text style={styles.checklistTitle}>Select Participants</Text>
              {loadingMembers ? (
                <ActivityIndicator color={colors.primary} size="small" style={{ marginVertical: 12 }} />
              ) : groupMembers.length === 0 ? (
                <Text style={styles.noMembersText}>No group members found.</Text>
              ) : (
                groupMembers.map((member) => {
                  const isChecked = selectedParticipants.includes(member.user_id);
                  const name = member.profiles?.full_name || "Unknown User";

                  return (
                    <Pressable
                      disabled={isEditingBlocked}
                      key={member.user_id}
                      onPress={() => {
                        if (isChecked) {
                          if (selectedParticipants.length > 1) {
                            setSelectedParticipants(selectedParticipants.filter((id) => id !== member.user_id));
                          } else {
                            Alert.alert("Warning", "At least one participant must be checked.");
                          }
                        } else {
                          setSelectedParticipants([...selectedParticipants, member.user_id]);
                        }
                      }}
                      style={styles.checkRow}
                    >
                      <View style={[
                        styles.checkbox, 
                        isChecked && styles.checkboxChecked,
                        isEditingBlocked && styles.disabledCheckbox
                      ]}>
                        {isChecked ? <Text style={styles.checkboxTick}>✓</Text> : null}
                      </View>
                      <Text style={styles.checkText}>{name}</Text>
                    </Pressable>
                  );
                })
              )}
            </View>
          ) : null}

          <CustomButton
            disabled={saving || isEditingBlocked}
            onPress={handleSave}
            style={styles.saveButton}
            title={saving ? "Saving..." : isEditMode ? "Save Changes" : "Save Expense"}
          />
        </View>
      </ScrollView>

      {/* Modal for Group Selection */}
      <Modal
        animationType="slide"
        transparent
        visible={showGroupModal}
        onRequestClose={() => setShowGroupModal(false)}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => setShowGroupModal(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Group</Text>
            {groups.length === 0 ? (
              <Text style={styles.noGroupsText}>No groups found. Create one first!</Text>
            ) : (
              <ScrollView style={styles.modalList}>
                {groups.map((item) => (
                  <Pressable
                    key={item.id}
                    onPress={() => {
                      setSelectedGroup(item);
                      setShowGroupModal(false);
                    }}
                    style={styles.groupItem}
                  >
                    <Text style={styles.groupItemText}>{item.name}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            )}
          </View>
        </Pressable>
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
    paddingBottom: 110
  },
  loadingContainer: {
    alignItems: "center",
    backgroundColor: colors.background,
    flex: 1,
    justifyContent: "center"
  },
  formCard: {
    backgroundColor: colors.card,
    borderRadius: 22,
    padding: 18,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.06,
    shadowRadius: 20,
    elevation: 4
  },
  label: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 8,
    marginTop: 14
  },
  input: {
    backgroundColor: colors.input,
    borderColor: colors.border,
    borderRadius: 14,
    borderWidth: 1,
    color: colors.text,
    fontSize: 16,
    minHeight: 52,
    paddingHorizontal: 14
  },
  inputDisabled: {
    opacity: 0.6,
    backgroundColor: colors.border
  },
  notes: {
    minHeight: 104,
    paddingTop: 14
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
    paddingHorizontal: 14
  },
  selectorDisabled: {
    opacity: 0.65,
    backgroundColor: colors.border
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
    fontSize: 22
  },
  splitTypeContainer: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
    marginBottom: 10
  },
  splitTypeOption: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.input,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 14,
    minHeight: 48
  },
  splitTypeOptionSelected: {
    backgroundColor: colors.primarySoft,
    borderColor: colors.primary
  },
  splitTypeOptionText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "700"
  },
  splitTypeOptionTextSelected: {
    color: colors.primaryDark
  },
  disabledOption: {
    opacity: 0.5
  },
  checklistContainer: {
    backgroundColor: colors.input,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
    marginTop: 12,
    marginBottom: 6
  },
  checklistTitle: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800",
    marginBottom: 12
  },
  checkRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    borderBottomColor: colors.border,
    borderBottomWidth: 1
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.textMuted,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary
  },
  checkboxTick: {
    color: colors.white,
    fontSize: 13,
    fontWeight: "900"
  },
  disabledCheckbox: {
    opacity: 0.5
  },
  checkText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "600"
  },
  noMembersText: {
    color: colors.textMuted,
    fontSize: 13,
    textAlign: "center",
    marginVertical: 10
  },
  saveButton: {
    marginTop: 22
  },
  warningBanner: {
    backgroundColor: colors.dangerSoft,
    borderRadius: 14,
    padding: 14,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: colors.danger + "33"
  },
  warningText: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: "700",
    textAlign: "center",
    lineHeight: 18
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "flex-end"
  },
  modalContent: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: "75%",
    padding: 24,
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
  modalList: {
    marginBottom: 20
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
  noGroupsText: {
    color: colors.textMuted,
    fontSize: 15,
    textAlign: "center",
    paddingVertical: 20
  }
});
