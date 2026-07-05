import { StyleSheet, Text, View } from "react-native";
import { formatCurrency } from "../src/utils/format";
import { useTheme } from "../src/hooks/useTheme";
import { ColorTheme } from "../src/constants/theme";

type GroupCardProps = {
  name: string;
  membersCount?: number;
  totalExpenses?: string;
  createdAt?: string;
  userBalance?: number | null;
};

export function GroupCard({ name, membersCount = 1, totalExpenses = formatCurrency(0), createdAt, userBalance }: GroupCardProps) {
  const { theme } = useTheme();
  const styles = getStyles(theme);
  const formattedDate = createdAt
    ? new Date(createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })
    : null;

  return (
    <View style={styles.card}>
      <View style={styles.badge}>
        <Text style={styles.badgeText}>{name.charAt(0).toUpperCase()}</Text>
      </View>
      <View style={styles.content}>
        <Text style={styles.name}>{name}</Text>
        {formattedDate ? (
          <Text style={styles.members}>Created: {formattedDate}</Text>
        ) : (
          <Text style={styles.members}>{membersCount} members</Text>
        )}
      </View>
      <View style={styles.expenseBox}>
        <Text style={styles.expenseLabel}>Total</Text>
        <Text style={styles.expense}>{totalExpenses}</Text>
        {userBalance !== undefined && userBalance !== null && (
          <Text
            style={[
              styles.balanceText,
              Math.abs(userBalance) < 0.01
                ? { color: theme.primary }
                : userBalance > 0
                ? { color: theme.primary }
                : { color: theme.danger }
            ]}
          >
            {Math.abs(userBalance) < 0.01
              ? "Settled ✓"
              : userBalance > 0
              ? `+${formatCurrency(userBalance)}`
              : `-${formatCurrency(Math.abs(userBalance))}`}
          </Text>
        )}
      </View>
      <Text style={styles.chevron}>›</Text>
    </View>
  );
}

const getStyles = (theme: ColorTheme) => StyleSheet.create({
  card: {
    alignItems: "center",
    backgroundColor: theme.card,
    borderRadius: 20,
    flexDirection: "row",
    marginBottom: 14,
    padding: 16,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 3
  },
  badge: {
    alignItems: "center",
    backgroundColor: theme.primarySoft,
    borderRadius: 18,
    height: 48,
    justifyContent: "center",
    marginRight: 14,
    width: 48
  },
  badgeText: {
    color: theme.primaryDark,
    fontSize: 20,
    fontWeight: "900"
  },
  content: {
    flex: 1
  },
  name: {
    color: theme.text,
    fontSize: 17,
    fontWeight: "800",
    marginBottom: 4
  },
  members: {
    color: theme.textMuted,
    fontSize: 13
  },
  expenseBox: {
    alignItems: "flex-end"
  },
  expenseLabel: {
    color: theme.textMuted,
    fontSize: 12,
    marginBottom: 4
  },
  expense: {
    color: theme.text,
    fontSize: 15,
    fontWeight: "800"
  },
  balanceText: {
    fontSize: 12,
    fontWeight: "700",
    marginTop: 4
  },
  chevron: {
    color: theme.textMuted,
    fontSize: 22,
    marginLeft: 12,
    fontWeight: "400"
  }
});
