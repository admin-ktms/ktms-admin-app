import { adminApi } from "../../api/admin-api.js";
import { navigate } from "../../app/router.js";

let tournamentList = [];

export async function renderTournaments(page) {
  page.innerHTML = `
    <div class="ktms-module">

      <div class="ktms-module-toolbar">
        <div>
          <h2>Tournaments</h2>
          <p>Manage tournament configuration and lifecycle through KTMS Core.</p>
        </div>

        <button
          id="create-tournament-button"
          class="ktms-primary-button"
          type="button"
        >
          CREATE TOURNAMENT
        </button>
      </div>

      <div class="ktms-action-row">
        <label>
          Status
          <select id="tournament-status-filter">
            <option value="">All tournaments</option>
          </select>
        </label>

        <button
          id="refresh-tournaments-button"
          class="ktms-secondary-button"
          type="button"
        >
          REFRESH
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

  document
    .getElementById("refresh-tournaments-button")
    .addEventListener("click", async () => {
      await loadTournaments();
    });

  document
    .getElementById("tournament-status-filter")
    .addEventListener("change", async (event) => {
      await loadTournaments(event.target.value || null);
    });

  await loadTournaments();
}

async function loadTournaments(status = null) {
  const container = document.getElementById("tournaments-list");
  const message = document.getElementById("tournaments-message");

  if (!container) return;

  container.innerHTML = "Loading tournaments...";

  if (message) {
    message.textContent = "";
  }

  try {
    const data = await adminApi("tournament.list", {
      status
    });

    tournamentList = normalizeTournamentList(data);

    updateStatusFilter(tournamentList, status);

    if (!tournamentList.length) {
      container.innerHTML = `
        <div class="ktms-empty-state">
          <h3>No tournaments found</h3>
          <p>
            There are currently no tournaments matching this view.
          </p>
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
              <th>Type</th>
              <th>Edition</th>
              <th>Year</th>
              <th>Status</th>
              <th>Start</th>
              <th>Capacity</th>
              <th></th>
            </tr>
          </thead>

          <tbody>
            ${tournamentList.map(renderTournamentRow).join("")}
          </tbody>

        </table>
      </div>
    `;

    container
      .querySelectorAll("[data-tournament-id]")
      .forEach((button) => {
        button.addEventListener("click", async () => {
          await openTournament(button.dataset.tournamentId);
        });
      });

  } catch (error) {
    container.innerHTML = `
      <div class="ktms-error-state">
        <strong>Unable to load tournaments</strong>
        <p>${escapeHtml(error.message)}</p>
      </div>
    `;
  }
}

function normalizeTournamentList(data) {
  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data?.tournaments)) {
    return data.tournaments;
  }

  if (Array.isArray(data?.items)) {
    return data.items;
  }

  return [];
}

function updateStatusFilter(tournaments, selectedStatus) {
  const filter = document.getElementById("tournament-status-filter");

  if (!filter) return;

  const statuses = [
    ...new Set(
      tournaments
        .map((tournament) => tournament.tournament_status)
        .filter(Boolean)
    )
  ];

  const existing = new Set(
    [...filter.options].map((option) => option.value)
  );

  statuses.forEach((status) => {
    if (!existing.has(status)) {
      const option = document.createElement("option");
      option.value = status;
      option.textContent = status;
      filter.appendChild(option);
    }
  });

  filter.value = selectedStatus || "";
}

function renderTournamentRow(tournament) {
  const id = tournament.tournament_id;
  const status = tournament.tournament_status || "Unknown";

  return `
    <article class="ktms-tournament-card">

      <div class="ktms-tournament-card-top">

        <div class="ktms-tournament-identity">

          <div class="ktms-tournament-type">
            ${escapeHtml(tournament.tournament_type_id || "—")}
          </div>

          <div>
            <h3>
              ${escapeHtml(
                tournament.tournament_name || "Unnamed Tournament"
              )}
            </h3>

            <span class="ktms-tournament-id">
              ${escapeHtml(id)}
            </span>
          </div>

        </div>

        <span class="ktms-status ktms-status-${statusClass(status)}">
          ${escapeHtml(status)}
        </span>

      </div>

      <div class="ktms-tournament-meta">

        <div class="ktms-tournament-meta-item">
          <span>EDITION</span>
          <strong>
            ${escapeHtml(tournament.tournament_edition || "—")}
          </strong>
        </div>

        <div class="ktms-tournament-meta-item">
          <span>YEAR</span>
          <strong>
            ${escapeHtml(tournament.tournament_year || "—")}
          </strong>
        </div>

        <div class="ktms-tournament-meta-item">
          <span>START</span>
          <strong>
            ${formatDate(tournament.tournament_start_date)}
          </strong>
        </div>

        <div class="ktms-tournament-meta-item">
          <span>END</span>
          <strong>
            ${formatDate(tournament.tournament_end_date)}
          </strong>
        </div>

      </div>

      <div class="ktms-tournament-card-footer">

        <div class="ktms-player-capacity">

          <div class="ktms-capacity-label">
            <span>PLAYER CAPACITY</span>

            <strong>
              ${escapeHtml(tournament.maximum_players || "—")}
            </strong>
          </div>

          <div class="ktms-capacity-track">
            <div class="ktms-capacity-fill"></div>
          </div>

        </div>

        <button
          type="button"
          class="ktms-view-tournament"
          data-tournament-id="${escapeHtml(id)}"
        >
          VIEW TOURNAMENT
          <span>→</span>
        </button>

      </div>

    </article>
  `;
}

function statusClass(status) {
  return String(status || "")
    .toLowerCase()
    .replaceAll(" ", "-")
    .replaceAll("_", "-")
    .replaceAll("/", "-")
    .replace(/[^a-z0-9-]/g, "");
}

async function openTournament(tournamentId) {
  const container = document.getElementById("tournaments-list");

  if (container) {
    container.innerHTML = "Loading tournament...";
  }

  try {
    const tournament = await adminApi("tournament.get", {
      tournamentId
    });

    renderTournamentDetails(tournament);

  } catch (error) {
    if (container) {
      container.innerHTML = `
        <div class="ktms-error-state">
          <strong>Unable to load tournament</strong>
          <p>${escapeHtml(error.message)}</p>
        </div>
      `;
    }
  }
}

function renderTournamentDetails(tournament) {
  const page = document.getElementById("ktms-page");

  const summary =
    tournament.operationalSummary || {};

  const registration =
    summary.registration || {};

  const competition =
    summary.competition || {};

  const results =
    summary.results || {};

  page.innerHTML = `
    <div class="ktms-module">

      <button
        id="back-to-tournaments"
        class="ktms-back-button"
        type="button"
      >
        ← TOURNAMENTS
      </button>

      <div class="ktms-module-toolbar">

        <div>
          <h2>
            ${escapeHtml(
              tournament.tournament_name || "Tournament"
            )}
          </h2>

          <p>
            ${escapeHtml(tournament.tournament_id)}
            · Edition
            ${escapeHtml(tournament.tournament_edition)}
          </p>
        </div>

        <span class="ktms-status ktms-status-large">
          ${escapeHtml(
            tournament.tournament_status || "Unknown"
          )}
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
          "Edition",
          tournament.tournament_edition
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
          formatDateTime(
            tournament.registration_open_datetime
          )
        )}

        ${detailCard(
          "Registration Closes",
          formatDateTime(
            tournament.registration_close_datetime
          )
        )}

        ${detailCard(
          "Completed",
          formatDateTime(
            tournament.tournament_completed_datetime
          )
        )}

      </div>

      ${renderOperationalSummary(
        tournament,
        registration,
        competition,
        results
      )}

      <div class="ktms-section">

        <h3>Tournament Lifecycle</h3>

        <p class="ktms-secondary-text">
          Lifecycle transitions are validated and executed by KTMS Core.
        </p>

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

  page
    .querySelectorAll("[data-tournament-action]")
    .forEach((button) => {
      button.addEventListener("click", async () => {
        await executeTournamentAction(
          tournament.tournament_id,
          button.dataset.tournamentAction
        );
      });
    });

  page
    .querySelectorAll("[data-tournament-module]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        navigate(button.dataset.tournamentModule);
      });
    });
}

