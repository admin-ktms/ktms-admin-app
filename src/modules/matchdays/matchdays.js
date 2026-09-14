import { adminApi } from "../../api/admin-api.js";

const RECOVERY_MATCHDAYS = new Set([4, 6, 9]);

let matchdayState = {
  tournaments: [],
  matchdays: [],
  selectedTournamentId: "",
  selectedMatchdayId: "",
  summary: null,
  current: null,
  matchdaysVisible: false
};

/* =========================================================
   RENDER
   ========================================================= */

export async function renderMatchdays(page) {
  page.innerHTML = `
    <div class="ktms-matchday-module">

      <div class="ktms-module-toolbar">

        <div>
          <h1>Matchdays</h1>

          <p>
            KT tournament matchday overview, lifecycle status,
            validation and controlled operational intervention.
          </p>
        </div>

        <button
          type="button"
          class="ktms-secondary-button"
          id="matchday-refresh"
        >
          REFRESH
        </button>

      </div>

      <div
        id="matchday-message"
        class="ktms-message"
        hidden
      ></div>

      <section class="ktms-section">

        <div class="ktms-section-header">

          <div>
            <h2 class="ktms-section-title">
              Tournament
            </h2>

            <p class="ktms-section-subtitle">
              Select a KT tournament to monitor its
              12-matchday lifecycle.
            </p>
          </div>

        </div>

        <div class="ktms-matchday-tournament-selector">

          <label for="matchday-tournament">
            Tournament
          </label>

          <select id="matchday-tournament">

            <option value="">
              Select a tournament
            </option>

          </select>

        </div>

      </section>

      <div id="matchday-content">

        <div class="ktms-empty-state">

          <strong>
            Select a tournament
          </strong>

          <p>
            Choose a KT tournament above to view
            its Matchday overview.
          </p>

        </div>

      </div>

    </div>
  `;

  bindRefresh();

  await loadTournaments();
}

/* =========================================================
   TOURNAMENTS
   ========================================================= */

async function loadTournaments() {
  try {
    clearMessage();

    const result =
      await adminApi(
        "tournament.list",
        {
          status: null
        }
      );

    matchdayState.tournaments =
      normalizeTournaments(result);

    renderTournamentOptions();

  } catch (error) {

    showMessage(
      error?.message ||
        "Unable to load tournaments.",
      "error"
    );
  }
}

function normalizeTournaments(result) {
  const rows =
    result?.data ||
    result?.tournaments ||
    result?.items ||
    result ||
    [];

  if (!Array.isArray(rows)) {
    return [];
  }

  return rows
    .map((row) => ({
      tournamentId: String(
        row.tournamentId ??
        row.tournament_id ??
        row.id ??
        ""
      ),

      tournamentName: String(
        row.tournamentName ??
        row.tournament_name ??
        row.name ??
        row.tournamentId ??
        row.tournament_id ??
        ""
      )
    }))
    .filter(
      (row) =>
        row.tournamentId
    );
}

function renderTournamentOptions() {
  const selector =
    document.getElementById(
      "matchday-tournament"
    );

  if (!selector) {
    return;
  }

  selector.innerHTML = `
    <option value="">
      Select a tournament
    </option>

    ${matchdayState.tournaments
      .map(
        (tournament) => `
          <option
            value="${escapeAttribute(
              tournament.tournamentId
            )}"
          >
            ${escapeHtml(
              tournament.tournamentId
            )}
            —
            ${escapeHtml(
              tournament.tournamentName
            )}
          </option>
        `
      )
      .join("")}
  `;

  selector.value =
    matchdayState.selectedTournamentId;

  selector.onchange =
    async () => {

      matchdayState.selectedTournamentId =
        selector.value;

      matchdayState.selectedMatchdayId =
        "";

      matchdayState.summary =
        null;

      matchdayState.current =
        null;

      matchdayState.matchdaysVisible =
        false;

      if (!selector.value) {
        renderEmptyTournamentState();
        return;
      }

      await loadMatchdays();
    };
}

/* =========================================================
   MATCHDAY DATA
   ========================================================= */

