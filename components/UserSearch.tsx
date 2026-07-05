import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { searchUsers, type SearchedUser } from "../src/services/groupService";
import { useTheme } from "../src/hooks/useTheme";
import { ColorTheme } from "../src/constants/theme";

type UserSearchProps = {
  onSelectUser: (user: SearchedUser) => void;
  excludeUserIds: string[];
};

export function UserSearch({ onSelectUser, excludeUserIds }: UserSearchProps) {
  const { theme } = useTheme();
  const styles = getStyles(theme);
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
          placeholderTextColor={theme.textMuted}
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
            <ActivityIndicator color={theme.white} size="small" />
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

const getStyles = (theme: ColorTheme) => StyleSheet.create({
  container: {
    marginBottom: 16
  },
  sectionTitle: {
    color: theme.text,
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 10,
    marginTop: 0
  },
  searchBox: {
    alignItems: "center",
    backgroundColor: theme.input,
    borderColor: theme.border,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: "row",
    paddingLeft: 16,
    paddingRight: 6,
    minHeight: 58
  },
  searchInput: {
    color: theme.text,
    flex: 1,
    fontSize: 16,
    minHeight: 52
  },
  clearButton: {
    padding: 8,
    marginRight: 4
  },
  clearText: {
    color: theme.textMuted,
    fontSize: 14,
    fontWeight: "bold"
  },
  searchButton: {
    backgroundColor: theme.primary,
    borderRadius: 12,
    height: 44,
    justifyContent: "center",
    paddingHorizontal: 16,
    alignItems: "center"
  },
  buttonDisabled: {
    backgroundColor: theme.border
  },
  buttonPressed: {
    opacity: 0.85
  },
  searchButtonText: {
    color: theme.white,
    fontSize: 14,
    fontWeight: "800"
  },
  noResults: {
    color: theme.danger,
    fontSize: 13,
    fontWeight: "600",
    marginTop: 8,
    textAlign: "center"
  },
  resultsCard: {
    backgroundColor: theme.card,
    borderColor: theme.border,
    borderRadius: 16,
    borderWidth: 1,
    marginTop: 10,
    overflow: "hidden"
  },
  userRow: {
    alignItems: "center",
    borderBottomColor: theme.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    padding: 12,
    justifyContent: "space-between"
  },
  avatar: {
    alignItems: "center",
    backgroundColor: theme.primarySoft,
    borderRadius: 18,
    height: 36,
    justifyContent: "center",
    width: 36
  },
  avatarText: {
    color: theme.primaryDark,
    fontSize: 14,
    fontWeight: "800"
  },
  userInfo: {
    flex: 1,
    marginLeft: 12,
    marginRight: 12
  },
  name: {
    color: theme.text,
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 2
  },
  email: {
    color: theme.textMuted,
    fontSize: 12
  },
  addButton: {
    backgroundColor: theme.primarySoft,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 6
  },
  addButtonText: {
    color: theme.primaryDark,
    fontSize: 12,
    fontWeight: "800"
  }
});
