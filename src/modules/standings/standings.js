import { adminApi } from "../../api/admin-api.js";

const state = {
  tournaments: [],
  selectedTournamentId: "",
  overall: [],
  groups: [],
  selectedGroupId: "",
  view: "overall",
  loading: false,
  error: ""
};

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function arrayFrom(data, keys = []) {
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

function groupId(row) {
  return (
    row?.group_id ??
    row?.groupId ??
    row?.id ??
    ""
  );
}

function groupName(row) {
  return (
    row?.group_name ??
    row?.groupName ??
    row?.name ??
    groupId(row) ??
    "Group"
  );
}

function playerName(row) {
  return (
    row?.manager_name ??
    row?.player_name ??
    row?.registration_name ??
    row?.squad_name ??
    row?.display_name ??
    row?.registration_id ??
    "Unknown player"
  );
}

function value(row, ...keys) {
  for (const key of keys) {
    if (
      row?.[key] !== undefined &&
      row?.[key] !== null
    ) {
      return row[key];
    }
  }

  return 0;
}

function num(row, ...keys) {
  const n = Number(value(row, ...keys));

  return Number.isFinite(n)
    ? n
    : 0;
}

function normalizeRows(rows, rankKeys = ["rank"]) {
  return rows
    .map((row) => ({
      ...row,

      rank: num(
        row,
        ...rankKeys
      ),

      name: playerName(row),

      registrationId:
        row?.registration_id ??
        row?.registrationId ??
        "",

      played: num(
        row,
        "played",
        "matches_played",
        "played_matches",
        "games_played"
      ),

      wins: num(
        row,
        "wins",
        "matches_won",
        "won"
      ),

      losses: num(
        row,
        "losses",
        "matches_lost",
        "lost"
      ),

      points: num(
        row,
        "points",
        "total_points"
      ),

      goalsScored: num(
        row,
        "goals_scored",
        "goalsFor",
        "goals_for"
      ),

      goalsConceded: num(
        row,
        "goals_conceded",
        "goalsAgainst",
        "goals_against"
      ),

      goalDifference: num(
        row,
        "goal_difference",
        "goalDifference",
        "goal_diff"
      ),

      performance: num(
        row,
        "performance_score",
        "performance",
        "performanceScore"
      ),

      status:
        row?.qualification_status ??
        row?.status ??
        ""
    }))
    .sort(
      (a, b) =>
        a.rank - b.rank ||
        b.points - a.points ||
        b.goalDifference -
          a.goalDifference
    );
}

function normalizeGroups(data) {
  const source = arrayFrom(
    data,
    [
      "groups",
      "groupStandings",
      "data"
    ]
  );

  return source
    .map((item) => ({
      id: groupId(item),

      name: groupName(item),

      status:
        item?.group_status ??
        item?.groupStatus ??
        "",

      rows: normalizeRows(
        arrayFrom(
          item,
          [
            "standings",
            "leaderboard",
            "rows",
            "players"
          ]
        ),
        [
          "rank",
          "group_rank"
        ]
      )
    }))
    .filter(
      (group) => group.id
    )
    .sort(
      (a, b) =>
        a.name.localeCompare(
          b.name,
          undefined,
          {
            numeric: true
          }
        )
    );
}

async function loadTournaments() {
  const data = await adminApi(
    "tournament.list",
    {
      status: null
    }
  );

  state.tournaments =
    arrayFrom(
      data,
      [
        "tournaments",
        "data"
      ]
    );

  if (
    !state.selectedTournamentId &&
    state.tournaments.length
  ) {
    state.selectedTournamentId =
      tournamentId(
        state.tournaments[0]
      );
  }
}

async function loadStandings() {
  state.loading = true;
  state.error = "";

  try {
    const [
      groupData,
      overallData
    ] = await Promise.all([
      state.selectedTournamentId
        ? adminApi(
            "standings.list",
            {
              tournamentId:
                state.selectedTournamentId
            }
          )
        : Promise.resolve([]),

      adminApi(
        "standings.list"
      )
    ]);

    state.groups =
      normalizeGroups(
        groupData
      );

    const overallRows =
      arrayFrom(
        overallData,
        [
          "standings",
          "leaderboard",
          "data"
        ]
      );

    state.overall =
      normalizeRows(
        overallRows
      ).filter((row) => {
        if (
          !state.selectedTournamentId
        ) {
          return true;
        }

        const id =
          tournamentId(row);

        return (
          !id ||
          id ===
            state.selectedTournamentId
        );
      });

    if (
      !state.selectedGroupId ||
      !state.groups.some(
        (group) =>
          group.id ===
          state.selectedGroupId
      )
    ) {
      state.selectedGroupId =
        state.groups[0]?.id ||
        "";
    }
  } catch (error) {
    state.error =
      error?.message ||
      "Unable to load standings.";

    state.groups = [];
    state.overall = [];
  } finally {
    state.loading = false;
  }
}

function renderTournamentOptions() {
  return `
    <option value="">
      Select tournament
    </option>

    ${state.tournaments
      .map((row) => {
        const id =
          tournamentId(row);

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
              tournamentName(row)
            )}
          </option>
        `;
      })
      .join("")}
  `;
}

function renderGroupOptions() {
  return `
    <option value="">
      Select group
    </option>

    ${state.groups
      .map(
        (group) => `
          <option
            value="${escapeHtml(
              group.id
            )}"
            ${
              group.id ===
              state.selectedGroupId
                ? "selected"
                : ""
            }
          >
            ${escapeHtml(
              group.name
            )}
          </option>
        `
      )
      .join("")}
  `;
}

function renderTable(rows) {
  if (!rows.length) {
    return `
      <div class="ktms-standings-empty">
        No standings data is available
        for this tournament yet.
      </div>
    `;
  }

  return `
    <div class="ktms-standings-table-wrap">

      <table class="ktms-standings-table">

        <thead>
          <tr>
            <th>Pos</th>
            <th>Player</th>
            <th>MP</th>
            <th>W</th>
            <th>L</th>
            <th>GF</th>
            <th>GA</th>
            <th>GD</th>
            <th>Pts</th>
            <th>Perf.</th>
            <th>Status</th>
          </tr>
        </thead>

        <tbody>

          ${rows
            .map(
              (row) => `
                <tr>

                  <td>
                    <strong>
                      ${escapeHtml(
                        row.rank ||
                          "—"
                      )}
                    </strong>
                  </td>

                  <td>
                    <div
                      class="ktms-standings-player"
                    >
                      ${escapeHtml(
                        row.name
                      )}
                    </div>

                    <div
                      class="ktms-standings-id"
                    >
                      ${escapeHtml(
                        row.registrationId
                      )}
                    </div>
                  </td>

                  <td>
                    ${row.played}
                  </td>

                  <td>
                    ${row.wins}
                  </td>

                  <td>
                    ${row.losses}
                  </td>

                  <td>
                    ${row.goalsScored}
                  </td>

                  <td>
                    ${row.goalsConceded}
                  </td>

                  <td>
                    ${row.goalDifference}
                  </td>

                  <td>
                    <strong>
                      ${row.points}
                    </strong>
                  </td>

                  <td>
                    ${row.performance.toFixed(
                      2
                    )}
                  </td>

                  <td>
                    ${
                      row.status
                        ? `
                          <span
                            class="ktms-standings-status"
                          >
                            ${escapeHtml(
                              row.status
                            )}
                          </span>
                        `
                        : ""
                    }
                  </td>

                </tr>
              `
            )
            .join("")}

        </tbody>

      </table>

    </div>
  `;
}

function renderOverallView() {
  return `
    <div
      class="ktms-standings-rule-note"
    >
      Ranking order:

      <strong>
        Points →
        Goal Difference →
        Goals Scored →
        Goals Conceded →
        Performance Score
      </strong>.

      Registration ID is only the final
      deterministic database tie-breaker;
      it is not a sporting criterion.
    </div>

    ${renderTable(
      state.overall
    )}
  `;
}

function renderGroupView() {
  const group =
    state.groups.find(
      (item) =>
        item.id ===
        state.selectedGroupId
    );

  if (!group) {
    return `
      <div
        class="ktms-standings-empty"
      >
        No group standings are
        available yet.
      </div>
    `;
  }

  return `
    <div
      class="ktms-standings-group-heading"
    >

      <div>
        <h3>
          ${escapeHtml(
            group.name
          )}
        </h3>

        <span>
          ${escapeHtml(
            group.status ||
              "Current group leaderboard"
          )}
        </span>
      </div>

      <div
        class="ktms-standings-group-meta"
      >
        4-player group ·
        Rank 1–2 qualify when
        group is completed
      </div>

    </div>

    ${renderTable(
      group.rows
    )}
  `;
}

function renderGroupOverview() {
  if (!state.groups.length) {
    return `
      <div
        class="ktms-standings-empty"
      >
        No groups have been generated
        for this tournament.
      </div>
    `;
  }

  return `
    <div
      class="ktms-standings-group-grid"
    >

      ${state.groups
        .map(
          (group) => `
            <button
              class="
                ktms-standings-group-card
                ${
                  group.id ===
                  state.selectedGroupId
                    ? "active"
                    : ""
                }
              "
              data-group-id="${escapeHtml(
                group.id
              )}"
            >

              <span>
                ${escapeHtml(
                  group.name
                )}
              </span>

              <strong>
                ${group.rows.length}/4
              </strong>

              <small>
                ${escapeHtml(
                  group.status ||
                    "Pending"
                )}
              </small>

            </button>
          `
        )
        .join("")}

    </div>
  `;
}

function render(content) {
  const selected =
    state.tournaments.find(
      (row) =>
        tournamentId(row) ===
        state.selectedTournamentId
    );

  const name =
    selected
      ? tournamentName(selected)
      : "KT Tournament";

  content.innerHTML = `
    <section
      class="ktms-standings-module"
    >

      <div
        class="ktms-standings-toolbar"
      >

        <div
          class="ktms-standings-controls"
        >

          <label>
            <span>
              Tournament
            </span>

            <select
              id="standings-tournament"
            >
              ${renderTournamentOptions()}
            </select>
          </label>

          ${
            state.view === "group"
              ? `
                <label>
                  <span>
                    Group
                  </span>

                  <select
                    id="standings-group"
                  >
                    ${renderGroupOptions()}
                  </select>
                </label>
              `
              : ""
          }

        </div>

        <button
          id="standings-refresh"
          class="ktms-standings-refresh"
        >
          Refresh
        </button>

      </div>

      ${
        state.error
          ? `
            <div
              class="ktms-standings-error"
            >
              ${escapeHtml(
                state.error
              )}
            </div>
          `
          : ""
      }

      <div
        class="ktms-standings-summary"
      >

        <div>
          <span>
            Tournament
          </span>

          <strong>
            ${escapeHtml(name)}
          </strong>
        </div>

        <div>
          <span>
            Overall Players
          </span>

          <strong>
            ${state.overall.length}
          </strong>
        </div>

        <div>
          <span>
            Groups
          </span>

          <strong>
            ${state.groups.length}
          </strong>
        </div>

        <div>
          <span>
            Mode
          </span>

          <strong>
            View only
          </strong>
        </div>

      </div>

      <div
        class="ktms-standings-tabs"
      >

        <button
          class="${
            state.view === "overall"
              ? "active"
              : ""
          }"
          data-standings-view="overall"
        >
          Overall
        </button>

        <button
          class="${
            state.view === "groups"
              ? "active"
              : ""
          }"
          data-standings-view="groups"
        >
          Groups
        </button>

        <button
          class="${
            state.view === "group"
              ? "active"
              : ""
          }"
          data-standings-view="group"
        >
          Group Table
        </button>

      </div>

      ${
        state.loading
          ? `
            <div
              class="ktms-standings-loading"
            >
              Loading standings...
            </div>
          `
          : ""
      }

      <div
        class="ktms-standings-content"
      >

        ${
          !state.loading &&
          state.view === "overall"
            ? renderOverallView()
            : ""
        }

        ${
          !state.loading &&
          state.view === "groups"
            ? renderGroupOverview()
            : ""
        }

        ${
          !state.loading &&
          state.view === "group"
            ? renderGroupView()
            : ""
        }

      </div>

    </section>
  `;

  bindEvents(content);
}

function bindEvents(content) {
  document
    .getElementById(
      "standings-tournament"
    )
    ?.addEventListener(
      "change",
      async (event) => {
        state.selectedTournamentId =
          event.target.value;

        state.selectedGroupId =
          "";

        await loadStandings();

        render(content);
      }
    );

  document
    .getElementById(
      "standings-group"
    )
    ?.addEventListener(
      "change",
      (event) => {
        state.selectedGroupId =
          event.target.value;

        state.view = "group";

        render(content);
      }
    );

  document
    .getElementById(
      "standings-refresh"
    )
    ?.addEventListener(
      "click",
      async () => {
        await loadStandings();
        render(content);
      }
    );

  document
    .querySelectorAll(
      "[data-standings-view]"
    )
    .forEach((button) => {
      button.addEventListener(
        "click",
        () => {
          state.view =
            button.dataset
              .standingsView;

          render(content);
        }
      );
    });

  document
    .querySelectorAll(
      "[data-group-id]"
    )
    .forEach((button) => {
      button.addEventListener(
        "click",
        () => {
          state.selectedGroupId =
            button.dataset.groupId;

          state.view = "group";

          render(content);
        }
      );
    });
}

export async function renderStandings(
  content
) {
  state.view = "overall";
  state.error = "";

  content.innerHTML = `
    <div
      class="ktms-standings-loading"
    >
      Loading standings...
    </div>
  `;

  try {
    await loadTournaments();
    await loadStandings();

    render(content);
  } catch (error) {
    state.error =
      error?.message ||
      "Unable to load standings.";

    render(content);
  }
}
