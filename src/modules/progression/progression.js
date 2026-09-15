
import { adminApi } from "../../api/admin-api.js";

const state = {
  tournaments: [],
  selectedTournamentId: "",
  data: null,
  loading: false,
  error: ""
};

/* =========================================================
   HELPERS
   ========================================================= */

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function arrayFrom(data, keys = []) {
  if (Array.isArray(data)) return data;

  for (const key of keys) {
    if (Array.isArray(data?.[key])) {
      return data[key];
    }
  }

  return [];
}

function tournamentId(row) {
  return (
    row?.tournament_id ??
    row?.tournamentId ??
    row?.id ??
    ""
  );
}

function tournamentName(row) {
  return (
    row?.tournament_name ??
    row?.tournamentName ??
    tournamentId(row) ??
    "Tournament"
  );
}

function number(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(`${value}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function formatDateTime(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

/* =========================================================
   STATUS / STAGE
   ========================================================= */

function getStage(status) {
  const value = String(status || "").toLowerCase();

  if (value.includes("registration open")) {
    return "Registration";
  }

  if (value.includes("registration closed")) {
    return "Registration Closed";
  }

  if (value.includes("group")) {
    return "Group Stage";
  }

  if (value.includes("playoff")) {
    return "Playoff Stage";
  }

  if (value.includes("knockout")) {
    return "Knockout Stage";
  }

  if (value.includes("completed")) {
    return "Completed";
  }

  if (value.includes("archived")) {
    return "Archived";
  }

  return status || "Not Started";
}

function statusClass(status) {
  const value = String(status || "")
    .toLowerCase()
    .replaceAll(" ", "-");

  return `ktms-progression-status ktms-progression-status-${escapeHtml(
    value || "neutral"
  )}`;
}

/* =========================================================
   DATA NORMALIZATION
   ========================================================= */

function normalize(data) {
  const source = data?.progression ?? data ?? {};

  const tournament = source.tournament ?? {};

  return {
    tournament: {
      id:
        tournament.tournamentId ??
        tournament.tournament_id ??
        "",

      name:
        tournament.tournamentName ??
        tournament.tournament_name ??
        "KT Tournament",

      type:
        tournament.tournamentTypeId ??
        tournament.tournament_type_id ??
        "KT",

      status:
        tournament.status ??
        "",

      startDate:
        tournament.startDate ??
        tournament.tournament_start_date ??
        "",

      endDate:
        tournament.endDate ??
        tournament.tournament_end_date ??
        ""
    },

    matchdays: arrayFrom(source.matchdays),

    groups: arrayFrom(source.groups),

    registrations: arrayFrom(
      source.registrationSummary
    ),

    fixtures: arrayFrom(
      source.fixtureSummary
    )
  };
}

/* =========================================================
   API
   ========================================================= */

async function loadTournaments() {
  const data = await adminApi("tournament.list", {
    status: null
  });

  state.tournaments = arrayFrom(data, [
    "tournaments",
    "data"
  ]);

  if (
    !state.selectedTournamentId &&
    state.tournaments.length
  ) {
    state.selectedTournamentId = tournamentId(
      state.tournaments[0]
    );
  }
}

async function loadProgression() {
  if (!state.selectedTournamentId) {
    state.data = null;
    return;
  }

  state.loading = true;
  state.error = "";

  try {
    const result = await adminApi(
      "progression.list",
      {
        tournamentId:
          state.selectedTournamentId
      }
    );

    state.data = normalize(result);
  } catch (error) {
    state.data = null;

    state.error =
      error?.message ||
      "Unable to load tournament progression.";
  } finally {
    state.loading = false;
  }
}

/* =========================================================
   TOURNAMENT SELECTOR
   ========================================================= */

function renderTournamentOptions() {
  return `
    <option value="">Select tournament</option>

    ${state.tournaments
      .map((row) => {
        const id = tournamentId(row);

        if (!id) {
          return "";
        }

        return `
          <option
            value="${escapeHtml(id)}"
            ${
              id === state.selectedTournamentId
                ? "selected"
                : ""
            }
          >
            ${escapeHtml(
              tournamentName(row)
            )}
          </option>
        `;
      })
      .join("")}
  `;
}

/* =========================================================
   PIPELINE
   ========================================================= */

function renderPipeline(currentStatus) {
  const current = getStage(currentStatus);

  const stages = [
    "Registration",
    "Registration Closed",
    "Group Stage",
    "Playoff Stage",
    "Knockout Stage",
    "Completed",
    "Archived"
  ];

  const currentIndex =
    stages.indexOf(current);

  return `
    <div class="ktms-progression-pipeline">

      ${stages
        .map((stage, index) => {
          let stateClass = "pending";

          if (
            currentIndex >= 0 &&
            index < currentIndex
          ) {
            stateClass = "complete";
          }

          if (index === currentIndex) {
            stateClass = "current";
          }

          return `
            <div
              class="
                ktms-progression-stage
                ${stateClass}
              "
            >
              <span
                class="ktms-progression-stage-index"
              >
                ${index + 1}
              </span>

              <span>
                ${escapeHtml(stage)}
              </span>
            </div>

            ${
              index < stages.length - 1
                ? `
                  <span
                    class="
                      ktms-progression-stage-line
                    "
                  ></span>
                `
                : ""
            }
          `;
        })
        .join("")}

    </div>
  `;
}

/* =========================================================
   SUMMARY
   ========================================================= */

function renderSummary(data) {
  const fixtures =
    data.fixtures.reduce(
      (sum, row) =>
        sum +
        number(
          row.fixtureCount ??
            row.fixture_count
        ),
      0
    );

  const resolved =
    data.fixtures.reduce(
      (sum, row) =>
        sum +
        number(
          row.resolvedFixtureCount ??
            row.resolved_fixture_count
        ),
      0
    );

  const unresolved =
    data.fixtures.reduce(
      (sum, row) =>
        sum +
        number(
          row.unresolvedFixtureCount ??
            row.unresolved_fixture_count
        ),
      0
    );

  const registrations =
    data.registrations.reduce(
      (sum, row) =>
        sum +
        number(
          row.registrationCount ??
            row.registration_count ??
            row.count
        ),
      0
    );

  const groups = data.groups.length;

  return `
    <div class="ktms-progression-summary-grid">

      <div class="ktms-progression-summary-card">
        <span>Current Stage</span>
        <strong>
          ${escapeHtml(
            getStage(
              data.tournament.status
            )
          )}
        </strong>
      </div>

      <div class="ktms-progression-summary-card">
        <span>Registrations</span>
        <strong>${registrations}</strong>
      </div>

      <div class="ktms-progression-summary-card">
        <span>Groups</span>
        <strong>${groups}</strong>
      </div>

      <div class="ktms-progression-summary-card">
        <span>Fixtures</span>
        <strong>${fixtures}</strong>
      </div>

      <div class="ktms-progression-summary-card">
        <span>Resolved</span>
        <strong>${resolved}</strong>
      </div>

      <div class="ktms-progression-summary-card">
        <span>Unresolved</span>
        <strong>${unresolved}</strong>
      </div>

    </div>
  `;
}

/* =========================================================
   MATCHDAYS
   ========================================================= */

function renderMatchdays(matchdays) {
  if (!matchdays.length) {
    return `
      <div class="ktms-progression-empty">
        No matchdays are available.
      </div>
    `;
  }

  return `
    <div class="ktms-progression-matchdays">

      ${matchdays
        .map((row) => {
          const total = number(
            row.fixtureCount ??
              row.fixture_count
          );

          const resolved = number(
            row.resolvedFixtureCount ??
              row.resolved_fixture_count
          );

          const unresolved = number(
            row.unresolvedFixtureCount ??
              row.unresolved_fixture_count
          );

          const status =
            row.status ??
            "Scheduled";

          const matchdayNumber =
            number(
              row.matchdayNumber ??
                row.matchday_number
            );

          const matchdayName =
            row.matchdayName ??
            row.matchday_name ??
            "Matchday";

          const matchdayId =
            row.matchdayId ??
            row.matchday_id ??
            matchdayNumber;

          return `
            <article
              class="
                ktms-progression-matchday
                is-collapsed
              "
              data-matchday-id="${escapeHtml(
                matchdayId
              )}"
            >

              <button
                type="button"
                class="
                  ktms-progression-matchday-toggle
                "
                aria-expanded="false"
                aria-controls="progression-matchday-${escapeHtml(
                  matchdayId
                )}"
              >

                <span
                  class="
                    ktms-progression-matchday-number
                  "
                >
                  ${matchdayNumber}
                </span>

                <span
                  class="
                    ktms-progression-matchday-main
                  "
                >

                  <span
                    class="
                      ktms-progression-matchday-title-row
                    "
                  >

                    <strong>
                      ${escapeHtml(
                        matchdayName
                      )}
                    </strong>

                    <span
                      class="${statusClass(status)}"
                    >
                      ${escapeHtml(status)}
                    </span>

                  </span>

                  <span
                    class="
                      ktms-progression-matchday-summary
                    "
                  >
                    ${total} fixtures
                    ·
                    ${resolved} resolved
                    ·
                    ${unresolved} unresolved
                  </span>

                </span>

                <span
                  class="
                    ktms-progression-matchday-chevron
                  "
                  aria-hidden="true"
                >
                  ›
                </span>

              </button>

              <div
                id="progression-matchday-${escapeHtml(
                  matchdayId
                )}"
                class="
                  ktms-progression-matchday-content
                "
                hidden
              >

                <div
                  class="
                    ktms-progression-matchday-meta
                  "
                >

                  <span>
                    <strong>${total}</strong>
                    fixtures
                  </span>

                  <span>
                    <strong>${resolved}</strong>
                    resolved
                  </span>

                  <span>
                    <strong>${unresolved}</strong>
                    unresolved
                  </span>

                </div>

              </div>

            </article>
          `;
        })
        .join("")}

    </div>
  `;
}

/* =========================================================
   GROUPS
   ========================================================= */

function renderGroups(groups) {
  if (!groups.length) {
    return `
      <div class="ktms-progression-empty">
        Groups have not been generated yet.
      </div>
    `;
  }

  return `
    <div class="ktms-progression-group-grid">

      ${groups
        .map((group) => {
          const name =
            group.groupName ??
            group.group_name ??
            group.name ??
            group.groupId ??
            "Group";

          const players =
            group.playerCount ??
            group.player_count ??
            group.registrationCount ??
            group.registration_count ??
            0;

          const status =
            group.status ??
            group.groupStatus ??
            "Pending";

          return `
            <div
              class="
                ktms-progression-group-card
              "
            >
              <strong>
                ${escapeHtml(name)}
              </strong>

              <span>
                ${number(players)} players
              </span>

              <small>
                ${escapeHtml(status)}
              </small>
            </div>
          `;
        })
        .join("")}

    </div>
  `;
}

/* =========================================================
   TOURNAMENT HEADER
   ========================================================= */

function renderTournamentHeader(data) {
  return `
    <div
      class="
        ktms-progression-header-card
      "
    >

      <div>

        <span
          class="
            ktms-progression-eyebrow
          "
        >
          ${escapeHtml(data.tournament.type)}
          TOURNAMENT
        </span>

        <h3>
          ${escapeHtml(
            data.tournament.name
          )}
        </h3>

        <code>
          ${escapeHtml(
            data.tournament.id
          )}
        </code>

      </div>

      <div
        class="
          ktms-progression-header-status
        "
      >

        <span
          class="${statusClass(
            data.tournament.status
          )}"
        >
          ${escapeHtml(
            data.tournament.status
          )}
        </span>

        <small>
          ${formatDate(
            data.tournament.startDate
          )}
          →
          ${formatDate(
            data.tournament.endDate
          )}
        </small>

      </div>

    </div>
  `;
}

/* =========================================================
   MAIN RENDER
   ========================================================= */

function render(content) {
  const data = state.data;

  content.innerHTML = `
    <section
      class="
        ktms-progression-module
      "
    >

      <div
        class="
          ktms-progression-toolbar
        "
      >

        <div>

          <h2>
            Tournament Progression
          </h2>

          <p>
            Monitor the automated KT tournament
            lifecycle and stage readiness.
          </p>

        </div>

        <div
          class="
            ktms-progression-controls
          "
        >

          <select
            id="progression-tournament"
          >
            ${renderTournamentOptions()}
          </select>

          <button
            id="progression-refresh"
            class="ktms-secondary-button"
            type="button"
          >
            Refresh
          </button>

        </div>

      </div>

      ${
        state.error
          ? `
            <div
              class="
                ktms-progression-error
              "
            >
              ${escapeHtml(state.error)}
            </div>
          `
          : ""
      }

      ${
        state.loading
          ? `
            <div
              class="
                ktms-progression-loading
              "
            >
              Loading progression…
            </div>
          `
          : ""
      }

      ${
        data
          ? `

            ${renderTournamentHeader(data)}

            ${renderPipeline(
              data.tournament.status
            )}

            ${renderSummary(data)}

            <div
              class="
                ktms-progression-section
                ktms-progression-matchday-section
              "
            >
            
              <button
                type="button"
                class="
                  ktms-progression-section-toggle
                "
                aria-expanded="true"
                aria-controls="progression-matchday-progress"
              >
            
                <span
                  class="
                    ktms-progression-section-heading
                  "
                >
            
                  <span>
            
                    <h3>
                      Matchday Progress
                    </h3>
            
                    <p>
                      Fixtures resolve through
                      the KT result workflow.
                    </p>
            
                  </span>
            
                </span>
            
                <span
                  class="
                    ktms-progression-section-chevron
                  "
                  aria-hidden="true"
                >
                  ›
                </span>
            
              </button>
            
              <div
                id="progression-matchday-progress"
                class="
                  ktms-progression-section-content
                "
              >
            
                ${renderMatchdays(
                  data.matchdays
                )}
            
              </div>
            
            </div>

            <div
              class="
                ktms-progression-section
              "
            >

              <div
                class="
                  ktms-progression-section-heading
                "
              >

                <div>

                  <h3>
                    Groups
                  </h3>

                  <p>
                    Group creation and completion
                    are controlled by tournament
                    progression services.
                  </p>

                </div>

              </div>

              ${renderGroups(
                data.groups
              )}

            </div>

            <div
              class="
                ktms-progression-rule-note
              "
            >

              <strong>
                KTMS automation:
              </strong>

              Administrators monitor progression
              here; they do not manually advance
              stages from the browser.

              Official results trigger leaderboard
              recalculation and the controlled
              progression service advances the
              tournament when its completion
              conditions are satisfied.

            </div>

          `
          : !state.loading
            ? `
              <div
                class="
                  ktms-progression-empty
                "
              >
                Select a tournament to view
                its progression.
              </div>
            `
            : ""
      }

    </section>
  `;

  const selector =
    document.getElementById(
      "progression-tournament"
    );

  selector?.addEventListener(
    "change",
    async (event) => {
      state.selectedTournamentId =
        event.target.value;

      await loadProgression();

      render(content);
    }
  );

  const refresh =
    document.getElementById(
      "progression-refresh"
    );

  refresh?.addEventListener(
    "click",
    async () => {
      await loadProgression();

      render(content);
    }
  );

    const matchdaySectionToggle =
    document.querySelector(
      ".ktms-progression-section-toggle"
    );

  const matchdaySectionContent =
    document.getElementById(
      "progression-matchday-progress"
    );

  matchdaySectionToggle?.addEventListener(
    "click",
    () => {
      const expanded =
        matchdaySectionToggle.getAttribute(
          "aria-expanded"
        ) === "true";

      matchdaySectionToggle.setAttribute(
        "aria-expanded",
        String(!expanded)
      );

      matchdaySectionContent.hidden =
        expanded;

      matchdaySectionToggle
        .closest(
          ".ktms-progression-matchday-section"
        )
        ?.classList.toggle(
          "is-collapsed",
          expanded
        );
    }
  );

  content
    .querySelectorAll(
      ".ktms-progression-matchday-toggle"
    )
    .forEach((toggle) => {
      toggle.addEventListener(
        "click",
        () => {
          const matchday =
            toggle.closest(
              ".ktms-progression-matchday"
            );

          const matchdayId =
            toggle.getAttribute(
              "aria-controls"
            );

          const details =
            document.getElementById(
              matchdayId
            );

          const expanded =
            toggle.getAttribute(
              "aria-expanded"
            ) === "true";

          toggle.setAttribute(
            "aria-expanded",
            String(!expanded)
          );

          if (details) {
            details.hidden =
              expanded;
          }

          matchday?.classList.toggle(
            "is-collapsed",
            expanded
          );
        }
      );
    });
}

/* =========================================================
   PUBLIC MODULE ENTRY
   ========================================================= */

export async function renderProgression(
  content
) {
  state.error = "";

  try {
    await loadTournaments();

    await loadProgression();
  } catch (error) {
    state.error =
      error?.message ||
      "Unable to load progression.";
  }

  render(content);
}