async function loadMatchdays() {
  const tournamentId =
    matchdayState.selectedTournamentId;

  if (!tournamentId) {
    renderEmptyTournamentState();
    return;
  }

  const content =
    document.getElementById(
      "matchday-content"
    );

  if (!content) {
    return;
  }

  content.innerHTML = `
    <div class="ktms-loading-state">
      Loading Matchday overview...
    </div>
  `;

  clearMessage();

  try {

    const [
      listResult,
      summaryResult,
      currentResult
    ] =
      await Promise.all([
        adminApi(
          "matchday.list",
          {
            tournamentId
          }
        ),

        adminApi(
          "matchday.summary",
          {
            tournamentId
          }
        ),

        adminApi(
          "matchday.current",
          {
            tournamentId
          }
        )
      ]);

    matchdayState.matchdays =
      normalizeMatchdays(
        listResult
      );

    matchdayState.summary =
      normalizeSummary(
        summaryResult
      );

    matchdayState.current =
      normalizeCurrent(
        currentResult
      );

    renderMatchdayDashboard();

  } catch (error) {

    content.innerHTML = `
      <div class="ktms-error-state">

        <strong>
          Unable to load matchdays.
        </strong>

        <p>
          ${escapeHtml(
            error?.message ||
              "KTMS could not load matchday data."
          )}
        </p>

      </div>
    `;
  }
}

/* =========================================================
   OVERVIEW
   ========================================================= */

function renderMatchdayDashboard() {
  const content =
    document.getElementById(
      "matchday-content"
    );

  if (!content) {
    return;
  }

  const tournament =
    matchdayState.tournaments.find(
      (item) =>
        item.tournamentId ===
        matchdayState.selectedTournamentId
    );

  content.innerHTML = `

    <section class="ktms-section">

      <div class="ktms-matchday-selected-tournament">

        <div>

          <div class="ktms-matchday-eyebrow">
            SELECTED TOURNAMENT
          </div>

          <strong>
            ${escapeHtml(
              matchdayState.selectedTournamentId
            )}
          </strong>

          <span>
            ${escapeHtml(
              tournament?.tournamentName ||
                ""
            )}
          </span>

        </div>

        <div class="ktms-matchday-progress">

          <strong>
            ${formatNumber(
              getCompletedCount()
            )}
            /
            ${formatNumber(
              matchdayState.matchdays.length
            )}
          </strong>

          <span>
            MATCHDAYS COMPLETED
          </span>

        </div>

      </div>

    </section>

    ${renderOperationalSummary()}

    <section class="ktms-section">

      <div class="ktms-section-header">

        <div>

          <h2 class="ktms-section-title">
            Matchday Operations
          </h2>

          <p class="ktms-section-subtitle">
            Matchday activation is automated by
            the KT lifecycle. Manual activation is
            an advanced administrative override only.
          </p>

        </div>

        <button
          type="button"
          class="ktms-primary-button"
          id="matchday-view-toggle"
        >
          ${
            matchdayState.matchdaysVisible
              ? "HIDE MATCHDAYS"
              : "VIEW MATCHDAYS"
          }
        </button>

      </div>

      <div
        id="matchday-schedule-panel"
        ${
          matchdayState.matchdaysVisible
            ? ""
            : "hidden"
        }
      >

        ${renderMatchdaySchedule()}

      </div>

    </section>

    <div id="matchday-detail"></div>
  `;

  bindOverviewActions();
}

/* =========================================================
   OPERATIONAL SUMMARY
   ========================================================= */

function renderOperationalSummary() {
  const summary =
    matchdayState.summary ||
    {};

  const current =
    matchdayState.current ||
    summary.current ||
    null;

  const previous =
    summary.previous ||
    null;

  const next =
    summary.next ||
    null;

  return `

    <section
      class="ktms-matchday-summary-grid"
    >

      ${summaryCard(
        "CURRENT",

        current
          ? `Matchday ${current.matchdayNumber}`
          : "None",

        current
          ? (
              current.matchdayName ||
              current.matchdayStatus ||
              "Active"
            )
          : "No active matchday",

        current
          ? "active"
          : "neutral"
      )}

      ${summaryCard(
        "PREVIOUS",

        previous
          ? `Matchday ${previous.matchdayNumber}`
          : "None",

        previous
          ? (
              previous.matchdayName ||
              previous.matchdayStatus ||
              "Completed"
            )
          : "No completed matchday",

        previous
          ? "completed"
          : "neutral"
      )}

      ${summaryCard(
        "NEXT",

        next
          ? `Matchday ${next.matchdayNumber}`
          : "None",

        next
          ? (
              next.matchdayName ||
              next.matchdayStatus ||
              "Scheduled"
            )
          : "No scheduled matchday",

        next
          ? "scheduled"
          : "neutral"
      )}

      ${summaryCard(
        "PROGRESS",

        `${getCompletedCount()} / ${matchdayState.matchdays.length}`,

        "Matchdays completed",

        "neutral"
      )}

    </section>

  `;
}

