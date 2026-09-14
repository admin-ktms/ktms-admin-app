import { adminApi } from "../../api/admin-api.js";

let state = {
  tournaments: [],
  matchdays: [],
  fixtures: [],
  selectedTournamentId: "",
  selectedMatchdayId: "",
  selectedStage: "",
  selectedStatus: "",
  selectedRescheduled: "",
  selectedFixtureId: "",
  loading: false
};

export async function renderFixtures(page) {
  state = {
    tournaments: [],
    matchdays: [],
    fixtures: [],
    selectedTournamentId: "",
    selectedMatchdayId: "",
    selectedStage: "",
    selectedStatus: "",
    selectedRescheduled: "",
    selectedFixtureId: "",
    loading: false
  };

  page.innerHTML = `
    <div class="ktms-module ktms-fixtures-module">

      <div class="ktms-module-toolbar">
        <div>
          <h2>Fixtures</h2>
          <p>
            Manage fixture generation, scheduling and rescheduling through KTMS Core.
          </p>
        </div>

        <button
          id="fixtures-refresh-button"
          class="ktms-secondary-button"
          type="button"
        >
          REFRESH
        </button>
      </div>

      <div
        id="fixtures-message"
        class="ktms-message"
        aria-live="polite"
      ></div>

      <section class="ktms-fixtures-filters">

        <div class="ktms-fixture-filter">
          <label for="fixture-tournament">
            Tournament
          </label>

          <select id="fixture-tournament">
            <option value="">Select tournament</option>
          </select>
        </div>

        <div class="ktms-fixture-filter">
          <label for="fixture-matchday">
            Matchday
          </label>

          <select id="fixture-matchday" disabled>
            <option value="">All matchdays</option>
          </select>
        </div>

        <div class="ktms-fixture-filter">
          <label for="fixture-stage">
            Stage
          </label>

          <select id="fixture-stage">
            <option value="">All stages</option>
            <option value="Group Stage">Group Stage</option>
            <option value="Playoff Stage">Playoff Stage</option>
            <option value="Knockout Stage">Knockout Stage</option>
            <option value="Finals">Finals</option>
          </select>
        </div>

        <div class="ktms-fixture-filter">
          <label for="fixture-status">
            Status
          </label>

          <select id="fixture-status">
            <option value="">All statuses</option>
            <option value="Scheduled">Scheduled</option>
            <option value="Result Submitted">Result Submitted</option>
            <option value="Awaiting Verification">Awaiting Verification</option>
            <option value="Official">Official</option>
            <option value="Walkover">Walkover</option>
          </select>
        </div>

        <div class="ktms-fixture-filter">
          <label for="fixture-rescheduled">
            Rescheduling
          </label>

          <select id="fixture-rescheduled">
            <option value="">All fixtures</option>
            <option value="false">Normal</option>
            <option value="true">Rescheduled</option>
          </select>
        </div>

      </section>

      <section
        id="fixture-operations"
        class="ktms-fixture-operations"
        hidden
      >

        <div class="ktms-fixture-operations-header">
          <div>
            <span class="ktms-fixture-section-kicker">
              ADVANCED CONTROLS
            </span>

            <h3>Fixture Operations</h3>

            <p>
              Administrative fixture operations are executed by KTMS Core.
            </p>
          </div>

          <button
            id="close-fixture-operations"
            class="ktms-secondary-button"
            type="button"
          >
            CLOSE
          </button>
        </div>

        <div class="ktms-fixture-operation-grid">

          <button
            id="generate-group-fixtures"
            class="ktms-primary-button"
            type="button"
          >
            GENERATE GROUP FIXTURES
          </button>

          <button
            id="generate-stage-fixtures"
            class="ktms-secondary-button"
            type="button"
          >
            GENERATE STAGE FIXTURES
          </button>

          <button
            id="schedule-matchday"
            class="ktms-secondary-button"
            type="button"
          >
            SCHEDULE MATCHDAY
          </button>

        </div>

        <div
          id="fixture-operation-message"
          class="ktms-message"
          aria-live="polite"
        ></div>

      </section>

      <div class="ktms-fixture-toolbar">

        <div>
          <strong id="fixture-count">
            0 fixtures
          </strong>

          <span id="fixture-context">
            Select a tournament to begin.
          </span>
        </div>

        <button
          id="open-fixture-operations"
          class="ktms-secondary-button"
          type="button"
        >
          ADVANCED CONTROLS
        </button>

      </div>

      <div id="fixtures-list">
        <div class="ktms-empty-state">
          <h3>Select a tournament</h3>
          <p>
            Choose a tournament above to load its fixtures.
          </p>
        </div>
      </div>

    </div>
  `;

  bindEvents();

  await loadTournaments();
}

