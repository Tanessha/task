import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const admins = [
  { email: "admin@test.com", password: "admin123" },
];

const doctors = [
  { email: "doctor1@test.com", password: "doctor123", name: "Doctor 1", specialty: "General" },
  { email: "doctor2@test.com", password: "doctor123", name: "Doctor 2", specialty: "Cardiology" },
  { email: "doctor3@test.com", password: "doctor123", name: "Doctor 3", specialty: "Dermatology" },
];

const patients = [
  { email: "patient1@test.com", password: "patient123", name: "Patient 1" },
  { email: "patient2@test.com", password: "patient123", name: "Patient 2" },
  { email: "patient3@test.com", password: "patient123", name: "Patient 3" },
];

const doctorIds = {};
const patientIds = {};

async function findUserByEmail(email) {
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({
      page,
      perPage: 100,
    });
    if (error) throw error;

    const user = data.users.find((item) => item.email === email);
    if (user) return user;
    if (data.users.length < 100) return null;
  }

  return null;
}

async function ensureAuthUser(account, label) {
  const { data, error } = await supabase.auth.admin.createUser({
    email: account.email,
    password: account.password,
    email_confirm: true,
  });

  if (!error) return data.user;
  if (!error.message.includes("already been registered")) {
    console.error(`create ${label}`, account.email, error.message);
    return null;
  }

  const user = await findUserByEmail(account.email);
  if (!user) console.error(`find existing ${label}`, account.email, error.message);
  return user;
}

for (const admin of admins) {
  await ensureAuthUser(admin, "admin user");

  const { error: e } = await supabase.from("system_admins").upsert({
    email: admin.email,
    password: admin.password,
  }, { onConflict: "email" });
  if (e) console.error("upsert admin", admin.email, e.message);
  else console.log("created admin", admin.email);
}

for (const doctor of doctors) {
  const user = await ensureAuthUser(doctor, "user");
  if (!user) continue;

  doctorIds[doctor.email] = user.id;

  const { error: e } = await supabase.from("doctors").upsert({
    id: user.id,
    name: doctor.name,
    email: doctor.email,
    specialty: doctor.specialty,
  });
  if (e) console.error("insert doctor", doctor.email, e.message);
  else console.log("created", doctor.email);
}

for (const patient of patients) {
  const user = await ensureAuthUser(patient, "user");
  if (!user) continue;

  patientIds[patient.email] = user.id;

  const { error: e } = await supabase.from("patients").upsert({
    id: user.id,
    name: patient.name,
    email: patient.email,
  });
  if (e) console.error("insert patient", patient.email, e.message);
  else console.log("created", patient.email);
}

const d1 = doctorIds["doctor1@test.com"];
const d2 = doctorIds["doctor2@test.com"];
const d3 = doctorIds["doctor3@test.com"];
const p1 = patientIds["patient1@test.com"];
const demoDoctorIds = [d1, d2, d3].filter(Boolean);

if (demoDoctorIds.length) {
  const { error: appointmentsDeleteError } = await supabase
    .from("appointments")
    .delete()
    .in("doctor_id", demoDoctorIds);
  if (appointmentsDeleteError) {
    console.error("delete demo appointments", appointmentsDeleteError.message);
    process.exit(1);
  }

  const { error: slotsDeleteError } = await supabase
    .from("slots")
    .delete()
    .in("doctor_id", demoDoctorIds);
  if (slotsDeleteError) {
    console.error("delete demo slots", slotsDeleteError.message);
    process.exit(1);
  }
}

const { data: slots, error: slotsError } = await supabase.from("slots").insert([
  { doctor_id: d1, start_time: "2026-04-28 09:00:00+00", end_time: "2026-04-28 10:00:00+00", is_booked: true  },
  { doctor_id: d1, start_time: "2026-04-29 10:00:00+00", end_time: "2026-04-29 11:00:00+00", is_booked: false },
  { doctor_id: d1, start_time: "2026-05-04 09:00:00+00", end_time: "2026-05-04 10:00:00+00", is_booked: false },
  { doctor_id: d1, start_time: "2026-05-06 11:00:00+00", end_time: "2026-05-06 12:00:00+00", is_booked: false },
  { doctor_id: d2, start_time: "2026-04-28 11:00:00+00", end_time: "2026-04-28 12:00:00+00", is_booked: false },
  { doctor_id: d2, start_time: "2026-04-30 09:00:00+00", end_time: "2026-04-30 10:00:00+00", is_booked: false },
  { doctor_id: d2, start_time: "2026-05-05 10:00:00+00", end_time: "2026-05-05 11:00:00+00", is_booked: false },
  { doctor_id: d2, start_time: "2026-05-07 09:00:00+00", end_time: "2026-05-07 10:00:00+00", is_booked: false },
  { doctor_id: d3, start_time: "2026-04-29 09:00:00+00", end_time: "2026-04-29 10:00:00+00", is_booked: false },
  { doctor_id: d3, start_time: "2026-04-30 11:00:00+00", end_time: "2026-04-30 12:00:00+00", is_booked: false },
  { doctor_id: d3, start_time: "2026-05-04 11:00:00+00", end_time: "2026-05-04 12:00:00+00", is_booked: false },
  { doctor_id: d3, start_time: "2026-05-07 10:00:00+00", end_time: "2026-05-07 11:00:00+00", is_booked: false },
]).select();

if (slotsError) { console.error("insert slots", slotsError.message); process.exit(1); }
console.log("created slots");

const bookedSlot = slots.find((s) => s.doctor_id === d1 && s.is_booked === true);

const { error: apptError } = await supabase.from("appointments").insert({
  patient_id: p1,
  doctor_id: d1,
  slot_id: bookedSlot.id,
  status: "active",
});
if (apptError) console.error("insert appointment", apptError.message);
else console.log("created pre-existing appointment");

console.log("done");