function summaryCard(
  label,
  value,
  secondary,
  type
) {
  return `

    <div
      class="
        ktms-matchday-summary-card
        ktms-matchday-summary-${normalizeStatus(
          type
        )}
      "
    >

      <span>
        ${escapeHtml(label)}
      </span>

      <strong>
        ${escapeHtml(value)}
      </strong>

      <small>
        ${escapeHtml(secondary)}
      </small>

    </div>

  `;
}

function getCompletedCount() {
  return matchdayState.matchdays.filter(
    (matchday) =>
      normalizeStatus(
        matchday.matchdayStatus
      ) === "completed"
  ).length;
}

/* =========================================================
   MATCHDAY SCHEDULE
   ========================================================= */

function renderMatchdaySchedule() {

  if (
    !matchdayState.matchdays.length
  ) {

    return `

      <div class="ktms-empty-state">

        <strong>
          No matchdays found
        </strong>

        <p>
          This tournament does not currently
          have a Matchday schedule.
        </p>

      </div>

    `;
  }

  return `

    <div class="ktms-matchday-schedule-intro">

      <div>

        <strong>
          12-Matchday Competition Lifecycle
        </strong>

        <p>
          Use VIEW for operational detail.
          Lifecycle controls are intentionally
          separated into Advanced Controls.
        </p>

      </div>

      <button
        type="button"
        class="ktms-secondary-button"
        id="matchday-validate"
      >
        VALIDATE MATCHDAYS
      </button>

    </div>

    <div class="ktms-matchday-grid">

      ${matchdayState.matchdays
        .map(
          renderMatchdayCard
        )
        .join("")}

    </div>

  `;
}

/* =========================================================
   MATCHDAY CARD
   ========================================================= */

function renderMatchdayCard(
  matchday
) {
  const status =
    normalizeStatus(
      matchday.matchdayStatus
    );

  const recovery =
    isRecoveryMatchday(
      matchday.matchdayNumber
    );

  return `

    <article
      class="
        ktms-matchday-card
        ktms-matchday-card-${status}
        ${
          recovery
            ? "ktms-matchday-card-recovery"
            : ""
        }
      "
      data-matchday-id="${escapeAttribute(
        matchday.matchdayId
      )}"
    >

      <div
        class="ktms-matchday-card-top"
      >

        <div>

          <span
            class="ktms-matchday-number"
          >
            MATCHDAY
            ${escapeHtml(
              matchday.matchdayNumber
            )}
          </span>

          <h3>
            ${escapeHtml(
              matchday.matchdayName ||
                getDefaultMatchdayName(
                  matchday.matchdayNumber
                )
            )}
          </h3>

        </div>

        ${statusBadge(
          matchday.matchdayStatus
        )}

      </div>

      <div
        class="ktms-matchday-card-stage"
      >

        ${escapeHtml(
          getMatchdayTypeLabel(
            matchday
          )
        )}

      </div>

      ${
        recovery
          ? `
            <div
              class="ktms-matchday-recovery-note"
            >
              Recovery / Rescheduling Window
            </div>
          `
          : ""
      }

      <div
        class="ktms-matchday-card-meta"
      >

        <div>

          <span>
            DATE
          </span>

          <strong>
            ${formatDate(
              matchday.matchdayDate
            )}
          </strong>

        </div>

        <div>

          <span>
            TIME
          </span>

          <strong>
            ${formatTimeRange(
              matchday.startTime,
              matchday.endTime
            )}
          </strong>

        </div>

      </div>

      <div
        class="ktms-matchday-card-footer"
      >

        <button
          type="button"
          class="
            ktms-secondary-button
            ktms-matchday-view
          "
          data-matchday-id="${escapeAttribute(
            matchday.matchdayId
          )}"
        >
          VIEW
        </button>

        ${renderAdvancedControls(
          matchday
        )}

      </div>

    </article>

  `;
}

/* =========================================================
   ADVANCED CONTROLS
   ========================================================= */

