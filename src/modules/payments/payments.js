import { adminApi } from "../../api/admin-api.js";

let paymentState = {
  summary: null,
  transactions: [],
  selectedTransaction: null,
  tournaments: [],
  filters: {
    tournamentId: "",
    paymentStatus: "",
    paymentMethod: "",
    paymentProvider: "",
    search: "",
    fromDatetime: "",
    toDatetime: ""
  }
};

export async function renderPayments(page) {
  paymentState.selectedTransaction = null;

  page.innerHTML = `
    <div class="ktms-payment-module">

      <div class="ktms-module-toolbar">
        <div>
          <h1>Payments</h1>
          <p>Monitor payments, verify bank transfers, and review tournament payment activity.</p>
        </div>

        <button type="button" class="ktms-secondary-button" id="payment-refresh">
          REFRESH
        </button>
      </div>

      <div id="payment-message" class="ktms-message"></div>

      <!-- Tournament Selection -->
      <section class="ktms-section">
        <div class="ktms-section-header">
          <h2 class="ktms-section-title">Tournament</h2>
          <p class="ktms-section-subtitle">
            Select a KT tournament to view its payment activity.
          </p>
        </div>

        <div class="ktms-payment-tournament-selector">
          <label for="payment-tournament">
            Tournament
          </label>

          <select id="payment-tournament">
            <option value="">Select a tournament</option>
          </select>
        </div>
      </section>

      <!-- Payment Content -->
      <div id="payment-content">
        <div class="ktms-empty-state">
          <strong>Select a tournament</strong>
          Choose a KT tournament above to view its payment activity.
        </div>
      </div>

    </div>
  `;

  bindTournamentSelector();
  bindRefresh();

  await loadTournaments();
}

async function loadTournaments() {
  const selector = document.getElementById("payment-tournament");

  if (!selector) {
    return;
  }

  selector.disabled = true;

  try {
    /*
     * Reuse the existing tournament read endpoint.
     * This assumes the Admin API already supports tournament.list,
     * which is already used by the Admin Console tournament module.
     */
    const result = await adminApi("tournament.list", {});

    paymentState.tournaments = normalizeTournaments(result);

    selector.innerHTML = `
      <option value="">Select a tournament</option>
      ${paymentState.tournaments
        .map((tournament) => {
          return `
            <option value="${escapeAttribute(tournament.tournamentId)}">
              ${escapeHtml(tournament.tournamentId)}
              — ${escapeHtml(tournament.tournamentName)}
            </option>
          `;
        })
        .join("")}
    `;

    selector.disabled = false;

    /*
     * Restore the previous tournament if one exists.
     */
    if (paymentState.filters.tournamentId) {
      const exists = paymentState.tournaments.some(
        (tournament) =>
          tournament.tournamentId === paymentState.filters.tournamentId
      );

      if (exists) {
        selector.value = paymentState.filters.tournamentId;
        await loadTournamentPayments();
      }
    }
  } catch (error) {
    selector.disabled = false;

    showMessage(
      error?.message || "Unable to load tournaments.",
      "error"
    );
  }
}

function normalizeTournaments(result) {
  const rows =
    result?.tournaments ||
    result?.data ||
    result?.items ||
    result ||
    [];

  if (!Array.isArray(rows)) {
    return [];
  }

  return rows
    .map((row) => {
      const tournamentId =
        row.tournamentId ??
        row.tournament_id ??
        row.id ??
        "";

      const tournamentName =
        row.tournamentName ??
        row.tournament_name ??
        row.name ??
        tournamentId;

      return {
        tournamentId: String(tournamentId),
        tournamentName: String(tournamentName)
      };
    })
    .filter((row) => row.tournamentId);
}

function bindTournamentSelector() {
  const selector = document.getElementById("payment-tournament");

  if (!selector) {
    return;
  }

  selector.addEventListener("change", async () => {
    paymentState.filters.tournamentId = selector.value;
    paymentState.selectedTransaction = null;

    if (!paymentState.filters.tournamentId) {
      renderUnselectedTournament();
      return;
    }

    await loadTournamentPayments();
  });
}

function bindRefresh() {
  const button = document.getElementById("payment-refresh");

  if (!button) {
    return;
  }

  button.addEventListener("click", async () => {
    if (!paymentState.filters.tournamentId) {
      await loadTournaments();
      return;
    }

    await loadTournamentPayments();
  });
}

