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


/* =========================================================
   KTMS SUPPORT MODULE
   ========================================================= */

const state = {
  admin: null,

  filters: {
    filter: "All",
    caseType: "",
    caseCategory: "",
    search: ""
  },

  cases: [],
  selectedCaseId: null,
  selectedCase: null,

  loadingList: false,
  loadingDetail: false,
  actionLoading: false,

  error: "",
  message: ""
};


/* =========================================================
   PUBLIC ENTRY POINT
   ========================================================= */

export async function renderSupport(page, admin) {
  state.admin = admin || null;

  page.innerHTML = `
    <div class="ktms-support-module">

      <div
        id="support-message"
        class="ktms-support-feedback"
        aria-live="polite"
      ></div>

      <div class="ktms-support-toolbar">

        <div>
          <div class="ktms-support-kicker">
            SUPPORT OPERATIONS
          </div>

          <h2>Case Management</h2>

          <p>
            Review player support cases, disputes and appeals
            without bypassing the authoritative KTMS services.
          </p>
        </div>

        <button
          id="support-refresh"
          type="button"
          class="ktms-primary-button"
        >
          REFRESH
        </button>

      </div>

      <div class="ktms-support-workspace">

        <section class="ktms-support-queue">

          <div class="ktms-support-queue-header">

            <div>
              <strong>Support Queue</strong>
              <span id="support-case-count">0 cases</span>
            </div>

          </div>

          <div class="ktms-support-filters">

            <label class="ktms-support-field">
              <span>Search</span>

              <input
                id="support-search"
                type="search"
                placeholder="Case ID, player, subject..."
                autocomplete="off"
              >
            </label>

            <label class="ktms-support-field">
              <span>Status</span>

              <select id="support-filter">
                <option value="All">All</option>
                <option value="Open">Open</option>
                <option value="Disputes">Disputes</option>
                <option value="Submitted">Submitted</option>
                <option value="Under Review">Under Review</option>
                <option value="Awaiting Player Information">
                  Awaiting Player Information
                </option>
                <option value="Resolved">Resolved</option>
                <option value="Rejected">Rejected</option>
                <option value="Closed">Closed</option>
              </select>
            </label>

            <label class="ktms-support-field">
              <span>Case Type</span>

              <select id="support-case-type">
                <option value="">All types</option>
                <option value="Dispute">Dispute</option>
                <option value="Appeal">Appeal</option>
                <option value="Support">Support</option>
              </select>
            </label>

            <label class="ktms-support-field">
              <span>Category</span>

              <select id="support-case-category">
                <option value="">All categories</option>
              </select>
            </label>

          </div>

          <div
            id="support-case-list"
            class="ktms-support-case-list"
          >
            ${renderListLoading()}
          </div>

        </section>

        <section
          id="support-case-detail"
          class="ktms-support-detail"
        >
          ${renderEmptyDetail()}
        </section>

      </div>

    </div>
  `;

  bindEvents();

  await loadCases();
}


/* =========================================================
   EVENTS
   ========================================================= */

function bindEvents() {
  document
    .getElementById("support-refresh")
    ?.addEventListener("click", async () => {
      await refreshSupport();
    });

  document
    .getElementById("support-filter")
    ?.addEventListener("change", async (event) => {
      state.filters.filter = event.target.value;
      await loadCases();
    });

  document
    .getElementById("support-case-type")
    ?.addEventListener("change", async (event) => {
      state.filters.caseType = event.target.value;
      await loadCases();
    });

  document
    .getElementById("support-case-category")
    ?.addEventListener("change", async (event) => {
      state.filters.caseCategory = event.target.value;
      await loadCases();
    });

  const search =
    document.getElementById("support-search");

  search?.addEventListener("input", debounce(async () => {
    state.filters.search =
      search.value.trim();

    await loadCases();
  }, 350));

  document
    .getElementById("support-case-list")
    ?.addEventListener("click", async (event) => {
      const row =
        event.target.closest("[data-support-case-id]");

      if (!row) return;

      const caseId =
        row.dataset.supportCaseId;

      if (!caseId) return;

      await loadCase(caseId);
    });

  document
    .getElementById("support-case-detail")
    ?.addEventListener("click", async (event) => {
      const button =
        event.target.closest("[data-support-action]");

      if (!button) return;

      const action =
        button.dataset.supportAction;

      await handleCaseAction(action);
    });
}


