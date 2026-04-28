import { NextRequest, NextResponse } from "next/server";
import {
  createSupabaseForRequest,
  getAuthenticatedProfile,
} from "@/lib/routeSupabase";
import { createClient } from "@supabase/supabase-js";

export async function GET(req: NextRequest) {
  // 🔐 Step 1: Use normal client for auth check
  const supabase = createSupabaseForRequest(req);
  const { profile, error: authError } = await getAuthenticatedProfile(supabase);

  if (!profile) {
    return NextResponse.json({ error: authError }, { status: 401 });
  }

  if (profile.role !== "admin") {
    return NextResponse.json(
      { error: "Only admins can view all appointments." },
      { status: 403 }
    );
  }

  // 🚀 Step 2: Use service role client to bypass RLS
  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await adminClient
    .from("appointments")
    .select(
      "id, status, created_at, doctors(id, name), patients(id, name), slots(id, start_time, end_time)"
    )
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // 🧾 Step 3: Format response for UI
  const appointments = (data ?? []).map((appointment) => ({
    id: appointment.id,
    status: appointment.status,
    created_at: appointment.created_at,
    doctor: appointment.doctors,
    patient: appointment.patients,
    slot: appointment.slots,
  }));

  return NextResponse.json({ appointments });
}