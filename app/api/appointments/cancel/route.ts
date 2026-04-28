import { NextRequest, NextResponse } from "next/server";
import {
  canPatientCancelAppointment,
} from "@/lib/appointmentRules";
import type { AppointmentStatus } from "@/lib/appointmentRules";
import {
  createServiceSupabase,
  createSupabaseForRequest,
  getAuthenticatedProfile,
  readString,
} from "@/lib/routeSupabase";

export async function POST(req: NextRequest) {
  const supabase = createSupabaseForRequest(req);
  const serviceSupabase = createServiceSupabase();
  const { profile, error: authError } = await getAuthenticatedProfile(supabase);

  if (!profile) {
    return NextResponse.json({ error: authError }, { status: 401 });
  }

  if (profile.role !== "patient" && profile.role !== "doctor") {
    return NextResponse.json(
      { error: "Only patients or doctors can update appointments." },
      { status: 403 }
    );
  }

  const body = await req.json().catch(() => null);
  const appointmentId = readString(body?.appointment_id ?? body?.appointmentId);
  const action = readString(body?.action) ?? "cancel";

  if (!appointmentId) {
    return NextResponse.json(
      { error: "appointment_id is required." },
      { status: 400 }
    );
  }

  if (action !== "cancel" && action !== "done") {
    return NextResponse.json(
      { error: "action must be either cancel or done." },
      { status: 400 }
    );
  }

  const { data: appointment, error: fetchError } = await supabase
    .from("appointments")
    .select("id, patient_id, doctor_id, slot_id, status, slots(id, start_time)")
    .eq("id", appointmentId)
    .maybeSingle();

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 400 });
  }

  if (!appointment) {
    return NextResponse.json(
      { error: "Appointment not found." },
      { status: 404 }
    );
  }

  if (profile.role === "patient" && appointment.patient_id !== profile.id) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  if (profile.role === "doctor" && appointment.doctor_id !== profile.id) {
    return NextResponse.json({ error: "Forbidden." }, { status: 403 });
  }

  if (profile.role === "patient") {
    if (action !== "cancel") {
      return NextResponse.json(
        { error: "Patients can only cancel appointments." },
        { status: 403 }
      );
    }

    const slot = Array.isArray(appointment.slots)
      ? appointment.slots[0]
      : appointment.slots;

    if (!slot?.start_time) {
      return NextResponse.json(
        { error: "Appointment slot not found." },
        { status: 400 }
      );
    }

    const rule = canPatientCancelAppointment(
      appointment.status as AppointmentStatus,
      slot?.start_time
    );

    if (!rule.allowed) {
      return NextResponse.json({ error: rule.error }, { status: 409 });
    }
  }

  const nextStatus = action === "done" ? "done" : "cancelled";
  const { data: updated, error: updateError } = await serviceSupabase
    .from("appointments")
    .update({ status: nextStatus })
    .eq("id", appointmentId)
    .select("id, patient_id, doctor_id, slot_id, status, created_at")
    .single();

  if (updateError) {
    return NextResponse.json({ error: updateError.message }, { status: 400 });
  }

  if (nextStatus === "cancelled") {
    await serviceSupabase
      .from("slots")
      .update({ is_booked: false })
      .eq("id", appointment.slot_id);
  }

  return NextResponse.json({ appointment: updated });
}