async function loadTournamentPayments() {
  const tournamentId = paymentState.filters.tournamentId;

  /*
   * Critical protection:
   * Never load payments without a tournament ID.
   */
  if (!tournamentId) {
    renderUnselectedTournament();
    return;
  }

  const content = document.getElementById("payment-content");

  if (!content) {
    return;
  }

  content.innerHTML = `
    <div class="ktms-loading-state">
      Loading payment activity...
    </div>
  `;

  clearMessage();

  try {
    const [summaryResult, transactionResult] = await Promise.all([
      adminApi("payment.summary", {
        tournamentId,
        fromDatetime: normalizeDatetime(
          paymentState.filters.fromDatetime
        ),
        toDatetime: normalizeDatetime(
          paymentState.filters.toDatetime
        )
      }),

      adminApi("payment.list", {
        tournamentId,
        paymentStatus:
          paymentState.filters.paymentStatus || null,
        paymentMethod:
          paymentState.filters.paymentMethod || null,
        paymentProvider:
          paymentState.filters.paymentProvider || null,
        search:
          paymentState.filters.search || null,
        fromDatetime: normalizeDatetime(
          paymentState.filters.fromDatetime
        ),
        toDatetime: normalizeDatetime(
          paymentState.filters.toDatetime
        )
      })
    ]);

    paymentState.summary = normalizeSummary(summaryResult);
    paymentState.transactions =
      normalizeTransactions(transactionResult);

    renderTournamentPaymentContent();
  } catch (error) {
    content.innerHTML = `
      <div class="ktms-error-state">
        Unable to load payment activity.
        ${escapeHtml(error?.message || "")}
      </div>
    `;
  }
}

function renderTournamentPaymentContent() {
  const content = document.getElementById("payment-content");

  if (!content) {
    return;
  }

  content.innerHTML = `
    <section class="ktms-section">

      <div class="ktms-section-header">
        <h2 class="ktms-section-title">Payments</h2>
        <p class="ktms-section-subtitle">
          Payment activity for
          <strong>${escapeHtml(
            paymentState.filters.tournamentId
          )}</strong>.
        </p>
      </div>

      ${renderSummary()}

      ${renderFilters()}

      <div id="payment-transactions">
        ${renderTransactions()}
      </div>

      <div id="payment-detail-container"></div>

    </section>
  `;

  bindPaymentFilters();
  bindTransactionButtons();
}

function renderSummary() {
  const summary = paymentState.summary || {};

  return `
    <div class="ktms-payment-summary-grid">

      ${paymentStatCard(
        "SUCCESSFUL",
        toNumber(summary.successfulCount),
        formatMoney(summary.successfulAmount),
        "success"
      )}

      ${paymentStatCard(
        "PENDING",
        toNumber(summary.pendingCount),
        formatMoney(summary.pendingAmount),
        "pending"
      )}

      ${paymentStatCard(
        "FAILED",
        toNumber(summary.failedCount),
        formatMoney(summary.failedAmount),
        "failed"
      )}

      ${paymentStatCard(
        "REFUNDED",
        toNumber(summary.refundedCount),
        null,
        "refunded"
      )}

      ${paymentStatCard(
        "TOTAL TRANSACTIONS",
        toNumber(summary.transactionCount),
        null,
        "neutral"
      )}

    </div>
  `;
}

function paymentStatCard(label, value, secondary, type) {
  return `
    <div class="ktms-payment-stat ktms-payment-stat-${type}">
      <div class="ktms-payment-stat-label">
        ${escapeHtml(label)}
      </div>

      <div class="ktms-payment-stat-value">
        ${formatNumber(value)}
      </div>

      ${
        secondary
          ? `
            <div class="ktms-payment-secondary-text">
              ${escapeHtml(secondary)}
            </div>
          `
          : ""
      }
    </div>
  `;
}