function bindEvents() {
  document
    .getElementById("fixtures-refresh-button")
    .addEventListener("click", async () => {
      await refreshFixtures();
    });

  document
    .getElementById("fixture-tournament")
    .addEventListener("change", async (event) => {
      state.selectedTournamentId = event.target.value;
      state.selectedMatchdayId = "";
      state.selectedFixtureId = "";

      await loadMatchdays();
      await loadFixtures();
    });

  document
    .getElementById("fixture-matchday")
    .addEventListener("change", async (event) => {
      state.selectedMatchdayId = event.target.value;
      state.selectedFixtureId = "";

      await loadFixtures();
    });

  document
    .getElementById("fixture-stage")
    .addEventListener("change", async (event) => {
      state.selectedStage = event.target.value;
      await loadFixtures();
    });

  document
    .getElementById("fixture-status")
    .addEventListener("change", async (event) => {
      state.selectedStatus = event.target.value;
      await loadFixtures();
    });

  document
    .getElementById("fixture-rescheduled")
    .addEventListener("change", async (event) => {
      state.selectedRescheduled = event.target.value;
      await loadFixtures();
    });

  document
    .getElementById("open-fixture-operations")
    .addEventListener("click", () => {
      const panel = document.getElementById("fixture-operations");

      if (!panel) {
        return;
      }

      panel.hidden = false;
    });

  document
    .getElementById("close-fixture-operations")
    .addEventListener("click", () => {
      const panel = document.getElementById("fixture-operations");

      if (!panel) {
        return;
      }

      panel.hidden = true;
    });

  document
    .getElementById("generate-group-fixtures")
    .addEventListener("click", async () => {
      await generateGroupFixtures();
    });

  document
    .getElementById("generate-stage-fixtures")
    .addEventListener("click", async () => {
      await generateStageFixtures();
    });

  document
    .getElementById("schedule-matchday")
    .addEventListener("click", async () => {
      await scheduleSelectedMatchday();
    });
}

async function loadTournaments() {
  const tournamentSelect =
    document.getElementById("fixture-tournament");

  if (!tournamentSelect) {
    return;
  }

  tournamentSelect.innerHTML = `
    <option value="">Loading tournaments...</option>
  `;

  try {
    const data = await adminApi("tournament.list", {
      status: null
    });

    state.tournaments = normalizeList(data);

    if (!state.tournaments.length) {
      tournamentSelect.innerHTML = `
        <option value="">No tournaments available</option>
      `;

      return;
    }

    tournamentSelect.innerHTML = `
      <option value="">Select tournament</option>

      ${state.tournaments
        .map((tournament) => `
          <option value="${escapeHtml(tournament.tournament_id)}">
            ${escapeHtml(
              tournament.tournament_id
            )}
            — 
            ${escapeHtml(
              tournament.tournament_name ||
              "Unnamed Tournament"
            )}
          </option>
        `)
        .join("")}
    `;

  } catch (error) {
    tournamentSelect.innerHTML = `
      <option value="">
        Unable to load tournaments
      </option>
    `;

    showMessage(
      error?.message ||
      "Unable to load tournaments.",
      "error"
    );
  }
}

