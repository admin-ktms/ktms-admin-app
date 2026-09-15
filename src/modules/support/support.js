import {
  getSupportCases,
  getSupportCase,
  respondToSupportCase,
  requestSupportInformation,
  resolveSupportCase,
  rejectSupportCase,
  closeSupportCase,
  reopenSupportCase
} from "../../api/support-api.js";


const STATUS_OPTIONS = [
  "Submitted",
  "Under Review",
  "Awaiting Player Information",
  "Resolved",
  "Rejected",
  "Closed"
];

const TYPE_OPTIONS = [
  "Support",
  "Dispute",
  "Appeal"
];


const state = {
  admin: null,

  cases: [],
  selectedCase: null,

  filters: {
    filter: "",
    caseType: "",
    caseCategory: "",
    search: ""
  },

  loading: false,
  selectedCaseLoading: false,
  actionLoading: false
};


/* =========================================================
   MAIN
   ========================================================= */

export async function renderSupport(page, admin) {
  state.admin = admin;

  page.innerHTML = `
    ...
  `;

  bindToolbarEvents();

  await loadCases();
}


function bindToolbarEvents() {
  document
    .getElementById("support-refresh")
    ?.addEventListener("click", async () => {
      await loadCases();
    });
}


/* =========================================================
   LOAD CASES
   ========================================================= */

async function loadCases() {
  setMessage("Loading support cases...", "info");

  try {
    state.loading = true;

    const result = await getSupportCases(
      state.filters
    );

    state.cases = normalizeRows(result);

    renderWorkspace();

    setMessage(
      `${state.cases.length} support case${
        state.cases.length === 1 ? "" : "s"
      } loaded.`,
      "success"
    );

  } catch (error) {
    console.error(
      "KTMS support case load failed:",
      error
    );

    state.cases = [];

    const content =
      document.getElementById("support-content");

    if (content) {
      content.innerHTML = `
        <div class="ktms-error-card">
          <strong>
            Unable to load support cases.
          </strong>

          <p>
            ${escapeHtml(
              error?.message ||
              "An unexpected error occurred."
            )}
          </p>
        </div>
      `;
    }

    setMessage(
      error?.message ||
      "Unable to load support cases.",
      "error"
    );

  } finally {
    state.loading = false;
  }
}


/* =========================================================
   WORKSPACE
   ========================================================= */

function renderWorkspace() {
  const content =
    document.getElementById("support-content");

  if (!content) return;

  content.innerHTML = `
    <div class="ktms-support-workspace">

      <div class="ktms-support-list-panel">

        ${renderFilters()}

        <div id="support-case-list">
          ${renderCaseList()}
        </div>

      </div>

      <div
        class="ktms-support-detail-panel"
        id="support-case-detail"
      >
        ${renderCaseDetail()}
      </div>

    </div>
  `;

  bindFilterEvents();
  bindCaseSelectionEvents();
  bindDetailEvents();
}


/* =========================================================
   FILTERS
   ========================================================= */

function renderFilters() {
  return `
    <div class="ktms-card">

      <div class="ktms-support-filter-grid">

        <label class="ktms-form-field">

          <span>Search</span>

          <input
            id="support-search"
            type="search"
            placeholder="Case ID, player, subject..."
            value="${escapeAttribute(
              state.filters.search
            )}"
          />

        </label>


        <label class="ktms-form-field">

          <span>Status</span>

          <select id="support-status-filter">

            <option value="">
              All statuses
            </option>

            ${STATUS_OPTIONS
              .map(
                (status) => `
                  <option
                    value="${escapeAttribute(status)}"
                    ${
                      state.filters.filter === status
                        ? "selected"
                        : ""
                    }
                  >
                    ${escapeHtml(status)}
                  </option>
                `
              )
              .join("")}

          </select>

        </label>


        <label class="ktms-form-field">

          <span>Case Type</span>

          <select id="support-type-filter">

            <option value="">
              All types
            </option>

            ${TYPE_OPTIONS
              .map(
                (type) => `
                  <option
                    value="${escapeAttribute(type)}"
                    ${
                      state.filters.caseType === type
                        ? "selected"
                        : ""
                    }
                  >
                    ${escapeHtml(type)}
                  </option>
                `
              )
              .join("")}

          </select>

        </label>


        <label class="ktms-form-field">

          <span>Category</span>

          <input
            id="support-category-filter"
            type="text"
            placeholder="Category"
            value="${escapeAttribute(
              state.filters.caseCategory
            )}"
          />

        </label>


        <div class="ktms-support-filter-actions">

          <button
            id="support-apply-filters"
            class="ktms-primary-button"
            type="button"
          >
            APPLY
          </button>

          <button
            id="support-reset-filters"
            class="ktms-secondary-button"
            type="button"
          >
            RESET
          </button>

        </div>

      </div>

    </div>
  `;
}


