import { NextRequest, NextResponse } from "next/server";
import { createSupabaseForRequest } from "@/lib/routeSupabase";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: NextRequest) {
  const supabase = createSupabaseForRequest(req);

  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const token = req.headers.get("authorization")?.replace("Bearer ", "");

  if (!token) {
    return NextResponse.json({ error: "No token" }, { status: 401 });
  }

  const { data: userData } = await supabase.auth.getUser(token);

  if (!userData?.user) {
    return NextResponse.json({ error: "Invalid user" }, { status: 401 });
  }

  const { data, error } = await adminClient
    .from("system_admins")
    .select("*")
    .eq("email", userData.user.email?.toLowerCase().trim())
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Not an admin" }, { status: 403 });
  }

  return NextResponse.json({
    admin: { email: userData.user.email },
  });
}