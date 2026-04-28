import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8">
      <h1 className="text-3xl font-bold">Appointment Booking System</h1>
      <div className="flex gap-4">
        <Link
          href="/doctor/login"
          className="rounded-lg bg-blue-600 px-6 py-3 font-medium text-white hover:bg-blue-700"
        >
          Doctor Login
        </Link>
        <Link
          href="/patient/login"
          className="rounded-lg bg-green-600 px-6 py-3 font-medium text-white hover:bg-green-700"
        >
          Patient Login
        </Link>
      </div>
    </main>
  );
}
