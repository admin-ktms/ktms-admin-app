import { supabase } from "../lib/supabase.js";

import {
  requestAdminVerificationCode,
  verifyAdminVerificationCode,
  establishSupabaseSession,
  adminApi,
  getStoredAdminSessionToken,
  storeAdminSessionToken,
  clearAdminSessionToken
} from "../api/admin-api.js";

// LOGIN REQUEST

export async function sendVerificationCode(email) {
  const normalizedEmail = String(email || "")
    .trim()
    .toLowerCase();

  if (!normalizedEmail) {
    const error = new Error("Email address is required.");
    error.code = "EMAIL_REQUIRED";
    throw error;
  }

  return await requestAdminVerificationCode(normalizedEmail);
}

// LOGIN VERIFICATION

export async function verifyVerificationCode(email, token) {
  const normalizedEmail = String(email || "")
    .trim()
    .toLowerCase();

  const normalizedToken = String(token || "")
    .trim();

  if (!normalizedEmail) {
    const error = new Error("Email address is required.");
    error.code = "EMAIL_REQUIRED";
    throw error;
  }

  if (!normalizedToken) {
    const error = new Error("Verification code is required.");
    error.code = "OTP_REQUIRED";
    throw error;
  }

  const loginData = await verifyAdminVerificationCode(
    normalizedEmail,
    normalizedToken
  );

  const session = await establishSupabaseSession(loginData);

  if (!loginData?.sessionToken) {
    const error = new Error(
      "KTMS administrator session was not created."
    );

    error.code = "KTMS_SESSION_CREATE_FAILED";
    throw error;
  }

  storeAdminSessionToken(loginData.sessionToken);

  return {
    session,
    admin: loginData.admin,
    userId: loginData.userId,
    adminSessionId: loginData.adminSessionId,
    adminSessionExpiresAt: loginData.adminSessionExpiresAt
  };
}

// CURRENT SESSION

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

// CURRENT ADMIN

export async function getAdminIdentity() {
  return await adminApi("admin.me");
}

// LOGOUT

export async function logout() {
  const adminSessionToken =
    getStoredAdminSessionToken();

  if (adminSessionToken) {
    try {
      await adminApi(
        "admin.session.logout"
      );
    } catch (error) {
      console.warn(
        "KTMS administrator session logout warning:",
        error
      );
    }
  }

  clearAdminSessionToken();

  const { error } =
    await supabase.auth.signOut();

  if (error) {
    throw error;
  }
}
