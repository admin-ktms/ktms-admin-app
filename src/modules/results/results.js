import { adminApi } from "../../api/admin-api.js";

const state = {
  tournaments: [],
  matchdays: [],
  fixtures: [],
  selectedTournamentId: "",
  selectedMatchdayId: "",
  selectedStatus: "",
  selectedFixtureId: "",
  selectedFixture: null,
  selectedResult: null,
  selectedDispute: null,
  loading: false,
  detailLoading: false
};

const STATUS_OPTIONS = [
  "",
  "Result Submitted",
  "Awaiting Verification",
  "Disputed",
  "Official",
  "Walkover"
];

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function normalize(value) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replaceAll("_", " ");
}

function statusLabel(value) {
  const text = normalize(value);

  if (!text) {
    return "Unknown";
  }

  return text
    .split(" ")
    .map(
      (word) =>
        word.charAt(0).toUpperCase() +
        word.slice(1)
    )
    .join(" ");
}

function statusClass(value) {
  const status = normalize(value);

  if (status === "official") {
    return "ktms-results-status-success";
  }

  if (status === "walkover") {
    return "ktms-results-status-warning";
  }

  if (
    status === "disputed" ||
    status === "conflict" ||
    status === "admin review"
  ) {
    return "ktms-results-status-danger";
  }

  if (
    status === "result submitted" ||
    status === "awaiting verification"
  ) {
    return "ktms-results-status-warning";
  }

  return "ktms-results-status-neutral";
}

function getTournamentId(tournament) {
  return (
    tournament?.tournament_id ||
    tournament?.id ||
    ""
  );
}

function getTournamentName(tournament) {
  return (
    tournament?.tournament_name ||
    tournament?.name ||
    getTournamentId(tournament) ||
    "Tournament"
  );
}

function getFixtureId(fixture) {
  return (
    fixture?.fixture_id ||
    fixture?.id ||
    ""
  );
}

function getMatchCode(fixture) {
  return (
    fixture?.match_code ||
    fixture?.matchCode ||
    getFixtureId(fixture) ||
    "Fixture"
  );
}

function getFixtureStatus(fixture) {
  return (
    fixture?.fixture_status ||
    fixture?.status ||
    ""
  );
}

function getFixtureStage(fixture) {
  return (
    fixture?.round_name ||
    fixture?.tournament_stage ||
    "Tournament"
  );
}

function getPlayerNameFromFixture(
  fixture,
  side
) {
  const direct =
    fixture?.[
      `registration_${side}_name`
    ];

  if (direct) {
    return direct;
  }

  const registration =
    fixture?.[
      `registration_${side}`
    ];

  if (
    registration &&
    typeof registration === "object"
  ) {
    return (
      registration.manager_name ||
      registration.player_name ||
      registration.squad_name ||
      registration.registration_id ||
      "Unknown"
    );
  }

  return (
    fixture?.[
      `registration_${side}_manager_name`
    ] ||
    fixture?.[
      `registration_${side}_squad_name`
    ] ||
    fixture?.[
      `registration_${side}_id`
    ] ||
    `Player ${side.toUpperCase()}`
  );
}

function getPlayerNameFromResult(
  result,
  side
) {
  const direct =
    result?.[
      `registration_${side}_name`
    ];

  if (direct) {
    return direct;
  }

  const registration =
    result?.[
      `registration_${side}`
    ];

  if (
    registration &&
    typeof registration === "object"
  ) {
    return (
      registration.manager_name ||
      registration.player_name ||
      registration.squad_name ||
      registration.registration_id ||
      "Unknown"
    );
  }

  return (
    result?.[
      `registration_${side}_manager_name`
    ] ||
    result?.[
      `registration_${side}_squad_name`
    ] ||
    result?.[
      `registration_${side}_id`
    ] ||
    `Player ${side.toUpperCase()}`
  );
}

function getFullTimeScore(result, side) {
  const value =
    result?.[
      `registration_${side}_fulltime_goals`
    ];

  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "—";
  }

  return String(value);
}

function getPenaltyScore(result, side) {
  const value =
    result?.[
      `registration_${side}_penalty_goals`
    ];

  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return 0;
  }

  return Number(value) || 0;
}

function getScoreDisplay(result, side) {
  const fullTime =
    getFullTimeScore(result, side);

  const penalty =
    getPenaltyScore(result, side);

  if (fullTime === "—") {
    return "—";
  }

  if (penalty > 0) {
    return `${fullTime} (${penalty})`;
  }

  return fullTime;
}

