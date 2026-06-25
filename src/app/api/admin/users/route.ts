import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const url =
  process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";
const serviceKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_SECRET_KEY ||
  "";

// Verify the caller's token belongs to an admin; return a service-role client.
async function requireAdmin(req: Request) {
  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token || !serviceKey) return null;

  const anon = createClient(url, anonKey, { auth: { persistSession: false } });
  const {
    data: { user },
  } = await anon.auth.getUser(token);
  if (!user) return null;

  const admin = createClient(url, serviceKey, {
    auth: { persistSession: false },
  });
  const { data: profile } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") return null;
  return admin;
}

// Create a new staff account (auto-confirmed) + fill in their profile.
export async function POST(req: Request) {
  const admin = await requireAdmin(req);
  if (!admin)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { email, password, name, phone, role } = await req.json();
  if (!email || !password || String(password).length < 6)
    return NextResponse.json(
      { error: "Email and a 6+ char password are required." },
      { status: 400 }
    );
  const { data, error } = await admin.auth.admin.createUser({
    email: String(email).trim(),
    password,
    email_confirm: true,
    user_metadata: { name },
  });
  if (error)
    return NextResponse.json({ error: error.message }, { status: 400 });
  if (data.user) {
    await admin
      .from("profiles")
      .update({ name, phone, email: String(email).trim(), role })
      .eq("id", data.user.id);
  }
  return NextResponse.json({ ok: true });
}

// Reset a user's password.
export async function PATCH(req: Request) {
  const admin = await requireAdmin(req);
  if (!admin)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, password } = await req.json();
  if (!id || !password || String(password).length < 6)
    return NextResponse.json(
      { error: "Password must be at least 6 characters." },
      { status: 400 }
    );
  const { error } = await admin.auth.admin.updateUserById(id, { password });
  if (error)
    return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

// Delete a user (auth account + profile via cascade).
export async function DELETE(req: Request) {
  const admin = await requireAdmin(req);
  if (!admin)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await req.json();
  if (!id) return NextResponse.json({ error: "Missing id" }, { status: 400 });
  const { error } = await admin.auth.admin.deleteUser(id);
  if (error)
    return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
