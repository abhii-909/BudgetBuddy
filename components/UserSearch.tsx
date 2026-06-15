import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { colors } from "../constants/colors";
import { searchUsers, type SearchedUser } from "../src/services/groupService";

type UserSearchProps = {
  onSelectUser: (user: SearchedUser) => void;
  excludeUserIds: string[];
};

export function UserSearch({ onSelectUser, excludeUserIds }: UserSearchProps) {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<SearchedUser[]>([]);
  const [searched, setSearched] = useState(false);

  const handleSearch = async () => {
    if (!query.trim()) return;

    setLoading(true);
    setSearched(true);
    const { data, error } = await searchUsers(query.trim());
    setLoading(false);

    if (error) {
      console.error("User search failed:", error);
      setResults([]);
    } else if (data) {
      // Filter out users already in the group
      const filtered = data.filter((user) => !excludeUserIds.includes(user.id));
      setResults(filtered);
    }
  };

  const clearSearch = () => {
    setQuery("");
    setResults([]);
    setSearched(false);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>Add Member</Text>
      <View style={styles.searchBox}>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          onChangeText={setQuery}
          placeholder="Search by name or email"
          placeholderTextColor={colors.textMuted}
          style={styles.searchInput}
          value={query}
        />
        {query ? (
          <Pressable onPress={clearSearch} style={styles.clearButton}>
            <Text style={styles.clearText}>✕</Text>
          </Pressable>
        ) : null}
        <Pressable
          disabled={loading || !query.trim()}
          onPress={handleSearch}
          style={({ pressed }) => [
            styles.searchButton,
            pressed && styles.buttonPressed,
            (!query.trim() || loading) && styles.buttonDisabled
          ]}
        >
          {loading ? (
            <ActivityIndicator color={colors.white} size="small" />
          ) : (
            <Text style={styles.searchButtonText}>Search</Text>
          )}
        </Pressable>
      </View>

      {searched && results.length === 0 && !loading ? (
        <Text style={styles.noResults}>No matching users found (or already joined).</Text>
      ) : null}

      {results.length > 0 ? (
        <View style={styles.resultsCard}>
          {results.map((user) => (
            <View key={user.id} style={styles.userRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {user.full_name?.charAt(0).toUpperCase() || "U"}
                </Text>
              </View>
              <View style={styles.userInfo}>
                <Text style={styles.name}>{user.full_name}</Text>
                <Text style={styles.email}>{user.email}</Text>
              </View>
              <Pressable
                onPress={() => {
                  onSelectUser(user);
                  clearSearch();
                }}
                style={({ pressed }) => [styles.addButton, pressed && styles.buttonPressed]}
              >
                <Text style={styles.addButtonText}>+ Add</Text>
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 20
  },
  sectionTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800",
    marginBottom: 10,
    marginTop: 10
  },
  searchBox: {
    alignItems: "center",
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    paddingLeft: 16,
    paddingRight: 6,
    minHeight: 58
  },
  searchInput: {
    color: colors.text,
    flex: 1,
    fontSize: 16,
    minHeight: 52
  },
  clearButton: {
    padding: 8,
    marginRight: 4
  },
  clearText: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "bold"
  },
  searchButton: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    height: 44,
    justifyContent: "center",
    paddingHorizontal: 16,
    alignItems: "center"
  },
  buttonDisabled: {
    backgroundColor: colors.border
  },
  buttonPressed: {
    opacity: 0.85
  },
  searchButtonText: {
    color: colors.white,
    fontSize: 14,
    fontWeight: "800"
  },
  noResults: {
    color: colors.danger,
    fontSize: 13,
    fontWeight: "600",
    marginTop: 8,
    textAlign: "center"
  },
  resultsCard: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 10,
    overflow: "hidden"
  },
  userRow: {
    alignItems: "center",
    borderBottomColor: colors.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    padding: 12,
    justifyContent: "space-between"
  },
  avatar: {
    alignItems: "center",
    backgroundColor: colors.primarySoft,
    borderRadius: 18,
    height: 36,
    justifyContent: "center",
    width: 36
  },
  avatarText: {
    color: colors.primaryDark,
    fontSize: 14,
    fontWeight: "800"
  },
  userInfo: {
    flex: 1,
    marginLeft: 12,
    marginRight: 12
  },
  name: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 2
  },
  email: {
    color: colors.textMuted,
    fontSize: 12
  },
  addButton: {
    backgroundColor: colors.primarySoft,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  addButtonText: {
    color: colors.primaryDark,
    fontSize: 12,
    fontWeight: "800"
  }
});