async function loadMatchdays() {
  const matchdaySelect =
    document.getElementById("fixture-matchday");

  if (!matchdaySelect) {
    return;
  }

  if (!state.selectedTournamentId) {
    matchdaySelect.disabled = true;

    matchdaySelect.innerHTML = `
      <option value="">All matchdays</option>
    `;

    return;
  }

  matchdaySelect.disabled = true;

  matchdaySelect.innerHTML = `
    <option value="">Loading matchdays...</option>
  `;

  try {
    const data = await adminApi("matchday.list", {
      tournamentId: state.selectedTournamentId
    });

    state.matchdays = normalizeList(data);

    matchdaySelect.innerHTML = `
      <option value="">All matchdays</option>

      ${state.matchdays
        .map((matchday) => `
          <option value="${escapeHtml(
            matchday.matchday_id
          )}">
            ${escapeHtml(
              matchday.matchday_number ??
              ""
            )}
            — 
            ${escapeHtml(
              matchday.matchday_name ||
              matchday.stage ||
              "Matchday"
            )}
          </option>
        `)
        .join("")}
    `;

    matchdaySelect.disabled = false;

  } catch (error) {
    matchdaySelect.innerHTML = `
      <option value="">
        Unable to load matchdays
      </option>
    `;

    showMessage(
      error?.message ||
      "Unable to load matchdays.",
      "error"
    );
  }
}

async function loadFixtures() {
  const container =
    document.getElementById("fixtures-list");

  if (!container) {
    return;
  }

  if (!state.selectedTournamentId) {
    container.innerHTML = `
      <div class="ktms-empty-state">
        <h3>Select a tournament</h3>
        <p>
          Choose a tournament above to load its fixtures.
        </p>
      </div>
    `;

    updateFixtureSummary(0);
    return;
  }

  state.loading = true;

  container.innerHTML = `
    <div class="ktms-loading-state">
      Loading fixtures...
    </div>
  `;

  clearMessage();

  try {
    const data = await adminApi("fixture.list", {
      tournamentId: state.selectedTournamentId,
      matchdayId:
        state.selectedMatchdayId ||
        null,
      fixtureStatus:
        state.selectedStatus ||
        null,
      tournamentStage:
        state.selectedStage ||
        null,
      roundName: null,
      isRescheduled:
        state.selectedRescheduled === ""
          ? null
          : state.selectedRescheduled === "true"
    });

    state.fixtures = normalizeList(data);

    renderFixturesList();

  } catch (error) {
    state.fixtures = [];

    container.innerHTML = `
      <div class="ktms-error-state">
        <strong>
          Unable to load fixtures
        </strong>

        <p>
          ${escapeHtml(
            error?.message ||
            "An unexpected error occurred."
          )}
        </p>
      </div>
    `;

    updateFixtureSummary(0);

  } finally {
    state.loading = false;
  }
}

function renderFixturesList() {
  const container =
    document.getElementById("fixtures-list");

  if (!container) {
    return;
  }

  updateFixtureSummary(
    state.fixtures.length
  );

  if (!state.fixtures.length) {
    container.innerHTML = `
      <div class="ktms-empty-state">
        <h3>No fixtures found</h3>

        <p>
          No fixtures match the current tournament and filter selection.
        </p>
      </div>
    `;

    return;
  }

  container.innerHTML = `
    <div class="ktms-fixtures-list">

      ${state.fixtures
        .map(renderFixtureCard)
        .join("")}

    </div>
  `;

  container
    .querySelectorAll("[data-fixture-id]")
    .forEach((button) => {
      button.addEventListener(
        "click",
        async () => {
          await openFixture(
            button.dataset.fixtureId
          );
        }
      );
    });
}