function renderAdvancedControls(
  matchday
) {
  const status =
    normalizeStatus(
      matchday.matchdayStatus
    );

  const number =
    Number(
      matchday.matchdayNumber
    );

  /*
   * SCHEDULED
   *
   * Manual activation is deliberately hidden
   * inside Advanced Controls.
   */

  if (status === "scheduled") {

    const canActivate =
      canActivateMatchday(
        matchday
      );

    return `

      <details
        class="ktms-matchday-advanced-controls"
      >

        <summary>
          ADVANCED CONTROLS
        </summary>

        <div
          class="ktms-matchday-advanced-body"
        >

          <p>
            Manual activation is an administrative
            override. Normal KT lifecycle progression
            should activate Matchdays automatically.
          </p>

          <button
            type="button"
            class="ktms-secondary-button ktms-matchday-activate"
            data-matchday-id="${escapeAttribute(
              matchday.matchdayId
            )}"
            ${
              canActivate
                ? ""
                : "disabled"
            }
            title="${escapeAttribute(
              canActivate
                ? "Manual activation override"
                : getActivationBlockReason(
                    matchday
                  )
            )}"
          >
            MANUAL ACTIVATE
          </button>

          <small>
            ${escapeHtml(
              canActivate
                ? `Matchday ${number} satisfies the current backend activation prerequisites.`
                : getActivationBlockReason(
                    matchday
                  )
            )}
          </small>

        </div>

      </details>

    `;
  }

  /*
   * ACTIVE
   *
   * Completion is also treated as an
   * administrative lifecycle operation.
   */

  if (status === "active") {

    return `

      <details
        class="ktms-matchday-advanced-controls"
      >

        <summary>
          ADVANCED CONTROLS
        </summary>

        <div
          class="ktms-matchday-advanced-body"
        >

          <p>
            Completing a Matchday changes its
            lifecycle state. Use this only after
            all assigned fixtures are operationally ready.
          </p>

          <button
            type="button"
            class="ktms-secondary-button ktms-matchday-complete"
            data-matchday-id="${escapeAttribute(
              matchday.matchdayId
            )}"
          >
            COMPLETE MATCHDAY
          </button>

        </div>

      </details>

    `;
  }

  /*
   * COMPLETED
   */

  if (status === "completed") {

    return `

      <span
        class="ktms-matchday-completed-label"
      >
        COMPLETED
      </span>

    `;
  }

  return `

    <span
      class="ktms-matchday-completed-label"
    >
      ${escapeHtml(
        matchday.matchdayStatus ||
          "UNKNOWN"
      )}
    </span>

  `;
}

/* =========================================================
   ACTIVATION RULE DISPLAY
   ========================================================= */

function canActivateMatchday(
  matchday
) {
  const number =
    Number(
      matchday.matchdayNumber
    );

  /*
   * Matchday 1 has no previous Matchday.
   */

  if (number <= 1) {
    return true;
  }

  const previous =
    matchdayState.matchdays.find(
      (item) =>
        Number(
          item.matchdayNumber
        ) === number - 1
    );

  if (!previous) {
    return false;
  }

  return (
    normalizeStatus(
      previous.matchdayStatus
    ) === "completed"
  );
}

function getActivationBlockReason(
  matchday
) {
  const number =
    Number(
      matchday.matchdayNumber
    );

  if (number <= 1) {
    return (
      "Matchday is not ready for activation."
    );
  }

  const previous =
    matchdayState.matchdays.find(
      (item) =>
        Number(
          item.matchdayNumber
        ) === number - 1
    );

  if (!previous) {
    return (
      `Matchday ${number - 1} could not be found.`
    );
  }

  const previousStatus =
    previous.matchdayStatus ||
    "Unknown";

  if (
    normalizeStatus(
      previousStatus
    ) !== "completed"
  ) {
    return (
      `Matchday ${number - 1} must be Completed ` +
      `before Matchday ${number} can be manually activated.`
    );
  }

  return (
    "Matchday is not ready for activation."
  );
}

/* =========================================================
   OVERVIEW ACTIONS
   ========================================================= */

function bindOverviewActions() {

  const toggle =
    document.getElementById(
      "matchday-view-toggle"
    );

  if (toggle) {

    toggle.addEventListener(
      "click",
      () => {

        matchdayState.matchdaysVisible =
          !matchdayState.matchdaysVisible;

        renderMatchdayDashboard();
      }
    );
  }

  bindMatchdayActions();

  bindValidation();
}

