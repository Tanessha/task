import { NextRequest, NextResponse } from "next/server";
import { validateBookingRules } from "@/lib/appointmentRules";
import {
  createServiceSupabase,
  createSupabaseForRequest,
  getAuthenticatedProfile,
  isUniqueViolation,
  readString,
} from "@/lib/routeSupabase";

export async function POST(req: NextRequest) {
  const supabase = createSupabaseForRequest(req);
  const serviceSupabase = createServiceSupabase();
  const { profile, error: authError } = await getAuthenticatedProfile(supabase);

  if (!profile) {
    return NextResponse.json({ error: authError }, { status: 401 });
  }

  if (profile.role !== "patient") {
    return NextResponse.json(
      { error: "Only patients can book appointments." },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => null);
  const doctorId = readString(body?.doctor_id ?? body?.doctorId);
  const slotId = readString(body?.slot_id ?? body?.slotId);

  if (!doctorId || !slotId) {
    return NextResponse.json(
      { error: "doctor_id and slot_id are required." },
      { status: 400 }
    );
  }

  const { data: slot, error: slotError } = await supabase
    .from("slots")
    .select("id, doctor_id, start_time, end_time, is_booked")
    .eq("id", slotId)
    .maybeSingle();

  if (slotError) {
    return NextResponse.json({ error: slotError.message }, { status: 400 });
  }

  const { data: activeAppointment, error: activeError } = await supabase
    .from("appointments")
    .select("id")
    .eq("patient_id", profile.id)
    .eq("doctor_id", doctorId)
    .eq("status", "active")
    .maybeSingle();

  if (activeError) {
    return NextResponse.json({ error: activeError.message }, { status: 400 });
  }

  const rule = validateBookingRules({
    slotExists: Boolean(slot),
    slotIsBooked: slot?.is_booked,
    slotDoctorId: slot?.doctor_id,
    requestedDoctorId: doctorId,
    hasActiveAppointmentWithDoctor: Boolean(activeAppointment),
  });

  if (!rule.allowed) {
    const status = rule.error?.includes("already") ? 409 : 400;
    return NextResponse.json({ error: rule.error }, { status });
  }

  const { data: reservedSlot, error: reserveError } = await serviceSupabase
    .from("slots")
    .update({ is_booked: true })
    .eq("id", slotId)
    .eq("doctor_id", doctorId)
    .eq("is_booked", false)
    .select("id")
    .maybeSingle();

  if (reserveError) {
    return NextResponse.json({ error: reserveError.message }, { status: 400 });
  }

  if (!reservedSlot) {
    return NextResponse.json(
      { error: "Slot is already booked." },
      { status: 409 }
    );
  }

  const { data: appointment, error: insertError } = await serviceSupabase
    .from("appointments")
    .insert({
      patient_id: profile.id,
      doctor_id: doctorId,
      slot_id: slotId,
      status: "active",
    })
    .select("id, patient_id, doctor_id, slot_id, status, created_at")
    .single();

  if (insertError) {
    await serviceSupabase.from("slots").update({ is_booked: false }).eq("id", slotId);

    return NextResponse.json(
      {
        error: isUniqueViolation(insertError)
          ? "Slot or doctor already has an active appointment conflict."
          : insertError.message,
      },
      { status: isUniqueViolation(insertError) ? 409 : 400 }
    );
  }

  return NextResponse.json({ appointment }, { status: 201 });
}
