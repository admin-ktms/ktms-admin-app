import { adminApi } from "../../api/admin-api.js";

const state = {
  tournaments: [],
  fixtures: [],
  selectedTournamentId: "",
  selectedMatchdayId: "",
  selectedStatus: "",
  selectedFixtureId: "",
  selectedResult: null,
  loading: false
};

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalizeStatus(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replaceAll("_", " ");
}

function statusLabel(status) {
  const normalized = normalizeStatus(status);

  if (!normalized) return "Unknown";

  return normalized
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

function statusClass(status) {
  const normalized = normalizeStatus(status);

  if (normalized === "official") {
    return "ktms-status-success";
  }

  if (normalized === "walkover") {
    return "ktms-status-warning";
  }

  if (
    normalized === "disputed" ||
    normalized === "conflict"
  ) {
    return "ktms-status-danger";
  }

  if (
    normalized === "awaiting verification" ||
    normalized === "result submitted"
  ) {
    return "ktms-status-warning";
  }

  return "ktms-status-neutral";
}

function getResultStatus(result) {
  if (!result) {
    return "No Result";
  }

  if (result.disputed === true) {
    return "Disputed";
  }

  if (result.result_locked === true) {
    return "Official";
  }

  if (result.verified_datetime) {
    return "Official";
  }

  if (result.submission_datetime) {
    return "Result Submitted";
  }

  return result.result_type || "Pending";
}

function getPlayerName(result, side) {
  const registration =
    result?.[`registration_${side}`] ||
    result?.[`registration${side.toUpperCase()}`];

  if (!registration) {
    return result?.[`registration_${side}_id`] || "Unknown";
  }

  return (
    registration.manager_name ||
    registration.player_name ||
    registration.squad_name ||
    registration.registration_id ||
    "Unknown"
  );
}

function getScore(result, side) {
  const fullTime =
    result?.[`registration_${side}_fulltime_goals`];

  const penalty =
    result?.[`registration_${side}_penalty_goals`];

  if (fullTime === null || fullTime === undefined) {
    return "—";
  }

  if (
    penalty !== null &&
    penalty !== undefined &&
    Number(penalty) > 0
  ) {
    return `${fullTime} (${penalty})`;
  }

  return String(fullTime);
}

function renderLoading(container) {
  container.innerHTML = `
    <section class="ktms-module ktms-results-module">
      <div class="ktms-module-header">
        <div>
          <span class="ktms-results-kicker">RESULTS</span>
          <h1>Match Results</h1>
          <p>Review submitted, disputed and official tournament results.</p>
        </div>
      </div>

      <div class="ktms-results-loading">
        Loading results...
      </div>
    </section>
  `;
}

function renderError(container, error) {
  container.innerHTML = `
    <section class="ktms-module ktms-results-module">
      <div class="ktms-module-header">
        <div>
          <span class="ktms-results-kicker">RESULTS</span>
          <h1>Match Results</h1>
        </div>
      </div>

      <div class="ktms-message" data-type="error">
        ${escapeHtml(error?.message || "Unable to load results.")}
      </div>
    </section>
  `;
}

async function loadTournaments() {
  const data = await adminApi("tournament.list", {
    status: null
  });

  state.tournaments = Array.isArray(data)
    ? data
    : Array.isArray(data?.tournaments)
      ? data.tournaments
      : [];
}

async function loadFixtures() {
  if (!state.selectedTournamentId) {
    state.fixtures = [];
    return;
  }

  const data = await adminApi("fixture.list", {
    tournamentId: state.selectedTournamentId,
    matchdayId: state.selectedMatchdayId || null,
    fixtureStatus: null,
    tournamentStage: null,
    roundName: null,
    isRescheduled: null
  });

  state.fixtures = Array.isArray(data)
    ? data
    : Array.isArray(data?.fixtures)
      ? data.fixtures
      : [];
}

async function loadResult(fixtureId) {
  const data = await adminApi("result.get", {
    fixtureId
  });

  state.selectedResult = data?.result || data || null;
  state.selectedFixtureId = fixtureId;
}

function renderTournamentOptions() {
  return `
    <option value="">Select tournament</option>
    ${state.tournaments
      .map((tournament) => {
        const id =
          tournament.tournament_id ||
          tournament.id ||
          "";

        const label =
          tournament.tournament_name ||
          tournament.name ||
          id;

        return `
          <option
            value="${escapeHtml(id)}"
            ${id === state.selectedTournamentId ? "selected" : ""}
          >
            ${escapeHtml(label)}
          </option>
        `;
      })
      .join("")}
  `;
}

function renderStatusOptions() {
  const statuses = [
    "",
    "Result Submitted",
    "Awaiting Verification",
    "Disputed",
    "Official",
    "Walkover"
  ];

  return statuses
    .map(
      (status) => `
        <option
          value="${escapeHtml(status)}"
          ${status === state.selectedStatus ? "selected" : ""}
        >
          ${escapeHtml(status || "All statuses")}
        </option>
      `
    )
    .join("");
}

function fixtureMatchesStatus(fixture) {
  if (!state.selectedStatus) {
    return true;
  }

  const status =
    fixture.result_status ||
    fixture.resultStatus ||
    fixture.status ||
    "";

  return (
    normalizeStatus(status) ===
    normalizeStatus(state.selectedStatus)
  );
}

function renderFixtureCards() {
  const fixtures = state.fixtures.filter(
    fixtureMatchesStatus
  );

  if (!fixtures.length) {
    return `
      <div class="ktms-results-empty">
        <strong>No results found</strong>
        <span>
          There are no fixtures matching the current Results filters.
        </span>
      </div>
    `;
  }

  return fixtures
    .map((fixture) => {
      const fixtureId =
        fixture.fixture_id ||
        fixture.id ||
        "";

      const matchCode =
        fixture.match_code ||
        fixture.matchCode ||
        fixtureId;

      const resultStatus =
        fixture.result_status ||
        fixture.resultStatus ||
        fixture.result_type ||
        "Pending";

      const playerA =
        fixture.registration_a_name ||
        fixture.registration_a_id ||
        "Player A";

      const playerB =
        fixture.registration_b_name ||
        fixture.registration_b_id ||
        "Player B";

      return `
        <article class="ktms-result-card">
          <div class="ktms-result-card-header">
            <div>
              <span class="ktms-results-kicker">
                ${escapeHtml(fixture.round_name || fixture.tournament_stage || "FIXTURE")}
              </span>

              <h3>${escapeHtml(matchCode)}</h3>
            </div>

            <span class="ktms-result-status ${statusClass(resultStatus)}">
              ${escapeHtml(statusLabel(resultStatus))}
            </span>
          </div>

          <div class="ktms-result-match">
            <div class="ktms-result-player">
              <span>PLAYER A</span>
              <strong>${escapeHtml(playerA)}</strong>
            </div>

            <div class="ktms-result-score">
              <strong>
                ${escapeHtml(
                  fixture.registration_a_fulltime_goals ??
                    fixture.score_a ??
                    "—"
                )}
                -
                ${escapeHtml(
                  fixture.registration_b_fulltime_goals ??
                    fixture.score_b ??
                    "—"
                )}
              </strong>
            </div>

            <div class="ktms-result-player">
              <span>PLAYER B</span>
              <strong>${escapeHtml(playerB)}</strong>
            </div>
          </div>

          <div class="ktms-result-card-footer">
            <span>
              ${escapeHtml(
                fixture.matchday_name ||
                fixture.matchday_id ||
                "Matchday"
              )}
            </span>

            <button
              class="ktms-button ktms-button-secondary"
              data-result-view="${escapeHtml(fixtureId)}"
              type="button"
            >
              VIEW RESULT
            </button>
          </div>
        </article>
      `;
    })
    .join("");
}

function renderResultDetail() {
  if (!state.selectedResult) {
    return "";
  }

  const result = state.selectedResult;

  const status = getResultStatus(result);

  const playerA =
    result.registration_a_name ||
    result.registration_a_manager_name ||
    result.registration_a_id ||
    getPlayerName(result, "a");

  const playerB =
    result.registration_b_name ||
    result.registration_b_manager_name ||
    result.registration_b_id ||
    getPlayerName(result, "b");

  return `
    <section class="ktms-result-detail">
      <div class="ktms-result-detail-header">
        <div>
          <span class="ktms-results-kicker">RESULT DETAIL</span>
          <h2>${escapeHtml(
            result.match_code ||
            result.fixture_id ||
            "Match Result"
          )}</h2>
        </div>

        <span class="ktms-result-status ${statusClass(status)}">
          ${escapeHtml(statusLabel(status))}
        </span>
      </div>

      <div class="ktms-result-detail-match">
        <div class="ktms-result-detail-player">
          <span>PLAYER A</span>
          <strong>${escapeHtml(playerA)}</strong>
          <b>${escapeHtml(getScore(result, "a"))}</b>
        </div>

        <div class="ktms-result-detail-vs">
          VS
        </div>

        <div class="ktms-result-detail-player">
          <span>PLAYER B</span>
          <strong>${escapeHtml(playerB)}</strong>
          <b>${escapeHtml(getScore(result, "b"))}</b>
        </div>
      </div>

      <div class="ktms-result-detail-grid">
        <div>
          <span>RESULT TYPE</span>
          <strong>${escapeHtml(
            result.result_type || "—"
          )}</strong>
        </div>

        <div>
          <span>WINNER</span>
          <strong>${escapeHtml(
            result.winner_registration_id || "—"
          )}</strong>
        </div>

        <div>
          <span>LOSER</span>
          <strong>${escapeHtml(
            result.loser_registration_id || "—"
          )}</strong>
        </div>

        <div>
          <span>WINNING METHOD</span>
          <strong>${escapeHtml(
            result.winning_method || "—"
          )}</strong>
        </div>

        <div>
          <span>VERIFIED BY</span>
          <strong>${escapeHtml(
            result.verified_by_admin_id || "—"
          )}</strong>
        </div>

        <div>
          <span>VERIFIED</span>
          <strong>${escapeHtml(
            result.verified_datetime || "Not verified"
          )}</strong>
        </div>
      </div>

      <div class="ktms-result-detail-notice">
        <strong>RESULT CONTROL</strong>
        <p>
          Result verification and dispute resolution must be
          performed through the controlled KTMS backend workflow.
          The Results module does not directly edit result records.
        </p>
      </div>
    </section>
  `;
}

function render(container) {
  const filteredFixtures = state.fixtures.filter(
    fixtureMatchesStatus
  );

  container.innerHTML = `
    <section class="ktms-module ktms-results-module">

      <div class="ktms-module-header">
        <div>
          <span class="ktms-results-kicker">KTMS RESULTS</span>
          <h1>Match Results</h1>
          <p>
            Monitor result submissions, verification and disputes
            across KT tournaments.
          </p>
        </div>
      </div>

      <div class="ktms-results-filters">

        <div class="ktms-result-filter">
          <label for="ktms-results-tournament">
            TOURNAMENT
          </label>

          <select id="ktms-results-tournament">
            ${renderTournamentOptions()}
          </select>
        </div>

        <div class="ktms-result-filter">
          <label for="ktms-results-status">
            RESULT STATUS
          </label>

          <select id="ktms-results-status">
            ${renderStatusOptions()}
          </select>
        </div>

      </div>

      <div class="ktms-results-toolbar">
        <div>
          <strong>Results Queue</strong>
          <span>
            ${filteredFixtures.length} fixture
            ${filteredFixtures.length === 1 ? "" : "s"}
          </span>
        </div>

        <button
          class="ktms-button ktms-button-secondary"
          id="ktms-results-refresh"
          type="button"
        >
          REFRESH
        </button>
      </div>

      ${
        state.selectedResult
          ? renderResultDetail()
          : `
            <div class="ktms-results-list">
              ${renderFixtureCards()}
            </div>
          `
      }

    </section>
  `;

  bindEvents(container);
}

function bindEvents(container) {
  const tournamentSelect =
    container.querySelector(
      "#ktms-results-tournament"
    );

  tournamentSelect?.addEventListener(
    "change",
    async (event) => {
      state.selectedTournamentId =
        event.target.value;

      state.selectedResult = null;
      state.selectedFixtureId = "";

      try {
        await loadFixtures();
        render(container);
      } catch (error) {
        renderError(container, error);
      }
    }
  );

  const statusSelect =
    container.querySelector(
      "#ktms-results-status"
    );

  statusSelect?.addEventListener(
    "change",
    (event) => {
      state.selectedStatus =
        event.target.value;

      render(container);
    }
  );

  const refreshButton =
    container.querySelector(
      "#ktms-results-refresh"
    );

  refreshButton?.addEventListener(
    "click",
    async () => {
      try {
        await loadFixtures();
        render(container);
      } catch (error) {
        renderError(container, error);
      }
    }
  );

  container
    .querySelectorAll("[data-result-view]")
    .forEach((button) => {
      button.addEventListener(
        "click",
        async () => {
          const fixtureId =
            button.dataset.resultView;

          if (!fixtureId) {
            return;
          }

          try {
            state.loading = true;

            await loadResult(fixtureId);

            render(container);
          } catch (error) {
            renderError(container, error);
          } finally {
            state.loading = false;
          }
        }
      );
    });
}

export async function renderResults(container) {
  renderLoading(container);

  try {
    await loadTournaments();

    if (
      !state.selectedTournamentId &&
      state.tournaments.length
    ) {
      state.selectedTournamentId =
        state.tournaments[0].tournament_id ||
        state.tournaments[0].id ||
        "";
    }

    await loadFixtures();

    render(container);
  } catch (error) {
    renderError(container, error);
  }
}
