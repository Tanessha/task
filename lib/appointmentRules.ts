export type Role = "patient" | "doctor" | "admin";
export type AppointmentStatus = "active" | "done" | "cancelled";

type RuleResult = {
  allowed: boolean;
  error?: string;
};

export type AppointmentDoctorStatus = {
  status: AppointmentStatus;
  doctorId?: string | null;
};

export type SlotWithDoctorId = {
  doctorId?: string | null;
};

export function isTerminalStatus(status: AppointmentStatus) {
  return status === "done" || status === "cancelled";
}

export function canPatientCancelAppointment(
  status: AppointmentStatus,
  startTime: string,
  now = new Date()
): RuleResult {
  if (isTerminalStatus(status)) {
    return { allowed: false, error: "Appointment is already done or cancelled." };
  }

  const startsAt = new Date(startTime);
  const oneHourMs = 60 * 60 * 1000;

  if (startsAt.getTime() - now.getTime() <= oneHourMs) {
    return {
      allowed: false,
      error: "Patients cannot cancel within 1 hour of the appointment.",
    };
  }

  return { allowed: true };
}

export function canDoctorUpdateAppointment(): RuleResult {
  return { allowed: true };
}

export function validateBookingRules(options: {
  slotExists: boolean;
  slotIsBooked?: boolean;
  slotDoctorId?: string;
  requestedDoctorId: string;
  hasActiveAppointmentWithDoctor: boolean;
}): RuleResult {
  if (!options.slotExists) {
    return { allowed: false, error: "Slot not found." };
  }

  if (options.slotDoctorId !== options.requestedDoctorId) {
    return { allowed: false, error: "Slot does not belong to the selected doctor." };
  }

  if (options.slotIsBooked) {
    return { allowed: false, error: "Slot is already booked." };
  }

  if (options.hasActiveAppointmentWithDoctor) {
    return {
      allowed: false,
      error: "Patient already has an active appointment with this doctor.",
    };
  }

  return { allowed: true };
}

export function filterSlotsWithoutActiveDoctorAppointments<
  TSlot extends SlotWithDoctorId
>(slots: TSlot[], appointments: AppointmentDoctorStatus[]) {
  const activeDoctorIds = new Set(
    appointments
      .filter((appointment) => appointment.status === "active")
      .map((appointment) => appointment.doctorId)
      .filter((doctorId): doctorId is string => Boolean(doctorId))
  );

  return slots.filter((slot) => {
    if (!slot.doctorId) {
      return true;
    }

    return !activeDoctorIds.has(slot.doctorId);
  });
}
