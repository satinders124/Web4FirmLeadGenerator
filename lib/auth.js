import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "./supabase-server";

export async function getCurrentUserAndRole() {
  const supabase = await createServerSupabaseClient();
  if (!supabase) return { user: null, role: null, configured: false };

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { user: null, role: null, configured: true };

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  return { user, role: profile?.role || "member", configured: true };
}

export async function requireUser() {
  const auth = await getCurrentUserAndRole();
  if (!auth.configured) {
    return { error: NextResponse.json({ error: "Supabase Auth is not configured yet." }, { status: 503 }) };
  }
  if (!auth.user) {
    return { error: NextResponse.json({ error: "Authentication required." }, { status: 401 }) };
  }
  return auth;
}

export async function requireAdmin() {
  const auth = await requireUser();
  if (auth.error) return auth;
  if (auth.role !== "admin") {
    return { error: NextResponse.json({ error: "Admin access is required for this action." }, { status: 403 }) };
  }
  return auth;
}