function bindFilterEvents() {
  document
    .getElementById("support-apply-filters")
    ?.addEventListener("click", async () => {

      state.filters.search =
        document.getElementById(
          "support-search"
        )?.value.trim() || "";

      state.filters.filter =
        document.getElementById(
          "support-status-filter"
        )?.value || "";

      state.filters.caseType =
        document.getElementById(
          "support-type-filter"
        )?.value || "";

      state.filters.caseCategory =
        document.getElementById(
          "support-category-filter"
        )?.value.trim() || "";

      await loadCases();
    });


  document
    .getElementById("support-reset-filters")
    ?.addEventListener("click", async () => {

      state.filters = {
        filter: "",
        caseType: "",
        caseCategory: "",
        search: ""
      };

      await loadCases();
    });
}


/* =========================================================
   CASE LIST
   ========================================================= */

function renderCaseList() {
  if (!state.cases.length) {
    return `
      <div class="ktms-empty-state">

        <h3>No support cases</h3>

        <p>
          No cases match the current filters.
        </p>

      </div>
    `;
  }


  return `
    <div class="ktms-card">

      <div class="ktms-support-list-header">
        <h3>Cases</h3>

        <span>
          ${state.cases.length}
        </span>
      </div>


      <div class="ktms-table-wrapper">

        <table class="ktms-table">

          <thead>
            <tr>
              <th>Case</th>
              <th>Player</th>
              <th>Type</th>
              <th>Status</th>
              <th>Modified</th>
            </tr>
          </thead>

          <tbody>

            ${state.cases
              .map(
                (item) => `
                  <tr
                    class="ktms-support-case-row ${
                      state.selectedCase?.caseId ===
                      item.caseId
                        ? "active"
                        : ""
                    }"
                    data-support-case-id="${escapeAttribute(
                      item.caseId
                    )}"
                  >

                    <td>
                      <strong>
                        ${escapeHtml(
                          item.caseId || "—"
                        )}
                      </strong>

                      <div class="ktms-support-row-subtext">
                        ${escapeHtml(
                          item.subject || "No subject"
                        )}
                      </div>
                    </td>

                    <td>
                      ${escapeHtml(
                        item.playerName || "—"
                      )}

                      <div class="ktms-support-row-subtext">
                        ${escapeHtml(
                          item.playerId || ""
                        )}
                      </div>
                    </td>

                    <td>
                      ${escapeHtml(
                        item.caseType || "—"
                      )}
                    </td>

                    <td>
                      ${statusBadge(
                        item.status
                      )}
                    </td>

                    <td>
                      ${formatDate(
                        item.lastModifiedDateTime
                      )}
                    </td>

                  </tr>
                `
              )
              .join("")}

          </tbody>

        </table>

      </div>

    </div>
  `;
}


function bindCaseSelectionEvents() {
  document
    .querySelectorAll(
      "[data-support-case-id]"
    )
    .forEach((row) => {

      row.addEventListener(
        "click",
        async () => {

          const caseId =
            row.dataset.supportCaseId;

          await loadCase(caseId);
        }
      );

    });
}


/* =========================================================
   CASE DETAIL
   ========================================================= */

