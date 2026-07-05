import { StyleSheet, Text, View } from "react-native";
import { useAuth } from "../src/hooks/useAuth";
import { useTheme } from "../src/hooks/useTheme";
import { ColorTheme } from "../src/constants/theme";
import { Avatar } from "./Avatar";

type HeaderProps = {
  title: string;
  subtitle?: string;
  onAvatarPress?: () => void;
};

export function Header({ title, subtitle, onAvatarPress }: HeaderProps) {
  const { profile, user } = useAuth();
  const { theme } = useTheme();
  const fullName = profile?.full_name || user?.user_metadata?.full_name || "";
  const email = profile?.email || user?.email || "";
  const avatarUrl = profile?.avatar_url || null;
  const styles = getStyles(theme);

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        <Text style={styles.title}>{title}</Text>
      </View>
      <Avatar
        avatarUrl={avatarUrl}
        fullName={fullName}
        email={email}
        size="medium"
        onPress={onAvatarPress}
      />
    </View>
  );
}

const getStyles = (theme: ColorTheme) => StyleSheet.create({
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
    color: theme.textMuted,
    fontSize: 14,
    marginBottom: 6
  },
  title: {
    color: theme.text,
    fontSize: 28,
    fontWeight: "800"
  }
});
