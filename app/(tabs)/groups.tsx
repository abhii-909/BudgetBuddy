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
import { useAuth } from "../../src/hooks/useAuth";
import { getUserGroups, type Group } from "../../src/services/groupService";
import { formatCurrency } from "../../src/utils/format";
import { useTheme } from "../../src/hooks/useTheme";
import { ColorTheme } from "../../src/constants/theme";

export default function GroupsScreen() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const styles = getStyles(theme);
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
              colors={[theme.primary]}
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
              placeholderTextColor={theme.textMuted}
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
              onActionPress={() => router.push("/create-group")}
              title={searchQuery ? "No groups found" : "No groups yet"}
            />
          ) : (
            filteredGroups.map((group) => {
              const membersCount = group.group_members?.length || 0;
              const totalExpenses = formatCurrency(
                group.expenses?.reduce((sum, exp) => sum + (exp.amount || 0), 0) || 0
              );

              return (
                <Pressable
                  key={group.id}
                  onPress={() =>
                    router.push({
                      pathname: "/group-details",
                      params: { id: group.id }
                    })
                  }
                  style={({ pressed }) => [pressed && styles.cardPressed]}
                >
                  <GroupCard
                    createdAt={group.created_at}
                    membersCount={membersCount}
                    name={group.name}
                    totalExpenses={totalExpenses}
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

const getStyles = (theme: ColorTheme) => StyleSheet.create({
  safeArea: {
    backgroundColor: theme.background,
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
    backgroundColor: theme.input,
    borderColor: theme.border,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    marginBottom: 20,
    paddingHorizontal: 16
  },
  searchIcon: {
    color: theme.textMuted,
    fontSize: 13,
    fontWeight: "800",
    marginRight: 8
  },
  searchInput: {
    color: theme.text,
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
    color: theme.text,
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 8
  },
  emptyText: {
    color: theme.textMuted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center"
  },
  fab: {
    alignItems: "center",
    backgroundColor: theme.primary,
    borderRadius: 32,
    bottom: 22,
    height: 64,
    justifyContent: "center",
    position: "absolute",
    right: 22,
    shadowColor: theme.primary,
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
    color: theme.white,
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
    backgroundColor: theme.border
  }
});
