import "./styles/admin.css";
import { supabase } from "./lib/supabase.js";

import {
  sendVerificationCode,
  completeAdminLogin,
  getCurrentSession,
  getAdminIdentity,
  startAdminSession,
  logout
} from "./auth/auth.js";

import {
  adminApi,
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

const app =
  document.getElementById("app");

if (!app) {
  throw new Error(
    "KTMS Admin: #app root element was not found."
  );
}

/* =========================================================
   LOGIN STATUS
   ========================================================= */

const LOGIN_STATUS = {
  VERIFIED: "VERIFIED",
  UNAUTHORIZED: "UNAUTHORIZED",
  FAILED: "FAILED"
};

/* =========================================================
   BUTTON LOADING STATE
   ========================================================= */

function setButtonLoading(
  button,
  loading,
  text
) {
  if (!button) return;

  if (loading) {
    button.disabled = true;

    button.dataset.originalText =
      button.innerHTML;

    button.innerHTML = `
      <span class="ktms-login-spinner"
            aria-hidden="true"></span>
      <span>${text}</span>
    `;

    return;
  }

  button.disabled = false;

  if (
    button.dataset.originalText
  ) {
    button.innerHTML =
      button.dataset.originalText;

    delete button.dataset.originalText;
  }
}

/* =========================================================
   LOGIN STATUS DISPLAY
   ========================================================= */

function setLoginStatus(
  status
) {
  const message =
    document.getElementById(
      "login-msg"
    );

  if (!message) return;

  message.dataset.status =
    status.toLowerCase();

  message.textContent =
    status;
}

function clearLoginStatus() {
  const message =
    document.getElementById(
      "login-msg"
    );

  if (!message) return;

  message.textContent = "";
  message.removeAttribute(
    "data-status"
  );
}

/* =========================================================
   LOGIN PAGE
   ========================================================= */

function renderLogin() {
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

          <p
            class="ktms-login-description"
            id="login-description"
          >
            Enter your administrator email to receive a verification code.
          </p>

          <div class="ktms-login-security">
            <span class="ktms-security-dot"></span>
            <span>SECURE EMAIL VERIFICATION</span>
          </div>

          <div
            id="login-msg"
            class="ktms-message"
            aria-live="polite"
          ></div>

          <!-- EMAIL -->

          <form
            id="email-form"
            class="ktms-login-form"
          >

            <div class="ktms-login-field">

              <label for="email">
                Administrator Email
              </label>

              <div class="ktms-login-input-wrap">

                <span class="ktms-input-icon">
                  @
                </span>

                <input
                  id="email"
                  type="email"
                  autocomplete="email"
                  placeholder="administrator@example.com"
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
              <span class="ktms-login-button-arrow">
                →
              </span>
            </button>

          </form>

          <!-- OTP -->

          <form
            id="otp-form"
            class="ktms-login-form"
            hidden
          >

            <div class="ktms-login-field">

              <label for="otp">
                Verification Code
              </label>

              <div class="ktms-login-input-wrap">

                <span class="ktms-input-icon">
                  #
                </span>

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
              <span class="ktms-login-button-arrow">
                →
              </span>
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

  setupLoginHandlers();
}

/* =========================================================
   LOGIN HANDLERS
   ========================================================= */

function setupLoginHandlers() {
  const emailForm =
    document.getElementById(
      "email-form"
    );

  const otpForm =
    document.getElementById(
      "otp-form"
    );

  const emailInput =
    document.getElementById(
      "email"
    );

  const otpInput =
    document.getElementById(
      "otp"
    );

  const sendButton =
    document.getElementById(
      "send-code"
    );

  const verifyButton =
    document.getElementById(
      "verify-code"
    );

  const backButton =
    document.getElementById(
      "back-to-email"
    );

  /* =======================================================
     REQUEST OTP
     ======================================================= */

  emailForm.addEventListener(
    "submit",
    async (event) => {
      event.preventDefault();

      const email =
        emailInput.value
          .trim()
          .toLowerCase();

      if (!email) {
        setLoginStatus(
          LOGIN_STATUS.FAILED
        );

        return;
      }

      clearLoginStatus();

      setButtonLoading(
        sendButton,
        true,
        "SENDING"
      );

      try {
        await sendVerificationCode(
          email
        );

        emailForm.hidden = true;
        otpForm.hidden = false;

        clearLoginStatus();

        otpInput.focus();

      } catch (error) {
        console.error(
          "KTMS verification request failed:",
          error
        );

        /*
         * Deliberately expose only the
         * permitted user-facing state.
         */
        setLoginStatus(
          isUnauthorizedError(error)
            ? LOGIN_STATUS.UNAUTHORIZED
            : LOGIN_STATUS.FAILED
        );

      } finally {
        setButtonLoading(
          sendButton,
          false
        );
      }
    }
  );

  /* =======================================================
     VERIFY OTP
     ======================================================= */

  otpForm.addEventListener(
    "submit",
    async (event) => {
      event.preventDefault();

      const email =
        emailInput.value
          .trim()
          .toLowerCase();

      const token =
        otpInput.value
          .trim();

      if (!email || !token) {
        setLoginStatus(
          LOGIN_STATUS.FAILED
        );

        return;
      }

      clearLoginStatus();

      setButtonLoading(
        verifyButton,
        true,
        "VERIFYING"
      );

      try {
        /*
         * Complete authentication:
         *
         * backend OTP verification
         *        ↓
         * Supabase session
         *        ↓
         * KTMS admin session
         *        ↓
         * admin.me
         */
        const admin =
          await completeAdminLogin(
            email,
            token
          );

        console.info(
          "KTMS administrator verified:",
          admin
        );

        setLoginStatus(
          LOGIN_STATUS.VERIFIED
        );

        /*
         * Give the user a brief visible
         * confirmation before entering.
         */
        await wait(350);

        await renderAdminShell(
          admin
        );

      } catch (error) {
        console.error(
          "KTMS administrator login failed:",
          error
        );

        /*
         * Never expose backend error details
         * to the administrator.
         */
        clearAdminSessionToken();

        try {
          await supabase.auth.signOut();
        } catch (signOutError) {
          console.warn(
            "KTMS login cleanup warning:",
            signOutError
          );
        }

        setLoginStatus(
          isUnauthorizedError(error)
            ? LOGIN_STATUS.UNAUTHORIZED
            : LOGIN_STATUS.FAILED
        );

      } finally {
        setButtonLoading(
          verifyButton,
          false
        );
      }
    }
  );

  /* =======================================================
     CHANGE EMAIL
     ======================================================= */

  backButton.addEventListener(
    "click",
    () => {
      otpForm.hidden = true;
      emailForm.hidden = false;

      otpInput.value = "";

      clearLoginStatus();

      emailInput.focus();
    }
  );
}

/* =========================================================
   ERROR CLASSIFICATION
   ========================================================= */

function isUnauthorizedError(
  error
) {
  const status =
    Number(error?.status);

  const code =
    String(error?.code || "")
      .toUpperCase();

  return (
    status === 401 ||
    status === 403 ||
    code === "ADMIN_ACCESS_DENIED" ||
    code === "IDENTITY_MISMATCH" ||
    code === "INVALID_SESSION" ||
    code === "OTP_VERIFICATION_FAILED" ||
    code === "SUPABASE_AUTH_REQUIRED" ||
    code === "AUTH_SESSION_FAILED" ||
    code === "AUTH_SESSION_MISSING"
  );
}

/* =========================================================
   AUTHENTICATE EXISTING SESSION
   ========================================================= */

async function authenticate() {
  const session =
    await getCurrentSession();

  if (!session) {
    renderLogin();
    return;
  }

  try {
    const admin =
      await getAdminIdentity();

    await renderAdminShell(
      admin
    );

  } catch (error) {
    console.error(
      "KTMS existing session authentication failed:",
      error
    );

    clearAdminSessionToken();

    try {
      await supabase.auth.signOut();
    } catch (signOutError) {
      console.warn(
        "KTMS session cleanup warning:",
        signOutError
      );
    }

    renderLogin();
  }
}

/* =========================================================
   ADMIN APPLICATION
   ========================================================= */

async function renderAdminShell(
  admin
) {
  const route =
    getCurrentRoute();

  const page =
    renderAppShell(
      app,
      admin,
      route
    );

  const logoutButton =
    document.getElementById(
      "logout-button"
    );

  if (logoutButton) {
    logoutButton.addEventListener(
      "click",
      async () => {
        try {
          await logout();
        } catch (error) {
          console.error(
            "KTMS administrator logout failed:",
            error
          );
        }

        renderLogin();
      }
    );
  }

  await renderRoute(
    page,
    route,
    admin
  );
}

/* =========================================================
   ROUTE CHANGE
   ========================================================= */

async function handleRouteChange() {
  const session =
    await getCurrentSession();

  if (!session) {
    renderLogin();
    return;
  }

  try {
    const admin =
      await getAdminIdentity();

    await renderAdminShell(
      admin
    );

  } catch (error) {
    console.error(
      "KTMS route authentication failed:",
      error
    );

    clearAdminSessionToken();

    try {
      await supabase.auth.signOut();
    } catch (signOutError) {
      console.warn(
        "KTMS route cleanup warning:",
        signOutError
      );
    }

    renderLogin();
  }
}

/* =========================================================
   DASHBOARD
   ========================================================= */

async function loadDashboard() {
  const target =
    document.getElementById(
      "dashboard-status"
    );

  if (!target) return;

  try {
    const data =
      await adminApi(
        "dashboard.summary"
      );

    target.innerHTML = `
      <div class="ktms-dashboard-grid">

        <div>
          <strong>${data.tournaments ?? 0}</strong>
          <span>Tournaments</span>
        </div>

        <div>
          <strong>${data.registrationRequests ?? 0}</strong>
          <span>Registration Requests</span>
        </div>

        <div>
          <strong>${data.players ?? 0}</strong>
          <span>Players</span>
        </div>

        <div>
          <strong>${data.transactions ?? 0}</strong>
          <span>Transactions</span>
        </div>

        <div>
          <strong>${data.notifications ?? 0}</strong>
          <span>Notifications</span>
        </div>

        <div>
          <strong>${data.supportCases ?? 0}</strong>
          <span>Support Cases</span>
        </div>

        <div>
          <strong>${data.awaitingVerification ?? 0}</strong>
          <span>Awaiting Verification</span>
        </div>

      </div>
    `;

  } catch (error) {
    console.error(
      "KTMS dashboard error:",
      error
    );

    target.textContent =
      "FAILED";
  }
}

/* =========================================================
   UTILITY
   ========================================================= */

function wait(
  milliseconds
) {
  return new Promise(
    (resolve) =>
      setTimeout(
        resolve,
        milliseconds
      )
  );
}

/* =========================================================
   SUPABASE AUTH STATE
   ========================================================= */

supabase.auth.onAuthStateChange(
  (_event, session) => {
    if (!session) {
      clearAdminSessionToken();
      renderLogin();
    }
  }
);

/* =========================================================
   START APPLICATION
   ========================================================= */

startRouter(
  handleRouteChange
);

authenticate();