/* =========================================================
   CASE LIST
   ========================================================= */

async function loadCases() {
  if (state.loadingList) return;

  state.loadingList = true;
  state.error = "";

  const list =
    document.getElementById("support-case-list");

  if (list) {
    list.innerHTML =
      renderListLoading();
  }

  try {
    const result =
      await getSupportCases({
        filter: state.filters.filter,
        caseType: state.filters.caseType,
        caseCategory: state.filters.caseCategory,
        search: state.filters.search
      });

    state.cases =
      Array.isArray(result)
        ? result
        : Array.isArray(result?.cases)
          ? result.cases
          : [];

    renderCaseList();

    updateCaseCount();

    updateCategoryOptions();

    /*
     * Keep the currently selected case if it still
     * exists in the refreshed queue.
     */
    if (state.selectedCaseId) {
      const stillExists =
        state.cases.some(
          item =>
            getCaseId(item) ===
            state.selectedCaseId
        );

      if (!stillExists) {
        state.selectedCaseId = null;
        state.selectedCase = null;

        renderDetail();
      }
    }

  } catch (error) {
    state.error =
      error?.message ||
      "Unable to load support cases.";

    if (list) {
      list.innerHTML =
        renderListError(state.error);
    }

    showFeedback(
      state.error,
      "error"
    );

  } finally {
    state.loadingList = false;
  }
}


function renderCaseList() {
  const list =
    document.getElementById("support-case-list");

  if (!list) return;

  if (!state.cases.length) {
    list.innerHTML = `
      <div class="ktms-support-no-cases">

        <div class="ktms-support-no-cases-icon">
          —
        </div>

        <strong>No support cases</strong>

        <p>
          No cases match the current queue filters.
        </p>

      </div>
    `;

    return;
  }

  list.innerHTML =
    state.cases
      .map((supportCase) =>
        renderCaseRow(supportCase)
      )
      .join("");
}


function renderCaseRow(supportCase) {
  const caseId =
    getCaseId(supportCase);

  const status =
    getCaseStatus(supportCase);

  const subject =
    getCaseSubject(supportCase);

  const player =
    getCasePlayer(supportCase);

  const tournament =
    getCaseTournament(supportCase);

  const modified =
    getCaseModified(supportCase);

  const selected =
    state.selectedCaseId === caseId;

  return `
    <button
      type="button"
      class="
        ktms-support-case-row
        ${selected ? "is-selected" : ""}
      "
      data-support-case-id="${escapeAttribute(caseId)}"
    >

      <div class="ktms-support-case-row-top">

        <span class="ktms-support-case-id">
          ${escapeHtml(caseId || "UNKNOWN")}
        </span>

        ${renderStatus(status)}

      </div>

      <strong class="ktms-support-case-subject">
        ${escapeHtml(subject || "Support case")}
      </strong>

      <div class="ktms-support-case-context">

        <span>
          ${escapeHtml(player || "Player unavailable")}
        </span>

        ${
          tournament
            ? `
              <span class="ktms-support-context-separator">
                /
              </span>
              <span>
                ${escapeHtml(tournament)}
              </span>
            `
            : ""
        }

      </div>

      <div class="ktms-support-case-modified">
        ${formatDate(modified)}
      </div>

    </button>
  `;
}


/* =========================================================
   CASE DETAIL
   ========================================================= */