/* =========================================================
   MATCHDAY ACTIONS
   ========================================================= */

function bindMatchdayActions() {

  /*
   * VIEW
   */

  document
    .querySelectorAll(
      ".ktms-matchday-view"
    )
    .forEach(
      (button) => {

        button.addEventListener(
          "click",
          async () => {

            await showMatchdayDetail(
              button.dataset.matchdayId
            );
          }
        );

      }
    );

  /*
   * MANUAL ACTIVATE
   */

  document
    .querySelectorAll(
      ".ktms-matchday-activate"
    )
    .forEach(
      (button) => {

        button.addEventListener(
          "click",
          async () => {

            if (button.disabled) {
              return;
            }

            const matchday =
              matchdayState.matchdays.find(
                (item) =>
                  item.matchdayId ===
                  button.dataset.matchdayId
              );

            const label =
              matchday
                ? (
                    `Matchday ${matchday.matchdayNumber} — ` +
                    `${
                      matchday.matchdayName ||
                      getDefaultMatchdayName(
                        matchday.matchdayNumber
                      )
                    }`
                  )
                : "this Matchday";

            /*
             * IMPORTANT:
             *
             * No backend request happens until
             * the administrator explicitly confirms.
             */

            const confirmed =
              window.confirm(
                `Are you sure you want to manually ACTIVATE ${label}?\n\n` +
                "This is an administrative override. " +
                "It will send the activation command to the KTMS backend.\n\n" +
                "Use manual activation only when normal automated lifecycle progression is not appropriate."
              );

            if (!confirmed) {
              return;
            }

            await performMatchdayAction(
              button.dataset.matchdayId,
              "activate"
            );
          }
        );

      }
    );

  /*
   * COMPLETE
   */

  document
    .querySelectorAll(
      ".ktms-matchday-complete"
    )
    .forEach(
      (button) => {

        button.addEventListener(
          "click",
          async () => {

            const matchday =
              matchdayState.matchdays.find(
                (item) =>
                  item.matchdayId ===
                  button.dataset.matchdayId
              );

            const label =
              matchday
                ? (
                    `Matchday ${matchday.matchdayNumber} — ` +
                    `${
                      matchday.matchdayName ||
                      getDefaultMatchdayName(
                        matchday.matchdayNumber
                      )
                    }`
                  )
                : "this Matchday";

            const confirmed =
              window.confirm(
                `Are you sure you want to COMPLETE ${label}?\n\n` +
                "This changes the Matchday lifecycle state. " +
                "KTMS will enforce the backend completion rules before accepting the command."
              );

            if (!confirmed) {
              return;
            }

            await performMatchdayAction(
              button.dataset.matchdayId,
              "complete"
            );
          }
        );

      }
    );
}

/* =========================================================
   PERFORM MATCHDAY ACTION
   ========================================================= */

async function performMatchdayAction(
  matchdayId,
  action
) {
  clearMessage();

  try {

    const result =
      await adminApi(
        action === "activate"
          ? "matchday.activate"
          : "matchday.complete",
        {
          matchdayId
        }
      );

    showMessage(
      result?.message ||
        `Matchday ${action} operation completed successfully.`,
      "success"
    );

    /*
     * Keep the Matchday schedule open after
     * a successful operation.
     */

    matchdayState.matchdaysVisible =
      true;

    await loadMatchdays();

  } catch (error) {

    showMessage(
      error?.message ||
        `Unable to ${action} matchday.`,
      "error"
    );
  }
}

/* =========================================================
   MATCHDAY DETAIL
   ========================================================= */

