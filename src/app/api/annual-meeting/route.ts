import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const url =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const serviceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY ||
  "";

const KEY = "annual_meeting_password";

// Verify the caller's token; return { admin, service } or null if not logged in.
async function auth(req: Request) {
  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token || !serviceKey) return null;
  const anon = createClient(url, anonKey, { auth: { persistSession: false } });
  const {
    data: { user },
  } = await anon.auth.getUser(token);
  if (!user) return null;
  const service = createClient(url, serviceKey, {
    auth: { persistSession: false },
  });
  const { data: profile } = await service
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  return { admin: profile?.role === "admin", service };
}

async function getPassword(service: SupabaseClient) {
  const { data } = await service
    .from("app_config")
    .select("value")
    .eq("key", KEY)
    .maybeSingle();
  return ((data as { value?: string } | null)?.value as string) ?? "";
}

// Is a password configured? (used to render the right screen)
export async function GET(req: Request) {
  const ctx = await auth(req);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const pw = await getPassword(ctx.service);
  return NextResponse.json({ configured: pw.length > 0 });
}

// Verify a submitted password (any logged-in user).
export async function POST(req: Request) {
  const ctx = await auth(req);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { password } = await req.json();
  const stored = await getPassword(ctx.service);
  const ok = stored.length > 0 && String(password) === stored;
  return NextResponse.json({ ok });
}

// Set / change the password (admin only). Empty string clears it.
export async function PUT(req: Request) {
  const ctx = await auth(req);
  if (!ctx || !ctx.admin)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { password } = await req.json();
  const { error } = await ctx.service
    .from("app_config")
    .upsert({ key: KEY, value: String(password ?? "") }, { onConflict: "key" });
  if (error)
    return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
