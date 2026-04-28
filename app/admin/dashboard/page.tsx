"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type AdminAppointment = {
  id: string;
  status: "active" | "done" | "cancelled";
  doctor: { name: string } | null;
  patient: { name: string } | null;
  slot: { start_time: string; end_time: string } | null;
};

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function AdminDashboard() {
  const router = useRouter();
  const [appointments, setAppointments] = useState<AdminAppointment[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/admin/login");
        return;
      }

      const res = await fetch("/api/admin/appointments", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const data = await res.json();

      if (res.ok) {
        setAppointments(data.appointments ?? []);
      } else {
        setError(data.error ?? "Unable to load appointments.");
      }

      setLoading(false);
    }

    load();
  }, [router]);

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/admin/login");
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
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex items-center justify-between">
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          <button
            onClick={handleLogout}
            className="rounded-lg border px-4 py-2 text-sm text-gray-600 hover:bg-gray-100"
          >
            Logout
          </button>
        </div>

        {error && (
          <p className="mb-4 rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="overflow-hidden rounded-xl border bg-white">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-600">
              <tr>
                <th className="px-4 py-3 font-medium">Doctor</th>
                <th className="px-4 py-3 font-medium">Patient</th>
                <th className="px-4 py-3 font-medium">Slot</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {appointments.map((appointment) => (
                <tr key={appointment.id}>
                  <td className="px-4 py-3">{appointment.doctor?.name}</td>
                  <td className="px-4 py-3">{appointment.patient?.name}</td>
                  <td className="px-4 py-3">
                    {appointment.slot
                      ? formatDateTime(appointment.slot.start_time)
                      : ""}
                  </td>
                  <td className="px-4 py-3">{appointment.status}</td>
                </tr>
              ))}
              {appointments.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-center text-gray-500" colSpan={4}>
                    No appointments found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