function getResultStatus(
  result,
  fixture
) {
  if (
    result?.disputed === true ||
    result?.dispute_status === "Admin Review" ||
    result?.dispute_status === "Open"
  ) {
    return "Disputed";
  }

  if (
    fixture?.fixture_status === "Official" ||
    result?.result_locked === true ||
    result?.verified_datetime
  ) {
    return "Official";
  }

  if (
    fixture?.fixture_status === "Walkover" ||
    result?.result_type === "Walkover"
  ) {
    return "Walkover";
  }

  if (
    fixture?.fixture_status ===
      "Awaiting Verification" ||
    result?.submission_datetime
  ) {
    return "Awaiting Verification";
  }

  if (
    fixture?.fixture_status ===
    "Result Submitted"
  ) {
    return "Result Submitted";
  }

  return "Pending";
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

function formatDate(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleDateString(
    undefined,
    {
      dateStyle: "medium"
    }
  );
}

function extractArray(data, keys = []) {
  if (Array.isArray(data)) {
    return data;
  }

  for (const key of keys) {
    if (Array.isArray(data?.[key])) {
      return data[key];
    }
  }

  return [];
}

async function loadTournaments() {
  const data = await adminApi(
    "tournament.list",
    {
      status: null
    }
  );

  state.tournaments =
    extractArray(data, [
      "tournaments",
      "data"
    ]);
}

async function loadMatchdays() {
  state.matchdays = [];

  if (!state.selectedTournamentId) {
    return;
  }

  const data = await adminApi(
    "matchday.list",
    {
      tournamentId:
        state.selectedTournamentId
    }
  );

  const rows = extractArray(data, [
    "matchdays",
    "data"
  ]);

  state.matchdays = rows
    .map((matchday) => ({
      matchdayId:
        matchday.matchdayId ??
        matchday.matchday_id ??
        "",

      tournamentId:
        matchday.tournamentId ??
        matchday.tournament_id ??
        "",

      matchdayNumber:
        matchday.matchdayNumber ??
        matchday.matchday_number ??
        null,

      matchdayName:
        matchday.matchdayName ??
        matchday.matchday_name ??
        "",

      matchdayDate:
        matchday.matchdayDate ??
        matchday.matchday_date ??
        null,

      startTime:
        matchday.startTime ??
        matchday.start_time ??
        null,

      endTime:
        matchday.endTime ??
        matchday.end_time ??
        null,

      stage:
        matchday.stage ??
        "",

      matchdayStatus:
        matchday.matchdayStatus ??
        matchday.matchday_status ??
        ""
    }))
    .filter(
      (matchday) =>
        matchday.matchdayId
    )
    .sort(
      (a, b) =>
        Number(a.matchdayNumber || 0) -
        Number(b.matchdayNumber || 0)
    );
}

async function loadFixtures() {
  state.fixtures = [];

  if (!state.selectedTournamentId) {
    return;
  }

  const data = await adminApi(
    "result.list",
    {
      tournamentId:
        state.selectedTournamentId,

      matchdayId:
        state.selectedMatchdayId ||
        null,

      fixtureStatus: null,

      tournamentStage: null,

      roundName: null,

      isRescheduled: null
    }
  );

  state.fixtures =
    extractArray(data, [
      "fixtures",
      "results",
      "data"
    ]);
}

async function loadResultDetail(
  fixtureId
) {
  state.detailLoading = true;

  const [
    resultData,
    disputeData
  ] = await Promise.all([
    adminApi(
      "result.get",
      {
        fixtureId
      }
    ),
    adminApi(
      "result.dispute.get",
      {
        fixtureId
      }
    ).catch(() => null)
  ]);

  state.selectedResult =
    resultData?.result ||
    resultData ||
    null;

  state.selectedDispute =
    disputeData?.dispute ||
    disputeData ||
    null;

  state.selectedFixtureId =
    fixtureId;

  state.detailLoading = false;
}

function getFilteredFixtures() {
  return state.fixtures.filter(
    (fixture) => {
      if (!state.selectedStatus) {
        return true;
      }

      const status =
        fixture?.result_status ||
        fixture?.resultStatus ||
        fixture?.fixture_status ||
        fixture?.status ||
        "";

      return (
        normalize(status) ===
        normalize(state.selectedStatus)
      );
    }
  );
}

function renderTournamentOptions() {
  return `
    <option value="">
      Select tournament
    </option>

    ${state.tournaments
      .map((tournament) => {
        const id =
          getTournamentId(tournament);

        if (!id) {
          return "";
        }

        return `
          <option
            value="${escapeHtml(id)}"
            ${
              id ===
              state.selectedTournamentId
                ? "selected"
                : ""
            }
          >
            ${escapeHtml(
              getTournamentName(tournament)
            )}
            ${
              tournament.tournament_edition
                ? ` — ${escapeHtml(
                    tournament.tournament_edition
                  )}`
                : ""
            }
          </option>
        `;
      })
      .join("")}
  `;
}

function renderMatchdayOptions() {
  return `
    <option value="">
      All matchdays
    </option>

    ${state.matchdays
      .map((matchday) => {
        const id =
          matchday.matchdayId || "";

        const number =
          matchday.matchdayNumber ?? "";

        const name =
          matchday.matchdayName ||
          `Matchday ${number}`;

        return `
          <option
            value="${escapeHtml(id)}"
            ${
              id ===
              state.selectedMatchdayId
                ? "selected"
                : ""
            }
          >
            MD${escapeHtml(number)}
            — ${escapeHtml(name)}
          </option>
        `;
      })
      .join("")}
  `;
}

function renderStatusOptions() {
  return STATUS_OPTIONS
    .map(
      (status) => `
        <option
          value="${escapeHtml(status)}"
          ${
            status ===
            state.selectedStatus
              ? "selected"
              : ""
          }
        >
          ${
            status
              ? escapeHtml(status)
              : "All statuses"
          }
        </option>
      `
    )
    .join("");
}

function renderSummary() {
  const fixtures =
    state.fixtures;

  const counts = {
    total: fixtures.length,
    submitted: 0,
    awaiting: 0,
    disputed: 0,
    official: 0,
    walkover: 0
  };

  fixtures.forEach((fixture) => {
    const status = normalize(
      fixture?.fixture_status ||
        fixture?.result_status ||
        fixture?.status
    );

    if (status === "result submitted") {
      counts.submitted += 1;
    }

    if (
      status === "awaiting verification"
    ) {
      counts.awaiting += 1;
    }

    if (
      status === "disputed" ||
      status === "admin review" ||
      fixture?.dispute_status
    ) {
      counts.disputed += 1;
    }

    if (status === "official") {
      counts.official += 1;
    }

    if (status === "walkover") {
      counts.walkover += 1;
    }
  });

  return `
    <div class="ktms-results-summary-grid">

      <div class="ktms-results-summary-card">
        <span>Total</span>
        <strong>${counts.total}</strong>
      </div>

      <div class="ktms-results-summary-card">
        <span>Submitted</span>
        <strong>${counts.submitted}</strong>
      </div>

      <div class="ktms-results-summary-card">
        <span>Awaiting</span>
        <strong>${counts.awaiting}</strong>
      </div>

      <div class="ktms-results-summary-card">
        <span>Disputed</span>
        <strong>${counts.disputed}</strong>
      </div>

      <div class="ktms-results-summary-card">
        <span>Official</span>
        <strong>${counts.official}</strong>
      </div>

      <div class="ktms-results-summary-card">
        <span>Walkover</span>
        <strong>${counts.walkover}</strong>
      </div>

    </div>
  `;
}

function renderEmptyState() {
  return `
    <div class="ktms-results-empty">

      <div class="ktms-results-empty-icon">
        RESULTS
      </div>

      <strong>No results found</strong>

      <span>
        Select a tournament to load its
        fixture result queue.
      </span>

    </div>
  `;
}

function renderFixtureCard(fixture) {
  const fixtureId =
    getFixtureId(fixture);

  const matchCode =
    getMatchCode(fixture);

  const status =
    fixture?.result_status ||
    fixture?.resultStatus ||
    getFixtureStatus(fixture) ||
    "Pending";

  const playerA =
    getPlayerNameFromFixture(
      fixture,
      "a"
    );

  const playerB =
    getPlayerNameFromFixture(
      fixture,
      "b"
    );

  const scoreA =
    fixture?.registration_a_fulltime_goals ??
    fixture?.score_a ??
    null;

  const scoreB =
    fixture?.registration_b_fulltime_goals ??
    fixture?.score_b ??
    null;

  const hasScore =
    scoreA !== null &&
    scoreA !== undefined &&
    scoreB !== null &&
    scoreB !== undefined;

  const matchday =
    fixture?.matchday_name ||
    fixture?.matchday_id ||
    "Matchday";

  return `
    <article
      class="ktms-results-fixture-card"
      data-fixture-card="${escapeHtml(
        fixtureId
      )}"
    >

      <div class="ktms-results-fixture-top">

        <div>
          <span class="ktms-results-kicker">
            ${escapeHtml(
              getFixtureStage(fixture)
            )}
          </span>

          <h3>
            ${escapeHtml(matchCode)}
          </h3>
        </div>

        <span
          class="ktms-results-status ${statusClass(
            status
          )}"
        >
          ${escapeHtml(
            statusLabel(status)
          )}
        </span>

      </div>

      <div class="ktms-results-fixture-match">

        <div class="ktms-results-team">
          <span>PLAYER A</span>

          <strong>
            ${escapeHtml(playerA)}
          </strong>
        </div>

        <div class="ktms-results-fixture-score">

          <strong>
            ${
              hasScore
                ? `${escapeHtml(
                    scoreA
                  )} – ${escapeHtml(
                    scoreB
                  )}`
                : "—"
            }
          </strong>

        </div>

        <div class="ktms-results-team ktms-results-team-right">
          <span>PLAYER B</span>

          <strong>
            ${escapeHtml(playerB)}
          </strong>
        </div>

      </div>

      <div class="ktms-results-fixture-bottom">

        <span>
          ${escapeHtml(matchday)}
        </span>

        <button
          type="button"
          class="ktms-button ktms-button-secondary"
          data-result-view="${escapeHtml(
            fixtureId
          )}"
        >
          VIEW RESULT
        </button>

      </div>

    </article>
  `;
}

function renderFixtureList() {
  const fixtures =
    getFilteredFixtures();

  if (!fixtures.length) {
    return renderEmptyState();
  }

  return `
    <div class="ktms-results-fixture-list">
      ${fixtures
        .map(renderFixtureCard)
        .join("")}
    </div>
  `;
}

function renderDisputePanel() {
  const dispute =
    state.selectedDispute;

  if (!dispute) {
    return "";
  }

  const status =
    dispute.dispute_status ||
    dispute.status ||
    "";

  const reason =
    dispute.dispute_reason ||
    dispute.reason ||
    "No dispute reason supplied.";

  return `
    <section class="ktms-results-dispute-panel">

      <div class="ktms-results-section-heading">
        <div>
          <span class="ktms-results-kicker">
            DISPUTE
          </span>

          <h3>
            Result dispute
          </h3>
        </div>

        <span
          class="ktms-results-status ${statusClass(
            status
          )}"
        >
          ${escapeHtml(
            statusLabel(status)
          )}
        </span>
      </div>

      <div class="ktms-results-dispute-grid">

        <div>
          <span>DISPUTE ID</span>
          <strong>
            ${escapeHtml(
              dispute.dispute_id ||
                "—"
            )}
          </strong>
        </div>

        <div>
          <span>DISPUTED BY</span>
          <strong>
            ${escapeHtml(
              dispute.disputed_by_registration_id ||
                "—"
            )}
          </strong>
        </div>

        <div>
          <span>CREATED</span>
          <strong>
            ${escapeHtml(
              formatDateTime(
                dispute.created_datetime
              )
            )}
          </strong>
        </div>

      </div>

      <div class="ktms-results-dispute-reason">
        <span>REASON</span>

        <p>
          ${escapeHtml(reason)}
        </p>
      </div>

    </section>
  `;
}

function renderResolutionPanel() {
  const dispute =
    state.selectedDispute;

  if (
    !dispute ||
    normalize(
      dispute.dispute_status
    ) !== "admin review"
  ) {
    return "";
  }

  return `
    <section class="ktms-results-resolution-panel">

      <div class="ktms-results-section-heading">

        <div>
          <span class="ktms-results-kicker">
            ADMIN REVIEW
          </span>

          <h3>
            Resolve result conflict
          </h3>
        </div>

        <span class="ktms-results-status ktms-results-status-danger">
          Action Required
        </span>

      </div>

      <p class="ktms-results-resolution-warning">
        Resolving this conflict can make the
        selected result Official. Confirm the
        final score and resolution reason before
        submitting.
      </p>

      <form id="ktms-result-resolution-form">

        <div class="ktms-results-form-grid">

          <label>
            <span>PLAYER A FULL-TIME</span>

            <input
              type="number"
              min="0"
              step="1"
              name="aFull"
              value="${escapeHtml(
                dispute.registration_a_fulltime_goals ??
                  ""
              )}"
              required
            />
          </label>

          <label>
            <span>PLAYER B FULL-TIME</span>

            <input
              type="number"
              min="0"
              step="1"
              name="bFull"
              value="${escapeHtml(
                dispute.registration_b_fulltime_goals ??
                  ""
              )}"
              required
            />
          </label>

          <label>
            <span>PLAYER A PENALTIES</span>

            <input
              type="number"
              min="0"
              step="1"
              name="aPenalty"
              value="${escapeHtml(
                dispute.registration_a_penalty_goals ??
                  0
              )}"
            />
          </label>

          <label>
            <span>PLAYER B PENALTIES</span>

            <input
              type="number"
              min="0"
              step="1"
              name="bPenalty"
              value="${escapeHtml(
                dispute.registration_b_penalty_goals ??
                  0
              )}"
            />
          </label>

          <label>
            <span>RESULT TYPE</span>

            <select name="resultType" required>
              <option value="Normal">
                Normal
              </option>

              <option value="Walkover">
                Walkover
              </option>

              <option value="Double No-show">
                Double No-show
              </option>

              <option value="Penalty Shootout">
                Penalty Shootout
              </option>
            </select>
          </label>

          <label>
            <span>WINNING METHOD</span>

            <select name="winningMethod">
              <option value="">
                Select method
              </option>

              <option value="Full Time">
                Full Time
              </option>

              <option value="Penalties">
                Penalties
              </option>

              <option value="Walkover">
                Walkover
              </option>

              <option value="Double No-show">
                Double No-show
              </option>
            </select>
          </label>

          <label class="ktms-results-form-full">
            <span>WINNER REGISTRATION ID</span>

            <input
              type="text"
              name="winnerRegistrationId"
              placeholder="Registration ID"
            />
          </label>

          <label class="ktms-results-form-full">
            <span>LOSER REGISTRATION ID</span>

            <input
              type="text"
              name="loserRegistrationId"
              placeholder="Registration ID"
            />
          </label>

          <label class="ktms-results-form-full">
            <span>RESOLUTION REASON</span>

            <textarea
              name="reason"
              rows="4"
              minlength="3"
              required
              placeholder="Explain the administrative resolution."
            ></textarea>
          </label>

        </div>

        <div
          id="ktms-result-resolution-message"
          class="ktms-results-form-message"
          hidden
        ></div>

        <div class="ktms-results-form-actions">

          <button
            type="button"
            class="ktms-button ktms-button-secondary"
            data-result-back
          >
            BACK
          </button>

          <button
            type="submit"
            class="ktms-button ktms-button-primary"
          >
            RESOLVE RESULT
          </button>

        </div>

      </form>

    </section>
  `;
}

function renderResultDetail() {
  if (state.detailLoading) {
    return `
      <section class="ktms-results-detail">
        <div class="ktms-results-loading">
          Loading result details...
        </div>
      </section>
    `;
  }

  if (!state.selectedResult) {
    return `
      <section class="ktms-results-detail">

        <div class="ktms-results-detail-empty">
          <strong>
            No result record
          </strong>

          <span>
            This fixture does not currently
            have an accessible result record.
          </span>
        </div>

      </section>
    `;
  }

  const result =
    state.selectedResult;

  const fixture =
    state.fixtures.find(
      (item) =>
        getFixtureId(item) ===
        state.selectedFixtureId
    ) || {};

  const status =
    getResultStatus(
      result,
      fixture
    );

  const playerA =
    getPlayerNameFromResult(
      result,
      "a"
    );

  const playerB =
    getPlayerNameFromResult(
      result,
      "b"
    );

  const winner =
    result.winner_registration_id;

  const loser =
    result.loser_registration_id;

  return `
    <section class="ktms-results-detail">

      <div class="ktms-results-detail-header">

        <div>
          <span class="ktms-results-kicker">
            RESULT DETAIL
          </span>

          <h2>
            ${escapeHtml(
              result.match_code ||
                fixture.match_code ||
                state.selectedFixtureId
            )}
          </h2>

          <p>
            ${escapeHtml(
              fixture.round_name ||
                fixture.tournament_stage ||
                ""
            )}
          </p>
        </div>

        <span
          class="ktms-results-status ${statusClass(
            status
          )}"
        >
          ${escapeHtml(
            statusLabel(status)
          )}
        </span>

      </div>

      <div class="ktms-results-scoreboard">

        <div class="ktms-results-score-team">

          <span>
            PLAYER A
          </span>

          <strong>
            ${escapeHtml(playerA)}
          </strong>

          <b>
            ${escapeHtml(
              getScoreDisplay(
                result,
                "a"
              )
            )}
          </b>

        </div>

        <div class="ktms-results-score-vs">
          VS
        </div>

        <div class="ktms-results-score-team ktms-results-score-team-right">

          <span>
            PLAYER B
          </span>

          <strong>
            ${escapeHtml(playerB)}
          </strong>

          <b>
            ${escapeHtml(
              getScoreDisplay(
                result,
                "b"
              )
            )}
          </b>

        </div>

      </div>

      <div class="ktms-results-detail-grid">

        <div>
          <span>RESULT TYPE</span>

          <strong>
            ${escapeHtml(
              result.result_type ||
                "—"
            )}
          </strong>
        </div>

        <div>
          <span>WINNING METHOD</span>

          <strong>
            ${escapeHtml(
              result.winning_method ||
                "—"
            )}
          </strong>
        </div>

        <div>
          <span>WINNER</span>

          <strong>
            ${escapeHtml(
              winner || "—"
            )}
          </strong>
        </div>

        <div>
          <span>LOSER</span>

          <strong>
            ${escapeHtml(
              loser || "—"
            )}
          </strong>
        </div>

        <div>
          <span>VERIFIED BY</span>

          <strong>
            ${escapeHtml(
              result.verified_by_admin_id ||
                "—"
            )}
          </strong>
        </div>

        <div>
          <span>VERIFIED</span>

          <strong>
            ${escapeHtml(
              formatDateTime(
                result.verified_datetime
              )
            )}
          </strong>
        </div>

        <div>
          <span>SUBMITTED</span>

          <strong>
            ${escapeHtml(
              formatDateTime(
                result.submission_datetime
              )
            )}
          </strong>
        </div>

        <div>
          <span>FIXTURE ID</span>

          <strong>
            ${escapeHtml(
              state.selectedFixtureId
            )}
          </strong>
        </div>

      </div>

      ${
        state.selectedDispute
          ? renderDisputePanel()
          : ""
      }

      ${
        renderResolutionPanel()
      }

      <div class="ktms-results-detail-actions">

        <button
          type="button"
          class="ktms-button ktms-button-secondary"
          data-result-back
        >
          BACK TO RESULTS
        </button>

        ${
          status === "Awaiting Verification"
            ? `
              <button
                type="button"
                class="ktms-button ktms-button-primary"
                data-result-verify="${escapeHtml(
                  state.selectedFixtureId
                )}"
              >
                VERIFY RESULT
              </button>
            `
            : ""
        }

      </div>

    </section>
  `;
}

