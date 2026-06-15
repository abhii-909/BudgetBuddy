import * as Linking from "expo-linking";
import { supabase } from "../lib/supabase";

type AuthCredentials = {
  email: string;
  password: string;
};

type SignUpCredentials = AuthCredentials & {
  fullName: string;
};

const getAuthErrorMessage = (error: unknown) => {
  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "object" && error !== null && "message" in error) {
    return String(error.message);
  }

  return "Something went wrong. Please try again.";
};

export const signUp = async ({ email, password, fullName }: SignUpCredentials) => {
  try {
    const emailRedirectTo = Linking.createURL("login");

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo,
        data: {
          full_name: fullName
        }
      }
    });

    if (error) {
      throw error;
    }

    if (!data.user) {
      throw new Error("Signup completed, but no user was returned.");
    }

    // Task 1: Create a profiles record. Prevent duplicates. Log errors.
    try {
      const { data: existingProfile, error: checkError } = await supabase
        .from("profiles")
        .select("id")
        .eq("id", data.user.id)
        .maybeSingle();

      if (checkError) {
        console.error("Error checking existing profile:", checkError);
      }

      if (!existingProfile) {
        const { error: insertError } = await supabase
          .from("profiles")
          .insert({
            id: data.user.id,
            full_name: fullName,
            email: email
          });

        if (insertError) {
          console.error("FAILED TO INSERT PROFILE (potential RLS issue):", insertError);
          throw new Error(`Profile creation failed: ${insertError.message}`);
        } else {
          console.log("Profile created successfully for user:", data.user.id);
        }
      } else {
        console.log("Profile already exists for user:", data.user.id);
      }
    } catch (profileError: any) {
      console.error("Profile creation step threw an error:", profileError);
      throw profileError;
    }

    return { data, error: null };
  } catch (error) {
    return {
      data: null,
      error: getAuthErrorMessage(error)
    };
  }
};

export const signIn = async ({ email, password }: AuthCredentials) => {
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      throw error;
    }

    return { data, error: null };
  } catch (error) {
    return {
      data: null,
      error: getAuthErrorMessage(error)
    };
  }
};

export const signOut = async () => {
  try {
    const { error } = await supabase.auth.signOut();

    if (error) {
      throw error;
    }

    return { error: null };
  } catch (error) {
    return {
      error: getAuthErrorMessage(error)
    };
  }
};

export const getCurrentUser = async () => {
  try {
    const { data, error } = await supabase.auth.getUser();

    if (error) {
      throw error;
    }

    return { user: data.user, error: null };
  } catch (error) {
    return {
      user: null,
      error: getAuthErrorMessage(error)
    };
  }
};

export const getSession = async () => {
  try {
    const { data, error } = await supabase.auth.getSession();

    if (error) {
      throw error;
    }

    return { session: data.session, error: null };
  } catch (error) {
    return {
      session: null,
      error: getAuthErrorMessage(error)
    };
  }
};
