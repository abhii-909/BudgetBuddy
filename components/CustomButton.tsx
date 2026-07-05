import { Pressable, StyleProp, StyleSheet, Text, ViewStyle } from "react-native";
import { useTheme } from "../src/hooks/useTheme";
import { ColorTheme } from "../src/constants/theme";

type CustomButtonProps = {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  style?: StyleProp<ViewStyle>;
  disabled?: boolean;
};

export function CustomButton({
  title,
  onPress,
  variant = "primary",
  style,
  disabled = false
}: CustomButtonProps) {
  const { theme } = useTheme();
  const styles = getStyles(theme);

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        styles[variant],
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
        style
      ]}
    >
      <Text
        style={[
          styles.text,
          variant === "ghost" && styles.ghostText,
          variant === "secondary" && styles.secondaryText
        ]}
      >
        {title}
      </Text>
    </Pressable>
  );
}

const getStyles = (theme: ColorTheme) => StyleSheet.create({
  button: {
    alignItems: "center",
    borderRadius: 16,
    justifyContent: "center",
    minHeight: 54,
    paddingHorizontal: 22
  },
  primary: {
    backgroundColor: theme.primary
  },
  secondary: {
    backgroundColor: theme.secondarySoft
  },
  ghost: {
    backgroundColor: theme.surface,
    borderColor: theme.border,
    borderWidth: 1
  },
  danger: {
    backgroundColor: theme.danger
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }]
  },
  disabled: {
    opacity: 0.6,
    backgroundColor: theme.border
  },
  text: {
    color: theme.white,
    fontSize: 16,
    fontWeight: "700"
  },
  ghostText: {
    color: theme.textMuted
  },
  secondaryText: {
    color: theme.secondary
  }
});
