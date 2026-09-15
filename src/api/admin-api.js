import { supabase } from "../lib/supabase.js";
import { CONFIG } from "../config.js";

const ADMIN_SESSION_KEY = "ktms_admin_session";

export function getStoredAdminSessionToken() {
  return sessionStorage.getItem(ADMIN_SESSION_KEY) || "";
}

export function storeAdminSessionToken(token) {
  if (!token) {
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
    return;
  }

  sessionStorage.setItem(ADMIN_SESSION_KEY, token);
}

export function clearAdminSessionToken() {
  sessionStorage.removeItem(ADMIN_SESSION_KEY);
}


/*
 * Pre-authentication administrator login request.
 *
 * This endpoint is deliberately separate from adminApi()
 * because the administrator does not yet have:
 *
 * - a Supabase Auth session
 * - a KTMS administrator session
 *
 * The backend validates the administrator and records
 * the login attempt before requesting the OTP.
 */
export async function requestAdminVerificationCode(email) {
  const normalizedEmail =
    String(email || "")
      .trim()
      .toLowerCase();

  if (!normalizedEmail) {
    const error = new Error(
      "Email address is required."
    );

    error.code = "EMAIL_REQUIRED";
    error.status = 400;

    throw error;
  }

  const response = await fetch(
    CONFIG.ADMIN_LOGIN_API_URL,
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json"
      },

      body: JSON.stringify({
        email: normalizedEmail
      })
    }
  );

  let result;

  try {
    result = await response.json();
  } catch {
    throw new Error(
      `KTMS Admin Login API returned a non-JSON response (${response.status}).`
    );
  }

  if (!response.ok || result?.success !== true) {
    const message =
      result?.error?.message ||
      `KTMS Admin Login request failed (${response.status}).`;

    const error = new Error(message);

    error.code =
      result?.error?.code ||
      "ADMIN_LOGIN_ERROR";

    error.status =
      response.status;

    throw error;
  }

  return result.data;
}


/*
 * Authenticated KTMS Admin API.
 *
 * This is used only after Supabase Auth has
 * successfully created the administrator session.
 */
export async function adminApi(
  action,
  payload = {}
) {
  const {
    data: { session },
    error: sessionError
  } = await supabase.auth.getSession();

  if (sessionError) {
    throw sessionError;
  }

  if (!session?.access_token) {
    throw new Error(
      "KTMS Admin session is not authenticated."
    );
  }

  const headers = {
    "Content-Type": "application/json",
    "Authorization":
      `Bearer ${session.access_token}`
  };

  /*
   * admin.session.start creates the KTMS
   * application session, so it must not require
   * an existing X-KTMS-Admin-Session header.
   */
  if (
    action !==
    "admin.session.start"
  ) {
    const adminSessionToken =
      getStoredAdminSessionToken();

    if (!adminSessionToken) {
      const error = new Error(
        "KTMS administrator session is missing."
      );

      error.code =
        "KTMS_SESSION_REQUIRED";

      error.status = 401;

      throw error;
    }

    headers[
      "X-KTMS-Admin-Session"
    ] =
      adminSessionToken;
  }

  const response =
    await fetch(
      CONFIG.ADMIN_API_URL,
      {
        method: "POST",

        headers,

        body: JSON.stringify({
          action,
          ...payload
        })
      }
    );

  let result;

  try {
    result =
      await response.json();
  } catch {
    throw new Error(
      `KTMS Admin API returned a non-JSON response (${response.status}).`
    );
  }

  if (
    !response.ok ||
    result?.success !== true
  ) {
    const message =
      result?.error?.message ||
      `KTMS Admin API request failed (${response.status}).`;

    const error =
      new Error(message);

    error.code =
      result?.error?.code ||
      "API_ERROR";

    error.status =
      response.status;

    /*
     * Remove the browser-side KTMS session
     * when the backend says it is no longer valid.
     */
    if (
      result?.error?.code ===
        "SESSION_EXPIRED" ||
      result?.error?.code ===
        "SESSION_REJECTED" ||
      result?.error?.code ===
        "KTMS_SESSION_REQUIRED" ||
      result?.error?.code ===
        "ADMIN_SESSION_REQUIRED"
    ) {
      clearAdminSessionToken();
    }

    throw error;
  }

  return result.data;
}