function renderCaseDetail() {
  if (!state.selectedCase) {
    return `
      <div class="ktms-card ktms-support-empty-detail">

        <h3>Select a case</h3>

        <p>
          Select a support case from the list
          to inspect its history and available
          operations.
        </p>

      </div>
    `;
  }


  const item = state.selectedCase;

  return `
    <div class="ktms-support-detail">

      ${renderCaseHeader(item)}

      ${renderCaseContext(item)}

      ${renderPlayerDescription(item)}

      ${renderMessages(item)}

      ${renderEvidence(item)}

      ${renderTimeline(item)}

      ${renderResolution(item)}

      ${renderActions(item)}

    </div>
  `;
}


function renderCaseHeader(item) {
  return `
    <div class="ktms-card">

      <div class="ktms-support-detail-header">

        <div>

          <div class="ktms-support-case-id">
            ${escapeHtml(
              item.caseId || "—"
            )}
          </div>

          <h3>
            ${escapeHtml(
              item.subject || "Support Case"
            )}
          </h3>

        </div>

        <div>
          ${statusBadge(item.status)}
        </div>

      </div>


      <div class="ktms-support-meta-grid">

        ${metaItem(
          "Case Type",
          item.caseType
        )}

        ${metaItem(
          "Category",
          item.caseCategory
        )}

        ${metaItem(
          "Created",
          formatDate(item.createdDateTime)
        )}

        ${metaItem(
          "Last Modified",
          formatDate(
            item.lastModifiedDateTime
          )
        )}

      </div>

    </div>
  `;
}


function renderCaseContext(item) {
  return `
    <div class="ktms-card">

      <div class="ktms-section-header">

        <div>
          <h3>Case Context</h3>
        </div>

      </div>


      <div class="ktms-support-meta-grid">

        ${metaItem(
          "Player",
          item.playerName
            ? `${item.playerName} (${item.playerId || "—"})`
            : item.playerId
        )}

        ${metaItem(
          "Player Email",
          item.playerEmail
        )}

        ${metaItem(
          "Tournament",
          item.tournamentId
        )}

        ${metaItem(
          "Registration",
          item.registrationReferenceId ||
          item.registrationId
        )}

        ${metaItem(
          "Fixture",
          item.fixtureId
        )}

        ${metaItem(
          "Match Code",
          item.matchCode
        )}

        ${metaItem(
          "Transaction",
          item.transactionHistoryId
        )}

      </div>

    </div>
  `;
}


function renderPlayerDescription(item) {
  return `
    <div class="ktms-card">

      <div class="ktms-section-header">
        <h3>Player Description</h3>
      </div>

      <div class="ktms-support-description">
        ${
          item.playerDescription
            ? escapeHtml(
                item.playerDescription
              )
            : "No description provided."
        }
      </div>

    </div>
  `;
}


/* =========================================================
   MESSAGES
   ========================================================= */

function renderMessages(item) {
  const messages =
    array(item.messages);

  return `
    <div class="ktms-card">

      <div class="ktms-section-header">

        <div>
          <h3>Communication</h3>
          <p>
            Permanent case communication history.
          </p>
        </div>

      </div>


      ${
        !messages.length
          ? `
            <div class="ktms-empty-state">
              No messages recorded.
            </div>
          `
          : `
            <div class="ktms-support-message-list">

              ${messages
                .map(
                  (message) => `
                    <div class="ktms-support-message">

                      <div class="ktms-support-message-header">

                        <strong>
                          ${escapeHtml(
                            message.senderType ||
                            "Unknown"
                          )}
                        </strong>

                        <span>
                          ${formatDate(
                            message.createdDateTime
                          )}
                        </span>

                      </div>

                      <div class="ktms-support-message-body">
                        ${escapeHtml(
                          message.message || ""
                        )}
                      </div>

                    </div>
                  `
                )
                .join("")}

            </div>
          `
      }


      ${
        canManageSupport()
          ? `
            <div class="ktms-support-response-box">

              <label class="ktms-form-field">

                <span>
                  Add response
                </span>

                <textarea
                  id="support-response-message"
                  rows="4"
                  placeholder="Write a response to the case..."
                ></textarea>

              </label>

              <div class="ktms-support-response-actions">

                <button
                  id="support-respond"
                  class="ktms-primary-button"
                  type="button"
                >
                  RESPOND
                </button>

                <button
                  id="support-request-information"
                  class="ktms-secondary-button"
                  type="button"
                >
                  REQUEST INFORMATION
                </button>

              </div>

            </div>
          `
          : ""
      }

    </div>
  `;
}


