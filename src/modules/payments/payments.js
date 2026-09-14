import { adminApi } from "../../api/admin-api.js";

let paymentState = {
  summary: null,
  transactions: [],
  selectedTransaction: null,
  tournaments: [],
  view: "tournament",

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
          <p>
            Monitor tournament payments, verify bank transfers,
            and review KTMS financial activity.
          </p>
        </div>

        <button
          type="button"
          class="ktms-secondary-button"
          id="payment-refresh"
        >
          REFRESH
        </button>
      </div>

      <div id="payment-message" class="ktms-message"></div>

      <!-- PAYMENT VIEW SWITCHER -->
      <section class="ktms-section">

        <div class="ktms-payment-view-switcher">

          <button
            type="button"
            class="ktms-payment-view-tab is-active"
            id="payment-view-tournament"
          >
            TOURNAMENT PAYMENTS
          </button>

          <button
            type="button"
            class="ktms-payment-view-tab"
            id="payment-view-lifetime"
          >
            LIFETIME TRANSACTION HISTORY
          </button>

        </div>

      </section>

      <div id="payment-content"></div>

    </div>
  `;

  bindViewSwitcher();
  bindRefresh();

  await loadTournaments();
}

/* =========================================================
   VIEW SWITCHING
   ========================================================= */

function bindViewSwitcher() {
  const tournamentButton = document.getElementById(
    "payment-view-tournament"
  );

  const lifetimeButton = document.getElementById(
    "payment-view-lifetime"
  );

  if (tournamentButton) {
    tournamentButton.addEventListener("click", async () => {
      paymentState.view = "tournament";

      setActiveViewButton("tournament");

      paymentState.selectedTransaction = null;

      renderTournamentView();

      if (paymentState.filters.tournamentId) {
        await loadTournamentPayments();
      }
    });
  }

  if (lifetimeButton) {
    lifetimeButton.addEventListener("click", async () => {
      paymentState.view = "lifetime";

      setActiveViewButton("lifetime");

      paymentState.selectedTransaction = null;

      renderLifetimeView();

      await loadLifetimeHistory();
    });
  }
}

function setActiveViewButton(view) {
  const tournamentButton = document.getElementById(
    "payment-view-tournament"
  );

  const lifetimeButton = document.getElementById(
    "payment-view-lifetime"
  );

  tournamentButton?.classList.toggle(
    "is-active",
    view === "tournament"
  );

  lifetimeButton?.classList.toggle(
    "is-active",
    view === "lifetime"
  );
}

/* =========================================================
   TOURNAMENT LIST
   ========================================================= */

async function loadTournaments() {
  try {
    /*
     * This is the confirmed existing Admin API action.
     */
    const result = await adminApi("tournament.list", {
      status: null
    });

    paymentState.tournaments =
      normalizeTournaments(result);

    if (paymentState.view === "tournament") {
      renderTournamentView();

      if (paymentState.filters.tournamentId) {
        const exists =
          paymentState.tournaments.some(
            (tournament) =>
              tournament.tournamentId ===
              paymentState.filters.tournamentId
          );

        if (exists) {
          const selector = document.getElementById(
            "payment-tournament"
          );

          if (selector) {
            selector.value =
              paymentState.filters.tournamentId;
          }

          await loadTournamentPayments();
        }
      }
    }
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

/* =========================================================
   TOURNAMENT VIEW
   ========================================================= */

function renderTournamentView() {
  const content =
    document.getElementById("payment-content");

  if (!content) {
    return;
  }

  content.innerHTML = `
    <section class="ktms-section">

      <div class="ktms-section-header">
        <h2 class="ktms-section-title">
          Tournament Payments
        </h2>

        <p class="ktms-section-subtitle">
          Select a tournament to view its payment activity.
        </p>
      </div>

      <div class="ktms-payment-tournament-selector">

        <label for="payment-tournament">
          Tournament
        </label>

        <select id="payment-tournament">

          <option value="">
            Select a tournament
          </option>

          ${paymentState.tournaments
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

        </select>

      </div>

      <div id="payment-tournament-content">

        <div class="ktms-empty-state">

          <strong>
            Select a tournament
          </strong>

          Choose a KT tournament above to view
          its payment activity.

        </div>

      </div>

    </section>
  `;

  const selector = document.getElementById(
    "payment-tournament"
  );

  if (selector) {
    selector.value =
      paymentState.filters.tournamentId;

    selector.addEventListener(
      "change",
      async () => {
        paymentState.filters.tournamentId =
          selector.value;

        paymentState.selectedTransaction =
          null;

        if (!selector.value) {
          renderTournamentView();
          return;
        }

        await loadTournamentPayments();
      }
    );
  }
}

/* =========================================================
   TOURNAMENT PAYMENTS
   ========================================================= */

async function loadTournamentPayments() {
  const tournamentId =
    paymentState.filters.tournamentId;

  /*
   * HARD SAFETY RULE:
   * The normal Payments overview must never
   * query payments without a tournament.
   */
  if (!tournamentId) {
    renderTournamentView();
    return;
  }

  const content =
    document.getElementById(
      "payment-tournament-content"
    );

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
    const [
      summaryResult,
      transactionResult
    ] = await Promise.all([
      adminApi("payment.summary", {
        tournamentId,

        fromDatetime:
          normalizeDatetime(
            paymentState.filters.fromDatetime
          ),

        toDatetime:
          normalizeDatetime(
            paymentState.filters.toDatetime
          )
      }),

      adminApi("payment.list", {
        tournamentId,

        paymentStatus:
          paymentState.filters.paymentStatus ||
          null,

        paymentMethod:
          paymentState.filters.paymentMethod ||
          null,

        paymentProvider:
          paymentState.filters.paymentProvider ||
          null,

        search:
          paymentState.filters.search ||
          null,

        fromDatetime:
          normalizeDatetime(
            paymentState.filters.fromDatetime
          ),

        toDatetime:
          normalizeDatetime(
            paymentState.filters.toDatetime
          )
      })
    ]);

    paymentState.summary =
      normalizeSummary(summaryResult);

    paymentState.transactions =
      normalizeTransactions(transactionResult);

    renderTournamentPaymentContent();
  } catch (error) {
    content.innerHTML = `
      <div class="ktms-error-state">
        Unable to load payment activity.
        ${escapeHtml(
          error?.message || ""
        )}
      </div>
    `;
  }
}

function renderTournamentPaymentContent() {
  const content =
    document.getElementById(
      "payment-tournament-content"
    );

  if (!content) {
    return;
  }

  const tournament =
    paymentState.tournaments.find(
      (item) =>
        item.tournamentId ===
        paymentState.filters.tournamentId
    );

  content.innerHTML = `

    <div class="ktms-payment-selected-tournament">

      <div>
        <div class="ktms-payment-detail-eyebrow">
          SELECTED TOURNAMENT
        </div>

        <strong>
          ${escapeHtml(
            paymentState.filters.tournamentId
          )}
        </strong>

        <span>
          ${escapeHtml(
            tournament?.tournamentName || ""
          )}
        </span>
      </div>

    </div>

    ${renderSummary()}

    ${renderFilters()}

    <div id="payment-transactions">
      ${renderTransactions()}
    </div>

    <div id="payment-detail-container"></div>
  `;

  bindPaymentFilters();
  bindTransactionButtons();
}

/* =========================================================
   LIFETIME FINANCIAL AUDIT
   ========================================================= */

function renderLifetimeView() {
  const content =
    document.getElementById("payment-content");

  if (!content) {
    return;
  }

  content.innerHTML = `

    <section class="ktms-section">

      <div class="ktms-section-header">

        <h2 class="ktms-section-title">
          Lifetime Transaction History
        </h2>

        <p class="ktms-section-subtitle">
          Complete KTMS payment transaction history
          across all tournaments for financial audit.
        </p>

      </div>

      <div class="ktms-payment-audit-warning">

        <strong>
          Financial Audit View
        </strong>

        <span>
          This view intentionally covers transactions
          across all KTMS tournaments. Use the normal
          Tournament Payments view for tournament-level
          operations.
        </span>

      </div>

      <div id="payment-lifetime-content">

        <div class="ktms-loading-state">
          Loading lifetime transaction history...
        </div>

      </div>

    </section>
  `;
}

async function loadLifetimeHistory() {
  const content =
    document.getElementById(
      "payment-lifetime-content"
    );

  if (!content) {
    return;
  }

  content.innerHTML = `
    <div class="ktms-loading-state">
      Loading lifetime transaction history...
    </div>
  `;

  clearMessage();

  try {
    /*
     * IMPORTANT:
     *
     * This is intentionally the ONLY place in the
     * Payments UI where tournamentId is omitted.
     *
     * payment.list already supports a null tournament
     * and therefore returns the platform lifetime
     * transaction ledger.
     */
    const result = await adminApi(
      "payment.list",
      {
        tournamentId: null,

        paymentStatus:
          paymentState.filters.paymentStatus ||
          null,

        paymentMethod:
          paymentState.filters.paymentMethod ||
          null,

        paymentProvider:
          paymentState.filters.paymentProvider ||
          null,

        search:
          paymentState.filters.search ||
          null,

        fromDatetime:
          normalizeDatetime(
            paymentState.filters.fromDatetime
          ),

        toDatetime:
          normalizeDatetime(
            paymentState.filters.toDatetime
          )
      }
    );

    paymentState.transactions =
      normalizeTransactions(result);

    renderLifetimeTransactions();
  } catch (error) {
    content.innerHTML = `
      <div class="ktms-error-state">
        Unable to load lifetime transaction history.
        ${escapeHtml(
          error?.message || ""
        )}
      </div>
    `;
  }
}

function renderLifetimeTransactions() {
  const content =
    document.getElementById(
      "payment-lifetime-content"
    );

  if (!content) {
    return;
  }

  content.innerHTML = `

    ${renderFilters()}

    <div class="ktms-payment-audit-count">

      <strong>
        ${formatNumber(
          paymentState.transactions.length
        )}
      </strong>

      transactions returned

    </div>

    <div id="payment-transactions">

      ${renderTransactions()}

    </div>

    <div id="payment-detail-container"></div>
  `;

  bindPaymentFilters();
  bindTransactionButtons();
}

/* =========================================================
   SUMMARY
   ========================================================= */

function renderSummary() {
  const summary =
    paymentState.summary || {};

  return `
    <div class="ktms-payment-summary-grid">

      ${paymentStatCard(
        "SUCCESSFUL",
        summary.successfulCount,
        formatMoney(
          summary.successfulAmount
        ),
        "success"
      )}

      ${paymentStatCard(
        "PENDING",
        summary.pendingCount,
        formatMoney(
          summary.pendingAmount
        ),
        "pending"
      )}

      ${paymentStatCard(
        "FAILED",
        summary.failedCount,
        formatMoney(
          summary.failedAmount
        ),
        "failed"
      )}

      ${paymentStatCard(
        "REFUNDED",
        summary.refundedCount,
        null,
        "refunded"
      )}

      ${paymentStatCard(
        "TOTAL TRANSACTIONS",
        summary.transactionCount,
        null,
        "neutral"
      )}

    </div>
  `;
}

function paymentStatCard(
  label,
  value,
  secondary,
  type
) {
  return `
    <div
      class="
        ktms-payment-stat
        ktms-payment-stat-${type}
      "
    >

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

/* =========================================================
   FILTERS
   ========================================================= */

function renderFilters() {
  return `

    <section class="ktms-section">

      <div class="ktms-section-header">

        <h3 class="ktms-section-title">
          Transactions
        </h3>

        <p class="ktms-section-subtitle">
          Filter the payment transaction ledger.
        </p>

      </div>

      <div class="ktms-payment-filters">

        <div class="ktms-payment-filter">

          <label for="payment-search">
            Search
          </label>

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

          <label for="payment-status">
            Status
          </label>

          <select id="payment-status">

            <option value="">
              All statuses
            </option>

            <option value="SUCCESSFUL">
              Successful
            </option>

            <option value="PENDING">
              Pending
            </option>

            <option value="AWAITING_VERIFICATION">
              Awaiting Verification
            </option>

            <option value="FAILED">
              Failed
            </option>

            <option value="REFUNDED">
              Refunded
            </option>

          </select>

        </div>

        <div class="ktms-payment-filter">

          <label for="payment-method">
            Method
          </label>

          <select id="payment-method">

            <option value="">
              All methods
            </option>

            <option value="PAYSTACK">
              Paystack
            </option>

            <option value="BANK_TRANSFER">
              Bank Transfer
            </option>

          </select>

        </div>

        <div class="ktms-payment-filter">

          <label for="payment-provider">
            Provider
          </label>

          <select id="payment-provider">

            <option value="">
              All providers
            </option>

            <option value="PAYSTACK">
              Paystack
            </option>

            <option value="BANK_TRANSFER">
              Bank Transfer
            </option>

          </select>

        </div>

        <div class="ktms-payment-filter">

          <label for="payment-from">
            From
          </label>

          <input
            id="payment-from"
            type="datetime-local"
            value="${escapeAttribute(
              paymentState.filters.fromDatetime
            )}"
          />

        </div>

        <div class="ktms-payment-filter">

          <label for="payment-to">
            To
          </label>

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
    document.getElementById(
      "payment-apply-filters"
    );

  if (applyButton) {
    applyButton.addEventListener(
      "click",
      async () => {
        paymentState.filters.search =
          getInputValue("payment-search");

        paymentState.filters.paymentStatus =
          getInputValue("payment-status");

        paymentState.filters.paymentMethod =
          getInputValue("payment-method");

        paymentState.filters.paymentProvider =
          getInputValue(
            "payment-provider"
          );

        paymentState.filters.fromDatetime =
          getInputValue("payment-from");

        paymentState.filters.toDatetime =
          getInputValue("payment-to");

        if (
          paymentState.view ===
          "lifetime"
        ) {
          await loadLifetimeHistory();
        } else {
          await loadTournamentPayments();
        }
      }
    );
  }

  const searchInput =
    document.getElementById(
      "payment-search"
    );

  if (searchInput) {
    searchInput.addEventListener(
      "keydown",
      async (event) => {
        if (event.key !== "Enter") {
          return;
        }

        paymentState.filters.search =
          searchInput.value.trim();

        if (
          paymentState.view ===
          "lifetime"
        ) {
          await loadLifetimeHistory();
        } else {
          await loadTournamentPayments();
        }
      }
    );
  }

  const status =
    document.getElementById(
      "payment-status"
    );

  const method =
    document.getElementById(
      "payment-method"
    );

  const provider =
    document.getElementById(
      "payment-provider"
    );

  if (status) {
    status.value =
      paymentState.filters.paymentStatus;
  }

  if (method) {
    method.value =
      paymentState.filters.paymentMethod;
  }

  if (provider) {
    provider.value =
      paymentState.filters.paymentProvider;
  }
}

/* =========================================================
   TRANSACTION TABLE
   ========================================================= */

function renderTransactions() {
  const transactions =
    paymentState.transactions;

  if (!transactions.length) {
    return `
      <div class="ktms-empty-state">

        <strong>
          No payment transactions
        </strong>

        No payment transactions match
        the current filters.

      </div>
    `;
  }

  return `

    <div class="ktms-table-wrap">

      <table
        class="
          ktms-table
          ktms-payment-table
        "
      >

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
            .map(
              renderTransactionRow
            )
            .join("")}

        </tbody>

      </table>

    </div>
  `;
}

function renderTransactionRow(
  transaction
) {
  const transactionId =
    transaction.transactionHistoryId ||
    transaction.transaction_history_id ||
    "";

  return `
    <tr>

      <td>

        <span class="ktms-payment-reference">
          ${escapeHtml(
            transaction.paymentReference ||
              "—"
          )}
        </span>

        ${
          transaction.transactionId
            ? `
              <span class="ktms-payment-secondary-text">
                ${escapeHtml(
                  transaction.transactionId
                )}
              </span>
            `
            : ""
        }

      </td>

      <td>

        <strong>
          ${escapeHtml(
            transaction.playerName ||
              "—"
          )}
        </strong>

        ${
          transaction.playerId
            ? `
              <span class="ktms-payment-secondary-text">
                ${escapeHtml(
                  transaction.playerId
                )}
              </span>
            `
            : ""
        }

      </td>

      <td>

        ${escapeHtml(
          transaction.tournamentName ||
            "—"
        )}

        <span class="ktms-payment-secondary-text">
          ${escapeHtml(
            transaction.tournamentId ||
              ""
          )}
        </span>

      </td>

      <td>
        ${escapeHtml(
          formatMoney(
            transaction.amount
          )
        )}
      </td>

      <td>
        ${escapeHtml(
          formatStatus(
            transaction.paymentMethod
          )
        )}
      </td>

      <td>
        ${paymentStatusBadge(
          transaction.paymentStatus
        )}
      </td>

      <td>
        ${escapeHtml(
          formatDateTime(
            transaction.paymentDatetime
          )
        )}
      </td>

      <td>

        <button
          type="button"
          class="
            ktms-secondary-button
            ktms-payment-view-button
          "
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
  document
    .querySelectorAll(
      ".ktms-payment-view-button"
    )
    .forEach((button) => {
      button.addEventListener(
        "click",
        async () => {
          const transactionId =
            button.dataset.transactionId;

          if (!transactionId) {
            return;
          }

          await loadPaymentDetail(
            transactionId
          );
        }
      );
    });
}

/* =========================================================
   PAYMENT DETAIL
   ========================================================= */

async function loadPaymentDetail(
  transactionId
) {
  const container =
    document.getElementById(
      "payment-detail-container"
    );

  if (!container) {
    return;
  }

  container.innerHTML = `
    <section
      class="ktms-payment-detail-section"
    >
      <div class="ktms-loading-state">
        Loading payment details...
      </div>
    </section>
  `;

  try {
    const result =
      await adminApi(
        "payment.detail",
        {
          transactionHistoryId:
            transactionId
        }
      );

    paymentState.selectedTransaction =
      result?.data ||
      result?.transaction ||
      result?.payment ||
      result;

    renderPaymentDetail();
  } catch (error) {
    container.innerHTML = `
      <section
        class="ktms-payment-detail-section"
      >
        <div class="ktms-error-state">
          Unable to load payment details.
          ${escapeHtml(
            error?.message || ""
          )}
        </div>
      </section>
    `;
  }
}

function renderPaymentDetail() {
  const container =
    document.getElementById(
      "payment-detail-container"
    );

  const payment =
    paymentState.selectedTransaction;

  if (!container || !payment) {
    return;
  }

  const registration =
    payment.registrationRequest ||
    {};

  container.innerHTML = `

    <section
      class="ktms-payment-detail-section"
    >

      <div class="ktms-payment-detail-header">

        <div>

          <div
            class="ktms-payment-detail-eyebrow"
          >
            PAYMENT DETAIL
          </div>

          <h3>
            ${escapeHtml(
              payment.paymentReference ||
                "Payment"
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
          paymentStatusBadge(
            payment.paymentStatus
          )
        )}

        ${detailItem(
          "Player",
          escapeHtml(
            payment.playerName ||
              "—"
          )
        )}

        ${detailItem(
          "Player ID",
          escapeHtml(
            payment.playerId ||
              "—"
          )
        )}

        ${detailItem(
          "Tournament",
          escapeHtml(
            payment.tournamentName ||
              "—"
          )
        )}

        ${detailItem(
          "Tournament ID",
          escapeHtml(
            payment.tournamentId ||
              "—"
          )
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
          escapeHtml(
            registration.squadName ||
              "—"
          )
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
            formatStatus(
              payment.paymentMethod
            )
          )
        )}

        ${detailItem(
          "Payment Provider",
          escapeHtml(
            formatStatus(
              payment.paymentProvider
            )
          )
        )}

        ${detailItem(
          "Amount",
          escapeHtml(
            formatMoney(
              payment.amount
            )
          )
        )}

        ${detailItem(
          "Expected Registration Fee",
          escapeHtml(
            formatMoney(
              registration.registrationFee
            )
          )
        )}

        ${detailItem(
          "Transaction ID",
          escapeHtml(
            payment.transactionId ||
              "—"
          )
        )}

        ${detailItem(
          "Provider Status",
          escapeHtml(
            payment.providerStatus ||
              "—"
          )
        )}

        ${detailItem(
          "Created",
          escapeHtml(
            formatDateTime(
              payment.createdDatetime
            )
          )
        )}

        ${detailItem(
          "Payment Date",
          escapeHtml(
            formatDateTime(
              payment.paymentDatetime
            )
          )
        )}

        ${detailItem(
          "Verified",
          escapeHtml(
            formatDateTime(
              payment.verifiedDatetime
            )
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
            <div
              class="ktms-payment-detail-note"
            >

              <div
                class="
                  ktms-payment-detail-note-label
                "
              >
                Payment Note
              </div>

              <div
                class="
                  ktms-payment-detail-note-content
                "
              >
                ${escapeHtml(
                  payment.paymentNote
                )}
              </div>

            </div>
          `
          : ""
      }

      ${
        payment.paymentProofUrl
          ? `
            <div
              class="ktms-payment-detail-note"
            >

              <div
                class="
                  ktms-payment-detail-note-label
                "
              >
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
            <div
              class="
                ktms-payment-verification-panel
              "
            >

              <h4>
                Bank Transfer Verification
              </h4>

              <p>
                This bank transfer is awaiting
                manual verification. Approval or
                rejection will be processed by the
                KTMS payment core.
              </p>

              <div
                class="
                  ktms-payment-verification-actions
                "
              >

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
  document
    .getElementById(
      "payment-detail-close"
    )
    ?.addEventListener(
      "click",
      closePaymentDetail
    );

  document
    .getElementById(
      "payment-approve-transfer"
    )
    ?.addEventListener(
      "click",
      async () => {
        await verifyBankTransfer(
          "APPROVE"
        );
      }
    );

  document
    .getElementById(
      "payment-reject-transfer"
    )
    ?.addEventListener(
      "click",
      async () => {
        await verifyBankTransfer(
          "REJECT"
        );
      }
    );
}

/* =========================================================
   BANK TRANSFER VERIFICATION
   ========================================================= */

async function verifyBankTransfer(
  decision
) {
  const payment =
    paymentState.selectedTransaction;

  if (!payment) {
    return;
  }

  const paymentReference =
    payment.paymentReference;

  if (!paymentReference) {
    showMessage(
      "Payment reference is missing.",
      "error"
    );
    return;
  }

  const reason =
    window.prompt(
      decision === "APPROVE"
        ? "Enter the reason for approving this bank transfer:"
        : "Enter the reason for rejecting this bank transfer:"
    );

  if (!reason || !reason.trim()) {
    return;
  }

  const confirmed =
    window.confirm(
      decision === "APPROVE"
        ? "Approve this bank transfer?"
        : "Reject this bank transfer?"
    );

  if (!confirmed) {
    return;
  }

  setVerificationButtonsDisabled(
    true
  );

  try {
    /*
     * CONFIRMED AGAINST DEPLOYED
     * ktms-admin-api v33.
     */
    await adminApi(
      "payment.verifyBank",
      {
        paymentReference,
        approved:
          decision === "APPROVE",
        reason: reason.trim()
      }
    );

    showMessage(
      decision === "APPROVE"
        ? "Bank transfer approved successfully."
        : "Bank transfer rejected successfully.",
      "success"
    );

    paymentState.selectedTransaction =
      null;

    await loadTournamentPayments();
  } catch (error) {
    showMessage(
      error?.message ||
        "Unable to process bank transfer verification.",
      "error"
    );

    setVerificationButtonsDisabled(
      false
    );
  }
}

function setVerificationButtonsDisabled(
  disabled
) {
  const approve =
    document.getElementById(
      "payment-approve-transfer"
    );

  const reject =
    document.getElementById(
      "payment-reject-transfer"
    );

  if (approve) {
    approve.disabled = disabled;
  }

  if (reject) {
    reject.disabled = disabled;
  }
}

/* =========================================================
   HELPERS
   ========================================================= */

function closePaymentDetail() {
  const container =
    document.getElementById(
      "payment-detail-container"
    );

  if (container) {
    container.innerHTML = "";
  }

  paymentState.selectedTransaction =
    null;
}

function normalizeSummary(result) {
  return (
    result?.data ||
    result?.summary ||
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

function normalizeTransactions(
  result
) {
  const rows =
    result?.data ||
    result?.transactions ||
    result?.payments ||
    result?.items ||
    result ||
    [];

  return Array.isArray(rows)
    ? rows
    : [];
}

function paymentStatusBadge(
  status
) {
  const normalized =
    String(status || "")
      .trim()
      .toUpperCase();

  let className =
    "ktms-status";

  if (
    normalized === "SUCCESSFUL" ||
    normalized === "SUCCESS"
  ) {
    className +=
      " ktms-status-active";
  } else if (
    normalized === "FAILED" ||
    normalized === "REJECTED"
  ) {
    className +=
      " ktms-status-failed";
  } else if (
    normalized === "PENDING" ||
    normalized ===
      "AWAITING_VERIFICATION"
  ) {
    className +=
      " ktms-status-suspended";
  }

  return `
    <span class="${className}">
      ${escapeHtml(
        formatStatus(status)
      )}
    </span>
  `;
}

function isBankTransfer(
  payment
) {
  const method =
    String(
      payment?.paymentMethod ||
        ""
    ).toUpperCase();

  const provider =
    String(
      payment?.paymentProvider ||
        ""
    ).toUpperCase();

  return (
    method.includes("BANK") ||
    provider.includes("BANK")
  );
}

function isAwaitingVerification(
  payment
) {
  const status =
    String(
      payment?.paymentStatus ||
        ""
    )
      .trim()
      .toUpperCase();

  return (
    status ===
      "AWAITING_VERIFICATION" ||
    status ===
      "AWAITING VERIFICATION"
  );
}

function detailItem(
  label,
  value
) {
  return `
    <div
      class="ktms-payment-detail-item"
    >

      <div
        class="
          ktms-payment-detail-item-label
        "
      >
        ${escapeHtml(label)}
      </div>

      <div
        class="
          ktms-payment-detail-item-value
        "
      >
        ${value}
      </div>

    </div>
  `;
}

function getInputValue(id) {
  const element =
    document.getElementById(id);

  return element
    ? element.value.trim()
    : "";
}

function normalizeDatetime(
  value
) {
  if (!value) {
    return null;
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return null;
  }

  return date.toISOString();
}

function formatNumber(
  value
) {
  const number =
    Number(value);

  return new Intl.NumberFormat(
    "en-NG"
  ).format(
    Number.isFinite(number)
      ? number
      : 0
  );
}

function formatMoney(
  value
) {
  const amount =
    Number(value);

  return new Intl.NumberFormat(
    "en-NG",
    {
      style: "currency",
      currency: "NGN",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }
  ).format(
    Number.isFinite(amount)
      ? amount
      : 0
  );
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

  return new Intl.DateTimeFormat(
    "en-NG",
    {
      dateStyle: "medium",
      timeStyle: "short"
    }
  ).format(date);
}

function formatStatus(
  value
) {
  if (!value) {
    return "—";
  }

  return String(value)
    .replace(
      /_/g,
      " "
    )
    .replace(
      /\s+/g,
      " "
    )
    .trim()
    .replace(
      /\b\w/g,
      (character) =>
        character.toUpperCase()
    );
}

function showMessage(
  message,
  type = "info"
) {
  const element =
    document.getElementById(
      "payment-message"
    );

  if (!element) {
    return;
  }

  element.textContent =
    message;

  element.className =
    `ktms-message is-visible ktms-message-${type}`;
}

function clearMessage() {
  const element =
    document.getElementById(
      "payment-message"
    );

  if (!element) {
    return;
  }

  element.textContent = "";

  element.className =
    "ktms-message";
}

function bindRefresh() {
  document
    .getElementById(
      "payment-refresh"
    )
    ?.addEventListener(
      "click",
      async () => {
        if (
          paymentState.view ===
          "lifetime"
        ) {
          await loadLifetimeHistory();
        } else {
          await loadTournaments();

          if (
            paymentState.filters
              .tournamentId
          ) {
            await loadTournamentPayments();
          }
        }
      }
    );
}

function escapeHtml(
  value
) {
  return String(
    value ?? ""
  )
    .replace(
      /&/g,
      "&amp;"
    )
    .replace(
      /</g,
      "&lt;"
    )
    .replace(
      />/g,
      "&gt;"
    )
    .replace(
      /"/g,
      "&quot;"
    )
    .replace(
      /'/g,
      "&#039;"
    );
}

function escapeAttribute(
  value
) {
  return escapeHtml(value);
}
