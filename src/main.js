import "./styles/main.css";

import { supabase } from "./lib/supabase.js";
import {
  sendVerificationCode,
  verifyVerificationCode,
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
      <section class="ktms-login-card">

        <div class="ktms-brand">
          <div class="ktms-brand-title">KTMS</div>
          <div class="ktms-brand-subtitle">Tournament Management System</div>
        </div>

        <h1>Admin Login</h1>

        <p id="login-description">
          Enter your administrator email to receive a verification code.
        </p>

        <div id="login-msg" class="ktms-message"></div>

        <form id="email-form">

          <label for="email">Administrator Email</label>

          <input
            id="email"
            type="email"
            autocomplete="email"
            required
          />

          <button id="send-code" type="submit">
            SEND VERIFICATION CODE
          </button>

        </form>

        <form id="otp-form" hidden>

          <label for="otp">Verification Code</label>

          <input
            id="otp"
            type="text"
            inputmode="numeric"
            autocomplete="one-time-code"
            maxlength="8"
            required
          />

          <button type="submit">
            VERIFY CODE
          </button>

          <button
            id="back-to-email"
            type="button"
            class="secondary-button"
          >
            CHANGE EMAIL
          </button>

        </form>

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

    renderAdminShell(admin);

  } catch (error) {
    console.error("KTMS administrator authentication failed:", error);
  
    const message = document.getElementById("login-msg");
  
    if (message) {
      message.textContent =
        `ADMIN AUTHENTICATION FAILED: ${error?.code || "UNKNOWN_ERROR"} — ${error?.message || "Unknown error"}`;
    }
  
    return;
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

  await renderRoute(page, route);
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
