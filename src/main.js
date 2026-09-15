import "./styles/admin.css";

import { supabase } from "./lib/supabase.js";

import {
  sendVerificationCode,
  verifyVerificationCode,
  getCurrentSession,
  getAdminIdentity,
  logout
} from "./auth/auth.js";

import {
  clearAdminSessionToken
} from "./api/admin-api.js";

import {
  getCurrentRoute,
  startRouter
} from "./app/router.js";

import {
  renderAppShell,
  renderRoute
} from "./app/app.js";

const app = document.getElementById("app");

if (!app) {
  throw new Error(
    "KTMS Admin: #app root element was not found."
  );
}

/*
 * --------------------------------------------------------------------------
 * APPLICATION STATE
 * --------------------------------------------------------------------------
 */

let authenticationInProgress = false;
let applicationReady = false;
let currentAdmin = null;


/*
 * --------------------------------------------------------------------------
 * LOGIN
 * --------------------------------------------------------------------------
 */

function renderLogin({
  step = "email",
  email = "",
  message = "",
  messageType = ""
} = {}) {
  app.innerHTML = `
    <main class="ktms-login">
      <div class="ktms-login-orbit ktms-login-orbit-one"></div>
      <div class="ktms-login-orbit ktms-login-orbit-two"></div>

      <section class="ktms-login-layout">

        <div class="ktms-login-identity">

          <div class="ktms-login-mark">
            <span class="ktms-login-mark-line"></span>
            <span>KTMS</span>
          </div>

          <div class="ktms-login-eyebrow">
            ADMINISTRATION CONSOLE
          </div>

          <h1>
            Tournament<br>
            <span>Command Center</span>
          </h1>

          <p class="ktms-login-intro">
            Secure administrative access to the KickOff Tournament
            Management System.
          </p>

          <div class="ktms-login-authority">
            <div class="ktms-login-authority-indicator"></div>

            <div>
              <strong>Protected Operations</strong>
              <span>Core-authoritative administration</span>
            </div>
          </div>

        </div>

        <section class="ktms-login-card">

          <div class="ktms-login-card-header">

            <div class="ktms-login-card-icon">
              <span></span>
              <span></span>
              <span></span>
            </div>

            <div>
              <div class="ktms-login-card-kicker">
                KTMS ADMIN
              </div>

              <h2>Sign in</h2>
            </div>

          </div>

          <p class="ktms-login-description">
            ${
              step === "verification"
                ? "Enter the verification code sent to your administrator email."
                : "Enter your administrator email to receive a verification code."
            }
          </p>

          <div class="ktms-login-security">
            <span class="ktms-security-dot"></span>
            <span>SECURE EMAIL VERIFICATION</span>
          </div>

          <div
            id="login-msg"
            class="ktms-message ${messageType}"
            aria-live="polite"
          >${escapeHtml(message)}</div>

          <form
            id="email-form"
            class="ktms-login-form"
            ${step === "verification" ? "hidden" : ""}
          >

            <div class="ktms-login-field">

              <label for="email">
                Administrator Email
              </label>

              <div class="ktms-login-input-wrap">

                <span class="ktms-input-icon">@</span>

                <input
                  id="email"
                  type="email"
                  autocomplete="email"
                  placeholder="administrator@example.com"
                  value="${escapeHtml(email)}"
                  required
                />

              </div>

            </div>

            <button
              id="send-code"
              type="submit"
              class="ktms-login-primary"
            >
              <span>CONTINUE</span>
              <span class="ktms-login-button-arrow">→</span>
            </button>

          </form>

          <form
            id="otp-form"
            class="ktms-login-form"
            ${step !== "verification" ? "hidden" : ""}
          >

            <div class="ktms-login-field">

              <label for="otp">
                Verification Code
              </label>

              <div class="ktms-login-input-wrap">

                <span class="ktms-input-icon">#</span>

                <input
                  id="otp"
                  type="text"
                  inputmode="numeric"
                  autocomplete="one-time-code"
                  maxlength="8"
                  placeholder="Enter verification code"
                  required
                />

              </div>

            </div>

            <button
              id="verify-code"
              type="submit"
              class="ktms-login-primary"
            >
              <span>VERIFY & ENTER</span>
              <span class="ktms-login-button-arrow">→</span>
            </button>

            <button
              id="back-to-email"
              type="button"
              class="ktms-login-secondary"
            >
              CHANGE EMAIL
            </button>

          </form>

          <div class="ktms-login-footer">
            <span>KTMS</span>
            <span class="ktms-login-footer-separator"></span>
            <span>AUTHORIZED ACCESS ONLY</span>
          </div>

        </section>

      </section>
    </main>
  `;

  bindLoginEvents();

  if (step === "verification") {
    document.getElementById("otp")?.focus();
  } else {
    document.getElementById("email")?.focus();
  }
}