function renderOperationalSummary(
  tournament,
  registration,
  competition,
  results
) {
  return `
    <div class="ktms-section">

      <div class="ktms-module-toolbar">

        <div>
          <h3>Operational Summary</h3>

          <p class="ktms-secondary-text">
            High-level tournament activity. Detailed management remains in the corresponding KTMS modules.
          </p>
        </div>

      </div>

      <div class="ktms-detail-grid">

        <article class="ktms-detail-card">

          <span>REGISTRATION</span>

          <strong>
            ${escapeHtml(
              registration.registeredPlayers ?? 0
            )}
            /
            ${escapeHtml(
              registration.maximumPlayers ??
              tournament.maximum_players ??
              0
            )}
            Players Registered
          </strong>

          <button
            type="button"
            class="ktms-secondary-button"
            data-tournament-module="/registrations"
          >
            OPEN REGISTRATIONS
          </button>

        </article>

        <article class="ktms-detail-card">

          <span>COMPETITION</span>

          <strong>
            ${escapeHtml(
              competition.matchdays ?? 0
            )}
            Matchdays
            ·
            ${escapeHtml(
              competition.fixtures ?? 0
            )}
            Fixtures
          </strong>

          <button
            type="button"
            class="ktms-secondary-button"
            data-tournament-module="/matchdays"
          >
            OPEN MATCHDAYS
          </button>

          <button
            type="button"
            class="ktms-secondary-button"
            data-tournament-module="/fixtures"
          >
            OPEN FIXTURES
          </button>

        </article>

        <article class="ktms-detail-card">

          <span>RESULTS</span>

          <strong>
            ${escapeHtml(
              results.officialResults ?? 0
            )}
            Official Results
          </strong>

          <button
            type="button"
            class="ktms-secondary-button"
            data-tournament-module="/results"
          >
            OPEN RESULTS
          </button>

        </article>

      </div>

    </div>
  `;
}

