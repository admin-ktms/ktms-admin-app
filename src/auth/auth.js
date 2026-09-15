import { supabase } from "../lib/supabase.js";

import {
  adminApi,
  requestAdminVerificationCode,
  getStoredAdminSessionToken,
  storeAdminSessionToken,
  clearAdminSessionToken
} from "../api/admin-api.js";


/* =========================================================
   REQUEST ADMIN VERIFICATION CODE
   ========================================================= */

export async function sendVerificationCode(
  email
) {
  const normalizedEmail =
    String(email || "")
      .trim()
      .toLowerCase();

  if (!normalizedEmail) {
    const error = new Error(
      "Email address is required."
    );

    error.code =
      "EMAIL_REQUIRED";

    throw error;
  }

  await requestAdminVerificationCode(
    normalizedEmail
  );

  return true;
}


/* =========================================================
   VERIFY SUPABASE AUTH OTP
   ========================================================= */

export async function verifyVerificationCode(
  email,
  token
) {
  const normalizedEmail =
    String(email || "")
      .trim()
      .toLowerCase();

  const normalizedToken =
    String(token || "")
      .trim();

  if (!normalizedEmail) {
    throw new Error(
      "Email address is required."
    );
  }

  if (!normalizedToken) {
    throw new Error(
      "Verification code is required."
    );
  }

  const {
    data,
    error
  } = await supabase.auth.verifyOtp({
    email:
      normalizedEmail,

    token:
      normalizedToken,

    type:
      "email"
  });

  if (error) {
    throw error;
  }

  if (!data?.session?.access_token) {
    throw new Error(
      "Authentication succeeded but no Supabase Auth session was created."
    );
  }

  /*
   * Confirm that the Supabase client can see
   * the authenticated session that will be used
   * by the KTMS Admin API.
   */
  const {
    data: {
      session
    },
    error: sessionError
  } =
    await supabase.auth.getSession();

  if (sessionError) {
    throw sessionError;
  }

  if (!session?.access_token) {
    throw new Error(
      "Supabase authentication completed, but the browser session is unavailable."
    );
  }

  return session;
}


/* =========================================================
   CREATE KTMS ADMIN SESSION
   ========================================================= */

export async function startAdminSession() {
  /*
   * admin.session.start requires:
   *
   * Authorization: Bearer <Supabase Auth access token>
   *
   * It does NOT require an existing
   * X-KTMS-Admin-Session header because it is
   * responsible for creating that session.
   */
  const data =
    await adminApi(
      "admin.session.start"
    );

  const sessionToken =
    data?.sessionToken;

  if (!sessionToken) {
    throw new Error(
      "KTMS administrator session was not created."
    );
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
  } =
    await supabase.auth.getSession();

  if (error) {
    throw error;
  }

  return session;
}


/* =========================================================
   CURRENT KTMS ADMIN IDENTITY
   ========================================================= */

export async function getAdminIdentity() {
  return await adminApi(
    "admin.me"
  );
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
  } =
    await supabase.auth.signOut();

  if (error) {
    throw error;
  }
}
