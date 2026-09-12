import { supabase } from "../lib/supabase.js";

export async function getAuthenticationLevel() {
  const {
    data,
    error
  } = await supabase.auth.getSession();

  if (error) {
    throw error;
  }

  if (!data?.session?.access_token) {
    return null;
  }

  const {
    data: claimsData,
    error: claimsError
  } = await supabase.auth.getClaims(
    data.session.access_token
  );

  if (claimsError) {
    throw claimsError;
  }

  return claimsData?.claims?.aal || null;
}

export async function requiresMfaStepUp() {
  const aal = await getAuthenticationLevel();

  return aal !== "aal2";
}

export async function isMfaVerified() {
  const aal = await getAuthenticationLevel();

  return aal === "aal2";
}