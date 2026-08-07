"use client";

import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "../lib/supabase-browser";
import { Icon } from "./Icons";

export default function LogoutButton() {
  const router = useRouter();

  async function logout() {
    try {
      const supabase = createBrowserSupabaseClient();
      await supabase.auth.signOut();
    } finally {
      router.refresh();
      router.replace("/login");
    }
  }

  return <button type="button" className="logout-button" onClick={logout}><Icon name="external" size={15} /> Sign out</button>;
}