function renderFixtureCard(fixture) {
  const fixtureId =
    fixture.fixture_id || "—";

  const matchCode =
    fixture.match_code || "—";

  const status =
    fixture.fixture_status || "Unknown";

  const playerA =
    fixture.registration_a?.manager_name ||
    fixture.registration_a?.player_name ||
    fixture.registration_a_name ||
    fixture.player_a_name ||
    fixture.registration_a_id ||
    "Player A";

  const playerB =
    fixture.registration_b?.manager_name ||
    fixture.registration_b?.player_name ||
    fixture.registration_b_name ||
    fixture.player_b_name ||
    fixture.registration_b_id ||
    "Player B";

  const start =
    fixture.fixture_start_datetime;

  const end =
    fixture.fixture_end_datetime;

  const deadline =
    fixture.result_deadline_datetime;

  const matchday =
    fixture.matchday_number ??
    fixture.matchday?.matchday_number ??
    "—";

  const stage =
    fixture.tournament_stage ||
    "—";

  const round =
    fixture.round_name ||
    "—";

  const rescheduled =
    Boolean(fixture.is_rescheduled);

  return `
    <article class="ktms-fixture-card">

      <div class="ktms-fixture-card-header">

        <div>
          <span class="ktms-fixture-kicker">
            ${escapeHtml(stage)}
          </span>

          <h3>
            ${escapeHtml(round)}
          </h3>
        </div>

        <span
          class="
            ktms-status
            ktms-status-${statusClass(status)}
          "
        >
          ${escapeHtml(status)}
        </span>

      </div>

      <div class="ktms-fixture-card-meta">

        <span>
          MD ${escapeHtml(matchday)}
        </span>

        <span>
          ${escapeHtml(matchCode)}
        </span>

        ${
          rescheduled
            ? `
              <span class="ktms-fixture-rescheduled">
                RESCHEDULED
              </span>
            `
            : ""
        }

      </div>

      <div class="ktms-fixture-versus">

        <div class="ktms-fixture-player">

          <span>
            PLAYER A
          </span>

          <strong>
            ${escapeHtml(playerA)}
          </strong>

        </div>

        <div class="ktms-fixture-vs">
          VS
        </div>

        <div class="ktms-fixture-player">

          <span>
            PLAYER B
          </span>

          <strong>
            ${escapeHtml(playerB)}
          </strong>

        </div>

      </div>

      <div class="ktms-fixture-schedule">

        <div>
          <span>START</span>
          <strong>
            ${formatDateTime(start)}
          </strong>
        </div>

        <div>
          <span>END</span>
          <strong>
            ${formatDateTime(end)}
          </strong>
        </div>

        <div>
          <span>RESULT DEADLINE</span>
          <strong>
            ${formatDateTime(deadline)}
          </strong>
        </div>

      </div>

      <div class="ktms-fixture-card-footer">

        <span class="ktms-fixture-id">
          ${escapeHtml(fixtureId)}
        </span>

        <button
          type="button"
          class="ktms-secondary-button"
          data-fixture-id="${escapeHtml(fixtureId)}"
        >
          VIEW FIXTURE
        </button>

      </div>

    </article>
  `;
}

async function openFixture(fixtureId) {
  state.selectedFixtureId = fixtureId;

  const container =
    document.getElementById("fixtures-list");

  if (!container) {
    return;
  }

  container.innerHTML = `
    <div class="ktms-loading-state">
      Loading fixture...
    </div>
  `;

  try {
    const fixture =
      await adminApi("fixture.get", {
        fixtureId
      });

    renderFixtureDetail(fixture);

  } catch (error) {
    container.innerHTML = `
      <div class="ktms-error-state">

        <strong>
          Unable to load fixture
        </strong>

        <p>
          ${escapeHtml(
            error?.message ||
            "Unable to load fixture."
          )}
        </p>

        <button
          id="fixture-back-button"
          type="button"
          class="ktms-secondary-button"
        >
          BACK TO FIXTURES
        </button>

      </div>
    `;

    document
      .getElementById("fixture-back-button")
      ?.addEventListener(
        "click",
        () => renderFixturesList()
      );
  }
}