function renderFilters() {
  return `
    <section class="ktms-section">

      <div class="ktms-section-header">
        <h3 class="ktms-section-title">Transactions</h3>
        <p class="ktms-section-subtitle">
          Payment transactions recorded for this tournament.
        </p>
      </div>

      <div class="ktms-payment-filters">

        <div class="ktms-payment-filter">
          <label for="payment-search">Search</label>
          <input
            id="payment-search"
            type="search"
            placeholder="Reference, player, transaction..."
            value="${escapeAttribute(
              paymentState.filters.search
            )}"
          />
        </div>

        <div class="ktms-payment-filter">
          <label for="payment-status">Status</label>

          <select id="payment-status">
            <option value="">All statuses</option>
            <option value="SUCCESSFUL">Successful</option>
            <option value="PENDING">Pending</option>
            <option value="AWAITING_VERIFICATION">
              Awaiting Verification
            </option>
            <option value="FAILED">Failed</option>
            <option value="REFUNDED">Refunded</option>
          </select>
        </div>

        <div class="ktms-payment-filter">
          <label for="payment-method">Method</label>

          <select id="payment-method">
            <option value="">All methods</option>
            <option value="PAYSTACK">Paystack</option>
            <option value="BANK_TRANSFER">
              Bank Transfer
            </option>
          </select>
        </div>

        <div class="ktms-payment-filter">
          <label for="payment-provider">Provider</label>

          <select id="payment-provider">
            <option value="">All providers</option>
            <option value="PAYSTACK">Paystack</option>
            <option value="BANK_TRANSFER">
              Bank Transfer
            </option>
          </select>
        </div>

        <div class="ktms-payment-filter">
          <label for="payment-from">From</label>

          <input
            id="payment-from"
            type="datetime-local"
            value="${escapeAttribute(
              paymentState.filters.fromDatetime
            )}"
          />
        </div>

        <div class="ktms-payment-filter">
          <label for="payment-to">To</label>

          <input
            id="payment-to"
            type="datetime-local"
            value="${escapeAttribute(
              paymentState.filters.toDatetime
            )}"
          />
        </div>

        <div class="ktms-payment-filter-action">
          <button
            type="button"
            class="ktms-primary-button"
            id="payment-apply-filters"
          >
            APPLY FILTERS
          </button>
        </div>

      </div>
    </section>
  `;
}

function bindPaymentFilters() {
  const applyButton =
    document.getElementById("payment-apply-filters");

  if (applyButton) {
    applyButton.addEventListener("click", async () => {
      paymentState.filters.search =
        getInputValue("payment-search");

      paymentState.filters.paymentStatus =
        getInputValue("payment-status");

      paymentState.filters.paymentMethod =
        getInputValue("payment-method");

      paymentState.filters.paymentProvider =
        getInputValue("payment-provider");

      paymentState.filters.fromDatetime =
        getInputValue("payment-from");

      paymentState.filters.toDatetime =
        getInputValue("payment-to");

      await loadTournamentPayments();
    });
  }

  const searchInput =
    document.getElementById("payment-search");

  if (searchInput) {
    searchInput.addEventListener("keydown", async (event) => {
      if (event.key !== "Enter") {
        return;
      }

      paymentState.filters.search = searchInput.value.trim();

      await loadTournamentPayments();
    });
  }

  const statusSelect =
    document.getElementById("payment-status");

  if (statusSelect) {
    statusSelect.value =
      paymentState.filters.paymentStatus;
  }

  const methodSelect =
    document.getElementById("payment-method");

  if (methodSelect) {
    methodSelect.value =
      paymentState.filters.paymentMethod;
  }

  const providerSelect =
    document.getElementById("payment-provider");

  if (providerSelect) {
    providerSelect.value =
      paymentState.filters.paymentProvider;
  }
}

function renderTransactions() {
  const transactions = paymentState.transactions;

  if (!transactions.length) {
    return `
      <div class="ktms-empty-state">
        <strong>No payment transactions</strong>
        No payment transactions match the current filters
        for this tournament.
      </div>
    `;
  }

  return `
    <div class="ktms-table-wrap">

      <table class="ktms-table ktms-payment-table">

        <thead>
          <tr>
            <th>Payment Reference</th>
            <th>Player</th>
            <th>Tournament</th>
            <th>Amount</th>
            <th>Method</th>
            <th>Status</th>
            <th>Payment Date</th>
            <th>Action</th>
          </tr>
        </thead>

        <tbody>
          ${transactions
            .map(renderTransactionRow)
            .join("")}
        </tbody>

      </table>

    </div>
  `;
}

