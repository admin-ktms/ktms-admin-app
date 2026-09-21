import { supabase } from "../lib/supabase.js";
import { CONFIG } from "../config.js";
import { createTraceId, logError, logInfo, logTrace, logWarn } from "../utils/logger.js";

const ADMIN_SESSION_KEY = "ktms_admin_session";

/* =========================================================
   KTMS ADMIN SESSION TOKEN
   ========================================================= */

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
  sessionStorage.removeItem(ADMIN_SESSION_KEY);
}

/* =========================================================
   BACKEND LOGIN ENGINE
   ========================================================= */

/**
 * Request the administrator OTP.
 *
 * Backend:
 * POST /ktms-admin-login
 * { action: "request", email }
 */
export async function requestAdminVerificationCode(email) {
  const normalizedEmail = String(email || "")
    .trim()
    .toLowerCase();

  if (!normalizedEmail) {
    const error = new Error("Email address is required.");
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
        action: "request",
        email: normalizedEmail
      })
    }
  );

  const result = await parseJsonResponse(
    response,
    "Administrator login request"
  );

  if (!response.ok || result?.success !== true) {
    const error = new Error(
      result?.error?.message ||
      "Administrator verification request failed."
    );

    error.code =
      result?.error?.code ||
      "ADMIN_LOGIN_ERROR";

    error.status = response.status;

    throw error;
  }

  return result.data;
}

/**
 * Verify OTP through the new backend login engine.
 *
 * Backend returns:
 * - accessToken
 * - refreshToken
 * - expiresIn
 * - expiresAt
 * - userId
 * - admin
 */
export async function verifyAdminVerificationCode(
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
    error.status = 400;

    throw error;
  }

  if (!normalizedToken) {
    const error = new Error(
      "Verification code is required."
    );

    error.code = "OTP_REQUIRED";
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
        action: "verify",
        email: normalizedEmail,
        token: normalizedToken
      })
    }
  );

  const result = await parseJsonResponse(
    response,
    "Administrator verification"
  );

  if (!response.ok || result?.success !== true) {
    const error = new Error(
      result?.error?.message ||
      "Administrator verification failed."
    );

    error.code =
      result?.error?.code ||
      "OTP_VERIFICATION_FAILED";

    error.status = response.status;

    throw error;
  }

  const data = result?.data;

  if (!data?.accessToken || !data?.refreshToken) {
    const error = new Error(
      "Authenticated session was not returned by the login service."
    );

    error.code = "AUTH_SESSION_MISSING";
    error.status = 401;

    throw error;
  }

  return data;
}

/* =========================================================
   SUPABASE SESSION ESTABLISHMENT
   ========================================================= */

/**
 * Install the authenticated Supabase session returned
 * by ktms-admin-login.
 *
 * This is the critical difference from the old login flow.
 *
 * Old:
 * browser verifyOtp()
 * browser getSession()
 *
 * New:
 * backend verifyOtp()
 * backend returns tokens
 * browser setSession()
 */
export async function establishSupabaseSession(
  loginData
) {
  if (
    !loginData?.accessToken ||
    !loginData?.refreshToken
  ) {
    const error = new Error(
      "Supabase authentication session data is incomplete."
    );

    error.code = "AUTH_SESSION_MISSING";
    error.status = 401;

    throw error;
  }

  const {
    data,
    error
  } = await supabase.auth.setSession({
    access_token: loginData.accessToken,
    refresh_token: loginData.refreshToken
  });

  if (error) {
    throw error;
  }

  if (!data?.session?.access_token) {
    const error = new Error(
      "Supabase authentication session could not be established."
    );

    error.code = "AUTH_SESSION_FAILED";
    error.status = 401;

    throw error;
  }

  return data.session;
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
      "Authenticated Supabase session required."
    );

    error.code = "SUPABASE_AUTH_REQUIRED";
    error.status = 401;

    throw error;
  }

  const headers = {
    "Content-Type": "application/json",
    "Authorization":
      `Bearer ${session.access_token}`
  };

  /*
   * admin.session.start is the bridge:
   *
   * Supabase Auth
   *       ↓
   * KTMS Admin Session
   *
   * Therefore it does not require the KTMS
   * session header yet.
   */
  if (action !== "admin.session.start") {
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
    ] = adminSessionToken;
  }

  const traceId = createTraceId();
  const route = window.location.pathname;
  const startedAt = performance.now();

  logInfo("API_REQUEST_STARTED", {
    traceId,
    action,
    route,
    supabaseSession: true,
    ktmsSession: action === "admin.session.start" ? false : true
  });

  const response = await fetch(
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

  const result = await parseJsonResponse(
    response,
    "KTMS Admin API"
  );

  if (
    !response.ok ||
    result?.success !== true
  ) {
    const error = new Error(
      result?.error?.message ||
      "KTMS Admin API request failed."
    );

    error.code =
      result?.error?.code ||
      "API_ERROR";

    error.status =
      response.status;

    if (
      [
        "ADMIN_SESSION_REQUIRED",
        "ADMIN_SESSION_INVALID",
        "ADMIN_SESSION_REVOKED",
        "ADMIN_SESSION_EXPIRED"
      ].includes(error.code)
    ) {
      clearAdminSessionToken();
    }

    throw error;
  }

  return result.data;
}

/* =========================================================
   RESPONSE PARSER
   ========================================================= */

async function parseJsonResponse(
  response,
  operation
) {
  let result;

  try {
    result = await response.json();
  } catch {
    const error = new Error(
      `${operation} returned an invalid server response.`
    );

    error.code = "INVALID_SERVER_RESPONSE";
    error.status = response.status;

    throw error;
  }

  return result;
}
