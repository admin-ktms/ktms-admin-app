import { supabase } from "../lib/supabase.js";

import {
  adminApi,
  requestAdminVerificationCode, 
  getStoredAdminSessionToken,
  storeAdminSessionToken,
  clearAdminSessionToken
} from "../api/admin-api.js";


/*
 * Requests an administrator verification code.
 *
 * IMPORTANT:
 *
 * The browser must NOT call
 * supabase.auth.signInWithOtp()
 * directly here.
 *
 * The request first goes through the
 * KTMS admin-login Edge Function so that
 * KTMS can:
 *
 * 1. Validate the administrator.
 * 2. Apply login-request controls.
 * 3. Record admin_login_attempts.
 * 4. Request the Supabase Auth OTP.
 */
export async function sendVerificationCode(
  email
) {
  const normalizedEmail =
    String(email || "")
      .trim()
      .toLowerCase();

  if (!normalizedEmail) {
    throw new Error(
      "Email address is required."
    );
  }

  await requestAdminVerificationCode(
    normalizedEmail
  );

  return true;
}


/*
 * Verifies the OTP received by the
 * administrator through Supabase Auth.
 *
 * This remains a direct Supabase Auth
 * operation because the administrator now
 * possesses the verification code.
 */
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
    email: normalizedEmail,
    token: normalizedToken,
    type: "email"
  });

  if (error) {
    throw error;
  }

  if (!data?.session) {
    throw new Error(
      "Authentication succeeded but no session was created."
    );
  }

  return data.session;
}


/*
 * Creates the KTMS application-level
 * administrator session after Supabase
 * authentication succeeds.
 */
export async function startAdminSession() {
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
  return await adminApi(
    "admin.me"
  );
}


/*
 * Logout order:
 *
 * 1. Revoke the KTMS administrator session.
 * 2. Remove the browser-side session token.
 * 3. Sign out of Supabase Auth.
 */
export async function logout() {
  const adminSessionToken =
    getStoredAdminSessionToken();

  if (adminSessionToken) {
    try {
      await adminApi(
        "admin.session.logout"
      );
    } catch (error) {
      /*
       * If the KTMS session is already expired
       * or rejected, continue with local logout.
       */
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