/* =========================================================
   EVIDENCE
   ========================================================= */

function renderEvidence(item) {
  const evidence =
    array(item.evidence);

  return `
    <div class="ktms-card">

      <div class="ktms-section-header">

        <div>
          <h3>Evidence</h3>
          <p>
            Evidence associated with this case.
          </p>
        </div>

      </div>


      ${
        !evidence.length
          ? `
            <div class="ktms-empty-state">
              No evidence attached.
            </div>
          `
          : `
            <div class="ktms-support-evidence-list">

              ${evidence
                .map(
                  (item) => `
                    <div class="ktms-support-evidence">

                      <div>

                        <strong>
                          ${escapeHtml(
                            item.fileName ||
                            item.evidenceType ||
                            "Evidence"
                          )}
                        </strong>

                        <div class="ktms-support-row-subtext">
                          ${escapeHtml(
                            item.evidenceType ||
                            ""
                          )}
                        </div>

                      </div>

                      ${
                        item.evidenceUrl
                          ? `
                            <a
                              href="${escapeAttribute(
                                item.evidenceUrl
                              )}"
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              VIEW
                            </a>
                          `
                          : ""
                      }

                    </div>
                  `
                )
                .join("")}

            </div>
          `
      }

    </div>
  `;
}


/* =========================================================
   TIMELINE
   ========================================================= */

function renderTimeline(item) {
  const timeline =
    array(item.timeline);

  return `
    <div class="ktms-card">

      <div class="ktms-section-header">
        <h3>Timeline</h3>
      </div>


      ${
        !timeline.length
          ? `
            <div class="ktms-empty-state">
              No timeline events recorded.
            </div>
          `
          : `
            <div class="ktms-support-timeline">

              ${timeline
                .map(
                  (event) => `
                    <div class="ktms-support-timeline-item">

                      <div class="ktms-support-timeline-marker"></div>

                      <div>

                        <strong>
                          ${escapeHtml(
                            event.eventType ||
                            "Event"
                          )}
                        </strong>

                        <div>
                          ${escapeHtml(
                            event.eventSummary ||
                            ""
                          )}
                        </div>

                        <span>
                          ${formatDate(
                            event.createdDateTime
                          )}
                        </span>

                      </div>

                    </div>
                  `
                )
                .join("")}

            </div>
          `
      }

    </div>
  `;
}


/* =========================================================
   RESOLUTION
   ========================================================= */

function renderResolution(item) {
  const hasResolution =
    item.resolution ||
    item.resolutionExplanation ||
    item.resolutionDateTime;

  if (!hasResolution) {
    return "";
  }

  return `
    <div class="ktms-card">

      <div class="ktms-section-header">
        <h3>Resolution</h3>
      </div>

      <div class="ktms-support-meta-grid">

        ${metaItem(
          "Resolution",
          item.resolution
        )}

        ${metaItem(
          "Resolved",
          formatDate(
            item.resolutionDateTime
          )
        )}

        ${metaItem(
          "Resolving Administrator",
          item.resolvingAdminId
        )}

      </div>


      ${
        item.resolutionExplanation
          ? `
            <div class="ktms-support-resolution-text">

              <strong>
                Explanation
              </strong>

              <p>
                ${escapeHtml(
                  item.resolutionExplanation
                )}
              </p>

            </div>
          `
          : ""
      }

    </div>
  `;
}


/* =========================================================
   ACTIONS
   ========================================================= */

