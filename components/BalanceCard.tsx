import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "../src/hooks/useTheme";
import { ColorTheme } from "../src/constants/theme";

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
  const { theme } = useTheme();
  const styles = getStyles(theme);

  return (
    <View style={[styles.card, fullWidth && styles.fullWidth]}>
      <Text style={styles.title}>{title}</Text>
      <Text style={[styles.amount, styles[tone]]}>{amount}</Text>
    </View>
  );
}

const getStyles = (theme: ColorTheme) => StyleSheet.create({
  card: {
    backgroundColor: theme.card,
    borderRadius: 20,
    flex: 1,
    padding: 18,
    shadowColor: theme.shadow,
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
    color: theme.textMuted,
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 10
  },
  amount: {
    fontSize: 28,
    fontWeight: "900"
  },
  primary: {
    color: theme.primaryDark
  },
  danger: {
    color: theme.danger
  },
  secondary: {
    color: theme.secondary
  }
});