async function showMatchdayDetail(
  matchdayId
) {
  const container =
    document.getElementById(
      "matchday-detail"
    );

  if (!container) {
    return;
  }

  container.innerHTML = `

    <section class="ktms-section">

      <div class="ktms-loading-state">
        Loading matchday details...
      </div>

    </section>

  `;

  try {

    const result =
      await adminApi(
        "matchday.get",
        {
          matchdayId
        }
      );

    const matchday =
      normalizeMatchdayDetail(
        result
      );

    if (!matchday) {
      throw new Error(
        "Matchday details were not returned."
      );
    }

    matchdayState.selectedMatchdayId =
      matchdayId;

    const recovery =
      isRecoveryMatchday(
        matchday.matchdayNumber
      );

    container.innerHTML = `

      <section class="ktms-section">

        <div class="ktms-matchday-detail">

          <div
            class="
              ktms-matchday-detail-header
              ${
                recovery
                  ? "ktms-matchday-detail-recovery"
                  : ""
              }
            "
          >

            <div>

              <span
                class="ktms-matchday-eyebrow"
              >
                MATCHDAY DETAIL
              </span>

              <h2>
                ${escapeHtml(
                  matchday.matchdayName ||
                    getDefaultMatchdayName(
                      matchday.matchdayNumber
                    )
                )}
              </h2>

              <p>
                ${escapeHtml(
                  matchday.matchdayId
                )}
              </p>

              ${
                recovery
                  ? `
                    <span
                      class="ktms-matchday-recovery-note"
                    >
                      Recovery / Rescheduling Window
                    </span>
                  `
                  : ""
              }

            </div>

            ${statusBadge(
              matchday.matchdayStatus
            )}

          </div>

          <div
            class="ktms-matchday-detail-grid"
          >

            ${detailItem(
              "Tournament",
              matchday.tournamentId
            )}

            ${detailItem(
              "Matchday Number",
              matchday.matchdayNumber
            )}

            ${detailItem(
              "Stage",
              matchday.stage
            )}

            ${detailItem(
              "Matchday Type",
              getMatchdayTypeLabel(
                matchday
              )
            )}

            ${detailItem(
              "Date",
              formatDate(
                matchday.matchdayDate
              )
            )}

            ${detailItem(
              "Start Time",
              formatTime(
                matchday.startTime
              )
            )}

            ${detailItem(
              "End Time",
              formatTime(
                matchday.endTime
              )
            )}

            ${detailItem(
              "Status",
              matchday.matchdayStatus
            )}

            ${detailItem(
              "Last Modified",
              formatDateTime(
                matchday.lastModifiedDatetime
              )
            )}

          </div>

        </div>

      </section>

    `;

    container.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });

  } catch (error) {

    container.innerHTML = `

      <section class="ktms-section">

        <div class="ktms-error-state">

          <strong>
            Unable to load matchday details.
          </strong>

          <p>
            ${escapeHtml(
              error?.message ||
                ""
            )}
          </p>

        </div>

      </section>

    `;
  }
}

/* =========================================================
   VALIDATION
   ========================================================= */

function bindValidation() {
  const button =
    document.getElementById(
      "matchday-validate"
    );

  if (!button) {
    return;
  }

  button.addEventListener(
    "click",
    validateMatchdays
  );
}

async function validateMatchdays() {
  const tournamentId =
    matchdayState.selectedTournamentId;

  if (!tournamentId) {

    showMessage(
      "Select a tournament first.",
      "info"
    );

    return;
  }

  const button =
    document.getElementById(
      "matchday-validate"
    );

  if (button) {
    button.disabled = true;
  }

  clearMessage();

  try {

    const result =
      await adminApi(
        "matchday.validate",
        {
          tournamentId
        }
      );

    const validation =
      normalizeValidation(
        result
      );

    if (validation.valid) {

      showMessage(
        validation.message ||
          "Matchday configuration is valid.",
        "success"
      );

      return;
    }

    showMessage(
      validation.errors.length
        ? validation.errors.join(
            " | "
          )
        : (
            validation.message ||
            "Matchday validation failed."
          ),
      "error"
    );

  } catch (error) {

    showMessage(
      error?.message ||
        "Unable to validate matchdays.",
      "error"
    );

  } finally {

    if (button) {
      button.disabled = false;
    }
  }
}

/* =========================================================
   NORMALIZATION
   ========================================================= */

function normalizeMatchdays(
  result
) {
  const rows =
    result?.data ||
    result?.matchdays ||
    result?.items ||
    result ||
    [];

  if (!Array.isArray(rows)) {
    return [];
  }

  return rows
    .map(
      normalizeMatchday
    )
    .filter(
      (row) =>
        row.matchdayId
    )
    .sort(
      (a, b) =>
        a.matchdayNumber -
        b.matchdayNumber
    );
}

