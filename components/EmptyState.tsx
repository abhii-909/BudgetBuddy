import { StyleSheet, Text, View } from "react-native";
import { useTheme } from "../src/hooks/useTheme";
import { ColorTheme } from "../src/constants/theme";
import { CustomButton } from "./CustomButton";

type EmptyStateProps = {
  icon?: string;
  title: string;
  description: string;
  actionText?: string;
  onActionPress?: () => void;
};

export function EmptyState({
  icon,
  title,
  description,
  actionText,
  onActionPress
}: EmptyStateProps) {
  const { theme } = useTheme();
  const styles = getStyles(theme);

  return (
    <View style={styles.container}>
      {icon ? <Text style={styles.icon}>{icon}</Text> : null}
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      {actionText && onActionPress ? (
        <CustomButton
          onPress={onActionPress}
          style={styles.button}
          title={actionText}
          variant="secondary"
        />
      ) : null}
    </View>
  );
}

const getStyles = (theme: ColorTheme) => StyleSheet.create({
  container: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 40
  },
  icon: {
    fontSize: 48,
    marginBottom: 16
  },
  title: {
    color: theme.text,
    fontSize: 18,
    fontWeight: "800",
    marginBottom: 8,
    textAlign: "center"
  },
  description: {
    color: theme.textMuted,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    marginBottom: 20
  },
  button: {
    minWidth: 160
  }
});
