import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { supabase } from "../lib/supabase";

/**
 * Service to manage picking, optimizing, and uploading profile avatars
 */

/**
 * Picks an image from the user's library, resizes to 512x512, compresses to 80%,
 * normalizes to JPEG, uploads to storage under `avatars/{userId}/avatar.jpg`,
 * and persists the CLEAN path `{userId}/avatar.jpg` in the profiles table.
 *
 * Always uses the authenticated user's ID from supabase.auth.getUser() to avoid
 * any mismatch between the passed userId and the actual auth session.
 *
 * Returns the saved storage path (without cache-buster) or error.
 */
export async function pickAndUploadAvatar(userId: string): Promise<{ data: string | null; error: string | null }> {
  try {
    // 0. Verify the currently authenticated user — do not trust the passed userId alone
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
    if (authError || !authUser) {
      return { data: null, error: "Not authenticated. Please log in again." };
    }

    // Log both IDs so mismatches are visible in the console
    console.log("[AvatarService] Authenticated user ID:", authUser.id);
    console.log("[AvatarService] Passed userId param:", userId);

    if (authUser.id !== userId) {
      console.warn(
        "[AvatarService] ⚠️ ID mismatch detected! " +
        `Passed: ${userId} | Auth: ${authUser.id}. ` +
        "Using authenticated user ID."
      );
    }

    // Always use the verified auth session ID for storage and DB operations
    const verifiedUserId = authUser.id;

    // 1. Request media library permissions
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== ImagePicker.PermissionStatus.GRANTED) {
      return { data: null, error: "Permission to access media library was denied." };
    }

    // 2. Select the image
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 1,
    });

    if (result.canceled || !result.assets || result.assets.length === 0) {
      return { data: null, error: null }; // User canceled the picker
    }

    const selectedAsset = result.assets[0];

    // 3. Resize to 512x512 and compress/normalize to JPEG
    const manipResult = await ImageManipulator.manipulateAsync(
      selectedAsset.uri,
      [{ resize: { width: 512, height: 512 } }],
      {
        compress: 0.8,
        format: ImageManipulator.SaveFormat.JPEG,
      }
    );

    // 4. Read the file URI to binary array buffer for Supabase upload
    const response = await fetch(manipResult.uri);
    const arrayBuffer = await response.arrayBuffer();
    const fileBody = new Uint8Array(arrayBuffer);

    // 5. Build unique storage path using timestamp to bypass all mobile/CDN caches
    const timestamp = Date.now();
    const storagePath = `${verifiedUserId}/avatar_${timestamp}.jpg`;

    // 6. Upload file to Supabase storage
    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(storagePath, fileBody, {
        contentType: "image/jpeg",
        upsert: true,
      });

    if (uploadError) {
      return { data: null, error: `Storage upload failed: ${uploadError.message}` };
    }

    console.log("[AvatarService] ✅ Storage upload successful:", storagePath);

    // 6b. Best-effort cleanup: remove any old avatar files for this user to keep bucket clean
    try {
      const { data: existingFiles } = await supabase.storage
        .from("avatars")
        .list(verifiedUserId);

      if (existingFiles && existingFiles.length > 0) {
        const oldFiles = existingFiles
          .filter((f) => f.name !== `avatar_${timestamp}.jpg`)
          .map((f) => `${verifiedUserId}/${f.name}`);
        if (oldFiles.length > 0) {
          await supabase.storage.from("avatars").remove(oldFiles);
        }
      }
    } catch {
      // Non-blocking cleanup
    }

    // 7. Update the profiles table with ONLY the clean storage path (no cache-buster).
    //    The cache-buster belongs in the public URL, not in the persisted path.
    const { data: updatedProfile, error: dbError } = await supabase
      .from("profiles")
      .update({ avatar_url: storagePath })
      .eq("id", verifiedUserId)
      .select("id, avatar_url")
      .maybeSingle();

    if (dbError) {
      console.error("[AvatarService] DB update error:", dbError);
      return { data: null, error: `Profile update failed: ${dbError.message}` };
    }

    if (!updatedProfile) {
      console.error(
        "[AvatarService] ⚠️ No profile row matched ID:", verifiedUserId,
        "— avatar uploaded to storage but profile was NOT updated."
      );
      return {
        data: null,
        error: `No profile found for user ID ${verifiedUserId}. ` +
               "The image was uploaded but your profile could not be updated."
      };
    }

    console.log("[AvatarService] ✅ Profile updated:", updatedProfile);

    // Return the clean storage path — callers use getAvatarPublicUrl() to display it
    return { data: storagePath, error: null };
  } catch (err: any) {
    console.error("[AvatarService] Unexpected error:", err);
    return { data: null, error: err.message || "An unexpected error occurred." };
  }
}

