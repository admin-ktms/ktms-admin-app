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

/* =========================================================
   REQUEST VERIFICATION CODE
   ========================================================= */

export async function sendVerificationCode(email) {
  const normalizedEmail = String(email || "")
    .trim()
    .toLowerCase();

  if (!normalizedEmail) {
    const error = new Error(
      "Email address is required."
    );

    error.code = "EMAIL_REQUIRED";

    throw error;
  }

  return await requestAdminVerificationCode(
    normalizedEmail
  );
}

/* =========================================================
   VERIFY ADMIN LOGIN
   ========================================================= */

/**
 * Complete authentication sequence:
 *
 * 1. Backend verifies OTP.
 * 2. Backend returns Supabase Auth tokens.
 * 3. Browser installs those tokens.
 * 4. Browser now has a genuine Supabase Auth session.
 */
export async function verifyVerificationCode(
  email,
  token
) {
  const normalizedEmail = String(email || "")
    .trim()
    .toLowerCase();

  const normalizedToken = String(token || "")
    .trim();

  if (!normalizedEmail) {
    const error = new Error(
      "Email address is required."
    );

    error.code = "EMAIL_REQUIRED";

    throw error;
  }

  if (!normalizedToken) {
    const error = new Error(
      "Verification code is required."
    );

    error.code = "OTP_REQUIRED";

    throw error;
  }

  const loginData =
    await verifyAdminVerificationCode(
      normalizedEmail,
      normalizedToken
    );

  const session =
    await establishSupabaseSession(
      loginData
    );

  return {
    session,
    admin: loginData.admin,
    userId: loginData.userId
  };
}

/* =========================================================
   CREATE KTMS ADMIN SESSION
   ========================================================= */

export async function startAdminSession() {
  const data =
    await adminApi(
      "admin.session.start"
    );

  const sessionToken =
    data?.sessionToken;

  if (!sessionToken) {
    const error = new Error(
      "KTMS administrator session was not created."
    );

    error.code =
      "KTMS_SESSION_CREATE_FAILED";

    throw error;
  }

  storeAdminSessionToken(
    sessionToken
  );

  return data;
}

/* =========================================================
   CURRENT SUPABASE SESSION
   ========================================================= */

export async function getCurrentSession() {
  const {
    data: {
      session
    },
    error
  } = await supabase.auth.getSession();

  if (error) {
    throw error;
  }

  return session;
}

/* =========================================================
   CURRENT ADMIN IDENTITY
   ========================================================= */

export async function getAdminIdentity() {
  return await adminApi(
    "admin.me"
  );
}

/* =========================================================
   COMPLETE LOGIN
   ========================================================= */

export async function completeAdminLogin(
  email,
  token
) {
  /*
   * STEP 1
   * Backend verifies OTP and returns
   * Supabase Auth credentials.
   */
  const authentication =
    await verifyVerificationCode(
      email,
      token
    );

  /*
   * STEP 2
   * Supabase Auth session is now installed
   * in the browser.
   */

  /*
   * STEP 3
   * Exchange Supabase identity for the
   * KTMS administrator session.
   */
  await startAdminSession();

  /*
   * STEP 4
   * Ask the protected Admin API who we are.
   */
  const admin =
    await getAdminIdentity();

  return admin;
}

/* =========================================================
   LOGOUT
   ========================================================= */

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

  const {
    error
  } = await supabase.auth.signOut();

  if (error) {
    throw error;
  }
}