function renderFixtureDetail(fixture) {
  const container =
    document.getElementById("fixtures-list");

  if (!container) {
    return;
  }

  const record =
    fixture?.fixture ||
    fixture;

  const playerA =
    fixture?.registrationA ||
    fixture?.registration_a ||
    record?.registration_a ||
    {};

  const playerB =
    fixture?.registrationB ||
    fixture?.registration_b ||
    record?.registration_b ||
    {};

  const matchday =
    fixture?.matchday ||
    record?.matchday ||
    {};

  const group =
    fixture?.group ||
    record?.group ||
    {};

  const status =
    record?.fixture_status ||
    "Unknown";

  const playerAName =
    playerA.manager_name ||
    playerA.player_name ||
    playerA.display_name ||
    playerA.registration_id ||
    record?.registration_a_id ||
    "Player A";

  const playerBName =
    playerB.manager_name ||
    playerB.player_name ||
    playerB.display_name ||
    playerB.registration_id ||
    record?.registration_b_id ||
    "Player B";

  container.innerHTML = `
    <section class="ktms-fixture-detail">

      <div class="ktms-fixture-detail-top">

        <button
          id="fixture-back-button"
          type="button"
          class="ktms-back-button"
        >
          ← FIXTURES
        </button>

        <span
          class="
            ktms-status
            ktms-status-${statusClass(status)}
          "
        >
          ${escapeHtml(status)}
        </span>

      </div>

      <div class="ktms-module-toolbar">

        <div>
          <span class="ktms-fixture-section-kicker">
            ${escapeHtml(
              record?.tournament_stage ||
              "Fixture"
            )}
          </span>

          <h2>
            ${escapeHtml(
              record?.round_name ||
              "Fixture Detail"
            )}
          </h2>

          <p>
            ${escapeHtml(
              record?.fixture_id ||
              "—"
            )}
          </p>
        </div>

        <div class="ktms-fixture-code">
          ${escapeHtml(
            record?.match_code ||
            "—"
          )}
        </div>

      </div>

      <div class="ktms-detail-grid">

        ${detailCard(
          "Fixture ID",
          record?.fixture_id
        )}

        ${detailCard(
          "Match Code",
          record?.match_code
        )}

        ${detailCard(
          "Matchday",
          matchday.matchday_number ||
          record?.matchday_id
        )}

        ${detailCard(
          "Stage",
          record?.tournament_stage
        )}

        ${detailCard(
          "Round",
          record?.round_name
        )}

        ${detailCard(
          "Group",
          group.group_name ||
          group.group_id ||
          record?.group_id ||
          "—"
        )}

        ${detailCard(
          "Match Order",
          record?.match_order
        )}

        ${detailCard(
          "Start",
          formatDateTime(
            record?.fixture_start_datetime
          )
        )}

        ${detailCard(
          "End",
          formatDateTime(
            record?.fixture_end_datetime
          )
        )}

        ${detailCard(
          "Result Deadline",
          formatDateTime(
            record?.result_deadline_datetime
          )
        )}

      </div>

      <div class="ktms-fixture-detail-match">

        <div class="ktms-fixture-detail-player">
          <span>PLAYER A</span>
          <strong>
            ${escapeHtml(playerAName)}
          </strong>
        </div>

        <div class="ktms-fixture-detail-vs">
          VS
        </div>

        <div class="ktms-fixture-detail-player">
          <span>PLAYER B</span>
          <strong>
            ${escapeHtml(playerBName)}
          </strong>
        </div>

      </div>

      ${
        record?.is_rescheduled
          ? `
            <div class="ktms-fixture-notice">
              <strong>RESCHEDULED FIXTURE</strong>

              <p>
                This fixture retains its original Fixture ID and has been
                moved to a recovery Matchday by KTMS Core.
              </p>
            </div>
          `
          : ""
      }

      <section class="ktms-section">

        <div class="ktms-module-toolbar">

          <div>
            <h3>Fixture Operations</h3>

            <p class="ktms-secondary-text">
              All fixture state changes are validated and executed by KTMS Core.
            </p>
          </div>

        </div>

        <div class="ktms-action-row">

          <button
            id="validate-fixture"
            type="button"
            class="ktms-secondary-button"
          >
            VALIDATE
          </button>

          <button
            id="schedule-fixture"
            type="button"
            class="ktms-secondary-button"
          >
            SCHEDULE
          </button>

          <button
            id="reschedule-fixture"
            type="button"
            class="ktms-secondary-button"
          >
            RESCHEDULE
          </button>

        </div>

        <div
          id="fixture-detail-message"
          class="ktms-message"
          aria-live="polite"
        ></div>

      </section>

    </section>
  `;

  document
    .getElementById("fixture-back-button")
    ?.addEventListener(
      "click",
      () => {
        renderFixturesList();
      }
    );

  document
    .getElementById("validate-fixture")
    ?.addEventListener(
      "click",
      async () => {
        await validateFixture(
          record?.fixture_id
        );
      }
    );

  document
    .getElementById("schedule-fixture")
    ?.addEventListener(
      "click",
      async () => {
        await scheduleFixture(
          record
        );
      }
    );

  document
    .getElementById("reschedule-fixture")
    ?.addEventListener(
      "click",
      async () => {
        await rescheduleFixture(
          record
        );
      }
    );
}

