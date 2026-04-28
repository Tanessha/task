import { NextRequest, NextResponse } from "next/server";
import {
  createServiceSupabase,
  createSupabaseForRequest,
  getAuthenticatedProfile,
} from "@/lib/routeSupabase";

export async function GET(req: NextRequest) {
  const supabase = createSupabaseForRequest(req);
  const serviceSupabase = createServiceSupabase();
  const { profile, error: authError } = await getAuthenticatedProfile(supabase);

  if (!profile) {
    return NextResponse.json({ error: authError }, { status: 401 });
  }

  if (profile.role !== "doctor") {
    return NextResponse.json(
      { error: "Only doctors can view assigned appointments." },
      { status: 403 }
    );
  }

  const { data, error } = await serviceSupabase
    .from("appointments")
    .select(
      "id, status, created_at, patients(id, name), slots(id, start_time, end_time)"
    )
    .eq("doctor_id", profile.id)
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ appointments: data ?? [] });
}