async function loadCase(caseId) {
  if (state.loadingDetail) return;

  state.selectedCaseId =
    String(caseId);

  state.loadingDetail = true;

  renderCaseList();

  const detail =
    document.getElementById(
      "support-case-detail"
    );

  if (detail) {
    detail.innerHTML =
      renderDetailLoading();
  }

  try {
    const result =
      await getSupportCase(caseId);

    state.selectedCase =
      result?.case ||
      result?.supportCase ||
      result ||
      null;

    renderDetail();

  } catch (error) {
    state.selectedCase = null;

    if (detail) {
      detail.innerHTML =
        renderDetailError(
          error?.message ||
          "Unable to load support case."
        );
    }

    showFeedback(
      error?.message ||
      "Unable to load support case.",
      "error"
    );

  } finally {
    state.loadingDetail = false;
  }
}


function renderDetail() {
  const detail =
    document.getElementById(
      "support-case-detail"
    );

  if (!detail) return;

  if (!state.selectedCase) {
    detail.innerHTML =
      renderEmptyDetail();

    return;
  }

  const supportCase =
    state.selectedCase;

  const status =
    getCaseStatus(supportCase);

  detail.innerHTML = `
    <div class="ktms-support-detail-inner">

      ${renderDetailHeader(supportCase)}

      ${renderCaseMeta(supportCase)}

      ${renderDescription(supportCase)}

      ${renderConversation(supportCase)}

      ${renderEvidence(supportCase)}

      ${renderTimeline(supportCase)}

      ${renderResolution(supportCase)}

      ${renderActions(supportCase, status)}

    </div>
  `;
}


function renderDetailHeader(supportCase) {
  const caseId =
    getCaseId(supportCase);

  const subject =
    getCaseSubject(supportCase);

  const status =
    getCaseStatus(supportCase);

  const caseType =
    getCaseType(supportCase);

  const category =
    getCaseCategory(supportCase);

  return `
    <header class="ktms-support-detail-header">

      <div>

        <div class="ktms-support-detail-kicker">
          ${escapeHtml(caseType || "SUPPORT CASE")}
        </div>

        <h2>
          ${escapeHtml(subject || "Support Case")}
        </h2>

        <div class="ktms-support-detail-id">
          ${escapeHtml(caseId)}
        </div>

      </div>

      <div class="ktms-support-detail-status">

        ${renderStatus(status)}

        ${
          category
            ? `
              <span class="ktms-support-category">
                ${escapeHtml(category)}
              </span>
            `
            : ""
        }

      </div>

    </header>
  `;
}


/* =========================================================
   META
   ========================================================= */

function renderCaseMeta(supportCase) {
  const player =
    getCasePlayer(supportCase);

  const tournament =
    getCaseTournament(supportCase);

  const registration =
    getField(
      supportCase,
      [
        "registrationId",
        "registration_id"
      ]
    );

  const fixture =
    getField(
      supportCase,
      [
        "fixtureId",
        "fixture_id"
      ]
    );

  const payment =
    getField(
      supportCase,
      [
        "paymentId",
        "payment_id",
        "transactionId",
        "transaction_id"
      ]
    );

  const submitted =
    getField(
      supportCase,
      [
        "createdDateTime",
        "created_datetime",
        "createdAt",
        "created_at"
      ]
    );

  const modified =
    getCaseModified(supportCase);

  return `
    <section class="ktms-support-meta-grid">

      ${metaItem("Player", player)}

      ${metaItem("Tournament", tournament)}

      ${metaItem("Registration", registration)}

      ${metaItem("Fixture", fixture)}

      ${metaItem("Payment", payment)}

      ${metaItem("Submitted", formatDate(submitted))}

      ${metaItem("Last modified", formatDate(modified))}

    </section>
  `;
}


function metaItem(label, value) {
  return `
    <div class="ktms-support-meta-item">

      <span>${escapeHtml(label)}</span>

      <strong>
        ${escapeHtml(value || "—")}
      </strong>

    </div>
  `;
}


