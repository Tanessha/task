CREATE TABLE IF NOT EXISTS doctors (
  id        UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name      TEXT NOT NULL,
  email     TEXT NOT NULL,
  specialty TEXT NOT NULL DEFAULT 'General'
);

CREATE TABLE IF NOT EXISTS patients (
  id    UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name  TEXT NOT NULL,
  email TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS slots (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  doctor_id  UUID        NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  start_time TIMESTAMPTZ NOT NULL,
  end_time   TIMESTAMPTZ NOT NULL,
  is_booked  BOOLEAN     NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS appointments (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID        NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  doctor_id  UUID        NOT NULL REFERENCES doctors(id)  ON DELETE CASCADE,
  slot_id    UUID        NOT NULL REFERENCES slots(id)    ON DELETE CASCADE,
  status     TEXT        NOT NULL DEFAULT 'active'
                         CHECK (status IN ('active', 'done', 'cancelled')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS system_admins (
  id       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email    TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL
);

ALTER TABLE doctors       ENABLE ROW LEVEL SECURITY;
ALTER TABLE patients      ENABLE ROW LEVEL SECURITY;
ALTER TABLE slots         ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_admins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_read_doctors"      ON doctors;
DROP POLICY IF EXISTS "patients_read_own"               ON patients;
DROP POLICY IF EXISTS "authenticated_read_slots"        ON slots;
DROP POLICY IF EXISTS "patient_read_own_appointments"   ON appointments;
DROP POLICY IF EXISTS "doctor_read_own_appointments"    ON appointments;

CREATE POLICY "authenticated_read_doctors" ON doctors
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "patients_read_own" ON patients
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "authenticated_read_slots" ON slots
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "patient_read_own_appointments" ON appointments
  FOR SELECT USING (auth.uid() = patient_id);

CREATE POLICY "doctor_read_own_appointments" ON appointments
  FOR SELECT USING (auth.uid() = doctor_id);

INSERT INTO system_admins (email, password) VALUES
  ('admin@test.com', 'admin123')
ON CONFLICT (email) DO NOTHING;
