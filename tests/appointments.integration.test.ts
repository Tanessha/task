import { createClient } from "@supabase/supabase-js";

const runIntegration = process.env.RUN_INTEGRATION_TESTS === "true";
const describeIntegration = runIntegration ? describe : describe.skip;

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

describeIntegration("appointments API integration", () => {
  it("books a slot through the API and verifies the DB entry through patient RLS", async () => {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { data: auth, error: authError } =
      await supabase.auth.signInWithPassword({
        email: "patient2@test.com",
        password: "patient123",
      });

    expect(authError).toBeNull();
    expect(auth.session?.access_token).toBeTruthy();

    const { data: slots } = await supabase
      .from("slots")
      .select("id, doctor_id")
      .eq("is_booked", false)
      .limit(1);

    if (!slots?.length) {
      console.warn("No available seeded slot; skipping booking assertion.");
      return;
    }

    const slot = slots[0];
    const res = await fetch(`${appUrl}/api/appointments/book`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${auth.session!.access_token}`,
      },
      body: JSON.stringify({ slot_id: slot.id, doctor_id: slot.doctor_id }),
    });
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.appointment.slot_id).toBe(slot.id);

    const { data: appointment } = await supabase
      .from("appointments")
      .select("id, status, slot_id")
      .eq("id", body.appointment.id)
      .single();

    expect(appointment).toMatchObject({
      id: body.appointment.id,
      status: "active",
      slot_id: slot.id,
    });
  });

  it("cancels an appointment through the API and verifies the status through patient RLS", async () => {
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    const { data: auth, error: authError } =
      await supabase.auth.signInWithPassword({
        email: "patient2@test.com",
        password: "patient123",
      });

    expect(authError).toBeNull();
    expect(auth.session?.access_token).toBeTruthy();

    const { data: appointments } = await supabase
      .from("appointments")
      .select("id")
      .eq("status", "active")
      .limit(1);

    if (!appointments?.length) {
      console.warn("No active patient appointment; skipping cancellation assertion.");
      return;
    }

    const res = await fetch(`${appUrl}/api/appointments/cancel`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${auth.session!.access_token}`,
      },
      body: JSON.stringify({
        appointment_id: appointments[0].id,
        action: "cancel",
      }),
    });
    const body = await res.json();

    expect(res.ok).toBe(true);
    expect(body.appointment.status).toBe("cancelled");
  });
});