function renderActions(item) {
  if (!canManageSupport()) {
    return `
      <div class="ktms-card">

        <div class="ktms-message">
          You have read-only access to Support cases.
        </div>

      </div>
    `;
  }


  const status = item.status;


  const canResolve =
    ![
      "Resolved",
      "Rejected",
      "Closed"
    ].includes(status);


  const canReject =
    ![
      "Resolved",
      "Rejected",
      "Closed"
    ].includes(status);


  const canClose =
    [
      "Resolved",
      "Rejected"
    ].includes(status);


  const canReopen =
    [
      "Resolved",
      "Rejected",
      "Closed"
    ].includes(status);


  return `
    <div class="ktms-card">

      <div class="ktms-section-header">

        <div>
          <h3>Case Actions</h3>

          <p>
            Business-domain decisions remain
            owned by their respective KTMS services.
          </p>
        </div>

      </div>


      <div class="ktms-support-action-grid">

        ${
          canResolve
            ? `
              <button
                id="support-resolve"
                class="ktms-primary-button"
                type="button"
              >
                RESOLVE
              </button>
            `
            : ""
        }


        ${
          canReject
            ? `
              <button
                id="support-reject"
                class="ktms-danger-button"
                type="button"
              >
                REJECT
              </button>
            `
            : ""
        }


        ${
          canClose
            ? `
              <button
                id="support-close"
                class="ktms-secondary-button"
                type="button"
              >
                CLOSE
              </button>
            `
            : ""
        }


        ${
          canReopen
            ? `
              <button
                id="support-reopen"
                class="ktms-secondary-button"
                type="button"
              >
                REOPEN
              </button>
            `
            : ""
        }

      </div>

    </div>
  `;
}


function bindDetailEvents() {
  document
    .getElementById("support-respond")
    ?.addEventListener(
      "click",
      () => performResponse("respond")
    );


  document
    .getElementById(
      "support-request-information"
    )
    ?.addEventListener(
      "click",
      () =>
        performResponse(
          "requestInformation"
        )
    );


  document
    .getElementById("support-resolve")
    ?.addEventListener(
      "click",
      () => performDecision("resolve")
    );


  document
    .getElementById("support-reject")
    ?.addEventListener(
      "click",
      () => performDecision("reject")
    );


  document
    .getElementById("support-close")
    ?.addEventListener(
      "click",
      () => performClose()
    );


  document
    .getElementById("support-reopen")
    ?.addEventListener(
      "click",
      () => performReopen()
    );
}


/* =========================================================
   ACTION HANDLERS
   ========================================================= */

async function performResponse(action) {
  if (!state.selectedCase) return;

  const message =
    document.getElementById(
      "support-response-message"
    )?.value.trim();

  if (!message) {
    setMessage(
      "Enter a message before continuing.",
      "error"
    );
    return;
  }


  try {
    state.actionLoading = true;

    setMessage(
      action === "respond"
        ? "Sending response..."
        : "Requesting information...",
      "info"
    );


    if (action === "respond") {
      await respondToSupportCase(
        state.selectedCase.caseId,
        message
      );
    } else {
      await requestSupportInformation(
        state.selectedCase.caseId,
        message
      );
    }


    await refreshSelectedCase();

    setMessage(
      action === "respond"
        ? "Response recorded."
        : "Information request recorded.",
      "success"
    );

  } catch (error) {
    console.error(
      "KTMS support response action failed:",
      error
    );

    setMessage(
      error?.message ||
      "Support action failed.",
      "error"
    );

  } finally {
    state.actionLoading = false;
  }
}


async function performDecision(action) {
  if (!state.selectedCase) return;

  const resolution =
    window.prompt(
      action === "resolve"
        ? "Enter the resolution:"
        : "Enter the rejection resolution:"
    );

  if (!resolution?.trim()) {
    return;
  }


  const explanation =
    window.prompt(
      "Enter the resolution explanation:"
    );

  if (!explanation?.trim()) {
    return;
  }


  try {
    state.actionLoading = true;

    setMessage(
      action === "resolve"
        ? "Resolving case..."
        : "Rejecting case...",
      "info"
    );


    if (action === "resolve") {
      await resolveSupportCase(
        state.selectedCase.caseId,
        resolution.trim(),
        explanation.trim()
      );
    } else {
      await rejectSupportCase(
        state.selectedCase.caseId,
        resolution.trim(),
        explanation.trim()
      );
    }


    await refreshSelectedCase();
    await refreshCaseListOnly();


    setMessage(
      action === "resolve"
        ? "Case resolved."
        : "Case rejected.",
      "success"
    );

  } catch (error) {
    console.error(
      "KTMS support decision failed:",
      error
    );

    setMessage(
      error?.message ||
      "Unable to update the case.",
      "error"
    );

  } finally {
    state.actionLoading = false;
  }
}


