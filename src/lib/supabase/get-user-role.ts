import { createClient } from "@/lib/supabase/server";

export type UserRole = "user" | "admin";

/**
 * Fetches the role for a given user ID from the profiles table.
 * Returns "user" as a safe default if the profile is missing.
 */
export async function getUserRole(userId: string): Promise<UserRole> {
  const supabase = createClient();
  const { data } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", userId)
    .maybeSingle();
  return (data?.role as UserRole) ?? "user";
}

/**
 * Returns true when the given user ID has the 'admin' role.
 */
export async function isAdmin(userId: string): Promise<boolean> {
  const role = await getUserRole(userId);
  return role === "admin";
}
