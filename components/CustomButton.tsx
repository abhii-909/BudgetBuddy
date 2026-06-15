import { Pressable, StyleProp, StyleSheet, Text, ViewStyle } from "react-native";
import { colors } from "../constants/colors";

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

const styles = StyleSheet.create({
  button: {
    alignItems: "center",
    borderRadius: 16,
    justifyContent: "center",
    minHeight: 54,
    paddingHorizontal: 22
  },
  primary: {
    backgroundColor: colors.primary
  },
  secondary: {
    backgroundColor: colors.secondarySoft
  },
  ghost: {
    backgroundColor: colors.white,
    borderColor: colors.border,
    borderWidth: 1
  },
  danger: {
    backgroundColor: colors.danger
  },
  pressed: {
    opacity: 0.85,
    transform: [{ scale: 0.98 }]
  },
  disabled: {
    opacity: 0.6,
    backgroundColor: colors.border
  },
  text: {
    color: colors.white,
    fontSize: 16,
    fontWeight: "700"
  },
  ghostText: {
    color: colors.text
  },
  secondaryText: {
    color: colors.secondary
  }
});
