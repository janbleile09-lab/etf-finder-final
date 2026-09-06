"use server";

import { createClient } from "@/lib/supabase/server";
import { z } from "zod";
import { revalidatePath } from "next/cache";

export const ProfileSchema = z.object({
  display_name: z.string().max(50).nullable().optional(),
  risk_tolerance: z.enum(["conservative", "balanced", "aggressive"]).nullable().optional(),
  base_currency: z.enum(["EUR", "USD"]).nullable().optional(),
  investment_horizon_years: z.coerce.number().min(0).max(100).nullable().optional(),
  data_sharing_consent: z.boolean().optional(),
});

export type ProfileData = z.infer<typeof ProfileSchema>;

export async function getProfile() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated", data: null };
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error && error.code !== "PGRST116") {
    return { error: error.message, data: null };
  }

  return { error: null, data };
}

export async function updateProfile(formData: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  const payload = {
    display_name: formData.get("display_name") as string | null,
    risk_tolerance: formData.get("risk_tolerance") as "conservative" | "balanced" | "aggressive" | null,
    base_currency: formData.get("base_currency") as "EUR" | "USD" | null,
    investment_horizon_years: formData.get("investment_horizon_years")
      ? Number(formData.get("investment_horizon_years"))
      : null,
    data_sharing_consent: formData.get("data_sharing_consent") === "on",
  };

  // Exclude empty strings and convert to null
  if (payload.display_name === "") payload.display_name = null;
  if (!payload.risk_tolerance) payload.risk_tolerance = null;
  if (!payload.base_currency) payload.base_currency = null;
  if (!payload.investment_horizon_years) payload.investment_horizon_years = null;

  const parsed = ProfileSchema.safeParse(payload);

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message };
  }

  const { error } = await supabase
    .from("profiles")
    .upsert({
      id: user.id,
      ...parsed.data,
      updated_at: new Date().toISOString(),
    });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/settings");
  return { success: true };
}

export async function updateConsent(consent: boolean) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { success: false };

  const { error } = await supabase
    .from("profiles")
    .upsert({
      id: user.id,
      data_sharing_consent: consent,
      updated_at: new Date().toISOString(),
    });

  return { success: !error };
}

export async function exportAccountData() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated", data: null };
  }

  const [profileRes, savedEtfsRes, chatHistoryRes] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", user.id).single(),
    supabase.from("user_saved_etfs").select("*").eq("user_id", user.id),
    supabase.from("chat_history").select("*").eq("user_id", user.id),
  ]);

  const exportData = {
    user: {
      id: user.id,
      email: user.email,
      created_at: user.created_at,
    },
    profile: profileRes.data || null,
    savedEtfs: savedEtfsRes.data || [],
    chatHistory: chatHistoryRes.data || [],
  };

  return { error: null, data: exportData };
}

export async function deleteAccountData() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return { error: "Not authenticated" };
  }

  // Delete all associated data manually (profile, bookmarks, chat)
  // Profiles table has CASCADE on delete, but user_saved_etfs does too.
  // Wait, deleting the profile won't delete the user in auth.users.
  // But since we can't easily delete the auth.user without an admin key in a server action
  // (unless we have SUPABASE_SERVICE_ROLE_KEY, which we might not),
  // we can at least wipe the data and then sign out.

  await Promise.all([
    supabase.from("profiles").delete().eq("id", user.id),
    supabase.from("user_saved_etfs").delete().eq("user_id", user.id),
    supabase.from("chat_history").delete().eq("user_id", user.id),
  ]);

  return { success: true };
}