function renderLifecycleActions(tournament) {
  const status = tournament.tournament_status;

  const actions = [];

  if (status === "Registration Open") {
    actions.push([
      "CLOSE_REGISTRATION",
      "CLOSE REGISTRATION"
    ]);

    actions.push([
      "SUSPEND",
      "SUSPEND"
    ]);
  }

  if (
    status === "Registration Closed" ||
    status === "Suspended"
  ) {
    actions.push([
      "REOPEN",
      "REOPEN"
    ]);
  }

  if (
    status === "Completed" ||
    status === "Archived"
  ) {
    actions.push([
      "REOPEN",
      "REOPEN"
    ]);
  }

  if (!actions.length) {
    return `
      <span class="ktms-secondary-text">
        No lifecycle actions available.
      </span>
    `;
  }

  return actions
    .map(([action, label]) => `
      <button
        type="button"
        class="ktms-secondary-button"
        data-tournament-action="${escapeHtml(action)}"
      >
        ${escapeHtml(label)}
      </button>
    `)
    .join("");
}

async function executeTournamentAction(
  tournamentId,
  tournamentAction
) {
  const label = tournamentAction
    .replaceAll("_", " ")
    .toLowerCase();

  if (
    !confirm(
      `Are you sure you want to ${label} for tournament ${tournamentId}?`
    )
  ) {
    return;
  }

  try {
    await adminApi("tournament.action", {
      tournamentId,
      tournamentAction
    });

    /*
     * Re-fetch through tournament.get rather than trusting the
     * action response. This guarantees the page receives the
     * current Core-authoritative operational summary.
     */
    const updated = await adminApi("tournament.get", {
      tournamentId
    });

    renderTournamentDetails(updated);

  } catch (error) {
    alert(error.message);
  }
}