/* =========================================================
   DESCRIPTION
   ========================================================= */

function renderDescription(supportCase) {
  const description =
    getField(
      supportCase,
      [
        "description",
        "caseDescription"
      ]
    );

  if (!description) return "";

  return `
    <section class="ktms-support-section">

      <div class="ktms-support-section-heading">
        <span>CASE DESCRIPTION</span>
      </div>

      <div class="ktms-support-description">
        ${formatMultiline(description)}
      </div>

    </section>
  `;
}


/* =========================================================
   CONVERSATION
   ========================================================= */

function renderConversation(supportCase) {
  const messages =
    getArray(
      supportCase,
      [
        "messages",
        "caseMessages",
        "supportMessages"
      ]
    );

  return `
    <section class="ktms-support-section">

      <div class="ktms-support-section-heading">

        <span>CONVERSATION</span>

        <span class="ktms-support-section-count">
          ${messages.length}
        </span>

      </div>

      ${
        messages.length
          ? `
            <div class="ktms-support-message-list">
              ${messages
                .map(renderMessage)
                .join("")}
            </div>
          `
          : `
            <div class="ktms-support-section-empty">
              No messages recorded for this case.
            </div>
          `
      }

    </section>
  `;
}


function renderMessage(message) {
  const body =
    getField(
      message,
      [
        "messageBody",
        "message_body",
        "body",
        "message"
      ]
    );

  const sender =
    getField(
      message,
      [
        "senderName",
        "sender_name",
        "createdByName",
        "created_by_name",
        "sender"
      ]
    );

  const senderType =
    getField(
      message,
      [
        "senderType",
        "sender_type",
        "authorType",
        "author_type"
      ]
    );

  const created =
    getField(
      message,
      [
        "createdDateTime",
        "created_datetime",
        "createdAt",
        "created_at"
      ]
    );

  return `
    <article class="ktms-support-message">

      <div class="ktms-support-message-header">

        <div>

          <strong>
            ${escapeHtml(sender || "KTMS")}
          </strong>

          ${
            senderType
              ? `
                <span>
                  ${escapeHtml(senderType)}
                </span>
              `
              : ""
          }

        </div>

        <time>
          ${formatDate(created)}
        </time>

      </div>

      <div class="ktms-support-message-body">
        ${formatMultiline(body)}
      </div>

    </article>
  `;
}


/* =========================================================
   EVIDENCE
   ========================================================= */

function renderEvidence(supportCase) {
  const evidence =
    getArray(
      supportCase,
      [
        "evidence",
        "caseEvidence"
      ]
    );

  if (!evidence.length) return "";

  return `
    <section class="ktms-support-section">

      <div class="ktms-support-section-heading">
        <span>EVIDENCE</span>

        <span class="ktms-support-section-count">
          ${evidence.length}
        </span>
      </div>

      <div class="ktms-support-evidence-list">

        ${evidence
          .map(renderEvidenceItem)
          .join("")}

      </div>

    </section>
  `;
}


function renderEvidenceItem(item) {
  const name =
    getField(
      item,
      [
        "fileName",
        "file_name",
        "name",
        "title"
      ]
    ) || "Evidence";

  const url =
    getField(
      item,
      [
        "fileUrl",
        "file_url",
        "url",
        "evidenceUrl",
        "evidence_url"
      ]
    );

  const type =
    getField(
      item,
      [
        "fileType",
        "file_type",
        "mimeType",
        "mime_type"
      ]
    );

  return `
    <div class="ktms-support-evidence">

      <div>

        <strong>
          ${escapeHtml(name)}
        </strong>

        ${
          type
            ? `
              <span>
                ${escapeHtml(type)}
              </span>
            `
            : ""
        }

      </div>

      ${
        url
          ? `
            <a
              href="${escapeAttribute(url)}"
              target="_blank"
              rel="noopener noreferrer"
            >
              VIEW
            </a>
          `
          : `
            <span class="ktms-support-no-link">
              NO LINK
            </span>
          `
      }

    </div>
  `;
}


