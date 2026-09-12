import { adminApi } from "../../api/admin-api.js";
import { navigate } from "../../app/router.js";

export async function renderTournaments(page) {
  page.innerHTML = `
    <div class="ktms-module">
      <div class="ktms-module-toolbar">
        <div>
          <h2>Tournaments</h2>
          <p>Manage KT tournament lifecycle and configuration.</p>
        </div>

        <button id="create-tournament-button" class="ktms-primary-button">
          CREATE TOURNAMENT
        </button>
      </div>

      <div id="tournaments-message" class="ktms-message"></div>

      <div id="tournaments-list">
        Loading tournaments...
      </div>
    </div>
  `;

  document
    .getElementById("create-tournament-button")
    .addEventListener("click", () => {
      renderCreateTournament(page);
    });

  await loadTournaments();
}

async function loadTournaments(status = null) {
  const container = document.getElementById("tournaments-list");
  const message = document.getElementById("tournaments-message");

  try {
    message.textContent = "";

    const data = await adminApi("tournament.list", {
      status
    });

    const tournaments = Array.isArray(data) ? data : [];

    if (!tournaments.length) {
      container.innerHTML = `
        <div class="ktms-empty-state">
          <h3>No tournaments found</h3>
          <p>Create the first KT tournament to begin the tournament lifecycle.</p>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="ktms-table-wrap">
        <table class="ktms-table">
          <thead>
            <tr>
              <th>Tournament ID</th>
              <th>Name</th>
              <th>Edition</th>
              <th>Year</th>
              <th>Status</th>
              <th>Start</th>
              <th>Players</th>
              <th></th>
            </tr>
          </thead>

          <tbody>
            ${tournaments.map(renderTournamentRow).join("")}
          </tbody>
        </table>
      </div>
    `;

    container.querySelectorAll("[data-tournament-id]").forEach((button) => {
      button.addEventListener("click", async () => {
        await openTournament(button.dataset.tournamentId);
      });
    });

  } catch (error) {
    container.innerHTML = `
      <div class="ktms-error-state">
        ${escapeHtml(error.message)}
      </div>
    `;
  }
}

function renderTournamentRow(tournament) {
  return `
    <tr>
      <td><strong>${escapeHtml(tournament.tournament_id)}</strong></td>
      <td>${escapeHtml(tournament.tournament_name)}</td>
      <td>${escapeHtml(tournament.tournament_edition)}</td>
      <td>${escapeHtml(tournament.tournament_year)}</td>
      <td>
        <span class="ktms-status">
          ${escapeHtml(tournament.tournament_status)}
        </span>
      </td>
      <td>${formatDate(tournament.tournament_start_date)}</td>
      <td>${escapeHtml(tournament.maximum_players)}</td>
      <td>
        <button
          class="ktms-table-action"
          data-tournament-id="${escapeHtml(tournament.tournament_id)}"
        >
          VIEW
        </button>
      </td>
    </tr>
  `;
}

async function openTournament(tournamentId) {
  const data = await adminApi("tournament.get", {
    tournamentId
  });

  renderTournamentDetails(data);
}

function renderTournamentDetails(tournament) {
  const page = document.getElementById("ktms-page");

  page.innerHTML = `
    <div class="ktms-module">

      <button id="back-to-tournaments" class="ktms-back-button">
        ← TOURNAMENTS
      </button>

      <div class="ktms-module-toolbar">
        <div>
          <h2>${escapeHtml(tournament.tournament_name)}</h2>
          <p>
            ${escapeHtml(tournament.tournament_id)}
            · Edition ${escapeHtml(tournament.tournament_edition)}
          </p>
        </div>

        <span class="ktms-status ktms-status-large">
          ${escapeHtml(tournament.tournament_status)}
        </span>
      </div>

      <div class="ktms-detail-grid">

        ${detailCard(
          "Tournament ID",
          tournament.tournament_id
        )}

        ${detailCard(
          "Tournament Type",
          tournament.tournament_type_id
        )}

        ${detailCard(
          "Year",
          tournament.tournament_year
        )}

        ${detailCard(
          "Registration Fee",
          formatAmount(tournament.registration_fee)
        )}

        ${detailCard(
          "Minimum Age",
          tournament.minimum_age
        )}

        ${detailCard(
          "Maximum Players",
          tournament.maximum_players
        )}

        ${detailCard(
          "Start Date",
          formatDate(tournament.tournament_start_date)
        )}

        ${detailCard(
          "End Date",
          formatDate(tournament.tournament_end_date)
        )}

        ${detailCard(
          "Registration Opens",
          formatDateTime(tournament.registration_open_datetime)
        )}

        ${detailCard(
          "Registration Closes",
          formatDateTime(tournament.registration_close_datetime)
        )}

      </div>

      <div class="ktms-section">
        <h3>Tournament Lifecycle</h3>

        <div class="ktms-action-row">
          ${renderLifecycleActions(tournament)}
        </div>
      </div>

    </div>
  `;

  document
    .getElementById("back-to-tournaments")
    .addEventListener("click", () => {
      navigate("/tournaments");
    });

  page.querySelectorAll("[data-tournament-action]").forEach((button) => {
    button.addEventListener("click", async () => {
      await executeTournamentAction(
        tournament.tournament_id,
        button.dataset.tournamentAction
      );
    });
  });
}

function renderLifecycleActions(tournament) {
  const status = tournament.tournament_status;

  const actions = [];

  if (status === "Registration Open") {
    actions.push(["CLOSE_REGISTRATION", "CLOSE REGISTRATION"]);
    actions.push(["SUSPEND", "SUSPEND"]);
  }

  if (status === "Registration Closed" || status === "Suspended") {
    actions.push(["REOPEN", "REOPEN"]);
  }

  if (status === "Completed" || status === "Archived") {
    actions.push(["REOPEN", "REOPEN"]);
  }

  if (!actions.length) {
    return `<span class="ktms-secondary-text">No lifecycle actions available.</span>`;
  }

  return actions.map(([action, label]) => `
    <button
      class="ktms-secondary-button"
      data-tournament-action="${action}"
    >
      ${label}
    </button>
  `).join("");
}

async function executeTournamentAction(tournamentId, action) {
  if (!confirm(`Execute ${action.replaceAll("_", " ")}?`)) {
    return;
  }

  try {
    const updated = await adminApi("tournament.action", {
      tournamentId,
      action
    });

    renderTournamentDetails(updated);

  } catch (error) {
    alert(error.message);
  }
}

function renderCreateTournament(page) {
  page.innerHTML = `
    <div class="ktms-module">

      <button id="back-to-tournaments" class="ktms-back-button">
        ← TOURNAMENTS
      </button>

      <div class="ktms-module-toolbar">
        <div>
          <h2>Create KT Tournament</h2>
          <p>Creates the tournament and its 12 scheduled matchdays.</p>
        </div>
      </div>

      <form id="create-tournament-form" class="ktms-form">

        <label>
          Tournament Name
          <input name="tournamentName" required>
        </label>

        <label>
          Tournament Year
          <input
            name="year"
            type="number"
            min="2000"
            required
          >
        </label>

        <label>
          Tournament Start Date
          <input
            name="startDate"
            type="date"
            required
          >
        </label>

        <label>
          Tournament End Date
          <input
            name="endDate"
            type="date"
            required
          >
        </label>

        <label>
          Registration Fee
          <input
            name="registrationFee"
            type="number"
            min="0"
            step="0.01"
            value="1000"
            required
          >
        </label>

        <label>
          Minimum Age
          <input
            name="minimumAge"
            type="number"
            min="0"
            value="18"
            required
          >
        </label>

        <label>
          Maximum Players
          <input
            name="maximumPlayers"
            type="number"
            min="1"
            value="100"
            required
          >
        </label>

        <div id="create-tournament-error" class="ktms-error-state"></div>

        <button type="submit" class="ktms-primary-button">
          CREATE TOURNAMENT
        </button>

      </form>
    </div>
  `;

  document
    .getElementById("back-to-tournaments")
    .addEventListener("click", () => {
      navigate("/tournaments");
    });

  document
    .getElementById("create-tournament-form")
    .addEventListener("submit", async (event) => {
      event.preventDefault();

      const form = event.currentTarget;
      const errorBox = document.getElementById("create-tournament-error");

      errorBox.textContent = "";

      const values = new FormData(form);

      try {
        const tournament = await adminApi("tournament.create", {
          tournamentName: values.get("tournamentName"),
          year: Number(values.get("year")),
          startDate: values.get("startDate"),
          endDate: values.get("endDate"),
          registrationFee: Number(values.get("registrationFee")),
          minimumAge: Number(values.get("minimumAge")),
          maximumPlayers: Number(values.get("maximumPlayers"))
        });

        renderTournamentDetails(tournament);

      } catch (error) {
        errorBox.textContent = error.message;
      }
    });
}

function detailCard(label, value) {
  return `
    <article class="ktms-detail-card">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value ?? "—")}</strong>
    </article>
  `;
}

function formatDate(value) {
  if (!value) return "—";

  return new Date(`${value}T00:00:00`).toLocaleDateString(
    undefined,
    {
      year: "numeric",
      month: "short",
      day: "numeric"
    }
  );
}

function formatDateTime(value) {
  if (!value) return "—";

  return new Date(value).toLocaleString(
    undefined,
    {
      dateStyle: "medium",
      timeStyle: "short"
    }
  );
}

function formatAmount(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "—";
  }

  return `₦${number.toLocaleString()}`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
