import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { NextRequest } from "next/server";
import type { Role } from "./appointmentRules";

export type AuthProfile = {
  id: string;
  email: string | null;
  role: Role;
  name?: string;
};

export function createSupabaseForRequest(req: NextRequest) {
  const authorization = req.headers.get("authorization") ?? "";

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: {
        headers: authorization ? { Authorization: authorization } : {},
      },
    }
  );
}

export function createServiceSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function getAuthenticatedProfile(
  supabase: SupabaseClient
): Promise<{ profile: AuthProfile | null; error?: string }> {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { profile: null, error: "Authentication required." };
  }

  const { data: patient } = await supabase
    .from("patients")
    .select("id, name, email")
    .eq("id", user.id)
    .maybeSingle();

  if (patient) {
    return {
      profile: {
        id: user.id,
        email: user.email ?? patient.email,
        role: "patient",
        name: patient.name,
      },
    };
  }

  const { data: doctor } = await supabase
    .from("doctors")
    .select("id, name, email")
    .eq("id", user.id)
    .maybeSingle();

  if (doctor) {
    return {
      profile: {
        id: user.id,
        email: user.email ?? doctor.email,
        role: "doctor",
        name: doctor.name,
      },
    };
  }

  const serviceSupabase = createServiceSupabase();
  const { data: admin } = await serviceSupabase
    .from("system_admins")
    .select("email")
    .eq("email", user.email)
    .maybeSingle();

  if (admin) {
    return {
      profile: {
        id: user.id,
        email: user.email ?? admin.email,
        role: "admin",
      },
    };
  }

  return { profile: null, error: "No application role found for this user." };
}

export function readString(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function isUniqueViolation(error: { code?: string } | null) {
  return error?.code === "23505";
}
