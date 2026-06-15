import { StyleSheet, Text, View } from "react-native";
import { colors } from "../constants/colors";

type BalanceCardProps = {
  title: string;
  amount: string;
  tone?: "primary" | "danger" | "secondary";
  fullWidth?: boolean;
};

export function BalanceCard({
  title,
  amount,
  tone = "primary",
  fullWidth = false
}: BalanceCardProps) {
  return (
    <View style={[styles.card, fullWidth && styles.fullWidth]}>
      <Text style={styles.title}>{title}</Text>
      <Text style={[styles.amount, styles[tone]]}>{amount}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 20,
    flex: 1,
    padding: 18,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 4
  },
  fullWidth: {
    flex: 0,
    width: "100%"
  },
  title: {
    color: colors.textMuted,
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 10
  },
  amount: {
    fontSize: 28,
    fontWeight: "900"
  },
  primary: {
    color: colors.primaryDark
  },
  danger: {
    color: colors.danger
  },
  secondary: {
    color: colors.secondary
  }
});
