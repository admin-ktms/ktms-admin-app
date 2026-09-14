import { adminApi } from "../../api/admin-api.js";

let matchdayState = {
  tournaments: [],
  matchdays: [],
  selectedTournamentId: "",
  selectedMatchdayId: "",
  summary: null
};

export async function renderMatchdays(page) {
  page.innerHTML = `
    <div class="ktms-matchday-module">

      <div class="ktms-module-toolbar">
        <div>
          <h1>Matchdays</h1>
          <p>
            Manage KT tournament matchday progression,
            activation, completion, and operational status.
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

      <div id="matchday-message" class="ktms-message"></div>

      <section class="ktms-section">

        <div class="ktms-section-header">
          <h2 class="ktms-section-title">
            Tournament
          </h2>

          <p class="ktms-section-subtitle">
            Select a KT tournament to manage its 12-matchday
            competition lifecycle.
          </p>
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
          <strong>Select a tournament</strong>
          <p>
            Choose a KT tournament above to view
            and manage its matchdays.
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

    const result = await adminApi(
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
      (row) => row.tournamentId
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

  selector.addEventListener(
    "change",
    async () => {
      matchdayState.selectedTournamentId =
        selector.value;

      matchdayState.selectedMatchdayId = "";

      if (!selector.value) {
        renderEmptyTournamentState();
        return;
      }

      await loadMatchdays();
    }
  );
}

/* =========================================================
   MATCHDAYS
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
      Loading matchdays...
    </div>
  `;

  clearMessage();

  try {
    const result = await adminApi(
      "matchday.list",
      {
        tournamentId
      }
    );

    matchdayState.matchdays =
      normalizeMatchdays(result);

    await loadMatchdaySummary();

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
   SUMMARY
   ========================================================= */

async function loadMatchdaySummary() {
  const tournamentId =
    matchdayState.selectedTournamentId;

  if (!tournamentId) {
    matchdayState.summary = null;
    return;
  }

  try {
    const result = await adminApi(
      "matchday.list",
      {
        tournamentId
      }
    );

    /*
     * The list endpoint is the authoritative
     * matchday collection.
     *
     * Build the operational summary locally so
     * the UI remains compatible with the existing
     * Admin API while the dedicated summary action
     * is not yet exposed.
     */
    const rows =
      normalizeMatchdays(result);

    const active =
      rows.find(
        (row) =>
          row.matchdayStatus === "Active"
      ) || null;

    const previous =
      [...rows]
        .filter(
          (row) =>
            row.matchdayStatus ===
            "Completed"
        )
        .sort(
          (a, b) =>
            b.matchdayNumber -
            a.matchdayNumber
        )[0] || null;

    const next =
      [...rows]
        .filter(
          (row) =>
            row.matchdayStatus ===
            "Scheduled"
        )
        .sort(
          (a, b) =>
            a.matchdayNumber -
            b.matchdayNumber
        )[0] || null;

    matchdayState.summary = {
      current: active,
      previous,
      next,
      total: rows.length,
      completed: rows.filter(
        (row) =>
          row.matchdayStatus ===
          "Completed"
      ).length
    };

  } catch {
    matchdayState.summary = null;
  }
}

/* =========================================================
   DASHBOARD
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

  const summary =
    matchdayState.summary || {};

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
              summary.completed || 0
            )}
            /
            ${formatNumber(
              summary.total ||
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
            Matchday Schedule
          </h2>

          <p class="ktms-section-subtitle">
            The KT tournament lifecycle is controlled
            through the matchday sequence below.
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
          .map(renderMatchdayCard)
          .join("")}
      </div>

    </section>

    <div id="matchday-detail"></div>
  `;

  bindMatchdayActions();
  bindValidation();
}

function renderOperationalSummary() {
  const summary =
    matchdayState.summary || {};

  const current =
    summary.current;

  const next =
    summary.next;

  return `
    <section class="ktms-matchday-summary-grid">

      ${summaryCard(
        "CURRENT",
        current
          ? `Matchday ${current.matchdayNumber}`
          : "None",
        current
          ? current.matchdayStatus
          : "No active matchday",
        current
          ? "active"
          : "neutral"
      )}

      ${summaryCard(
        "PREVIOUS",
        summary.previous
          ? `Matchday ${summary.previous.matchdayNumber}`
          : "None",
        summary.previous
          ? summary.previous.matchdayName
          : "No completed matchday",
        "completed"
      )}

      ${summaryCard(
        "NEXT",
        next
          ? `Matchday ${next.matchdayNumber}`
          : "None",
        next
          ? next.matchdayName
          : "No scheduled matchday",
        "scheduled"
      )}

      ${summaryCard(
        "PROGRESS",
        `${summary.completed || 0} / ${
          summary.total ||
          matchdayState.matchdays.length
        }`,
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
        ktms-matchday-summary-${type}
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

/* =========================================================
   MATCHDAY CARD
   ========================================================= */

function renderMatchdayCard(matchday) {
  const status =
    normalizeStatus(
      matchday.matchdayStatus
    );

  return `
    <article
      class="
        ktms-matchday-card
        ktms-matchday-card-${status}
      "
      data-matchday-id="${escapeAttribute(
        matchday.matchdayId
      )}"
    >

      <div class="ktms-matchday-card-top">

        <div>

          <span class="ktms-matchday-number">
            MATCHDAY
            ${escapeHtml(
              matchday.matchdayNumber
            )}
          </span>

          <h3>
            ${escapeHtml(
              matchday.matchdayName
            )}
          </h3>

        </div>

        ${statusBadge(
          matchday.matchdayStatus
        )}

      </div>

      <div class="ktms-matchday-card-stage">
        ${escapeHtml(
          matchday.stage
        )}
      </div>

      <div class="ktms-matchday-card-meta">

        <div>
          <span>DATE</span>
          <strong>
            ${formatDate(
              matchday.matchdayDate
            )}
          </strong>
        </div>

        <div>
          <span>TIME</span>
          <strong>
            ${formatTimeRange(
              matchday.startTime,
              matchday.endTime
            )}
          </strong>
        </div>

      </div>

      <div class="ktms-matchday-card-footer">

        <button
          type="button"
          class="ktms-secondary-button ktms-matchday-view"
          data-matchday-id="${escapeAttribute(
            matchday.matchdayId
          )}"
        >
          VIEW
        </button>

        ${renderLifecycleButton(matchday)}

      </div>

    </article>
  `;
}

function renderLifecycleButton(matchday) {
  if (
    matchday.matchdayStatus ===
    "Scheduled"
  ) {
    return `
      <button
        type="button"
        class="ktms-primary-button ktms-matchday-activate"
        data-matchday-id="${escapeAttribute(
          matchday.matchdayId
        )}"
      >
        ACTIVATE
      </button>
    `;
  }

  if (
    matchday.matchdayStatus ===
    "Active"
  ) {
    return `
      <button
        type="button"
        class="ktms-primary-button ktms-matchday-complete"
        data-matchday-id="${escapeAttribute(
          matchday.matchdayId
        )}"
      >
        COMPLETE
      </button>
    `;
  }

  return `
    <span class="ktms-matchday-completed-label">
      COMPLETED
    </span>
  `;
}

/* =========================================================
   DETAIL
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
    const result = await adminApi(
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

    container.innerHTML = `
      <section class="ktms-section">

        <div class="ktms-matchday-detail">

          <div class="ktms-matchday-detail-header">

            <div>
              <span class="ktms-matchday-eyebrow">
                MATCHDAY DETAIL
              </span>

              <h2>
                ${escapeHtml(
                  matchday.matchdayName
                )}
              </h2>

              <p>
                ${escapeHtml(
                  matchday.matchdayId
                )}
              </p>
            </div>

            ${statusBadge(
              matchday.matchdayStatus
            )}

          </div>

          <div class="ktms-matchday-detail-grid">

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

          Unable to load matchday details.

          ${escapeHtml(
            error?.message || ""
          )}

        </div>

      </section>
    `;
  }
}

/* =========================================================
   ACTIONS
   ========================================================= */

function bindMatchdayActions() {
  document
    .querySelectorAll(
      ".ktms-matchday-view"
    )
    .forEach((button) => {
      button.addEventListener(
        "click",
        async () => {
          await showMatchdayDetail(
            button.dataset.matchdayId
          );
        }
      );
    });

  document
    .querySelectorAll(
      ".ktms-matchday-activate"
    )
    .forEach((button) => {
      button.addEventListener(
        "click",
        async () => {
          await performMatchdayAction(
            button.dataset.matchdayId,
            "activate"
          );
        }
      );
    });

  document
    .querySelectorAll(
      ".ktms-matchday-complete"
    )
    .forEach((button) => {
      button.addEventListener(
        "click",
        async () => {
          await performMatchdayAction(
            button.dataset.matchdayId,
            "complete"
          );
        }
      );
    });
}

async function performMatchdayAction(
  matchdayId,
  action
) {
  const actionName =
    action === "activate"
      ? "ACTIVATE"
      : "COMPLETE";

  const confirmed =
    window.confirm(
      `${actionName} this matchday? KTMS will enforce the matchday lifecycle rules.`
    );

  if (!confirmed) {
    return;
  }

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
    return;
  }

  clearMessage();

  try {
    /*
     * The current Admin API does not expose
     * matchday.validate yet.
     *
     * The database authority exists, but we do
     * not bypass the Admin API from the browser.
     */
    showMessage(
      "Matchday validation is available in the KTMS core but is not yet exposed as an Admin API action.",
      "info"
    );

  } catch (error) {
    showMessage(
      error?.message ||
        "Unable to validate matchdays.",
      "error"
    );
  }
}

/* =========================================================
   NORMALIZATION
   ========================================================= */

function normalizeMatchdays(result) {
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
    .map(normalizeMatchday)
    .filter(
      (row) => row.matchdayId
    )
    .sort(
      (a, b) =>
        a.matchdayNumber -
        b.matchdayNumber
    );
}

function normalizeMatchday(row) {
  return {
    matchdayId: String(
      row.matchdayId ??
      row.matchday_id ??
      ""
    ),

    tournamentId: String(
      row.tournamentId ??
      row.tournament_id ??
      ""
    ),

    matchdayNumber: Number(
      row.matchdayNumber ??
      row.matchday_number ??
      0
    ),

    matchdayName: String(
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

    stage: String(
      row.stage ?? ""
    ),

    matchdayStatus: String(
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

  return normalizeMatchday(data);
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
        view and manage its matchdays.
      </p>

    </div>
  `;
}

function statusBadge(status) {
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
        formatStatus(status)
      )}
    </span>
  `;
}

function normalizeStatus(value) {
  return String(
    value || "unknown"
  )
    .trim()
    .toLowerCase()
    .replaceAll(
      /[^a-z0-9]+/g,
      "-"
    )
    .replace(
      /^-|-$/g,
      ""
    );
}

function formatStatus(value) {
  return String(
    value || "Unknown"
  );
}

function detailItem(
  label,
  value
) {
  return `
    <div class="ktms-matchday-detail-item">

      <span>
        ${escapeHtml(label)}
      </span>

      <strong>
        ${escapeHtml(
          value ?? "—"
        )}
      </strong>

    </div>
  `;
}

function formatNumber(value) {
  const number =
    Number(value);

  if (
    !Number.isFinite(number)
  ) {
    return "0";
  }

  return number.toLocaleString(
    "en-US"
  );
}

function formatDate(value) {
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

  return date.toLocaleDateString(
    "en-GB",
    {
      day: "2-digit",
      month: "short",
      year: "numeric"
    }
  );
}

function formatTime(value) {
  if (!value) {
    return "—";
  }

  const raw =
    String(value);

  if (
    raw.length >= 5 &&
    /^\d{2}:\d{2}/.test(raw)
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
  return `${formatTime(
    start
  )}–${formatTime(end)}`;
}

function formatDateTime(
  value
) {
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
    message || "";

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

  element.textContent = "";
  element.hidden = true;
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
      button.disabled = true;

      try {
        await loadTournaments();

        if (
          matchdayState.selectedTournamentId
        ) {
          await loadMatchdays();
        }

      } finally {
        button.disabled = false;
      }
    }
  );
}

function escapeHtml(value) {
  return String(value)
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

function escapeAttribute(value) {
  return escapeHtml(value);
}
