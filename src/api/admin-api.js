import { supabase } from "../lib/supabase.js";
import { CONFIG } from "../config.js";

export async function adminApi(action, payload = {}) {
  const {
    data: { session },
    error: sessionError
  } = await supabase.auth.getSession();

  if (sessionError) {
    throw sessionError;
  }

  if (!session?.access_token) {
    throw new Error("KTMS Admin session is not authenticated.");
  }

  const response = await fetch(CONFIG.ADMIN_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${session.access_token}`
    },
    body: JSON.stringify({
      action,
      ...payload
    })
  });

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

    error.code = result?.error?.code || "API_ERROR";
    error.status = response.status;

    throw error;
  }

  return result.data;
}