/* =========================================================
   TIMELINE
   ========================================================= */

function renderTimeline(supportCase) {
  const events =
    getArray(
      supportCase,
      [
        "timeline",
        "events",
        "caseEvents"
      ]
    );

  if (!events.length) return "";

  return `
    <section class="ktms-support-section">

      <div class="ktms-support-section-heading">
        <span>CASE TIMELINE</span>

        <span class="ktms-support-section-count">
          ${events.length}
        </span>
      </div>

      <div class="ktms-support-timeline">

        ${events
          .map(renderTimelineEvent)
          .join("")}

      </div>

    </section>
  `;
}


function renderTimelineEvent(event) {
  const action =
    getField(
      event,
      [
        "eventType",
        "event_type",
        "action",
        "actionType",
        "action_type",
        "description"
      ]
    ) || "Case event";

  const actor =
    getField(
      event,
      [
        "performedByName",
        "performed_by_name",
        "adminName",
        "admin_name",
        "actorName",
        "actor_name"
      ]
    );

  const timestamp =
    getField(
      event,
      [
        "createdDateTime",
        "created_datetime",
        "createdAt",
        "created_at"
      ]
    );

  return `
    <div class="ktms-support-timeline-item">

      <div class="ktms-support-timeline-marker"></div>

      <div class="ktms-support-timeline-content">

        <strong>
          ${escapeHtml(action)}
        </strong>

        <div>
          ${
            actor
              ? escapeHtml(actor)
              : "System"
          }
        </div>

        <time>
          ${formatDate(timestamp)}
        </time>

      </div>

    </div>
  `;
}


/* =========================================================
   RESOLUTION
   ========================================================= */

function renderResolution(supportCase) {
  const resolution =
    getField(
      supportCase,
      [
        "resolution"
      ]
    );

  const explanation =
    getField(
      supportCase,
      [
        "resolutionExplanation",
        "resolution_explanation"
      ]
    );

  const resolvedBy =
    getField(
      supportCase,
      [
        "resolvedByName",
        "resolved_by_name",
        "resolvingAdminName",
        "resolving_admin_name"
      ]
    );

  if (!resolution && !explanation) {
    return "";
  }

  return `
    <section class="ktms-support-section">

      <div class="ktms-support-section-heading">
        <span>RESOLUTION</span>
      </div>

      <div class="ktms-support-resolution">

        ${
          resolution
            ? `
              <div class="ktms-support-resolution-row">
                <span>Decision</span>
                <strong>
                  ${escapeHtml(resolution)}
                </strong>
              </div>
            `
            : ""
        }

        ${
          resolvedBy
            ? `
              <div class="ktms-support-resolution-row">
                <span>Resolved by</span>
                <strong>
                  ${escapeHtml(resolvedBy)}
                </strong>
              </div>
            `
            : ""
        }

        ${
          explanation
            ? `
              <div class="ktms-support-resolution-explanation">
                ${formatMultiline(explanation)}
              </div>
            `
            : ""
        }

      </div>

    </section>
  `;
}


/* =========================================================
   ACTIONS
   ========================================================= */

