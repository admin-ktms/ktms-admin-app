import { supabase } from "../lib/supabase.js";
import { adminApi } from "../api/admin-api.js";

export async function sendVerificationCode(email) {
  const normalizedEmail = email.trim().toLowerCase();

  if (!normalizedEmail) {
    throw new Error("Email address is required.");
  }

  const { error } = await supabase.auth.signInWithOtp({
    email: normalizedEmail,
    options: {
      shouldCreateUser: false
    }
  });

  if (error) {
    throw error;
  }

  return true;
}

export async function verifyVerificationCode(email, token) {
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedToken = token.trim();

  if (!normalizedEmail) {
    throw new Error("Email address is required.");
  }

  if (!normalizedToken) {
    throw new Error("Verification code is required.");
  }

  const { data, error } = await supabase.auth.verifyOtp({
    email: normalizedEmail,
    token: normalizedToken,
    type: "email"
  });

  if (error) {
    throw error;
  }

  if (!data?.session) {
    throw new Error("Authentication succeeded but no session was created.");
  }

  return data.session;
}

export async function getCurrentSession() {
  const {
    data: { session },
    error
  } = await supabase.auth.getSession();

  if (error) {
    throw error;
  }

  return session;
}

export async function getAdminIdentity() {
  return await adminApi("admin.me");
}

export async function logout() {
  const { error } = await supabase.auth.signOut();

  if (error) {
    throw error;
  }
}