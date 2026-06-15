import { StyleSheet, Text, View } from "react-native";
import { colors } from "../constants/colors";

type ExpenseCardProps = {
  title: string;
  amount: string;
  date: string;
  paidBy: string;
};

export function ExpenseCard({ title, amount, date, paidBy }: ExpenseCardProps) {
  return (
    <View style={styles.card}>
      <View style={styles.icon}>
        <Text style={styles.iconText}>₹</Text>
      </View>
      <View style={styles.content}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.meta}>
          {date} - Paid by {paidBy}
        </Text>
      </View>
      <Text style={styles.amount}>{amount}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: 20,
    flexDirection: "row",
    marginBottom: 12,
    padding: 16,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 3
  },
  icon: {
    alignItems: "center",
    backgroundColor: colors.secondarySoft,
    borderRadius: 16,
    height: 44,
    justifyContent: "center",
    marginRight: 12,
    width: 44
  },
  iconText: {
    color: colors.secondary,
    fontSize: 18,
    fontWeight: "900"
  },
  content: {
    flex: 1
  },
  title: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 4
  },
  meta: {
    color: colors.textMuted,
    fontSize: 13
  },
  amount: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800",
    marginLeft: 10
  }
});
