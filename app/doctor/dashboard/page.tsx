"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Doctor = {
  id: string;
  name: string;
  email: string;
  specialty: string;
};

type Slot = {
  id: string;
  start_time: string;
  end_time: string;
  is_booked: boolean;
};

type Appointment = {
  id: string;
  status: "active" | "done" | "cancelled";
  created_at: string;
  patients: { name: string };
  slots: { start_time: string; end_time: string };
};

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function DoctorDashboard() {
  const router = useRouter();
  const [doctor, setDoctor] = useState<Doctor | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState("");

  useEffect(() => {
    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/doctor/login");
        return;
      }

      const { data: doctorData } = await supabase
        .from("doctors")
        .select("*")
        .eq("id", user.id)
        .single();

      if (!doctorData) {
        router.push("/doctor/login");
        return;
      }

      setDoctor(doctorData);

      const { data: slotData } = await supabase
        .from("slots")
        .select("*")
        .eq("doctor_id", user.id)
        .order("start_time");

      setSlots(slotData ?? []);

      const {
        data: { session },
      } = await supabase.auth.getSession();
      const res = await fetch("/api/doctor/appointments", {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      const data = await res.json();

      if (res.ok) {
        setAppointments((data.appointments as Appointment[]) ?? []);
      }

      setLoading(false);
    }

    load();
  }, [router]);

  async function handleAction(
    appointmentId: string,
    action: "done" | "cancel"
  ) {
    setActionMsg("");
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const res = await fetch("/api/appointments/cancel", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session?.access_token}`,
      },
      body: JSON.stringify({ appointmentId, action }),
    });
    const data = await res.json();
    if (res.ok) {
      setActionMsg("Updated successfully.");
      setAppointments((prev) =>
        prev.map((a) =>
          a.id === appointmentId
            ? { ...a, status: action === "done" ? "done" : "cancelled" }
            : a
        )
      );
    } else {
      setActionMsg(data.error ?? "Something went wrong.");
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/doctor/login");
  }

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
          <div>
            <h1 className="text-2xl font-bold">{doctor?.name}</h1>
            <p className="text-sm text-gray-500">{doctor?.specialty}</p>
          </div>
          <button
            onClick={handleLogout}
            className="rounded-lg border px-4 py-2 text-sm text-gray-600 hover:bg-gray-100"
          >
            Logout
          </button>
        </div>

        {actionMsg && (
          <p className="mb-4 rounded-lg bg-blue-50 px-4 py-2 text-sm text-blue-700">
            {actionMsg}
          </p>
        )}

        <section className="mb-8">
          <h2 className="mb-3 text-lg font-semibold">My Slots</h2>
          {slots.length === 0 ? (
            <p className="text-sm text-gray-500">No slots found.</p>
          ) : (
            <div className="overflow-hidden rounded-xl border bg-white">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-gray-600">
                  <tr>
                    <th className="px-4 py-3 font-medium">Date & Time</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {slots.map((slot) => (
                    <tr key={slot.id}>
                      <td className="px-4 py-3">
                        {formatDateTime(slot.start_time)} —{" "}
                        {new Date(slot.end_time).toLocaleTimeString("en-IN", {
                          timeStyle: "short",
                        })}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            slot.is_booked
                              ? "bg-red-100 text-red-700"
                              : "bg-green-100 text-green-700"
                          }`}
                        >
                          {slot.is_booked ? "Booked" : "Available"}
                        </span>
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
          {appointments.length === 0 ? (
            <p className="text-sm text-gray-500">No appointments yet.</p>
          ) : (
            <div className="overflow-hidden rounded-xl border bg-white">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-gray-600">
                  <tr>
                    <th className="px-4 py-3 font-medium">Patient</th>
                    <th className="px-4 py-3 font-medium">Slot</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {appointments.map((appt) => (
                    <tr key={appt.id}>
                      <td className="px-4 py-3">{appt.patients?.name}</td>
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
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleAction(appt.id, "done")}
                              className="rounded bg-green-600 px-3 py-1 text-xs text-white hover:bg-green-700"
                            >
                              Done
                            </button>
                            <button
                              onClick={() => handleAction(appt.id, "cancel")}
                              className="rounded bg-red-600 px-3 py-1 text-xs text-white hover:bg-red-700"
                            >
                              Cancel
                            </button>
                          </div>
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