function renderActions(supportCase, status) {
  const canManage =
    canManageSupport();

  if (!canManage) {
    return `
      <section class="ktms-support-action-notice">
        <strong>Read-only access</strong>
        <span>
          Your administrator role can view this case but
          cannot modify it.
        </span>
      </section>
    `;
  }

  const isClosed =
    status === "Closed";

  const isResolved =
    status === "Resolved";

  const isRejected =
    status === "Rejected";

  const canRespond =
    !isClosed &&
    !isResolved &&
    !isRejected;

  const canRequestInfo =
    canRespond;

  const canResolve =
    canRespond;

  const canReject =
    canRespond;

  const canClose =
    isResolved ||
    isRejected;

  const canReopen =
    isResolved ||
    isRejected ||
    isClosed;

  return `
    <section class="ktms-support-actions">

      <div class="ktms-support-section-heading">
        <span>CASE ACTIONS</span>
      </div>

      <div class="ktms-support-action-grid">

        ${
          canRespond
            ? `
              <button
                type="button"
                class="ktms-secondary-button"
                data-support-action="respond"
              >
                RESPOND
              </button>
            `
            : ""
        }

        ${
          canRequestInfo
            ? `
              <button
                type="button"
                class="ktms-secondary-button"
                data-support-action="request_information"
              >
                REQUEST INFORMATION
              </button>
            `
            : ""
        }

        ${
          canResolve
            ? `
              <button
                type="button"
                class="ktms-primary-button"
                data-support-action="resolve"
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
                type="button"
                class="ktms-danger-button"
                data-support-action="reject"
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
                type="button"
                class="ktms-secondary-button"
                data-support-action="close"
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
                type="button"
                class="ktms-secondary-button"
                data-support-action="reopen"
              >
                REOPEN
              </button>
            `
            : ""
        }

      </div>

    </section>
  `;
}


/* =========================================================
   ACTION HANDLING
   ========================================================= */

async function handleCaseAction(action) {
  if (
    state.actionLoading ||
    !state.selectedCaseId
  ) {
    return;
  }

  const caseId =
    state.selectedCaseId;

  if (
    action === "respond" ||
    action === "request_information"
  ) {
    const message =
      window.prompt(
        action === "respond"
          ? "Enter your response:"
          : "Enter the information request:"
      );

    if (message === null) return;

    const trimmed =
      message.trim();

    if (!trimmed) {
      showFeedback(
        "A message is required.",
        "error"
      );

      return;
    }

    if (trimmed.length > 10000) {
      showFeedback(
        "Message cannot exceed 10,000 characters.",
        "error"
      );

      return;
    }

    await performAction(
      action,
      async () => {
        if (action === "respond") {
          return respondToSupportCase(
            caseId,
            trimmed
          );
        }

        return requestSupportInformation(
          caseId,
          trimmed
        );
      }
    );

    return;
  }


  if (
    action === "resolve" ||
    action === "reject"
  ) {
    const resolution =
      window.prompt(
        action === "resolve"
          ? "Enter the resolution:"
          : "Enter the rejection resolution:"
      );

    if (resolution === null) return;

    const explanation =
      window.prompt(
        "Enter the resolution explanation:"
      );

    if (explanation === null) return;

    const trimmedResolution =
      resolution.trim();

    const trimmedExplanation =
      explanation.trim();

    if (!trimmedResolution) {
      showFeedback(
        "A resolution is required.",
        "error"
      );

      return;
    }

    if (!trimmedExplanation) {
      showFeedback(
        "A resolution explanation is required.",
        "error"
      );

      return;
    }

    if (trimmedExplanation.length > 10000) {
      showFeedback(
        "Resolution explanation cannot exceed 10,000 characters.",
        "error"
      );

      return;
    }

    await performAction(
      action,
      async () => {
        if (action === "resolve") {
          return resolveSupportCase(
            caseId,
            trimmedResolution,
            trimmedExplanation
          );
        }

        return rejectSupportCase(
          caseId,
          trimmedResolution,
          trimmedExplanation
        );
      }
    );

    return;
  }


  if (action === "close") {
    const confirmed =
      window.confirm(
        "Close this support case?"
      );

    if (!confirmed) return;

    await performAction(
      action,
      () => closeSupportCase(caseId)
    );

    return;
  }


  if (action === "reopen") {
    const confirmed =
      window.confirm(
        "Reopen this support case?"
      );

    if (!confirmed) return;

    await performAction(
      action,
      () => reopenSupportCase(caseId)
    );
  }
}


