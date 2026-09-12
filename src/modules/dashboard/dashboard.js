import { adminApi } from "../../api/admin-api.js";
import { navigate } from "../../app/router.js";

export async function renderDashboard(page, admin) {
  page.innerHTML = `
    <div class="ktms-module">

      <div class="ktms-module-toolbar">
        <div>
          <h2>Dashboard</h2>
          <p>
            ${getRoleDescription(admin?.role)}
          </p>
        </div>

        <button
          id="dashboard-refresh"
          class="ktms-primary-button"
          type="button"
        >
          REFRESH
        </button>
      </div>

      <div
        id="dashboard-message"
        class="ktms-message"
        aria-live="polite"
      ></div>

      <section
        id="dashboard-stats"
        class="ktms-dashboard-grid"
        aria-label="KTMS dashboard statistics"
      >
        <div class="ktms-loading-state">
          Loading dashboard...
        </div>
      </section>

      <section class="ktms-dashboard-section">

        <div class="ktms-section-header">
          <div>
            <h3>Operational Focus</h3>
            <p>
              Administrative workload relevant to your role.
            </p>
          </div>
        </div>

        <div id="dashboard-focus">
          Loading...
        </div>

      </section>

      <section class="ktms-dashboard-section">

        <div class="ktms-section-header">
          <div>
            <h3>Attention Center</h3>
            <p>
              Action-required administrative events.
            </p>
          </div>
        </div>

        <div class="ktms-notice-card">
          <strong>Attention Center is being connected to KTMS Core.</strong>
          <p>
            The current Admin API does not yet expose the
            authoritative attention-item records required by
            the KTMS specification. No placeholder or fabricated
            administrative events are displayed.
          </p>
        </div>

      </section>

    </div>
  `;

  document
    .getElementById("dashboard-refresh")
    .addEventListener("click", () => {
      renderDashboard(page, admin);
    });

  await loadDashboard(page, admin);
}

async function loadDashboard(page, admin) {
  const statsContainer =
    document.getElementById("dashboard-stats");

  const focusContainer =
    document.getElementById("dashboard-focus");

  try {
    const data =
      await adminApi("dashboard.summary");

    renderStats(
      statsContainer,
      data
    );

    renderOperationalFocus(
      focusContainer,
      data,
      admin
    );

  } catch (error) {
    statsContainer.innerHTML = `
      <div class="ktms-error-state">
        ${escapeHtml(error.message)}
      </div>
    `;

    focusContainer.innerHTML = `
      <div class="ktms-error-state">
        Unable to load dashboard data.
      </div>
    `;
  }
}

function renderStats(container, data) {
  const cards = [
    {
      key: "tournaments",
      label: "Tournaments",
      value: data.tournaments,
      route: "/tournaments"
    },
    {
      key: "registrationRequests",
      label: "Registration Requests",
      value: data.registrationRequests,
      route: "/registrations"
    },
    {
      key: "players",
      label: "Players",
      value: data.players,
      route: "/players"
    },
    {
      key: "transactions",
      label: "Transactions",
      value: data.transactions,
      route: "/payments"
    },
    {
      key: "notifications",
      label: "Notifications",
      value: data.notifications,
      route: "/notifications"
    },
    {
      key: "supportCases",
      label: "Support Cases",
      value: data.supportCases,
      route: "/support"
    },
    {
      key: "awaitingVerification",
      label: "Awaiting Verification",
      value: data.awaitingVerification,
      route: "/registrations",
      attention: true
    }
  ];

  container.innerHTML = cards
    .map((card) => `
      <button
        type="button"
        class="ktms-stat-card ${card.attention ? "ktms-stat-card-attention" : ""}"
        data-dashboard-route="${card.route}"
      >
        <strong>
          ${Number(card.value ?? 0)}
        </strong>

        <span>
          ${escapeHtml(card.label)}
        </span>
      </button>
    `)
    .join("");

  container
    .querySelectorAll("[data-dashboard-route]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        navigate(button.dataset.dashboardRoute);
      });
    });
}

function renderOperationalFocus(
  container,
  data,
  admin
) {
  const role =
    String(admin?.role || "")
      .trim();

  let items = [];

  switch (role) {

    case "Game Master":
      items = [
        {
          label: "Registration requests",
          value: data.registrationRequests,
          route: "/registrations"
        },
        {
          label: "Awaiting verification",
          value: data.awaitingVerification,
          route: "/registrations"
        },
        {
          label: "Support cases",
          value: data.supportCases,
          route: "/support"
        },
        {
          label: "Transactions",
          value: data.transactions,
          route: "/payments"
        }
      ];
      break;

    case "Platform Manager":
      items = [
        {
          label: "Tournaments",
          value: data.tournaments,
          route: "/tournaments"
        },
        {
          label: "Notifications",
          value: data.notifications,
          route: "/notifications"
        }
      ];
      break;

    case "Moderator":
      items = [
        {
          label: "Tournaments",
          value: data.tournaments,
          route: "/tournaments"
        },
        {
          label: "Registration requests",
          value: data.registrationRequests,
          route: "/registrations"
        }
      ];
      break;

    case "Support":
      items = [
        {
          label: "Support cases",
          value: data.supportCases,
          route: "/support"
        },
        {
          label: "Players",
          value: data.players,
          route: "/players"
        },
        {
          label: "Notifications",
          value: data.notifications,
          route: "/notifications"
        }
      ];
      break;

    case "Accountant":
      items = [
        {
          label: "Transactions",
          value: data.transactions,
          route: "/payments"
        },
        {
          label: "Awaiting verification",
          value: data.awaitingVerification,
          route: "/registrations"
        }
      ];
      break;

    default:
      items = [
        {
          label: "Tournaments",
          value: data.tournaments,
          route: "/tournaments"
        }
      ];
  }

  container.innerHTML = `
    <div class="ktms-focus-grid">
      ${items.map((item) => `
        <button
          type="button"
          class="ktms-focus-item"
          data-focus-route="${item.route}"
        >
          <span>
            ${escapeHtml(item.label)}
          </span>

          <strong>
            ${Number(item.value ?? 0)}
          </strong>
        </button>
      `).join("")}
    </div>
  `;

  container
    .querySelectorAll("[data-focus-route]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        navigate(button.dataset.focusRoute);
      });
    });
}

function getRoleDescription(role) {
  switch (String(role || "").trim()) {

    case "Game Master":
      return "Complete KTMS command center and security authority.";

    case "Platform Manager":
      return "Technical and system operations overview.";

    case "Moderator":
      return "Tournament operations and competition workload.";

    case "Support":
      return "Player support and dispute workload.";

    case "Accountant":
      return "Finance and payment workload.";

    default:
      return "KTMS administrative overview.";
  }
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