function renderTransactionRow(transaction) {
  const transactionId =
    transaction.transactionHistoryId ||
    transaction.transaction_history_id ||
    "";

  return `
    <tr>

      <td>
        <span class="ktms-payment-reference">
          ${escapeHtml(
            transaction.paymentReference || "—"
          )}
        </span>

        ${
          transaction.transactionId
            ? `
              <span class="ktms-payment-secondary-text">
                ${escapeHtml(transaction.transactionId)}
              </span>
            `
            : ""
        }
      </td>

      <td>
        <strong>
          ${escapeHtml(transaction.playerName || "—")}
        </strong>

        ${
          transaction.playerId
            ? `
              <span class="ktms-payment-secondary-text">
                ${escapeHtml(transaction.playerId)}
              </span>
            `
            : ""
        }
      </td>

      <td>
        ${escapeHtml(transaction.tournamentName || "—")}

        <span class="ktms-payment-secondary-text">
          ${escapeHtml(transaction.tournamentId || "")}
        </span>
      </td>

      <td>
        ${escapeHtml(
          formatMoney(transaction.amount)
        )}
      </td>

      <td>
        ${escapeHtml(
          formatStatus(transaction.paymentMethod)
        )}
      </td>

      <td>
        ${paymentStatusBadge(
          transaction.paymentStatus
        )}
      </td>

      <td>
        ${escapeHtml(
          formatDateTime(transaction.paymentDatetime)
        )}
      </td>

      <td>
        <button
          type="button"
          class="ktms-secondary-button ktms-payment-view-button"
          data-transaction-id="${escapeAttribute(
            transactionId
          )}"
        >
          VIEW
        </button>
      </td>

    </tr>
  `;
}

function bindTransactionButtons() {
  const buttons = document.querySelectorAll(
    ".ktms-payment-view-button"
  );

  buttons.forEach((button) => {
    button.addEventListener("click", async () => {
      const transactionId =
        button.dataset.transactionId;

      if (!transactionId) {
        return;
      }

      await loadPaymentDetail(transactionId);
    });
  });
}

async function loadPaymentDetail(transactionId) {
  const container = document.getElementById(
    "payment-detail-container"
  );

  if (!container) {
    return;
  }

  container.innerHTML = `
    <section class="ktms-payment-detail-section">
      <div class="ktms-loading-state">
        Loading payment details...
      </div>
    </section>
  `;

  try {
    const result = await adminApi("payment.detail", {
      transactionHistoryId: transactionId
    });

    paymentState.selectedTransaction =
      result?.transaction ||
      result?.payment ||
      result?.data ||
      result;

    renderPaymentDetail();
  } catch (error) {
    container.innerHTML = `
      <section class="ktms-payment-detail-section">
        <div class="ktms-error-state">
          Unable to load payment details.
          ${escapeHtml(error?.message || "")}
        </div>
      </section>
    `;
  }
}

