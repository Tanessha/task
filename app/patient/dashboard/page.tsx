"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { filterSlotsWithoutActiveDoctorAppointments } from "@/lib/appointmentRules";
import { supabase } from "@/lib/supabase";

type Patient = {
  id: string;
  name: string;
  email: string;
};

type AvailableSlot = {
  id: string;
  start_time: string;
  end_time: string;
  doctors: {
    id: string;
    name: string;
    specialty: string;
  };
};

type MyAppointment = {
  id: string;
  status: "active" | "done" | "cancelled";
  slots: { start_time: string; end_time: string };
  doctors: { id: string; name: string; specialty: string };
};

type ActionMessage = {
  text: string;
  tone: "success" | "error";
};

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function PatientDashboard() {
  const router = useRouter();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [availableSlots, setAvailableSlots] = useState<AvailableSlot[]>([]);
  const [myAppointments, setMyAppointments] = useState<MyAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState<ActionMessage | null>(null);
  const [bookingSlotId, setBookingSlotId] = useState<string | null>(null);

  async function loadDashboard() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/patient/login");
      return;
    }

    const { data: patientData } = await supabase
      .from("patients")
      .select("*")
      .eq("id", user.id)
      .single();

    if (!patientData) {
      router.push("/patient/login");
      return;
    }

    setPatient(patientData);

    const { data: slotsData } = await supabase
      .from("slots")
      .select("id, start_time, end_time, doctors(id, name, specialty)")
      .eq("is_booked", false)
      .order("start_time");

    setAvailableSlots((slotsData as unknown as AvailableSlot[]) ?? []);

    const { data: apptData } = await supabase
      .from("appointments")
      .select(
        "id, status, slots(start_time, end_time), doctors(id, name, specialty)"
      )
      .eq("patient_id", user.id)
      .order("created_at", { ascending: false });

    setMyAppointments((apptData as unknown as MyAppointment[]) ?? []);
  }

  useEffect(() => {
    async function load() {
      await loadDashboard();
      setLoading(false);
    }

    load();
  }, [router]);

  async function handleBook(slotId: string, doctorId: string) {
    setActionMsg(null);
    setBookingSlotId(slotId);

    const {
      data: { session },
    } = await supabase.auth.getSession();

    const res = await fetch("/api/appointments/book", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({ slotId, doctorId }),
    });
    const data = await res.json();

    if (res.ok) {
      setActionMsg({
        text: "Appointment booked successfully!",
        tone: "success",
      });
      await loadDashboard();
    } else {
      setActionMsg({
        text: data.error ?? "Booking failed.",
        tone: "error",
      });
    }

    setBookingSlotId(null);
  }

  async function handleCancel(appointmentId: string) {
    setActionMsg(null);
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const res = await fetch("/api/appointments/cancel", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({ appointmentId, action: "cancel" }),
    });
    const data = await res.json();

    if (res.ok) {
      setActionMsg({
        text: "Appointment cancelled.",
        tone: "success",
      });
      await loadDashboard();
    } else {
      setActionMsg({
        text: data.error ?? "Cancellation failed.",
        tone: "error",
      });
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/patient/login");
  }

  const bookableSlots = filterSlotsWithoutActiveDoctorAppointments(
    availableSlots.map((slot) => ({
      ...slot,
      doctorId: slot.doctors?.id,
    })),
    myAppointments.map((appointment) => ({
      status: appointment.status,
      doctorId: appointment.doctors?.id,
    }))
  );

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-gray-500">Loading...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold">{patient?.name}</h1>
          <button
            onClick={handleLogout}
            className="rounded-lg border px-4 py-2 text-sm text-gray-600 hover:bg-gray-100"
          >
            Logout
          </button>
        </div>

        {actionMsg && (
          <p
            className={`mb-4 rounded-lg px-4 py-2 text-sm ${
              actionMsg.tone === "success"
                ? "bg-green-50 text-green-700"
                : "bg-red-50 text-red-700"
            }`}
          >
            {actionMsg.text}
          </p>
        )}

        <section className="mb-8">
          <h2 className="mb-3 text-lg font-semibold">Available Slots</h2>
          {bookableSlots.length === 0 ? (
            <p className="text-sm text-gray-500">No available slots right now.</p>
          ) : (
            <div className="overflow-hidden rounded-xl border bg-white">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-gray-600">
                  <tr>
                    <th className="px-4 py-3 font-medium">Doctor</th>
                    <th className="px-4 py-3 font-medium">Specialty</th>
                    <th className="px-4 py-3 font-medium">Date & Time</th>
                    <th className="px-4 py-3 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {bookableSlots.map((slot) => (
                    <tr key={slot.id}>
                      <td className="px-4 py-3">{slot.doctors?.name}</td>
                      <td className="px-4 py-3 text-gray-500">
                        {slot.doctors?.specialty}
                      </td>
                      <td className="px-4 py-3">
                        {formatDateTime(slot.start_time)} -{" "}
                        {new Date(slot.end_time).toLocaleTimeString("en-IN", {
                          timeStyle: "short",
                        })}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() =>
                            handleBook(slot.id, slot.doctors?.id)
                          }
                          disabled={bookingSlotId === slot.id}
                          className="rounded bg-green-600 px-3 py-1 text-xs text-white hover:bg-green-700 disabled:opacity-50"
                        >
                          {bookingSlotId === slot.id ? "Booking..." : "Book"}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold">My Appointments</h2>
          {myAppointments.length === 0 ? (
            <p className="text-sm text-gray-500">No appointments yet.</p>
          ) : (
            <div className="overflow-hidden rounded-xl border bg-white">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-gray-600">
                  <tr>
                    <th className="px-4 py-3 font-medium">Doctor</th>
                    <th className="px-4 py-3 font-medium">Slot</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {myAppointments.map((appt) => (
                    <tr key={appt.id}>
                      <td className="px-4 py-3">
                        <div>{appt.doctors?.name}</div>
                        <div className="text-xs text-gray-400">
                          {appt.doctors?.specialty}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {formatDateTime(appt.slots?.start_time)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            appt.status === "active"
                              ? "bg-blue-100 text-blue-700"
                              : appt.status === "done"
                              ? "bg-green-100 text-green-700"
                              : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {appt.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {appt.status === "active" && (
                          <button
                            onClick={() => handleCancel(appt.id)}
                            className="rounded bg-red-600 px-3 py-1 text-xs text-white hover:bg-red-700"
                          >
                            Cancel
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