async function validateFixture(fixtureId) {
  if (!fixtureId) {
    return;
  }

  const message =
    document.getElementById(
      "fixture-detail-message"
    );

  if (message) {
    message.textContent =
      "Validating fixture...";
  }

  try {
    const result =
      await adminApi("fixture.validate", {
        fixtureId
      });

    if (message) {
      message.textContent =
        validationMessage(result);
    }

  } catch (error) {
    if (message) {
      message.textContent =
        error?.message ||
        "Fixture validation failed.";
    }
  }
}

async function scheduleFixture(fixture) {
  if (!fixture?.fixture_id) {
    return;
  }

  const start =
    fixture.fixture_start_datetime;

  if (!start) {
    showFixtureDetailMessage(
      "This fixture does not have a start time. Use the Matchday scheduling operation first.",
      "error"
    );

    return;
  }

  if (
    !confirm(
      `Schedule fixture ${fixture.fixture_id} using its current fixture window?`
    )
  ) {
    return;
  }

  try {
    await adminApi("fixture.schedule", {
      fixtureId: fixture.fixture_id,
      fixtureStartDatetime: start
    });

    showFixtureDetailMessage(
      "Fixture scheduled successfully.",
      "success"
    );

    await openFixture(
      fixture.fixture_id
    );

  } catch (error) {
    showFixtureDetailMessage(
      error?.message ||
      "Unable to schedule fixture.",
      "error"
    );
  }
}

async function rescheduleFixture(fixture) {
  if (!fixture?.fixture_id) {
    return;
  }

  const recoveryMatchday =
    getRecoveryMatchday(
      fixture.tournament_stage
    );

  if (!recoveryMatchday) {
    showFixtureDetailMessage(
      "This fixture cannot be rescheduled by the KTMS recovery-window rules.",
      "error"
    );

    return;
  }

  if (
    !confirm(
      `Reschedule ${fixture.fixture_id} to the recovery Matchday? The same Fixture ID will be retained.`
    )
  ) {
    return;
  }

  try {
    await adminApi("fixture.reschedule", {
      fixtureId: fixture.fixture_id,
      newMatchdayId:
        recoveryMatchday.matchday_id
    });

    showFixtureDetailMessage(
      `Fixture rescheduled to Matchday ${recoveryMatchday.matchday_number}.`,
      "success"
    );

    await loadFixtures();

  } catch (error) {
    showFixtureDetailMessage(
      error?.message ||
      "Unable to reschedule fixture.",
      "error"
    );
  }
}

