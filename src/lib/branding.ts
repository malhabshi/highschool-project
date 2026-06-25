"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

// Cloud-backed: one global logo (in the settings row id=1) shared by everyone.
export function useLogo() {
  const [logo, setLogoState] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    const { data } = await supabase
      .from("settings")
      .select("logo")
      .eq("id", 1)
      .maybeSingle();
    setLogoState((data?.logo as string) ?? null);
  }, []);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const setLogo = useCallback(async (value: string) => {
    setLogoState(value); // optimistic
    await supabase.from("settings").update({ logo: value }).eq("id", 1);
  }, []);

  const clearLogo = useCallback(async () => {
    setLogoState(null);
    await supabase.from("settings").update({ logo: null }).eq("id", 1);
  }, []);

  return { logo, setLogo, clearLogo };
}