function normalizeMatchday(
  row
) {
  return {

    matchdayId:
      String(
        row.matchdayId ??
        row.matchday_id ??
        ""
      ),

    tournamentId:
      String(
        row.tournamentId ??
        row.tournament_id ??
        ""
      ),

    matchdayNumber:
      Number(
        row.matchdayNumber ??
        row.matchday_number ??
        0
      ),

    matchdayName:
      String(
        row.matchdayName ??
        row.matchday_name ??
        ""
      ),

    matchdayDate:
      row.matchdayDate ??
      row.matchday_date ??
      null,

    startTime:
      row.startTime ??
      row.start_time ??
      null,

    endTime:
      row.endTime ??
      row.end_time ??
      null,

    stage:
      String(
        row.stage ??
        ""
      ),

    matchdayStatus:
      String(
        row.matchdayStatus ??
        row.matchday_status ??
        "Scheduled"
      ),

    createdDatetime:
      row.createdDatetime ??
      row.created_datetime ??
      null,

    lastModifiedDatetime:
      row.lastModifiedDatetime ??
      row.last_modified_datetime ??
      null
  };
}

function normalizeMatchdayDetail(
  result
) {
  const data =
    result?.data ||
    result?.matchday ||
    result;

  if (
    !data ||
    typeof data !== "object" ||
    Array.isArray(data)
  ) {
    return null;
  }

  return normalizeMatchday(
    data
  );
}

function normalizeSummary(
  result
) {
  const data =
    result?.data ||
    result?.summary ||
    result;

  if (
    !data ||
    typeof data !== "object" ||
    Array.isArray(data)
  ) {
    return null;
  }

  return data;
}

function normalizeCurrent(
  result
) {
  const data =
    result?.data ||
    result?.current ||
    result;

  if (
    !data ||
    typeof data !== "object" ||
    Array.isArray(data)
  ) {
    return null;
  }

  if (
    data.matchday &&
    typeof data.matchday === "object"
  ) {
    return normalizeMatchday(
      data.matchday
    );
  }

  if (
    data.matchday_id ||
    data.matchdayId
  ) {
    return normalizeMatchday(
      data
    );
  }

  return data;
}

function normalizeValidation(
  result
) {
  const data =
    result?.data ||
    result?.validation ||
    result;

  if (
    !data ||
    typeof data !== "object" ||
    Array.isArray(data)
  ) {

    return {
      valid: false,
      errors: [],
      message:
        "Invalid validation response."
    };
  }

  const errors =
    data.errors ||
    data.validation_errors ||
    data.problems ||
    [];

  return {

    valid:
      data.valid === true ||
      data.is_valid === true ||
      data.success === true,

    errors:
      Array.isArray(errors)
        ? errors.map(
            (item) =>
              typeof item === "string"
                ? item
                : (
                    item?.message ||
                    JSON.stringify(item)
                  )
          )
        : [],

    message:
      data.message ||
      data.validation_message ||
      ""
  };
}

/* =========================================================
   MATCHDAY DEFINITIONS
   ========================================================= */

function isRecoveryMatchday(
  matchdayNumber
) {
  return RECOVERY_MATCHDAYS.has(
    Number(
      matchdayNumber
    )
  );
}

function getMatchdayTypeLabel(
  matchday
) {
  const number =
    Number(
      matchday?.matchdayNumber
    );

  if (
    isRecoveryMatchday(
      number
    )
  ) {
    return "Recovery / Rescheduling";
  }

  switch (number) {

    case 1:
    case 2:
    case 3:
      return "Group Stage";

    case 5:
      return "Playoff";

    case 7:
      return "Round of 32";

    case 8:
      return "Round of 16";

    case 10:
      return "Quarterfinal";

    case 11:
      return "Semifinal";

    case 12:
      return "Final + Third Place";

    default:
      return (
        matchday?.stage ||
        "KT Matchday"
      );
  }
}

function getDefaultMatchdayName(
  matchdayNumber
) {
  switch (
    Number(
      matchdayNumber
    )
  ) {

    case 1:
      return "Group Stage — Matchday 1";

    case 2:
      return "Group Stage — Matchday 2";

    case 3:
      return "Group Stage — Matchday 3";

    case 4:
      return "Group Stage — Rescheduled";

    case 5:
      return "Playoff";

    case 6:
      return "Playoff — Rescheduled";

    case 7:
      return "Round of 32";

    case 8:
      return "Round of 16";

    case 9:
      return "Knockout — Rescheduled";

    case 10:
      return "Quarterfinal";

    case 11:
      return "Semifinal";

    case 12:
      return "Final + Third Place";

    default:
      return `Matchday ${matchdayNumber}`;
  }
}

