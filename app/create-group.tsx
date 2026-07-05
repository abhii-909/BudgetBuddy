import { router } from "expo-router";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CustomButton } from "../components/CustomButton";
import { Header } from "../components/Header";
import { useAuth } from "../src/hooks/useAuth";
import { createGroup } from "../src/services/groupService";
import { useTheme } from "../src/hooks/useTheme";
import { ColorTheme } from "../src/constants/theme";

export default function CreateGroupScreen() {
  const { user } = useAuth();
  const { theme } = useTheme();
  const styles = getStyles(theme);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const [isFocused, setIsFocused] = useState(false);

  const handleCreateGroup = async () => {
    if (!name.trim()) {
      setErrorMessage("Please enter a group name.");
      return;
    }

    if (!user) {
      setErrorMessage("You must be logged in to create a group.");
      return;
    }

    setErrorMessage("");
    setSuccessMessage("");
    setLoading(true);

    const { error } = await createGroup(name.trim(), user.id);

    setLoading(false);

    if (error) {
      setErrorMessage(error);
      return;
    }

    setSuccessMessage("Group created successfully!");
    
    setTimeout(() => {
      router.replace("/(tabs)/groups");
    }, 1000);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <Pressable
            onPress={() => {
              if (router.canGoBack()) {
                router.back();
              } else {
                router.replace("/(tabs)/dashboard");
              }
            }}
            style={({ pressed }) => [styles.backButton, pressed && styles.backButtonPressed]}
          >
            <Text style={styles.backText}>← Back</Text>
          </Pressable>

          <Header subtitle="Create a new shared space" title="Add Group" />

          <View style={styles.formCard}>
            <Text style={styles.label}>Group Name</Text>
            <TextInput
              autoCapitalize="words"
              onChangeText={setName}
              onFocus={() => setIsFocused(true)}
              onBlur={() => setIsFocused(false)}
              placeholder="e.g. Goa Trip, Apartment Crew"
              placeholderTextColor={theme.textMuted}
              style={[styles.input, isFocused && styles.inputFocused]}
              value={name}
            />


            {errorMessage ? (
              <View style={styles.messageBoxError}>
                <Text style={styles.errorText}>{errorMessage}</Text>
              </View>
            ) : null}

            {successMessage ? (
              <View style={styles.messageBoxSuccess}>
                <Text style={styles.successText}>{successMessage}</Text>
              </View>
            ) : null}

            <CustomButton
              onPress={() => {
                if (!loading) {
                  handleCreateGroup();
                }
              }}
              style={styles.submitButton}
              title={loading ? "Creating Group..." : "Create Group"}
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const getStyles = (theme: ColorTheme) => StyleSheet.create({
  safeArea: {
    backgroundColor: theme.background,
    flex: 1
  },
  keyboardView: {
    flex: 1
  },
  content: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 24
  },
  backButton: {
    alignSelf: "flex-start",
    marginBottom: 18,
    paddingVertical: 8
  },
  backButtonPressed: {
    opacity: 0.7
  },
  backText: {
    color: theme.primaryDark,
    fontSize: 15,
    fontWeight: "800"
  },
  formCard: {
    backgroundColor: theme.card,
    borderRadius: 24,
    padding: 20,
    shadowColor: theme.shadow,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.07,
    shadowRadius: 22,
    elevation: 5
  },
  label: {
    color: theme.text,
    fontSize: 14,
    fontWeight: "800",
    marginBottom: 8,
    marginTop: 14
  },
  input: {
    backgroundColor: theme.input,
    borderColor: theme.border,
    borderRadius: 14,
    borderWidth: 1,
    color: theme.text,
    fontSize: 16,
    minHeight: 52,
    paddingHorizontal: 14
  },
  inputFocused: {
    borderColor: theme.primary,
    backgroundColor: theme.white
  },
  messageBoxError: {
    backgroundColor: theme.dangerSoft,
    borderRadius: 14,
    marginTop: 18,
    padding: 12
  },
  messageBoxSuccess: {
    backgroundColor: theme.primarySoft,
    borderRadius: 14,
    marginTop: 18,
    padding: 12
  },
  errorText: {
    color: theme.danger,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20
  },
  successText: {
    color: theme.primaryDark,
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 20
  },
  submitButton: {
    marginTop: 20
  }
});
