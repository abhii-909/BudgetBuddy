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
    const emailRedirectTo = Linking.createURL("auth-callback");

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

    // Check if user already exists (Supabase returns an empty identities array when email confirmation is enabled and the email is taken)
    const isDuplicate = Array.isArray(data.user.identities) && data.user.identities.length === 0;

    return {
      data,
      isDuplicate,
      needsConfirmation: !data.session,
      error: null
    };
  } catch (error) {
    return {
      data: null,
      isDuplicate: false,
      needsConfirmation: false,
      error: getAuthErrorMessage(error)
    };
  }
};

export const resendConfirmation = async (email: string) => {
  try {
    const emailRedirectTo = Linking.createURL("auth-callback");
    const { error } = await supabase.auth.resend({
      type: "signup",
      email,
      options: {
        emailRedirectTo
      }
    });

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

export const requestPasswordReset = async (email: string) => {
  try {
    const redirectTo = Linking.createURL("reset-password");
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo
    });

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

export const updatePassword = async (password: string) => {
  try {
    const { data, error } = await supabase.auth.updateUser({
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
