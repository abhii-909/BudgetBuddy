import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "../constants/colors";
import { useAuth } from "../src/hooks/useAuth";
import { getAvatarInitial } from "../src/utils/avatar";

type HeaderProps = {
  title: string;
  subtitle?: string;
  onAvatarPress?: () => void;
};

export function Header({ title, subtitle, onAvatarPress }: HeaderProps) {
  const { user } = useAuth();
  const fullName = user?.user_metadata?.full_name;
  const avatarText = getAvatarInitial(fullName, user?.email);


  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        <Text style={styles.title}>{title}</Text>
      </View>
      <Pressable
        onPress={onAvatarPress}
        style={({ pressed }) => [
          styles.avatar,
          pressed && styles.avatarPressed
        ]}
      >
        <Text style={styles.avatarText}>{avatarText}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24
  },
  content: {
    flex: 1,
    marginRight: 12
  },
  subtitle: {
    color: colors.textMuted,
    fontSize: 14,
    marginBottom: 6
  },
  title: {
    color: colors.text,
    fontSize: 28,
    fontWeight: "800"
  },
  avatar: {
    alignItems: "center",
    backgroundColor: colors.primarySoft,
    borderRadius: 24,
    height: 48,
    justifyContent: "center",
    width: 48
  },
  avatarPressed: {
    opacity: 0.72
  },
  avatarText: {
    color: colors.primaryDark,
    fontSize: 18,
    fontWeight: "800"
  }
});