function bindLoginEvents() {
  const emailForm =
    document.getElementById("email-form");

  const otpForm =
    document.getElementById("otp-form");

  const emailInput =
    document.getElementById("email");

  const otpInput =
    document.getElementById("otp");

  const message =
    document.getElementById("login-msg");

  const backButton =
    document.getElementById("back-to-email");


  /*
   * SEND VERIFICATION CODE
   */

  if (emailForm) {
    emailForm.addEventListener(
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
          if (message) {
            message.textContent =
              "Administrator email is required.";
          }

          return;
        }

        authenticationInProgress = true;

        const button =
          document.getElementById("send-code");

        if (button) {
          button.disabled = true;
        }

        if (message) {
          message.textContent =
            "Sending verification code...";
        }

        try {
          await sendVerificationCode(email);

          renderLogin({
            step: "verification",
            email,
            message:
              "Verification code sent. Check your email."
          });
        } catch (error) {
          console.error(
            "KTMS verification request failed:",
            error
          );

          if (message) {
            message.textContent =
              error?.message ||
              "Unable to send verification code.";
          }
        } finally {
          authenticationInProgress = false;
        }
      }
    );
  }


  /*
   * VERIFY CODE
   */

  if (otpForm) {
    otpForm.addEventListener(
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

        const token =
          String(otpInput?.value || "")
            .trim();

        if (!email) {
          if (message) {
            message.textContent =
              "Administrator email is required.";
          }

          return;
        }

        if (!token) {
          if (message) {
            message.textContent =
              "Verification code is required.";
          }

          return;
        }

        authenticationInProgress = true;

        const button =
          document.getElementById("verify-code");

        if (button) {
          button.disabled = true;
        }

        if (message) {
          message.textContent =
            "Verifying administrator authentication...";
        }

        try {
          const authentication =
            await verifyVerificationCode(
              email,
              token
            );

          const admin =
            authentication?.admin;

          if (!admin) {
            throw new Error(
              "Administrator identity was not returned after verification."
            );
          }

          /*
           * Establish the authenticated SPA state.
           */
          currentAdmin = admin;
          applicationReady = true;

          const currentPath =
            window.location.pathname.replace(
              /\/+$/,
              ""
            );

          if (!currentPath || currentPath === "/") {
            window.history.replaceState(
              {},
              "",
              "/dashboard"
            );
          }

          /*
           * IMPORTANT:
           *
           * Do not allow a rendering error to be interpreted as an
           * authentication failure.
           */
          await renderAdminShell(
            currentAdmin
          );

        } catch (error) {
          console.error(
            "KTMS administrator login failed:",
            error
          );

          clearAdminSessionToken();

          try {
            await supabase.auth.signOut();
          } catch {
          }

          currentAdmin = null;
          applicationReady = false;

          renderLogin({
            step: "verification",
            email,
            message:
              error?.message ||
              "Unable to complete administrator authentication."
          });

        } finally {
          authenticationInProgress = false;
        }
      }
    );
  }


  /*
   * CHANGE EMAIL
   */

  if (backButton) {
    backButton.addEventListener(
      "click",
      () => {
        renderLogin({
          step: "email",
          email:
            emailInput?.value || ""
        });
      }
    );
  }
}


/*
 * --------------------------------------------------------------------------
 * INITIAL AUTHENTICATION
 * --------------------------------------------------------------------------
 */

async function authenticate() {
  if (authenticationInProgress) {
    return false;
  }

  authenticationInProgress = true;

  try {
    const session =
      await getCurrentSession();

    if (!session?.access_token) {
      currentAdmin = null;
      applicationReady = false;

      renderLogin();

      return false;
    }

    let admin;

    try {
      admin =
        await getAdminIdentity();

    } catch (error) {

      /*
       * The previous implementation attempted to call
       * startAdminSession() here, but that function was not imported
       * or defined in this file.
       *
       * Do not invent a second authentication flow here.
       *
       * If the KTMS admin session is invalid, the current authenticated
       * Supabase session must be treated as requiring a fresh login.
       */

      console.error(
        "KTMS administrator identity lookup failed:",
        error
      );

      throw error;
    }

    if (!admin) {
      throw new Error(
        "KTMS administrator identity could not be loaded."
      );
    }

    currentAdmin = admin;
    applicationReady = true;

    return true;

  } catch (error) {
    console.error(
      "KTMS administrator authentication failed:",
      error
    );

    currentAdmin = null;
    applicationReady = false;

    clearAdminSessionToken();

    try {
      await supabase.auth.signOut();
    } catch {
    }

    renderLogin();

    return false;

  } finally {
    authenticationInProgress = false;
  }
}


