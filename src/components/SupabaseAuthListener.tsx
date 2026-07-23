"use client";

// Boots the Supabase auth subscription once on the client. Renders nothing.

import { useEffect } from "react";
import { useSession } from "@/lib/session";

export default function SupabaseAuthListener() {
  const init = useSession((s) => s._init);
  useEffect(() => {
    init();
  }, [init]);
  return null;
}
