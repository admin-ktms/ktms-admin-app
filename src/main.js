import {
  sendVerificationCode,
  completeAdminLogin,
  getCurrentSession,
  getAdminIdentity,
  logout
} from "./auth/auth.js";

import {
  clearAdminSessionToken
} from "./api/admin-api.js";

import { supabase } from "./lib/supabase.js";
import {
  getCurrentRoute,
  navigate,
  startRouter
} from "./app/router.js";

import { renderLogin } from "./ui/login.js";
import { renderAdminShell } from "./ui/admin-shell.js";

let authenticationInProgress = false;
let applicationReady = false;

// DOM

const app = document.getElementById("app");

if (!app) {
  throw new Error("KTMS application root was not found.");
}

// AUTHENTICATION STATE

function clearAuthenticationState() {
  clearAdminSessionToken();
  supabase.auth.signOut().catch(() => {});
}

async function authenticate() {
  if (authenticationInProgress) {
    return false;
  }

  try {
    const session = await getCurrentSession();

    if (!session?.access_token) {
      applicationReady = false;
      renderLogin();
      return false;
    }

    const admin = await getAdminIdentity();

    if (!admin) {
      throw new Error(
        "KTMS administrator identity could not be loaded."
      );
    }

    applicationReady = true;
    renderAdminShell(admin);

    return true;
  } catch (error) {
    applicationReady = false;
    clearAuthenticationState();
    renderLogin();
    return false;
  }
}

// LOGIN

function bindLoginEvents() {
  const loginForm =
    document.querySelector("#admin-login-form");

  const verificationForm =
    document.querySelector(
      "#admin-verification-form"
    );

  const emailInput =
    document.querySelector("#admin-email");

  const tokenInput =
    document.querySelector("#admin-verification-code");

  const loginError =
    document.querySelector("#admin-login-error");

  const verificationError =
    document.querySelector(
      "#admin-verification-error"
    );

  if (loginForm) {
    loginForm.addEventListener(
      "submit",
      async (event) => {
        event.preventDefault();

        if (authenticationInProgress) {
          return;
        }

        const email =
          String(emailInput?.value || "")
            .trim()
            .toLowerCase();

        if (!email) {
          if (loginError) {
            loginError.textContent =
              "Email address is required.";
          }

          return;
        }

        authenticationInProgress = true;

        if (loginError) {
          loginError.textContent = "";
        }

        try {
          await sendVerificationCode(email);

          renderLogin({
            step: "verification",
            email
          });

          bindLoginEvents();
        } catch (error) {
          if (loginError) {
            loginError.textContent =
              error?.message ||
              "Unable to send verification code.";
          }
        } finally {
          authenticationInProgress = false;
        }
      }
    );
  }

  if (verificationForm) {
    verificationForm.addEventListener(
      "submit",
      async (event) => {
        event.preventDefault();

        if (authenticationInProgress) {
          return;
        }

        const email =
          String(
            verificationForm.dataset.email ||
            emailInput?.value ||
            ""
          )
            .trim()
            .toLowerCase();

        const token =
          String(tokenInput?.value || "").trim();

        if (!email) {
          if (verificationError) {
            verificationError.textContent =
              "Email address is required.";
          }

          return;
        }

        if (!token) {
          if (verificationError) {
            verificationError.textContent =
              "Verification code is required.";
          }

          return;
        }

        authenticationInProgress = true;

        if (verificationError) {
          verificationError.textContent = "";
        }

        try {
          const admin =
            await completeAdminLogin(
              email,
              token
            );

          applicationReady = true;

          renderAdminShell(admin);

          const route =
            getCurrentRoute();

          if (route !== "dashboard") {
            navigate(
              `/${route}`
            );
          }
        } catch (error) {
          clearAuthenticationState();

          if (verificationError) {
            verificationError.textContent =
              error?.message ||
              "Unable to complete administrator login.";
          }
        } finally {
          authenticationInProgress = false;
        }
      }
    );
  }
}

// ROUTING

async function handleRouteChange() {
  if (authenticationInProgress) {
    return;
  }

  if (!applicationReady) {
    const authenticated =
      await authenticate();

    if (!authenticated) {
      return;
    }
  }

  renderAdminShell(
    await getAdminIdentity()
  );
}

// LOGOUT

async function handleLogout() {
  if (authenticationInProgress) {
    return;
  }

  try {
    await logout();
  } catch (error) {
    console.warn(
      "KTMS administrator logout warning:",
      error
    );
  } finally {
    applicationReady = false;
    authenticationInProgress = false;
    clearAuthenticationState();
    renderLogin();
    bindLoginEvents();

    if (
      window.location.pathname !== "/"
    ) {
      window.history.replaceState(
        {},
        "",
        "/"
      );
    }
  }
}

// AUTH STATE

supabase.auth.onAuthStateChange(
  (event, session) => {
    if (authenticationInProgress) {
      return;
    }

    if (
      event === "SIGNED_OUT" ||
      !session?.access_token
    ) {
      if (applicationReady) {
        applicationReady = false;
        clearAdminSessionToken();
        renderLogin();
        bindLoginEvents();
      }

      return;
    }

    if (
      event === "TOKEN_REFRESHED" &&
      applicationReady
    ) {
      return;
    }
  }
);

// GLOBAL EVENTS

document.addEventListener(
  "click",
  (event) => {
    const logoutButton =
      event.target.closest(
        "[data-action='logout']"
      );

    if (logoutButton) {
      event.preventDefault();
      handleLogout();
    }
  }
);

// INITIALIZATION

async function initialize() {
  renderLogin();
  bindLoginEvents();

  startRouter(
    handleRouteChange
  );
}

initialize().catch((error) => {
  console.error(
    "KTMS application initialization failed:",
    error
  );

  applicationReady = false;
  authenticationInProgress = false;

  clearAuthenticationState();
  renderLogin();
  bindLoginEvents();
});