function renderCreateTournament(page) {
  page.innerHTML = `
    <div class="ktms-module">

      <button
        id="back-to-tournaments"
        class="ktms-back-button"
        type="button"
      >
        ← TOURNAMENTS
      </button>

      <div class="ktms-module-toolbar">

        <div>
          <h2>Create Tournament</h2>

          <p>
            Submit tournament configuration to KTMS Core.
            Core remains responsible for validation, type rules,
            identifiers, editions, lifecycle state and generated
            competition structure.
          </p>
        </div>

      </div>

      <form
        id="create-tournament-form"
        class="ktms-form"
        novalidate
      >

        <label>
          Tournament Name

          <input
            name="tournamentName"
            type="text"
            autocomplete="off"
            required
          >
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
            placeholder="Leave blank to use Core default"
          >
        </label>

        <label>
          Minimum Age

          <input
            name="minimumAge"
            type="number"
            min="0"
            placeholder="Leave blank to use Core default"
          >
        </label>

        <label>
          Maximum Players

          <input
            name="maximumPlayers"
            type="number"
            min="1"
            placeholder="Leave blank to use Core default"
          >
        </label>

        <div
          id="create-tournament-error"
          class="ktms-error-state"
        ></div>

        <div class="ktms-action-row">

          <button
            type="submit"
            class="ktms-primary-button"
            id="submit-create-tournament"
          >
            CREATE TOURNAMENT
          </button>

          <button
            type="button"
            class="ktms-secondary-button"
            id="cancel-create-tournament"
          >
            CANCEL
          </button>

        </div>

      </form>

    </div>
  `;

  document
    .getElementById("back-to-tournaments")
    .addEventListener("click", () => {
      navigate("/tournaments");
    });

  document
    .getElementById("cancel-create-tournament")
    .addEventListener("click", () => {
      navigate("/tournaments");
    });

  document
    .getElementById("create-tournament-form")
    .addEventListener("submit", async (event) => {
      event.preventDefault();

      await submitCreateTournament(event.currentTarget);
    });
}

async function submitCreateTournament(form) {
  const errorBox = document.getElementById(
    "create-tournament-error"
  );

  errorBox.textContent = "";

  const values = new FormData(form);

  const tournamentName =
    String(values.get("tournamentName") || "").trim();

  const yearValue =
    String(values.get("year") || "").trim();

  const startDate =
    String(values.get("startDate") || "").trim();

  const endDate =
    String(values.get("endDate") || "").trim();

  if (!tournamentName) {
    errorBox.textContent =
      "Tournament Name is required.";
    return;
  }

  if (!yearValue) {
    errorBox.textContent =
      "Tournament Year is required.";
    return;
  }

  if (!startDate || !endDate) {
    errorBox.textContent =
      "Tournament Start Date and End Date are required.";
    return;
  }

  const payload = {
    tournamentName,
    year: Number(yearValue),
    startDate,
    endDate
  };

  const registrationFee =
    String(values.get("registrationFee") || "").trim();

  const minimumAge =
    String(values.get("minimumAge") || "").trim();

  const maximumPlayers =
    String(values.get("maximumPlayers") || "").trim();

  if (registrationFee !== "") {
    payload.registrationFee = Number(registrationFee);
  }

  if (minimumAge !== "") {
    payload.minimumAge = Number(minimumAge);
  }

  if (maximumPlayers !== "") {
    payload.maximumPlayers = Number(maximumPlayers);
  }

  setCreateButtonState(true);

  try {
    const tournament = await adminApi(
      "tournament.create",
      payload
    );

    /*
     * Creation returns the newly-created tournament, but the
     * authoritative detail response now also contains the
     * operational summary. Fetch that complete representation.
     */
    const tournamentId =
      tournament?.tournament_id;

    if (!tournamentId) {
      throw new Error(
        "Tournament was created but no Tournament ID was returned."
      );
    }

    const completeTournament =
      await adminApi("tournament.get", {
        tournamentId
      });

    renderTournamentDetails(completeTournament);

  } catch (error) {
    errorBox.textContent = error.message;
    setCreateButtonState(false);
  }
}

function setCreateButtonState(loading) {
  const button = document.getElementById(
    "submit-create-tournament"
  );

  if (!button) return;

  button.disabled = loading;

  button.textContent = loading
    ? "CREATING..."
    : "CREATE TOURNAMENT";
}

function detailCard(label, value) {
  return `
    <article class="ktms-detail-card">

      <span>
        ${escapeHtml(label)}
      </span>

      <strong>
        ${escapeHtml(value ?? "—")}
      </strong>

    </article>
  `;
}

function formatDate(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleDateString(
    undefined,
    {
      year: "numeric",
      month: "short",
      day: "numeric"
    }
  );
}

function formatDateTime(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString(
    undefined,
    {
      dateStyle: "medium",
      timeStyle: "short"
    }
  );
}

function formatAmount(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "—";
  }

  const number = Number(value);

  if (!Number.isFinite(number)) {
    return String(value);
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