async function performAction(action, operation) {
  state.actionLoading = true;

  disableActionButtons(true);

  try {
    await operation();

    showFeedback(
      actionSuccessMessage(action),
      "success"
    );

    /*
     * Reload both queue and detail from the backend.
     * The frontend never manufactures the new status,
     * resolution or timeline.
     */
    await loadCases();

    if (state.selectedCaseId) {
      await loadCase(
        state.selectedCaseId
      );
    }

  } catch (error) {
    showFeedback(
      error?.message ||
      "Support action failed.",
      "error"
    );

  } finally {
    state.actionLoading = false;

    disableActionButtons(false);
  }
}


function actionSuccessMessage(action) {
  const messages = {
    respond: "Response recorded.",
    request_information:
      "Information request recorded.",
    resolve:
      "Support case resolved.",
    reject:
      "Support case rejected.",
    close:
      "Support case closed.",
    reopen:
      "Support case reopened."
  };

  return (
    messages[action] ||
    "Support case updated."
  );
}


/* =========================================================
   ROLE / PERMISSION PRESENTATION
   ========================================================= */

function canManageSupport() {
  const role =
    String(
      state.admin?.role ||
      ""
    )
      .trim()
      .toLowerCase();

  /*
   * Backend remains authoritative.
   *
   * This is only UI presentation so Moderator does not
   * receive management controls that it cannot use.
   */
  return (
    role === "game master" ||
    role === "support"
  );
}


/* =========================================================
   REFRESH
   ========================================================= */

async function refreshSupport() {
  state.message = "";

  await loadCases();

  if (state.selectedCaseId) {
    await loadCase(
      state.selectedCaseId
    );
  }

  showFeedback(
    "Support queue refreshed.",
    "success"
  );
}


/* =========================================================
   LOADING / EMPTY / ERROR
   ========================================================= */

function renderListLoading() {
  return `
    <div class="ktms-support-loading">

      <div class="ktms-support-loading-line"></div>
      <div class="ktms-support-loading-line"></div>
      <div class="ktms-support-loading-line"></div>
      <div class="ktms-support-loading-line"></div>

    </div>
  `;
}


function renderDetailLoading() {
  return `
    <div class="ktms-support-detail-loading">

      <div class="ktms-support-loading-block"></div>
      <div class="ktms-support-loading-block"></div>
      <div class="ktms-support-loading-block"></div>

    </div>
  `;
}


function renderListError(message) {
  return `
    <div class="ktms-support-error-state">

      <strong>
        Unable to load support queue
      </strong>

      <p>
        ${escapeHtml(message)}
      </p>

      <button
        type="button"
        class="ktms-secondary-button"
        id="support-retry"
      >
        RETRY
      </button>

    </div>
  `;
}


function renderDetailError(message) {
  return `
    <div class="ktms-support-error-state">

      <strong>
        Unable to load case
      </strong>

      <p>
        ${escapeHtml(message)}
      </p>

    </div>
  `;
}


function renderEmptyDetail() {
  return `
    <div class="ktms-support-empty-detail">

      <div class="ktms-support-empty-detail-mark">
        SUPPORT
      </div>

      <h3>
        Select a case
      </h3>

      <p>
        Choose a support case from the queue to review
        its player context, conversation, evidence,
        timeline and available actions.
      </p>

    </div>
  `;
}


/* =========================================================
   FEEDBACK
   ========================================================= */

function showFeedback(
  message,
  type = "info"
) {
  const element =
    document.getElementById(
      "support-message"
    );

  if (!element) return;

  element.textContent =
    message || "";

  element.className =
    `ktms-support-feedback is-visible ${type}`;

  window.clearTimeout(
    showFeedback.timeout
  );

  showFeedback.timeout =
    window.setTimeout(() => {
      element.textContent = "";
      element.className =
        "ktms-support-feedback";
    }, 5000);
}


