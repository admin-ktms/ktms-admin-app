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

  sessionStorage.setItem(
    ADMIN_SESSION_KEY,
    String(token)
  );
}

export function clearAdminSessionToken() {
  sessionStorage.removeItem(
    ADMIN_SESSION_KEY
  );
}


/* =========================================================
   PRE-AUTHENTICATION ADMIN LOGIN
   ========================================================= */

export async function requestAdminVerificationCode(
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

  if (
    !response.ok ||
    result?.success !== true
  ) {
    const error = new Error(
      result?.error?.message ||
      `KTMS Admin Login request failed (${response.status}).`
    );

    error.code =
      result?.error?.code ||
      "ADMIN_LOGIN_ERROR";

    error.status =
      response.status;

    throw error;
  }

  return result.data;
}


/* =========================================================
   AUTHENTICATED KTMS ADMIN API
   ========================================================= */

export async function adminApi(
  action,
  payload = {}
) {
  if (!action) {
    const error = new Error(
      "KTMS Admin API action is required."
    );

    error.code = "ACTION_REQUIRED";
    error.status = 400;

    throw error;
  }

  /*
   * Always obtain the current Supabase Auth session.
   *
   * The Supabase client is configured with
   * autoRefreshToken=true, so this gives the
   * current usable access token after OTP login.
   */
  const {
    data: {
      session
    },
    error: sessionError
  } = await supabase.auth.getSession();

  if (sessionError) {
    throw sessionError;
  }

  if (!session?.access_token) {
    const error = new Error(
      "KTMS Admin requires an authenticated Supabase session."
    );

    error.code =
      "SUPABASE_AUTH_REQUIRED";

    error.status = 401;

    throw error;
  }

  const headers = {
    "Content-Type":
      "application/json",

    "Authorization":
      `Bearer ${session.access_token}`
  };


  /*
   * admin.session.start is the bridge between:
   *
   * Supabase Auth
   *        ↓
   * KTMS administrator session
   *
   * Therefore it intentionally does NOT require
   * X-KTMS-Admin-Session yet.
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
    const error =
      new Error(
        result?.error?.message ||
        `KTMS Admin API request failed (${response.status}).`
      );

    error.code =
      result?.error?.code ||
      "API_ERROR";

    error.status =
      response.status;

    /*
     * The browser-side KTMS session is no
     * longer trustworthy if the backend rejects it.
     */
    if (
      result?.error?.code ===
        "SESSION_EXPIRED" ||

      result?.error?.code ===
        "SESSION_REJECTED" ||

      result?.error?.code ===
        "ADMIN_SESSION_REQUIRED" ||

      result?.error?.code ===
        "ADMIN_SESSION_INVALID" ||

      result?.error?.code ===
        "ADMIN_SESSION_REVOKED" ||

      result?.error?.code ===
        "ADMIN_SESSION_EXPIRED"
    ) {
      clearAdminSessionToken();
    }

    throw error;
  }

  return result.data;
}