function render(container) {
  const fixtures =
    getFilteredFixtures();

  if (state.selectedFixtureId) {
    container.innerHTML = `
      <section class="ktms-module ktms-results-module">

        <div class="ktms-module-header">

          <div>
            <span class="ktms-results-kicker">
              KTMS RESULTS
            </span>

            <h1>
              Match Result
            </h1>

            <p>
              Review the authoritative result,
              dispute state and administrative
              controls.
            </p>
          </div>

        </div>

        ${renderResultDetail()}

      </section>
    `;

    bindEvents(container);
    return;
  }

  container.innerHTML = `
    <section class="ktms-module ktms-results-module">

      <div class="ktms-module-header">

        <div>
          <span class="ktms-results-kicker">
            KTMS RESULTS
          </span>

          <h1>
            Match Results
          </h1>

          <p>
            Monitor submitted, disputed and
            official match results across KT
            tournaments.
          </p>
        </div>

      </div>

      <div class="ktms-results-filters">

        <div class="ktms-result-filter">
          <label
            for="ktms-results-tournament"
          >
            TOURNAMENT
          </label>

          <select
            id="ktms-results-tournament"
          >
            ${renderTournamentOptions()}
          </select>
        </div>

        <div class="ktms-result-filter">
          <label
            for="ktms-results-matchday"
          >
            MATCHDAY
          </label>

          <select
            id="ktms-results-matchday"
            ${
              state.selectedTournamentId
                ? ""
                : "disabled"
            }
          >
            ${renderMatchdayOptions()}
          </select>
        </div>

        <div class="ktms-result-filter">
          <label
            for="ktms-results-status"
          >
            RESULT STATUS
          </label>

          <select
            id="ktms-results-status"
          >
            ${renderStatusOptions()}
          </select>
        </div>

      </div>

      ${
        state.selectedTournamentId
          ? renderSummary()
          : ""
      }

      <div class="ktms-results-toolbar">

        <div>
          <strong>
            Results Queue
          </strong>

          <span>
            ${fixtures.length}
            ${
              fixtures.length === 1
                ? "fixture"
                : "fixtures"
            }
          </span>
        </div>

        <button
          type="button"
          id="ktms-results-refresh"
          class="ktms-button ktms-button-secondary"
          ${
            state.selectedTournamentId
              ? ""
              : "disabled"
          }
        >
          REFRESH
        </button>

      </div>

      ${
        state.selectedTournamentId
          ? renderFixtureList()
          : renderEmptyState()
      }

    </section>
  `;

  bindEvents(container);
}