async function performClose() {
  if (!state.selectedCase) return;


  if (
    !window.confirm(
      "Close this support case?"
    )
  ) {
    return;
  }


  try {
    state.actionLoading = true;

    setMessage(
      "Closing case...",
      "info"
    );


    await closeSupportCase(
      state.selectedCase.caseId
    );


    await refreshSelectedCase();
    await refreshCaseListOnly();


    setMessage(
      "Case closed.",
      "success"
    );

  } catch (error) {
    console.error(
      "KTMS support close failed:",
      error
    );

    setMessage(
      error?.message ||
      "Unable to close the case.",
      "error"
    );

  } finally {
    state.actionLoading = false;
  }
}


async function performReopen() {
  if (!state.selectedCase) return;


  const message =
    window.prompt(
      "Enter the reason for reopening this case:"
    );


  if (!message?.trim()) {
    return;
  }


  try {
    state.actionLoading = true;

    setMessage(
      "Reopening case...",
      "info"
    );


    await reopenSupportCase(
      state.selectedCase.caseId,
      message.trim()
    );


    await refreshSelectedCase();
    await refreshCaseListOnly();


    setMessage(
      "Case reopened.",
      "success"
    );

  } catch (error) {
    console.error(
      "KTMS support reopen failed:",
      error
    );

    setMessage(
      error?.message ||
      "Unable to reopen the case.",
      "error"
    );

  } finally {
    state.actionLoading = false;
  }
}


/* =========================================================
   DATA REFRESH
   ========================================================= */

async function loadCase(caseId) {
  try {
    state.selectedCaseLoading = true;

    setMessage(
      "Loading case...",
      "info"
    );


    const result =
      await getSupportCase(caseId);


    state.selectedCase =
      normalizeObject(result);


    renderWorkspace();


    setMessage(
      "Case loaded.",
      "success"
    );

  } catch (error) {
    console.error(
      "KTMS support case detail load failed:",
      error
    );

    setMessage(
      error?.message ||
      "Unable to load case.",
      "error"
    );

  } finally {
    state.selectedCaseLoading = false;
  }
}


async function refreshSelectedCase() {
  if (!state.selectedCase?.caseId) {
    return;
  }


  const caseId =
    state.selectedCase.caseId;


  const result =
    await getSupportCase(caseId);


  state.selectedCase =
    normalizeObject(result);


  renderWorkspace();
}


async function refreshCaseListOnly() {
  const result =
    await getSupportCases(
      state.filters
    );

  state.cases =
    normalizeRows(result);


  const list =
    document.getElementById(
      "support-case-list"
    );

  if (list) {
    list.innerHTML =
      renderCaseList();

    bindCaseSelectionEvents();
  }
}


/* =========================================================
   PERMISSIONS
   ========================================================= */

function canManageSupport() {
  return [
    "Game Master",
    "Support"
  ].includes(
    state.admin?.role
  );
}


/* =========================================================
   HELPERS
   ========================================================= */

function normalizeRows(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (Array.isArray(value?.data)) {
    return value.data;
  }

  if (Array.isArray(value?.rows)) {
    return value.rows;
  }

  return [];
}


function normalizeObject(value) {
  if (value?.data && !Array.isArray(value.data)) {
    return value.data;
  }

  return value || {};
}


function array(value) {
  return Array.isArray(value)
    ? value
    : [];
}


function metaItem(label, value) {
  return `
    <div class="ktms-support-meta-item">

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

    </div>
  `;
}


function statusBadge(status) {
  if (!status) {
    return `
      <span class="ktms-support-status">
        —
      </span>
    `;
  }

  return `
    <span
      class="ktms-support-status ktms-support-status-${slug(
        status
      )}"
    >
      ${escapeHtml(status)}
    </span>
  `;
}


function slug(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
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
    return escapeHtml(value);
  }

  return escapeHtml(
    date.toLocaleString()
  );
}


function setMessage(message, type = "info") {
  const element =
    document.getElementById(
      "support-message"
    );

  if (!element) return;

  element.className =
    `ktms-message ${type}`;

  element.textContent =
    message || "";
}


function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}


function escapeAttribute(value) {
  return escapeHtml(value);
}