/* =========================================================
   UI HELPERS
   ========================================================= */

function updateCaseCount() {
  const element =
    document.getElementById(
      "support-case-count"
    );

  if (!element) return;

  const count =
    state.cases.length;

  element.textContent =
    `${count} ${count === 1 ? "case" : "cases"}`;
}


function updateCategoryOptions() {
  const select =
    document.getElementById(
      "support-case-category"
    );

  if (!select) return;

  const current =
    state.filters.caseCategory;

  const categories =
    [
      ...new Set(
        state.cases
          .map(
            item =>
              getCaseCategory(item)
          )
          .filter(Boolean)
      )
    ]
      .sort();

  select.innerHTML = `
    <option value="">
      All categories
    </option>

    ${categories
      .map(
        category => `
          <option
            value="${escapeAttribute(category)}"
          >
            ${escapeHtml(category)}
          </option>
        `
      )
      .join("")}
  `;

  select.value =
    categories.includes(current)
      ? current
      : "";
}


function disableActionButtons(disabled) {
  document
    .querySelectorAll(
      "[data-support-action]"
    )
    .forEach(button => {
      button.disabled =
        disabled;
    });
}


/* =========================================================
   DATA NORMALIZATION
   ========================================================= */

function getCaseId(item) {
  return String(
    getField(
      item,
      [
        "caseId",
        "case_id",
        "id"
      ]
    ) || ""
  );
}


function getCaseStatus(item) {
  return String(
    getField(
      item,
      [
        "status",
        "caseStatus",
        "case_status"
      ]
    ) || ""
  );
}


function getCaseSubject(item) {
  return String(
    getField(
      item,
      [
        "subject",
        "caseSubject",
        "case_subject"
      ]
    ) || ""
  );
}


function getCaseType(item) {
  return String(
    getField(
      item,
      [
        "caseType",
        "case_type",
        "type"
      ]
    ) || ""
  );
}


function getCaseCategory(item) {
  return String(
    getField(
      item,
      [
        "caseCategory",
        "case_category",
        "category"
      ]
    ) || ""
  );
}


function getCasePlayer(item) {
  return String(
    getField(
      item,
      [
        "playerName",
        "player_name",
        "managerName",
        "manager_name",
        "playerId",
        "player_id"
      ]
    ) || ""
  );
}


function getCaseTournament(item) {
  return String(
    getField(
      item,
      [
        "tournamentId",
        "tournament_id"
      ]
    ) || ""
  );
}


function getCaseModified(item) {
  return getField(
    item,
    [
      "lastModifiedDateTime",
      "last_modified_datetime",
      "modifiedDateTime",
      "modified_datetime",
      "updatedAt",
      "updated_at"
    ]
  );
}


function getField(
  object,
  fields
) {
  if (!object) return "";

  for (const field of fields) {
    if (
      object[field] !== undefined &&
      object[field] !== null
    ) {
      return object[field];
    }
  }

  return "";
}


function getArray(
  object,
  fields
) {
  const value =
    getField(
      object,
      fields
    );

  return Array.isArray(value)
    ? value
    : [];
}


/* =========================================================
   FORMATTING
   ========================================================= */

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


function formatMultiline(value) {
  return escapeHtml(
    value || "—"
  ).replaceAll(
    "\n",
    "<br>"
  );
}


function renderStatus(status) {
  if (!status) {
    return `
      <span class="ktms-support-status">
        —
      </span>
    `;
  }

  return `
    <span
      class="
        ktms-support-status
        ktms-support-status-${slug(status)}
      "
    >
      ${escapeHtml(status)}
    </span>
  `;
}


function slug(value) {
  return String(value)
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


function debounce(
  callback,
  delay
) {
  let timer = null;

  return (...args) => {
    window.clearTimeout(timer);

    timer =
      window.setTimeout(
        () => callback(...args),
        delay
      );
  };
}