function showFormMessage(
  container,
  message,
  type = "error"
) {
  const element =
    container.querySelector(
      "#ktms-result-resolution-message"
    );

  if (!element) {
    return;
  }

  element.hidden = false;
  element.dataset.type = type;
  element.textContent = message;
}

async function handleResolutionSubmit(
  container,
  form
) {
  const formData =
    new FormData(form);

  const aFull =
    Number(
      formData.get("aFull")
    );

  const bFull =
    Number(
      formData.get("bFull")
    );

  const aPenalty =
    Number(
      formData.get("aPenalty") || 0
    );

  const bPenalty =
    Number(
      formData.get("bPenalty") || 0
    );

  const resultType =
    String(
      formData.get("resultType") || ""
    ).trim();

  const winningMethod =
    String(
      formData.get("winningMethod") || ""
    ).trim();

  const winnerRegistrationId =
    String(
      formData.get(
        "winnerRegistrationId"
      ) || ""
    ).trim();

  const loserRegistrationId =
    String(
      formData.get(
        "loserRegistrationId"
      ) || ""
    ).trim();

  const reason =
    String(
      formData.get("reason") || ""
    ).trim();

  if (
    !Number.isInteger(aFull) ||
    aFull < 0
  ) {
    showFormMessage(
      container,
      "Player A full-time score must be a non-negative integer."
    );
    return;
  }

  if (
    !Number.isInteger(bFull) ||
    bFull < 0
  ) {
    showFormMessage(
      container,
      "Player B full-time score must be a non-negative integer."
    );
    return;
  }

  if (
    !Number.isInteger(aPenalty) ||
    aPenalty < 0
  ) {
    showFormMessage(
      container,
      "Player A penalty score must be a non-negative integer."
    );
    return;
  }

  if (
    !Number.isInteger(bPenalty) ||
    bPenalty < 0
  ) {
    showFormMessage(
      container,
      "Player B penalty score must be a non-negative integer."
    );
    return;
  }

  if (!resultType) {
    showFormMessage(
      container,
      "Result type is required."
    );
    return;
  }

  if (!reason) {
    showFormMessage(
      container,
      "Resolution reason is required."
    );
    return;
  }

  const disputeId =
    state.selectedDispute?.dispute_id;

  if (!disputeId) {
    showFormMessage(
      container,
      "No active dispute was found for this result."
    );
    return;
  }

  const submitButton =
    form.querySelector(
      'button[type="submit"]'
    );

  if (submitButton) {
    submitButton.disabled = true;
    submitButton.textContent =
      "RESOLVING...";
  }

  try {
    await adminApi(
      "result.resolve",
      {
        fixtureId:
          state.selectedFixtureId,

        disputeId,

        aFull,

        bFull,

        aPenalty,

        bPenalty,

        resultType,

        winnerRegistrationId:
          winnerRegistrationId ||
          null,

        loserRegistrationId:
          loserRegistrationId ||
          null,

        winningMethod:
          winningMethod ||
          null,

        reason
      }
    );

    await loadFixtures();

    await loadResultDetail(
      state.selectedFixtureId
    );

    render(container);
  } catch (error) {
    showFormMessage(
      container,
      error?.message ||
        "Unable to resolve result."
    );

    if (submitButton) {
      submitButton.disabled = false;
      submitButton.textContent =
        "RESOLVE RESULT";
    }
  }
}

