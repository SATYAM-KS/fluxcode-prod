import { createAdminClient } from "@/lib/supabase/admin-client";
import type { User } from "@supabase/supabase-js";

export type Profile = {
  id: string;
  email: string;
  role: string;
  avatar_url: string | null;
  created_at: string;
};

/**
 * Gets the profile for the given user using the service-role client
 * (bypasses RLS). If no profile row exists, upserts one so the app
 * never breaks regardless of trigger or RLS policy state.
 */
export async function ensureProfile(user: User): Promise<Profile> {
  const admin = createAdminClient();

  // 1. Try to read existing profile (service role bypasses RLS)
  const { data: existing } = await admin
    .from("profiles")
    .select("id, email, role, avatar_url, created_at")
    .eq("id", user.id)
    .maybeSingle();

  if (existing) return existing as Profile;

  // 2. No profile row – upsert one using the real auth user id
  const avatarUrl =
    user.user_metadata?.avatar_url ??
    user.user_metadata?.picture ??
    null;

  const { data: upserted } = await admin
    .from("profiles")
    .upsert(
      {
        id: user.id,
        email: user.email ?? "",
        role: "user",
        avatar_url: avatarUrl,
        created_at: new Date().toISOString(),
      },
      { onConflict: "id", ignoreDuplicates: false }
    )
    .select("id, email, role, avatar_url, created_at")
    .single();

  return (upserted as Profile) ?? {
    id: user.id,
    email: user.email ?? "",
    role: "user",
    avatar_url: avatarUrl,
    created_at: new Date().toISOString(),
  };
}
