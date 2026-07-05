import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";
import { supabase } from "../lib/supabase";

/**
 * Service to manage picking, optimizing, and uploading profile avatars
 */

/**
 * Picks an image from the user's library, resizes to 512x512, compresses to 80%,
 * normalizes to JPEG, uploads to storage under `avatars/{userId}/avatar.jpg`,
 * and persists the path `{userId}/avatar.jpg` in the profiles table.
 * 
 * Returns the saved storage path or error.
 */
export async function pickAndUploadAvatar(userId: string): Promise<{ data: string | null; error: string | null }> {
  try {
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

    // 5. Build storage path: {userId}/avatar.jpg
    const storagePath = `${userId}/avatar.jpg`;

    // 6. Upload file to Supabase storage (upsert = true replaces the file)
    const { error: uploadError } = await supabase.storage
      .from("avatars")
      .upload(storagePath, fileBody, {
        contentType: "image/jpeg",
        upsert: true,
      });

    if (uploadError) {
      return { data: null, error: `Storage upload failed: ${uploadError.message}` };
    }

    // 7. Update profiles table avatar_url field with the storage path (including cache-buster version)
    const dbPath = `${storagePath}?v=${new Date().getTime()}`;
    const { error: dbError } = await supabase
      .from("profiles")
      .update({ avatar_url: dbPath })
      .eq("id", userId);

    if (dbError) {
      return { data: null, error: `Profile update failed: ${dbError.message}` };
    }

    return { data: dbPath, error: null };
  } catch (err: any) {
    console.error("Avatar service error:", err);
    return { data: null, error: err.message || "An unexpected error occurred." };
  }
}

/**
 * Returns a public URL for a given avatar storage path.
 */
export function getAvatarPublicUrl(storagePath: string | null | undefined): string | null {
  if (!storagePath) return null;
  const { data } = supabase.storage.from("avatars").getPublicUrl(storagePath);
  return data?.publicUrl || null;
}

/**
 * Deletes the user's avatar from Supabase Storage and clears it in the profile database.
 */
export async function deleteAvatar(userId: string): Promise<{ success: boolean; error: string | null }> {
  try {
    const storagePath = `${userId}/avatar.jpg`;

    // 1. Delete from Supabase Storage
    const { error: deleteError } = await supabase.storage
      .from("avatars")
      .remove([storagePath]);

    if (deleteError) {
      return { success: false, error: `Failed to remove from storage: ${deleteError.message}` };
    }

    // 2. Clear avatar_url column in profiles database table
    const { error: dbError } = await supabase
      .from("profiles")
      .update({ avatar_url: null })
      .eq("id", userId);

    if (dbError) {
      return { success: false, error: `Failed to clear profile URL: ${dbError.message}` };
    }

    return { success: true, error: null };
  } catch (err: any) {
    console.error("Avatar delete error:", err);
    return { success: false, error: err.message || "An unexpected error occurred." };
  }
}