async function handleVerify(
  container,
  fixtureId
) {
  const result =
    state.selectedResult;

  if (!result) {
    return;
  }

  const aFull =
    Number(
      result.registration_a_fulltime_goals
    );

  const bFull =
    Number(
      result.registration_b_fulltime_goals
    );

  const aPenalty =
    Number(
      result.registration_a_penalty_goals ||
        0
    );

  const bPenalty =
    Number(
      result.registration_b_penalty_goals ||
        0
    );

  if (
    !Number.isInteger(aFull) ||
    !Number.isInteger(bFull)
  ) {
    window.alert(
      "The result does not contain valid full-time scores."
    );
    return;
  }

  const confirmed =
    window.confirm(
      "Verify this result as official?"
    );

  if (!confirmed) {
    return;
  }

  try {
    await adminApi(
      "result.verify",
      {
        fixtureId,

        aFull,

        bFull,

        aPenalty,

        bPenalty,

        resultType:
          result.result_type ||
          "Normal",

        winnerRegistrationId:
          result.winner_registration_id ||
          null,

        loserRegistrationId:
          result.loser_registration_id ||
          null,

        winningMethod:
          result.winning_method ||
          null
      }
    );

    await loadFixtures();

    await loadResultDetail(
      fixtureId
    );

    render(container);
  } catch (error) {
    window.alert(
      error?.message ||
        "Unable to verify result."
    );
  }
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

      state.selectedMatchdayId = "";
      state.selectedStatus = "";
      state.selectedFixtureId = "";
      state.selectedResult = null;
      state.selectedDispute = null;

      try {
        await loadMatchdays();
        await loadFixtures();
        render(container);
      } catch (error) {
        renderError(
          container,
          error
        );
      }
    }
  );

  const matchdaySelect =
    container.querySelector(
      "#ktms-results-matchday"
    );

  matchdaySelect?.addEventListener(
    "change",
    async (event) => {
      state.selectedMatchdayId =
        event.target.value;

      state.selectedFixtureId = "";
      state.selectedResult = null;
      state.selectedDispute = null;

      try {
        await loadFixtures();
        render(container);
      } catch (error) {
        renderError(
          container,
          error
        );
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
      if (
        !state.selectedTournamentId
      ) {
        return;
      }

      refreshButton.disabled = true;
      refreshButton.textContent =
        "REFRESHING...";

      try {
        await loadFixtures();
        render(container);
      } catch (error) {
        renderError(
          container,
          error
        );
      }
    }
  );

  container
    .querySelectorAll(
      "[data-result-view]"
    )
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
            await loadResultDetail(
              fixtureId
            );

            render(container);
          } catch (error) {
            renderError(
              container,
              error
            );
          }
        }
      );
    });

  container
    .querySelectorAll(
      "[data-result-back]"
    )
    .forEach((button) => {
      button.addEventListener(
        "click",
        () => {
          state.selectedFixtureId = "";
          state.selectedResult = null;
          state.selectedDispute = null;

          render(container);
        }
      );
    });

  container
    .querySelectorAll(
      "[data-result-verify]"
    )
    .forEach((button) => {
      button.addEventListener(
        "click",
        async () => {
          await handleVerify(
            container,
            button.dataset.resultVerify
          );
        }
      );
    });

  const resolutionForm =
    container.querySelector(
      "#ktms-result-resolution-form"
    );

  resolutionForm?.addEventListener(
    "submit",
    async (event) => {
      event.preventDefault();

      await handleResolutionSubmit(
        container,
        resolutionForm
      );
    }
  );
}

