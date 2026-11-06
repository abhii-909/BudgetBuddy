import React, { useState, useEffect } from "react";
import { StyleSheet, Text, View, Image, Pressable, ActivityIndicator } from "react-native";
import { getAvatarSignedUrl } from "../src/services/avatarService";
import { getAvatarInitial } from "../src/utils/avatar";
import { useTheme } from "../src/hooks/useTheme";
import { ColorTheme } from "../src/constants/theme";

type AvatarSize = "small" | "medium" | "large";

type AvatarProps = {
  avatarUrl?: string | null; // storage path e.g. {userId}/avatar.jpg
  fullName?: string | null;
  email?: string | null;
  size?: AvatarSize;
  onPress?: () => void;
  loading?: boolean;
};

const SIZE_MAP: Record<AvatarSize, number> = {
  small: 32,
  medium: 48,
  large: 80,
};

export function Avatar({
  avatarUrl,
  fullName,
  email,
  size = "medium",
  onPress,
  loading = false,
}: AvatarProps) {
  const { theme } = useTheme();
  const styles = getStyles(theme);
  const pixelSize = SIZE_MAP[size];
  const initials = getAvatarInitial(fullName || "", email || "");

  // Resolve the storage path to a signed URL asynchronously.
  // This works for both public and private Supabase buckets.
  const [resolvedUrl, setResolvedUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (avatarUrl) {
      getAvatarSignedUrl(avatarUrl).then((url) => {
        if (!cancelled) {
          console.log("[Avatar] Resolved signed URL:", url ? "✅ obtained" : "❌ null");
          setResolvedUrl(url);
        }
      });
    } else {
      setResolvedUrl(null);
    }

    return () => {
      cancelled = true;
    };
  }, [avatarUrl]);

  const containerStyle = [
    styles.container,
    { width: pixelSize, height: pixelSize, borderRadius: pixelSize / 2 },
  ];

  const content = (
    <View style={containerStyle}>
      {resolvedUrl ? (
        <Image
          source={{ uri: resolvedUrl }}
          style={{ width: pixelSize, height: pixelSize, borderRadius: pixelSize / 2 }}
          resizeMode="cover"
          onError={(e) =>
            console.error("[Avatar] Image load error:", e.nativeEvent.error, "URL:", resolvedUrl)
          }
        />
      ) : (
        <View style={[styles.fallback, { width: pixelSize, height: pixelSize, borderRadius: pixelSize / 2 }]}>
          <Text style={[styles.fallbackText, { fontSize: pixelSize * 0.4 }]}>{initials}</Text>
        </View>
      )}

      {loading && (
        <View style={[styles.loaderOverlay, { borderRadius: pixelSize / 2 }]}>
          <ActivityIndicator size="small" color={theme.white} />
        </View>
      )}
    </View>
  );

  if (onPress) {
    return (
      <Pressable onPress={onPress} disabled={loading} style={({ pressed }) => [pressed && styles.pressed]}>
        {content}
      </Pressable>
    );
  }

  return content;
}

const getStyles = (theme: ColorTheme) => StyleSheet.create({
  container: {
    overflow: "hidden",
    position: "relative",
  },
  fallback: {
    backgroundColor: theme.primarySoft,
    alignItems: "center",
    justifyContent: "center",
  },
  fallbackText: {
    color: theme.primaryDark,
    fontWeight: "800",
  },
  loaderOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  pressed: {
    opacity: 0.8,
  },
});
