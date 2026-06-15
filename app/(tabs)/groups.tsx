import { router, useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { GroupCard } from "../../components/GroupCard";
import { Header } from "../../components/Header";
import { EmptyState } from "../../components/EmptyState";
import { colors } from "../../constants/colors";
import { useAuth } from "../../src/hooks/useAuth";
import { getUserGroups, type Group } from "../../src/services/groupService";
import { formatCurrency } from "../../src/utils/format";

export default function GroupsScreen() {
  const { user } = useAuth();
  const [groupsList, setGroupsList] = useState<
    (Group & {
      group_members: { user_id: string }[];
      expenses: { amount: number }[];
    })[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const fetchGroups = async (isRefreshing = false) => {
    if (!user) return;
    if (isRefreshing) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    const { data, error } = await getUserGroups(user.id);

    setLoading(false);
    setRefreshing(false);

    if (error) {
      console.error("Failed to fetch groups:", error);
    } else if (data) {
      setGroupsList(data);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchGroups();
    }, [user])
  );

  const onRefresh = () => {
    fetchGroups(true);
  };

  const filteredGroups = groupsList.filter((group) =>
    group.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.wrapper}>
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
        >
          <Header subtitle="Shared spaces" title="Groups" />

          <View style={styles.searchBox}>
            <Text style={styles.searchIcon}>🔍</Text>
            <TextInput
              onChangeText={setSearchQuery}
              placeholder="Search groups"
              placeholderTextColor={colors.textMuted}
              style={styles.searchInput}
              value={searchQuery}
            />
          </View>

          {loading ? (
            <View style={styles.skeletonContainer}>
              <View style={styles.skeletonCard} />
              <View style={styles.skeletonCard} />
              <View style={styles.skeletonCard} />
            </View>
          ) : filteredGroups.length === 0 ? (
            <EmptyState
              actionText={searchQuery ? undefined : "Create Group"}
              description={
                searchQuery
                  ? "Try searching for something else."
                  : "Create a group to start splitting bills with friends."
              }
              icon="👥"
              onActionPress={searchQuery ? undefined : () => router.push("/create-group")}
              title={searchQuery ? "No groups match your search" : "No groups yet"}
            />
          ) : (
            filteredGroups.map((group) => {
              const totalExpensesAmount = group.expenses?.reduce((sum, exp) => sum + parseFloat(exp.amount as any), 0) || 0;
              const formattedTotal = formatCurrency(totalExpensesAmount);

              return (
                <Pressable
                  key={group.id}
                  onPress={() => router.push({ pathname: "/group-details", params: { id: group.id } })}
                  style={({ pressed }) => [pressed && styles.cardPressed]}
                >
                  <GroupCard
                    createdAt={group.created_at}
                    membersCount={group.group_members?.length || 0}
                    name={group.name}
                    totalExpenses={formattedTotal}
                  />
                </Pressable>
              );
            })
          )}
        </ScrollView>

        <Pressable
          onPress={() => router.push("/create-group")}
          style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
        >
          <Text style={styles.fabText}>+</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: colors.background,
    flex: 1
  },
  wrapper: {
    flex: 1
  },
  cardPressed: {
    opacity: 0.96,
    transform: [{ scale: 0.99 }]
  },
  content: {
    padding: 20,
    paddingBottom: 110
  },
  searchBox: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    marginBottom: 20,
    paddingHorizontal: 16
  },
  searchIcon: {
    color: colors.textMuted,
    fontSize: 13,
    fontWeight: "800",
    marginRight: 8
  },
  searchInput: {
    color: colors.text,
    flex: 1,
    fontSize: 16,
    minHeight: 52
  },
  loadingWrapper: {
    alignItems: "center",
    justifyContent: "center",
    minHeight: 200
  },
  emptyWrapper: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 40,
    paddingHorizontal: 24
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 16
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 8
  },
  emptyText: {
    color: colors.textMuted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center"
  },
  fab: {
    alignItems: "center",
    backgroundColor: colors.primary,
    borderRadius: 32,
    bottom: 22,
    height: 64,
    justifyContent: "center",
    position: "absolute",
    right: 22,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    width: 64,
    elevation: 6
  },
  fabPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }]
  },
  fabText: {
    color: colors.white,
    fontSize: 34,
    fontWeight: "500",
    marginTop: -3
  },
  skeletonContainer: {
    gap: 14
  },
  skeletonCard: {
    height: 90,
    borderRadius: 20,
    backgroundColor: colors.border
  }
});