function getRecoveryMatchday(stage) {
  const recoveryMap = {
    "Group Stage": 4,
    "Playoff Stage": 6,
    "Knockout Stage": 9
  };

  const recoveryNumber =
    recoveryMap[stage];

  if (!recoveryNumber) {
    return null;
  }

  return state.matchdays.find(
    (matchday) =>
      Number(
        matchday.matchday_number
      ) === recoveryNumber
  ) || null;
}

async function generateGroupFixtures() {
  if (!state.selectedTournamentId) {
    showOperationMessage(
      "Select a tournament first.",
      "error"
    );

    return;
  }

  if (
    !confirm(
      "Generate the complete Group Stage fixture set for this tournament?"
    )
  ) {
    return;
  }

  showOperationMessage(
    "Generating Group Stage fixtures..."
  );

  try {
    const result =
      await adminApi("fixture.generate", {
        tournamentId:
          state.selectedTournamentId,
        mode: "group"
      });

    showOperationMessage(
      operationSuccessMessage(
        result,
        "Group Stage fixtures generated successfully."
      ),
      "success"
    );

    await loadFixtures();

  } catch (error) {
    showOperationMessage(
      error?.message ||
      "Unable to generate Group Stage fixtures.",
      "error"
    );
  }
}

async function generateStageFixtures() {
  if (!state.selectedTournamentId) {
    showOperationMessage(
      "Select a tournament first.",
      "error"
    );

    return;
  }

  if (!state.selectedMatchdayId) {
    showOperationMessage(
      "Select a Matchday before generating stage fixtures.",
      "error"
    );

    return;
  }

  const matchday =
    state.matchdays.find(
      (item) =>
        item.matchday_id ===
        state.selectedMatchdayId
    );

  const stage =
    matchday?.stage ||
    matchday?.tournament_stage;

  const round =
    matchday?.round_name ||
    matchday?.matchday_name;

  if (!stage || !round) {
    showOperationMessage(
      "The selected Matchday does not contain enough stage information.",
      "error"
    );

    return;
  }

  if (
    !confirm(
      `Generate ${round} fixtures for this Matchday?`
    )
  ) {
    return;
  }

  showOperationMessage(
    "Generating stage fixtures..."
  );

  try {
    const result =
      await adminApi("fixture.generate", {
        tournamentId:
          state.selectedTournamentId,
        mode: "stage",
        tournamentStage: stage,
        roundName: round,
        matchdayId:
          state.selectedMatchdayId,
        matchdayIds: [
          state.selectedMatchdayId
        ]
      });

    showOperationMessage(
      operationSuccessMessage(
        result,
        "Stage fixtures generated successfully."
      ),
      "success"
    );

    await loadFixtures();

  } catch (error) {
    showOperationMessage(
      error?.message ||
      "Unable to generate stage fixtures.",
      "error"
    );
  }
}

async function scheduleSelectedMatchday() {
  if (!state.selectedTournamentId) {
    showOperationMessage(
      "Select a tournament first.",
      "error"
    );

    return;
  }

  if (!state.selectedMatchdayId) {
    showOperationMessage(
      "Select a Matchday first.",
      "error"
    );

    return;
  }

  const matchday =
    state.matchdays.find(
      (item) =>
        item.matchday_id ===
        state.selectedMatchdayId
    );

  const number =
    matchday?.matchday_number;

  if (
    !confirm(
      `Schedule all schedulable fixtures for Matchday ${number ?? state.selectedMatchdayId}?`
    )
  ) {
    return;
  }

  showOperationMessage(
    "Scheduling Matchday fixtures..."
  );

  try {
    const result =
      await adminApi("fixture.schedule", {
        mode: "matchday",
        matchdayId:
          state.selectedMatchdayId
      });

    showOperationMessage(
      operationSuccessMessage(
        result,
        "Matchday fixtures scheduled successfully."
      ),
      "success"
    );

    await loadFixtures();

  } catch (error) {
    showOperationMessage(
      error?.message ||
      "Unable to schedule Matchday fixtures.",
      "error"
    );
  }
}