function renderPaymentDetail() {
  const container = document.getElementById(
    "payment-detail-container"
  );

  const payment = paymentState.selectedTransaction;

  if (!container || !payment) {
    return;
  }

  const registration =
    payment.registrationRequest || {};

  container.innerHTML = `
    <section class="ktms-payment-detail-section">

      <div class="ktms-payment-detail-header">

        <div>
          <div class="ktms-payment-detail-eyebrow">
            Payment Detail
          </div>

          <h3>
            ${escapeHtml(
              payment.paymentReference || "Payment"
            )}
          </h3>
        </div>

        <button
          type="button"
          class="ktms-secondary-button"
          id="payment-detail-close"
        >
          CLOSE
        </button>

      </div>

      <div class="ktms-payment-detail-grid">

        ${detailItem(
          "Status",
          paymentStatusBadge(payment.paymentStatus)
        )}

        ${detailItem(
          "Player",
          escapeHtml(payment.playerName || "—")
        )}

        ${detailItem(
          "Player ID",
          escapeHtml(payment.playerId || "—")
        )}

        ${detailItem(
          "Tournament",
          escapeHtml(payment.tournamentName || "—")
        )}

        ${detailItem(
          "Tournament ID",
          escapeHtml(payment.tournamentId || "—")
        )}

        ${detailItem(
          "Registration",
          escapeHtml(
            payment.registrationReferenceId ||
              registration.requestId ||
              "—"
          )
        )}

        ${detailItem(
          "Squad",
          escapeHtml(registration.squadName || "—")
        )}

        ${detailItem(
          "Registration Status",
          escapeHtml(
            formatStatus(
              registration.requestStatus
            )
          )
        )}

        ${detailItem(
          "Payment Method",
          escapeHtml(
            formatStatus(payment.paymentMethod)
          )
        )}

        ${detailItem(
          "Payment Provider",
          escapeHtml(
            formatStatus(payment.paymentProvider)
          )
        )}

        ${detailItem(
          "Amount",
          escapeHtml(formatMoney(payment.amount))
        )}

        ${detailItem(
          "Expected Registration Fee",
          escapeHtml(
            formatMoney(registration.registrationFee)
          )
        )}

        ${detailItem(
          "Transaction ID",
          escapeHtml(payment.transactionId || "—")
        )}

        ${detailItem(
          "Provider Status",
          escapeHtml(payment.providerStatus || "—")
        )}

        ${detailItem(
          "Created",
          escapeHtml(
            formatDateTime(payment.createdDatetime)
          )
        )}

        ${detailItem(
          "Payment Date",
          escapeHtml(
            formatDateTime(payment.paymentDatetime)
          )
        )}

        ${detailItem(
          "Verified",
          escapeHtml(
            formatDateTime(payment.verifiedDatetime)
          )
        )}

        ${detailItem(
          "Payment Submitted",
          escapeHtml(
            formatDateTime(
              registration.paymentSubmittedDatetime
            )
          )
        )}

        ${detailItem(
          "Registration Payment Verified",
          escapeHtml(
            formatDateTime(
              registration.paymentVerifiedDatetime
            )
          )
        )}

      </div>

      ${
        payment.paymentNote
          ? `
            <div class="ktms-payment-detail-note">
              <div class="ktms-payment-detail-note-label">
                Payment Note
              </div>

              <div class="ktms-payment-detail-note-content">
                ${escapeHtml(payment.paymentNote)}
              </div>
            </div>
          `
          : ""
      }

      ${
        payment.paymentProofUrl
          ? `
            <div class="ktms-payment-detail-note">
              <div class="ktms-payment-detail-note-label">
                Payment Proof
              </div>

              <a
                class="ktms-payment-proof"
                href="${escapeAttribute(
                  payment.paymentProofUrl
                )}"
                target="_blank"
                rel="noopener noreferrer"
              >
                VIEW PAYMENT PROOF
              </a>
            </div>
          `
          : ""
      }

      ${
        isBankTransfer(payment) &&
        isAwaitingVerification(payment)
          ? `
            <div class="ktms-payment-verification-panel">

              <h4>
                Bank Transfer Verification
              </h4>

              <p>
                This bank transfer is awaiting manual verification.
                Approval or rejection will be processed by the
                KTMS payment core.
              </p>

              <div class="ktms-payment-verification-actions">

                <button
                  type="button"
                  class="ktms-primary-button"
                  id="payment-approve-transfer"
                >
                  APPROVE TRANSFER
                </button>

                <button
                  type="button"
                  class="ktms-danger-button"
                  id="payment-reject-transfer"
                >
                  REJECT TRANSFER
                </button>

              </div>

            </div>
          `
          : ""
      }

    </section>
  `;

  bindDetailButtons();
}

function bindDetailButtons() {
  const closeButton =
    document.getElementById("payment-detail-close");

  if (closeButton) {
    closeButton.addEventListener(
      "click",
      closePaymentDetail
    );
  }

  const approveButton = document.getElementById(
    "payment-approve-transfer"
  );

  if (approveButton) {
    approveButton.addEventListener("click", async () => {
      await verifyBankTransfer("APPROVE");
    });
  }

  const rejectButton = document.getElementById(
    "payment-reject-transfer"
  );

  if (rejectButton) {
    rejectButton.addEventListener("click", async () => {
      await verifyBankTransfer("REJECT");
    });
  }
}

async function verifyBankTransfer(decision) {
  const payment =
    paymentState.selectedTransaction;

  if (!payment) {
    return;
  }

  const transactionId =
    payment.transactionHistoryId ||
    payment.transaction_history_id;

  if (!transactionId) {
    showMessage(
      "Payment transaction ID is missing.",
      "error"
    );
    return;
  }

  const reason = window.prompt(
    decision === "APPROVE"
      ? "Enter the reason for approving this bank transfer:"
      : "Enter the reason for rejecting this bank transfer:"
  );

  if (!reason || !reason.trim()) {
    return;
  }

  const confirmed = window.confirm(
    decision === "APPROVE"
      ? "Approve this bank transfer?"
      : "Reject this bank transfer?"
  );

  if (!confirmed) {
    return;
  }

  setVerificationButtonsDisabled(true);

  try {
    await adminApi("payment.verifyBank", {
      transactionHistoryId: transactionId,
      decision:
        decision === "APPROVE"
          ? "APPROVED"
          : "REJECTED",
      reason: reason.trim()
    });

    showMessage(
      decision === "APPROVE"
        ? "Bank transfer approved successfully."
        : "Bank transfer rejected successfully.",
      "success"
    );

    paymentState.selectedTransaction = null;

    await loadTournamentPayments();
  } catch (error) {
    showMessage(
      error?.message ||
        "Unable to process bank transfer verification.",
      "error"
    );

    setVerificationButtonsDisabled(false);
  }
}