/* =========================================================
   UI HELPERS
   ========================================================= */

function renderEmptyTournamentState() {
  const content =
    document.getElementById(
      "matchday-content"
    );

  if (!content) {
    return;
  }

  content.innerHTML = `

    <div class="ktms-empty-state">

      <strong>
        Select a tournament
      </strong>

      <p>
        Choose a KT tournament above to
        view its Matchday overview.
      </p>

    </div>

  `;
}

function statusBadge(
  status
) {
  return `

    <span
      class="
        ktms-status
        ktms-status-${normalizeStatus(
          status
        )}
      "
    >
      ${escapeHtml(
        formatStatus(
          status
        )
      )}
    </span>

  `;
}

function normalizeStatus(
  value
) {
  return String(
    value ||
      "unknown"
  )
    .trim()
    .toLowerCase()
    .replace(
      /[^a-z0-9]+/g,
      "-"
    )
    .replace(
      /^-|-$/g,
      ""
    );
}

function formatStatus(
  value
) {
  return String(
    value ||
      "Unknown"
  );
}

function detailItem(
  label,
  value
) {
  return `

    <div
      class="ktms-matchday-detail-item"
    >

      <span>
        ${escapeHtml(
          label
        )}
      </span>

      <strong>
        ${escapeHtml(
          value ??
            "—"
        )}
      </strong>

    </div>

  `;
}

function formatNumber(
  value
) {
  const number =
    Number(
      value
    );

  if (
    !Number.isFinite(
      number
    )
  ) {
    return "0";
  }

  return number.toLocaleString(
    "en-US"
  );
}

function formatDate(
  value
) {
  if (!value) {
    return "—";
  }

  const date =
    new Date(
      value
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return String(
      value
    );
  }

  return date.toLocaleDateString(
    "en-GB",
    {
      day: "2-digit",
      month: "short",
      year: "numeric"
    }
  );
}

function formatTime(
  value
) {
  if (!value) {
    return "—";
  }

  const raw =
    String(
      value
    );

  if (
    raw.length >= 5 &&
    /^\d{2}:\d{2}/.test(
      raw
    )
  ) {
    return raw.slice(
      0,
      5
    );
  }

  return raw;
}

function formatTimeRange(
  start,
  end
) {
  return (
    `${formatTime(
      start
    )}–${formatTime(
      end
    )}`
  );
}

function formatDateTime(
  value
) {
  if (!value) {
    return "—";
  }

  const date =
    new Date(
      value
    );

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return String(
      value
    );
  }

  return date.toLocaleString(
    "en-GB",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }
  );
}

function showMessage(
  message,
  type = "info"
) {
  const element =
    document.getElementById(
      "matchday-message"
    );

  if (!element) {
    return;
  }

  element.className =
    `ktms-message ktms-message-${type}`;

  element.textContent =
    message ||
    "";

  element.hidden =
    !message;
}

function clearMessage() {
  const element =
    document.getElementById(
      "matchday-message"
    );

  if (!element) {
    return;
  }

  element.textContent =
    "";

  element.hidden =
    true;

  element.className =
    "ktms-message";
}

function bindRefresh() {
  const button =
    document.getElementById(
      "matchday-refresh"
    );

  if (!button) {
    return;
  }

  button.addEventListener(
    "click",
    async () => {

      button.disabled =
        true;

      try {

        await loadTournaments();

        if (
          matchdayState.selectedTournamentId
        ) {
          await loadMatchdays();
        }

      } catch (error) {

        showMessage(
          error?.message ||
            "Unable to refresh Matchday data.",
          "error"
        );

      } finally {

        button.disabled =
          false;
      }
    }
  );
}

function escapeHtml(
  value
) {
  return String(
    value
  )
    .replaceAll(
      "&",
      "&amp;"
    )
    .replaceAll(
      "<",
      "&lt;"
    )
    .replaceAll(
      ">",
      "&gt;"
    )
    .replaceAll(
      '"',
      "&quot;"
    )
    .replaceAll(
      "'",
      "&#039;"
    );
}

function escapeAttribute(
  value
) {
  return escapeHtml(
    value
  );
}
