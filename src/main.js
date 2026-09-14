import "./styles/admin.css";
import { supabase } from "./lib/supabase.js";

import {
  sendVerificationCode,
  verifyVerificationCode,
  startAdminSession,
  getCurrentSession,
  getAdminIdentity,
  logout
} from "./auth/auth.js";

import { adminApi } from "./api/admin-api.js";
import { getCurrentRoute, startRouter } from "./app/router.js";
import { renderAppShell, renderRoute } from "./app/app.js";

const app = document.getElementById("app");

if (!app) {
  throw new Error("KTMS Admin: #app root element was not found.");
}

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

          <p class="ktms-login-description" id="login-description">
            Enter your administrator email to receive a verification code.
          </p>

          <div class="ktms-login-security">
            <span class="ktms-security-dot"></span>
            <span>SECURE EMAIL VERIFICATION</span>
          </div>

          <div id="login-msg" class="ktms-message" aria-live="polite"></div>

          <form id="email-form" class="ktms-login-form">

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

          <form id="otp-form" class="ktms-login-form" hidden>

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

  const emailForm = document.getElementById("email-form");
  const otpForm = document.getElementById("otp-form");
  const emailInput = document.getElementById("email");
  const otpInput = document.getElementById("otp");
  const message = document.getElementById("login-msg");
  const backButton = document.getElementById("back-to-email");

  emailForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    message.textContent = "Sending verification code...";

    try {
      await sendVerificationCode(emailInput.value);

      emailForm.hidden = true;
      otpForm.hidden = false;

      message.textContent =
        "Verification code sent. Check your email.";

      otpInput.focus();
    } catch (error) {
      console.error("KTMS login code error:", error);

      message.textContent =
        error?.message || "Unable to send verification code.";
    }
  });

  otpForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    message.textContent = "Verifying...";

    try {
      await verifyVerificationCode(
  emailInput.value,
  otpInput.value
);

message.textContent =
  "Authentication successful. Establishing secure administrator session...";

await startAdminSession();

await authenticate();

    } catch (error) {
      console.error("KTMS OTP verification error:", error);

      message.textContent =
        error?.message || "Verification failed.";
    }
  });

  backButton.addEventListener("click", () => {
    otpForm.hidden = true;
    emailForm.hidden = false;
    otpInput.value = "";
    message.textContent = "";
    emailInput.focus();
  });
}

async function authenticate() {
  const session = await getCurrentSession();

  if (!session) {
    renderLogin();
    return;
  }

  try {
    const admin = await getAdminIdentity();

    await renderAdminShell(admin);
  } catch (error) {
    console.error(
      "KTMS administrator authentication failed:",
      error
    );

    /*
     * A valid Supabase session without a valid
     * KTMS administrator session must establish
     * a fresh KTMS session before retrying.
     */
    if (
      error?.code === "KTMS_SESSION_REQUIRED" ||
      error?.code === "SESSION_EXPIRED" ||
      error?.code === "SESSION_REJECTED" ||
      error?.code === "ADMIN_SESSION_REQUIRED"
    ) {
      try {
        await startAdminSession();

        const admin =
          await getAdminIdentity();

        await renderAdminShell(admin);

        return;
      } catch (retryError) {
        console.error(
          "KTMS administrator session recovery failed:",
          retryError
        );

        const message =
          document.getElementById("login-msg");

        if (message) {
          message.textContent =
            `ADMIN AUTHENTICATION FAILED: ${
              retryError?.code || "UNKNOWN_ERROR"
            } — ${
              retryError?.message ||
              "Unable to establish administrator session."
            }`;
        }

        return;
      }
    }

    const message =
      document.getElementById("login-msg");

    if (message) {
      message.textContent =
        `ADMIN AUTHENTICATION FAILED: ${
          error?.code || "UNKNOWN_ERROR"
        } — ${
          error?.message ||
          "Unknown error"
        }`;
    }
  }
}
async function renderAdminShell(admin) {
  const route = getCurrentRoute();

  const page = renderAppShell(
    app,
    admin,
    route
  );

  document
    .getElementById("logout-button")
    .addEventListener("click", async () => {
      await logout();
      renderLogin();
    });

  await renderRoute(page, route, admin);
}

async function handleRouteChange() {
  const session = await getCurrentSession();

  if (!session) {
    renderLogin();
    return;
  }

  try {
    const admin = await getAdminIdentity();
    await renderAdminShell(admin);
  } catch (error) {
    console.error("KTMS route authentication failed:", error);

    await logout();
    renderLogin();
  }
}

async function loadDashboard() {
  const target = document.getElementById("dashboard-status");

  try {
    const data = await adminApi("dashboard.summary");

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
    console.error("KTMS dashboard error:", error);

    target.textContent =
      error?.message || "Unable to load dashboard.";
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

supabase.auth.onAuthStateChange((_event, session) => {
  if (!session) {
    renderLogin();
  }
});

startRouter(handleRouteChange);
authenticate();
