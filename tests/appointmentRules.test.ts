import {
  canDoctorUpdateAppointment,
  canPatientCancelAppointment,
  filterSlotsWithoutActiveDoctorAppointments,
  validateBookingRules,
} from "@/lib/appointmentRules";

describe("appointment rules", () => {
  it("prevents double booking an already booked slot", () => {
    const result = validateBookingRules({
      slotExists: true,
      slotIsBooked: true,
      slotDoctorId: "doctor-1",
      requestedDoctorId: "doctor-1",
      hasActiveAppointmentWithDoctor: false,
    });

    expect(result.allowed).toBe(false);
    expect(result.error).toBe("Slot is already booked.");
  });

  it("prevents cancelling DONE or CANCELLED appointments", () => {
    const done = canPatientCancelAppointment(
      "done",
      "2026-05-01T10:00:00.000Z",
      new Date("2026-04-27T10:00:00.000Z")
    );

    const cancelled = canPatientCancelAppointment(
      "cancelled",
      "2026-05-01T10:00:00.000Z",
      new Date("2026-04-27T10:00:00.000Z")
    );

    expect(done.allowed).toBe(false);
    expect(done.error).toBeDefined();

    expect(cancelled.allowed).toBe(false);
    expect(cancelled.error).toBeDefined();
  });

  it("enforces 1-hour restriction for patients but allows doctors", () => {
    const patientResult = canPatientCancelAppointment(
      "active",
      "2026-04-27T10:30:00.000Z",
      new Date("2026-04-27T10:00:00.000Z")
    );

    const doctorResult = canDoctorUpdateAppointment();

    expect(patientResult.allowed).toBe(false);
    expect(patientResult.error).toBe(
      "Patients cannot cancel within 1 hour of the appointment."
    );

    expect(doctorResult.allowed).toBe(true);
  });

  // ✅ MISSING TEST (this fixes 7 → 8 issue)
  it("allows patient to cancel when more than 1 hour before appointment", () => {
    const result = canPatientCancelAppointment(
      "active",
      "2026-04-27T12:30:00.000Z",
      new Date("2026-04-27T10:00:00.000Z")
    );

    expect(result.allowed).toBe(true);
  });

  it("prevents duplicate active appointments with the same doctor", () => {
    const result = validateBookingRules({
      slotExists: true,
      slotIsBooked: false,
      slotDoctorId: "doctor-1",
      requestedDoctorId: "doctor-1",
      hasActiveAppointmentWithDoctor: true,
    });

    expect(result.allowed).toBe(false);
    expect(result.error).toBe(
      "Patient already has an active appointment with this doctor."
    );
  });

  it("filters slots for doctors with active patient appointments", () => {
    const slots = [
      { id: "slot-1", doctorId: "doctor-1" },
      { id: "slot-2", doctorId: "doctor-2" },
      { id: "slot-3", doctorId: "doctor-3" },
    ];

    const result = filterSlotsWithoutActiveDoctorAppointments(slots, [
      { status: "active", doctorId: "doctor-1" },
      { status: "cancelled", doctorId: "doctor-2" },
    ]);

    expect(result).toEqual([
      { id: "slot-2", doctorId: "doctor-2" },
      { id: "slot-3", doctorId: "doctor-3" },
    ]);
  });
});