function setVerificationButtonsDisabled(disabled) {
  const approveButton = document.getElementById(
    "payment-approve-transfer"
  );

  const rejectButton = document.getElementById(
    "payment-reject-transfer"
  );

  if (approveButton) {
    approveButton.disabled = disabled;
  }

  if (rejectButton) {
    rejectButton.disabled = disabled;
  }
}

function closePaymentDetail() {
  const container = document.getElementById(
    "payment-detail-container"
  );

  if (container) {
    container.innerHTML = "";
  }

  paymentState.selectedTransaction = null;
}

function renderUnselectedTournament() {
  const content = document.getElementById(
    "payment-content"
  );

  if (!content) {
    return;
  }

  content.innerHTML = `
    <div class="ktms-empty-state">
      <strong>Select a tournament</strong>
      Choose a KT tournament above to view its payment activity.
    </div>
  `;
}

function normalizeSummary(result) {
  return (
    result?.summary ||
    result?.data ||
    result || {
      transactionCount: 0,
      successfulCount: 0,
      pendingCount: 0,
      failedCount: 0,
      refundedCount: 0,
      successfulAmount: 0,
      pendingAmount: 0,
      failedAmount: 0
    }
  );
}

function normalizeTransactions(result) {
  const rows =
    result?.transactions ||
    result?.payments ||
    result?.data ||
    result?.items ||
    result ||
    [];

  return Array.isArray(rows) ? rows : [];
}

function paymentStatusBadge(status) {
  const normalized = String(status || "")
    .trim()
    .toUpperCase();

  let className = "ktms-status";

  if (
    normalized === "SUCCESSFUL" ||
    normalized === "SUCCESS"
  ) {
    className += " ktms-status-active";
  } else if (
    normalized === "FAILED" ||
    normalized === "REJECTED"
  ) {
    className += " ktms-status-failed";
  } else if (
    normalized === "PENDING" ||
    normalized === "AWAITING_VERIFICATION"
  ) {
    className += " ktms-status-suspended";
  }

  return `
    <span class="${className}">
      ${escapeHtml(formatStatus(status))}
    </span>
  `;
}

function isBankTransfer(payment) {
  const method = String(
    payment?.paymentMethod || ""
  ).toUpperCase();

  const provider = String(
    payment?.paymentProvider || ""
  ).toUpperCase();

  return (
    method.includes("BANK") ||
    provider.includes("BANK")
  );
}

function isAwaitingVerification(payment) {
  const status = String(
    payment?.paymentStatus || ""
  ).toUpperCase();

  return (
    status === "AWAITING_VERIFICATION" ||
    status === "AWAITING VERIFICATION"
  );
}

function detailItem(label, value) {
  return `
    <div class="ktms-payment-detail-item">
      <div class="ktms-payment-detail-item-label">
        ${escapeHtml(label)}
      </div>

      <div class="ktms-payment-detail-item-value">
        ${value}
      </div>
    </div>
  `;
}

function getInputValue(id) {
  const element = document.getElementById(id);

  return element
    ? element.value.trim()
    : "";
}

function normalizeDatetime(value) {
  if (!value) {
    return null;
  }

  return new Date(value).toISOString();
}

function toNumber(value) {
  const number = Number(value);

  return Number.isFinite(number)
    ? number
    : 0;
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-NG").format(
    toNumber(value)
  );
}

function formatMoney(value) {
  const amount = toNumber(value);

  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
}

function formatDateTime(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return new Intl.DateTimeFormat("en-NG", {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(date);
}

function formatStatus(value) {
  if (!value) {
    return "—";
  }

  return String(value)
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (character) =>
      character.toUpperCase()
    );
}

function showMessage(message, type = "info") {
  const element =
    document.getElementById("payment-message");

  if (!element) {
    return;
  }

  element.textContent = message;
  element.className =
    `ktms-message is-visible ktms-message-${type}`;
}

function clearMessage() {
  const element =
    document.getElementById("payment-message");

  if (!element) {
    return;
  }

  element.textContent = "";
  element.className = "ktms-message";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}