/*
 * --------------------------------------------------------------------------
 * ADMIN SHELL
 * --------------------------------------------------------------------------
 */

async function renderAdminShell(admin) {
  if (!admin) {
    throw new Error(
      "KTMS administrator identity is unavailable."
    );
  }

  const route =
    getCurrentRoute();

  const page =
    renderAppShell(
      app,
      admin,
      route
    );

  /*
   * Bind logout for the newly-rendered shell.
   */

  const logoutButton =
    document.getElementById(
      "logout-button"
    );

  if (logoutButton) {
    logoutButton.addEventListener(
      "click",
      handleLogout
    );
  }

  /*
   * IMPORTANT:
   *
   * A page/module failure must NOT propagate into the authentication handler and cause
   * Supabase signOut().
   */

  try {
    await renderRoute(
      page,
      route,
      admin
    );

  } catch (error) {
    console.error(
      `KTMS ${route} module rendering failed:`,
      error
    );

    renderModuleError(
      page,
      route,
      error
    );
  }
}


/*
 * --------------------------------------------------------------------------
 * MODULE ERROR
 * --------------------------------------------------------------------------
 */

function renderModuleError(
  page,
  route,
  error
) {
  if (!page) {
    return;
  }

  const message =
    error?.message ||
    "An unexpected module error occurred.";

  page.innerHTML = `
    <div class="ktms-error-card">

      <strong>
        Unable to load ${escapeHtml(
          route || "this module"
        )}.
      </strong>

      <p>
        ${escapeHtml(message)}
      </p>

      <button
        id="ktms-module-retry"
        class="ktms-secondary-button"
        type="button"
      >
        RETRY
      </button>

    </div>
  `;

  document
    .getElementById(
      "ktms-module-retry"
    )
    ?.addEventListener(
      "click",
      async () => {

        if (!currentAdmin) {
          return;
        }

        await renderAdminShell(
          currentAdmin
        );
      }
    );
}


/*
 * --------------------------------------------------------------------------
 * ROUTING
 * --------------------------------------------------------------------------
 */

async function handleRouteChange() {
  if (authenticationInProgress) {
    return;
  }

  /*
   * Only authenticate when the SPA does not currently have an
   * authenticated administrator.
   */

  if (
    !applicationReady ||
    !currentAdmin
  ) {
    const authenticated =
      await authenticate();

    if (!authenticated) {
      return;
    }
  }


  await renderAdminShell(
    currentAdmin
  );
}


/*
 * --------------------------------------------------------------------------
 * LOGOUT
 * --------------------------------------------------------------------------
 */

async function handleLogout() {
  if (authenticationInProgress) {
    return;
  }

  authenticationInProgress = true;

  try {
    await logout();

  } catch (error) {
    console.warn(
      "KTMS administrator logout warning:",
      error
    );

    clearAdminSessionToken();

    try {
      await supabase.auth.signOut();
    } catch {
    }

  } finally {

    /*
     * Only the explicit logout path clears the in-memory administrator.
     */

    currentAdmin = null;
    applicationReady = false;
    authenticationInProgress = false;

    window.history.replaceState(
      {},
      "",
      "/"
    );

    renderLogin();
  }
}


/*
 * --------------------------------------------------------------------------
 * SUPABASE AUTH STATE
 * --------------------------------------------------------------------------
 */

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

        currentAdmin = null;
        applicationReady = false;

        clearAdminSessionToken();

        renderLogin();
      }
    }
  }
);


/*
 * --------------------------------------------------------------------------
 * INITIALIZATION
 * --------------------------------------------------------------------------
 */

async function initialize() {

  const session =
    await getCurrentSession();

  if (!session?.access_token) {
    renderLogin();
  }

  startRouter(
    handleRouteChange
  );
}


initialize().catch(
  async (error) => {
    console.error(
      "KTMS application initialization failed:",
      error
    );

    currentAdmin = null;
    applicationReady = false;
    authenticationInProgress = false;

    clearAdminSessionToken();

    try {
      await supabase.auth.signOut();
    } catch {
    }

    renderLogin({
      message:
        error?.message ||
        "KTMS Admin failed to initialize."
    });
  }
);


/*
 * --------------------------------------------------------------------------
 * UTILITIES
 * --------------------------------------------------------------------------
 */

function escapeHtml(value) {
  return String(value)
    .replaceAll(
      "&",
      "&amp;"
    )
    .replaceAll(
      "<",
      "&lt;"
    )
    .replaceAll(
      ">",
      "&gt;"
    )
    .replaceAll(
      '"',
      "&quot;"
    )
    .replaceAll(
      "'",
      "&#039;"
    );
}