function renderError(
  container,
  error
) {
  container.innerHTML = `
    <section class="ktms-module ktms-results-module">

      <div class="ktms-module-header">

        <div>
          <span class="ktms-results-kicker">
            KTMS RESULTS
          </span>

          <h1>
            Match Results
          </h1>
        </div>

      </div>

      <div class="ktms-results-error">

        <strong>
          Unable to load Results
        </strong>

        <p>
          ${escapeHtml(
            error?.message ||
              "An unexpected error occurred."
          )}
        </p>

        <button
          type="button"
          class="ktms-button ktms-button-secondary"
          id="ktms-results-error-retry"
        >
          RETRY
        </button>

      </div>

    </section>
  `;

  container
    .querySelector(
      "#ktms-results-error-retry"
    )
    ?.addEventListener(
      "click",
      () => {
        renderResults(container);
      }
    );
}

export async function renderResults(
  container
) {
  state.loading = true;

  renderLoading(container);

  try {
    await loadTournaments();

    state.loading = false;

    render(container);
  } catch (error) {
    state.loading = false;

    renderError(
      container,
      error
    );
  }
}

function renderLoading(container) {
  container.innerHTML = `
    <section class="ktms-module ktms-results-module">

      <div class="ktms-module-header">

        <div>
          <span class="ktms-results-kicker">
            KTMS RESULTS
          </span>

          <h1>
            Match Results
          </h1>

          <p>
            Loading the KTMS result queue...
          </p>
        </div>

      </div>

      <div class="ktms-results-loading">
        Loading results...
      </div>

    </section>
  `;
}
