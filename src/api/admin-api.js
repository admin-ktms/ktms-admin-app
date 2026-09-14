import { supabase } from "../lib/supabase.js";
import { CONFIG } from "../config.js";

const ADMIN_SESSION_KEY = "ktms_admin_session";

function getAdminSessionToken() {
  return sessionStorage.getItem(ADMIN_SESSION_KEY) || "";
}

export function getStoredAdminSessionToken() {
  return getAdminSessionToken();
}

export function storeAdminSessionToken(token) {
  if (!token) {
    sessionStorage.removeItem(ADMIN_SESSION_KEY);
    return;
  }

  sessionStorage.setItem(
    ADMIN_SESSION_KEY,
    token
  );
}

export function clearAdminSessionToken() {
  sessionStorage.removeItem(
    ADMIN_SESSION_KEY
  );
}

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
    "Authorization": `Bearer ${session.access_token}`
  };

  /*
   * admin.session.start is the one admin API action
   * that creates the KTMS application session.
   *
   * It must NOT send an existing KTMS session header.
   */
  if (action !== "admin.session.start") {
    const adminSessionToken =
      getAdminSessionToken();

    if (!adminSessionToken) {
      throw new Error(
        "KTMS administrator session is missing."
      );
    }

    headers["X-KTMS-Admin-Session"] =
      adminSessionToken;
  }

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

  let result;

  try {
    result = await response.json();
  } catch {
    throw new Error(
      `KTMS Admin API returned a non-JSON response (${response.status}).`
    );
  }

  if (!response.ok || result?.success !== true) {
    const message =
      result?.error?.message ||
      `KTMS Admin API request failed (${response.status}).`;

    const error = new Error(message);

    error.code =
      result?.error?.code ||
      "API_ERROR";

    error.status = response.status;

    /*
     * If the server says the KTMS session is no
     * longer valid, remove the browser copy so that
     * the next login creates a fresh one.
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