/**
 * Returns a short-lived signed URL for a given avatar storage path.
 *
 * Uses createSignedUrl (not getPublicUrl) so this works regardless of whether
 * the avatars bucket is set to Public or Private in Supabase.
 *
 * Strips any legacy ?v=... cache-busters from the path before signing.
 * The signed URL itself is unique per call so no extra cache-buster is needed.
 */
export async function getAvatarSignedUrl(
  storagePath: string | null | undefined
): Promise<string | null> {
  if (!storagePath) return null;

  // Strip any legacy ?v=... that may have been persisted in older DB rows
  const cleanPath = storagePath.split("?")[0];

  const { data, error } = await supabase.storage
    .from("avatars")
    .createSignedUrl(cleanPath, 60 * 60); // 1-hour expiry

  if (error || !data?.signedUrl) {
    console.error("[AvatarService] createSignedUrl failed:", error?.message);
    return null;
  }

  return data.signedUrl;
}

/**
 * @deprecated Use getAvatarSignedUrl instead.
 * Kept for any legacy callers — strips query params and delegates to getPublicUrl.
 */
export function getAvatarPublicUrl(storagePath: string | null | undefined): string | null {
  if (!storagePath) return null;
  const cleanPath = storagePath.split("?")[0];
  const { data } = supabase.storage.from("avatars").getPublicUrl(cleanPath);
  if (!data?.publicUrl) return null;
  return `${data.publicUrl}?v=${Date.now()}`;
}

/**
 * Deletes the user's avatar from Supabase Storage and clears it in the profile database.
 * Uses supabase.auth.getUser() to verify the authenticated user before deletion.
 */
export async function deleteAvatar(userId: string): Promise<{ success: boolean; error: string | null }> {
  try {
    // Verify authenticated user before performing any destructive operation
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
    if (authError || !authUser) {
      return { success: false, error: "Not authenticated. Please log in again." };
    }

    console.log("[AvatarService] deleteAvatar — Auth user ID:", authUser.id);
    console.log("[AvatarService] deleteAvatar — Passed userId:", userId);

    if (authUser.id !== userId) {
      console.warn("[AvatarService] ⚠️ ID mismatch in deleteAvatar. Using authenticated user ID.");
    }

    const verifiedUserId = authUser.id;
    const storagePath = `${verifiedUserId}/avatar.jpg`;

    // 1. Delete from Supabase Storage
    const { error: deleteError } = await supabase.storage
      .from("avatars")
      .remove([storagePath]);

    if (deleteError) {
      return { success: false, error: `Failed to remove from storage: ${deleteError.message}` };
    }

    // 2. Clear avatar_url in the profiles table
    const { error: dbError } = await supabase
      .from("profiles")
      .update({ avatar_url: null })
      .eq("id", verifiedUserId);

    if (dbError) {
      return { success: false, error: `Failed to clear profile URL: ${dbError.message}` };
    }

    console.log("[AvatarService] ✅ Avatar deleted successfully for:", verifiedUserId);
    return { success: true, error: null };
  } catch (err: any) {
    console.error("[AvatarService] Delete error:", err);
    return { success: false, error: err.message || "An unexpected error occurred." };
  }
}
