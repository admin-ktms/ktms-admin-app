import { adminApi } from "../api/admin-api.js";
import { navigate } from "./router.js";
import { renderTournaments } from "../modules/tournaments/tournaments.js";
import { renderDashboard } from "../modules/dashboard/dashboard.js";
import { renderRegistrations } from "../modules/registrations/registrations.js";
import { renderPlayers } from "../modules/players/players.js";
import { renderPayments } from "../modules/payments/payments.js";

const navigation = [
  ["dashboard", "Dashboard", "/dashboard"],
  ["tournaments", "Tournaments", "/tournaments"],
  ["registrations", "Registrations", "/registrations"],
  ["players", "Players", "/players"],
  ["payments", "Payments", "/payments"],
  ["matchdays", "Matchdays", "/matchdays"],
  ["fixtures", "Fixtures", "/fixtures"],
  ["results", "Results", "/results"],
  ["standings", "Standings", "/standings"],
  ["progression", "Progression", "/progression"],
  ["awards", "Awards", "/awards"],
  ["notifications", "Notifications", "/notifications"],
  ["support", "Support", "/support"],
  ["operations", "Operations", "/operations"],
  ["audit", "Audit", "/audit"],
  ["administrators", "Administrators", "/administrators"]
];

export function renderAppShell(app, admin, route) {
  app.innerHTML = `
    <div class="ktms-app">

      <aside class="ktms-sidebar">

        <div class="ktms-sidebar-brand">
          <div class="ktms-brand-title">KTMS</div>
          <div class="ktms-brand-subtitle">Admin Console</div>
        </div>

        <nav class="ktms-navigation">
          ${navigation.map(([key, label, path]) => `
            <button
              class="ktms-nav-item ${route === key ? "active" : ""}"
              data-route="${path}"
            >
              ${label}
            </button>
          `).join("")}
        </nav>

      </aside>

      <main class="ktms-main">

        <header class="ktms-topbar">

          <div>
            <span class="ktms-topbar-title">KTMS Admin</span>
          </div>

          <div class="ktms-admin-user">
            <div>
              <strong>${escapeHtml(admin.displayName || "")}</strong>
              <span>${escapeHtml(admin.role || "")}</span>
            </div>

            <button id="logout-button">
              LOG OUT
            </button>
          </div>

        </header>

        <section id="ktms-page" class="ktms-page"></section>

      </main>

    </div>
  `;

  document.querySelectorAll("[data-route]").forEach((button) => {
    button.addEventListener("click", () => {
      navigate(button.dataset.route);
    });
  });

  return document.getElementById("ktms-page");
}

export async function renderRoute(page, route, admin) {
  const titles = {
    dashboard: "Dashboard",
    tournaments: "Tournaments",
    registrations: "Registration Requests",
    players: "Players",
    payments: "Payments",
    matchdays: "Matchdays",
    fixtures: "Fixtures",
    results: "Results",
    standings: "Standings",
    progression: "Progression",
    awards: "Awards",
    notifications: "Notifications",
    support: "Support",
    operations: "Operations",
    audit: "Audit",
    administrators: "Administrators"
  };

  page.innerHTML = `
    <div class="ktms-page-header">
      <h1>${titles[route] || "Dashboard"}</h1>
      <p>KTMS tournament operations</p>
    </div>

    <div id="ktms-page-content">
      Loading...
    </div>
  `;

  const content = document.getElementById("ktms-page-content");

  if (route === "dashboard") {
    await renderDashboard(content, admin);
    return;
  }

  if (route === "tournaments") {
  await renderTournaments(content);
  return;
}

  if (route === "registrations") {
  await renderRegistrations(content);
  return;
}

  if (route === "players") {
  await renderPlayers(content);
  return;
}

  if (route === "payments") {
  return renderPayments(content);
}

  content.innerHTML = `
    <div class="ktms-empty-state">
      <h2>${titles[route] || "Module"}</h2>
      <p>This module is connected to the KTMS Admin API and is ready for its operational UI.</p>
    </div>
  `;
}



function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
