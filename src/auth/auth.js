import { supabase } from "../lib/supabase.js";

import {
  adminApi,
  getStoredAdminSessionToken,
  storeAdminSessionToken,
  clearAdminSessionToken
} from "../api/admin-api.js";


export async function sendVerificationCode(email) {
  const normalizedEmail =
    email.trim().toLowerCase();

  if (!normalizedEmail) {
    throw new Error(
      "Email address is required."
    );
  }

  const { error } =
    await supabase.auth.signInWithOtp({
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


export async function verifyVerificationCode(
  email,
  token
) {
  const normalizedEmail =
    email.trim().toLowerCase();

  const normalizedToken =
    token.trim();

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