async function refreshFixtures() {
  await loadTournaments();

  if (state.selectedTournamentId) {
    await loadMatchdays();
    await loadFixtures();
  }
}

function updateFixtureSummary(count) {
  const countElement =
    document.getElementById(
      "fixture-count"
    );

  const contextElement =
    document.getElementById(
      "fixture-context"
    );

  if (countElement) {
    countElement.textContent =
      `${count} fixture${count === 1 ? "" : "s"}`;
  }

  if (contextElement) {
    if (!state.selectedTournamentId) {
      contextElement.textContent =
        "Select a tournament to begin.";

      return;
    }

    const tournament =
      state.tournaments.find(
        (item) =>
          item.tournament_id ===
          state.selectedTournamentId
      );

    const matchday =
      state.matchdays.find(
        (item) =>
          item.matchday_id ===
          state.selectedMatchdayId
      );

    contextElement.textContent =
      [
        tournament?.tournament_id,
        matchday
          ? `MD ${matchday.matchday_number}`
          : "All matchdays"
      ]
        .filter(Boolean)
        .join(" · ");
  }
}

function showMessage(text, type = "") {
  const message =
    document.getElementById(
      "fixtures-message"
    );

  if (!message) {
    return;
  }

  message.textContent = text;
  message.dataset.type = type;
}

function clearMessage() {
  const message =
    document.getElementById(
      "fixtures-message"
    );

  if (!message) {
    return;
  }

  message.textContent = "";
  message.dataset.type = "";
}

function showOperationMessage(
  text,
  type = ""
) {
  const message =
    document.getElementById(
      "fixture-operation-message"
    );

  if (!message) {
    return;
  }

  message.textContent = text;
  message.dataset.type = type;
}

function showFixtureDetailMessage(
  text,
  type = ""
) {
  const message =
    document.getElementById(
      "fixture-detail-message"
    );

  if (!message) {
    return;
  }

  message.textContent = text;
  message.dataset.type = type;
}

function normalizeList(data) {
  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data?.items)) {
    return data.items;
  }

  if (Array.isArray(data?.fixtures)) {
    return data.fixtures;
  }

  if (Array.isArray(data?.matchdays)) {
    return data.matchdays;
  }

  if (Array.isArray(data?.tournaments)) {
    return data.tournaments;
  }

  return [];
}

function operationSuccessMessage(
  result,
  fallback
) {
  if (typeof result === "string") {
    return result;
  }

  return (
    result?.message ||
    result?.summary ||
    fallback
  );
}

function validationMessage(result) {
  if (!result) {
    return "Fixture validation completed.";
  }

  if (result.valid === true) {
    return (
      result.message ||
      "Fixture validation passed."
    );
  }

  if (result.valid === false) {
    return (
      result.message ||
      result.error ||
      "Fixture validation failed."
    );
  }

  return (
    result.message ||
    "Fixture validation completed."
  );
}

function detailCard(label, value) {
  return `
    <article class="ktms-detail-card">

      <span>
        ${escapeHtml(label)}
      </span>

      <strong>
        ${escapeHtml(
          value === null ||
          value === undefined ||
          value === ""
            ? "—"
            : value
        )}
      </strong>

    </article>
  `;
}

function formatDateTime(value) {
  if (!value) {
    return "—";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return String(value);
  }

  return new Intl.DateTimeFormat(
    undefined,
    {
      dateStyle: "medium",
      timeStyle: "short"
    }
  ).format(date);
}

function statusClass(status) {
  return String(status || "")
    .toLowerCase()
    .replaceAll(" ", "-")
    .replaceAll("_", "-")
    .replaceAll("/", "-")
    .replace(/[^a-z0-9-]/g, "");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
