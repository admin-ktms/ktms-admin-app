
import { adminApi } from "../../api/admin-api.js";

let paymentState = {
  summary: null,
  transactions: [],
  selectedTransaction: null,

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
  page.innerHTML = `
    <div class="ktms-module">

      <div class="ktms-module-toolbar">
        <div>
          <h2>Payments</h2>
          <p>
            Monitor payments, verify bank transfers, and review
            tournament payment activity.
          </p>
        </div>

        <button
          id="payments-refresh-button"
          class="ktms-secondary-button"
          type="button"
        >
          REFRESH
        </button>
      </div>

      <div id="payments-message" class="ktms-message"></div>

      <section id="payments-summary">
        <div class="ktms-loading-state">
          Loading payment summary...
        </div>
      </section>

      <section class="ktms-section">

        <div class="ktms-module-toolbar">
          <div>
            <h3>Transactions</h3>
            <p>
              Payment transactions recorded by KTMS.
            </p>
          </div>
        </div>

        <div class="ktms-payment-filters">

          <div class="ktms-payment-filter">
            <label for="payment-search">
              Search
            </label>

            <input
              id="payment-search"
              class="ktms-filter"
              type="search"
              placeholder="Reference, player, transaction..."
            />
          </div>

          <div class="ktms-payment-filter">
            <label for="payment-tournament">
              Tournament
            </label>

            <input
              id="payment-tournament"
              class="ktms-filter"
              type="text"
              placeholder="KT-2026-E01"
            />
          </div>

          <div class="ktms-payment-filter">
            <label for="payment-status">
              Status
            </label>

            <select id="payment-status" class="ktms-filter">
              <option value="">All statuses</option>
              <option value="SUCCESS">Successful</option>
              <option value="PENDING">Pending</option>
              <option value="AWAITING_VERIFICATION">
                Awaiting Verification
              </option>
              <option value="FAILED">Failed</option>
              <option value="REFUNDED">Refunded</option>
            </select>
          </div>

          <div class="ktms-payment-filter">
            <label for="payment-method">
              Method
            </label>

            <select id="payment-method" class="ktms-filter">
              <option value="">All methods</option>
              <option value="Paystack">Paystack</option>
              <option value="Bank Transfer">Bank Transfer</option>
            </select>
          </div>

          <div class="ktms-payment-filter">
            <label for="payment-provider">
              Provider
            </label>

            <select id="payment-provider" class="ktms-filter">
              <option value="">All providers</option>
              <option value="Paystack">Paystack</option>
              <option value="Bank Transfer">Bank Transfer</option>
            </select>
          </div>

          <div class="ktms-payment-filter">
            <label for="payment-from">
              From
            </label>

            <input
              id="payment-from"
              class="ktms-filter"
              type="datetime-local"
            />
          </div>

          <div class="ktms-payment-filter">
            <label for="payment-to">
              To
            </label>

            <input
              id="payment-to"
              class="ktms-filter"
              type="datetime-local"
            />
          </div>

          <div class="ktms-payment-filter-action">
            <button
              id="payment-filter-button"
              class="ktms-primary-button"
              type="button"
            >
              APPLY FILTERS
            </button>
          </div>

        </div>

      </section>

      <section id="payments-table-section">
        <div class="ktms-loading-state">
          Loading transactions...
        </div>
      </section>

      <section
        id="payment-detail-section"
        class="ktms-payment-detail-section"
        hidden
      ></section>

    </div>
  `;

  bindPaymentEvents();

  await loadPayments();
}

function bindPaymentEvents() {
  const refreshButton = document.getElementById(
    "payments-refresh-button"
  );

  const filterButton = document.getElementById(
    "payment-filter-button"
  );

  if (refreshButton) {
    refreshButton.addEventListener(
      "click",
      async () => {
        await loadPayments();
      }
    );
  }

  if (filterButton) {
    filterButton.addEventListener(
      "click",
      async () => {
        readFilters();
        await loadPayments();
      }
    );
  }

  const search = document.getElementById(
    "payment-search"
  );

  if (search) {
    search.addEventListener(
      "keydown",
      async (event) => {
        if (event.key !== "Enter") return;

        readFilters();
        await loadPayments();
      }
    );
  }
}

function readFilters() {
  paymentState.filters = {
    tournamentId:
      getInputValue("payment-tournament"),

    paymentStatus:
      getInputValue("payment-status"),

    paymentMethod:
      getInputValue("payment-method"),

    paymentProvider:
      getInputValue("payment-provider"),

    search:
      getInputValue("payment-search"),

    fromDatetime:
      getInputValue("payment-from"),

    toDatetime:
      getInputValue("payment-to")
  };
}

async function loadPayments() {
  const summaryContainer =
    document.getElementById(
      "payments-summary"
    );

  const tableContainer =
    document.getElementById(
      "payments-table-section"
    );

  const message =
    document.getElementById(
      "payments-message"
    );

  if (summaryContainer) {
    summaryContainer.innerHTML = `
      <div class="ktms-loading-state">
        Loading payment summary...
      </div>
    `;
  }

  if (tableContainer) {
    tableContainer.innerHTML = `
      <div class="ktms-loading-state">
        Loading transactions...
      </div>
    `;
  }

  if (message) {
    message.textContent = "";
    message.className = "ktms-message";
  }

  try {
    const [
      summary,
      transactions
    ] = await Promise.all([
      adminApi(
        "payment.summary",
        {
          tournamentId:
            paymentState.filters.tournamentId ||
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
      ),

      adminApi(
        "payment.list",
        {
          tournamentId:
            paymentState.filters.tournamentId ||
            null,

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
      )
    ]);

    paymentState.summary =
      normalizeSummary(summary);

    paymentState.transactions =
      normalizeTransactions(transactions);

    renderSummary(
      paymentState.summary
    );

    renderTransactions(
      paymentState.transactions
    );
  } catch (error) {
    if (summaryContainer) {
      summaryContainer.innerHTML = "";
    }

    if (tableContainer) {
      tableContainer.innerHTML = `
        <div class="ktms-error-state">
          <strong>
            Unable to load payments
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

    showMessage(
      error?.message ||
      "Unable to load payment data.",
      "error"
    );
  }
}

function normalizeSummary(data) {
  return {
    transactionCount:
      toNumber(data?.transactionCount),

    successfulCount:
      toNumber(data?.successfulCount),

    pendingCount:
      toNumber(data?.pendingCount),

    failedCount:
      toNumber(data?.failedCount),

    refundedCount:
      toNumber(data?.refundedCount),

    successfulAmount:
      toNumber(data?.successfulAmount),

    pendingAmount:
      toNumber(data?.pendingAmount),

    failedAmount:
      toNumber(data?.failedAmount),

    currency:
      data?.currency ||
      "NGN"
  };
}

function normalizeTransactions(data) {
  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data?.transactions)) {
    return data.transactions;
  }

  if (Array.isArray(data?.rows)) {
    return data.rows;
  }

  return [];
}

function renderSummary(summary) {
  const container =
    document.getElementById(
      "payments-summary"
    );

  if (!container) return;

  container.innerHTML = `
    <div class="ktms-payment-summary-grid">

      ${paymentStatCard(
        "SUCCESSFUL",
        summary.successfulCount,
        formatMoney(
          summary.successfulAmount,
          summary.currency
        ),
        "success"
      )}

      ${paymentStatCard(
        "PENDING",
        summary.pendingCount,
        formatMoney(
          summary.pendingAmount,
          summary.currency
        ),
        "pending"
      )}

      ${paymentStatCard(
        "FAILED",
        summary.failedCount,
        formatMoney(
          summary.failedAmount,
          summary.currency
        ),
        "failed"
      )}

      ${paymentStatCard(
        "REFUNDED",
        summary.refundedCount,
        "",
        "refunded"
      )}

      ${paymentStatCard(
        "TOTAL TRANSACTIONS",
        summary.transactionCount,
        "",
        "neutral"
      )}

    </div>
  `;
}

function paymentStatCard(
  label,
  count,
  amount,
  type
) {
  return `
    <article
      class="
        ktms-payment-stat
        ktms-payment-stat-${escapeAttribute(type)}
      "
    >
      <span class="ktms-payment-stat-label">
        ${escapeHtml(label)}
      </span>

      <strong class="ktms-payment-stat-count">
        ${escapeHtml(
          formatNumber(count)
        )}
      </strong>

      ${
        amount
          ? `
            <span class="ktms-payment-stat-amount">
              ${escapeHtml(amount)}
            </span>
          `
          : ""
      }
    </article>
  `;
}

function renderTransactions(
  transactions
) {
  const container =
    document.getElementById(
      "payments-table-section"
    );

  if (!container) return;

  if (!transactions.length) {
    container.innerHTML = `
      <section class="ktms-section">
        ${emptyState(
          "No payment transactions",
          "No payment transactions match the current filters."
        )}
      </section>
    `;

    return;
  }

  container.innerHTML = `
    <section class="ktms-section">

      <div class="ktms-module-toolbar">
        <div>
          <h3>
            Payment Transactions
          </h3>

          <p>
            ${escapeHtml(
              `${transactions.length} transaction${
                transactions.length === 1
                  ? ""
                  : "s"
              } loaded`
            )}
          </p>
        </div>
      </div>

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
              .map(
                renderTransactionRow
              )
              .join("")}
          </tbody>

        </table>
      </div>

    </section>
  `;

  bindTransactionButtons();
}

function renderTransactionRow(
  transaction
) {
  const id = getValue(
    transaction,
    "transactionHistoryId",
    "transaction_history_id"
  );

  const reference = getValue(
    transaction,
    "paymentReference",
    "payment_reference"
  );

  const playerName =
    getValue(
      transaction,
      "playerName",
      "player_name"
    ) ||
    getValue(
      transaction,
      "playerId",
      "player_id"
    ) ||
    "—";

  const tournamentId =
    getValue(
      transaction,
      "tournamentId",
      "tournament_id"
    );

  const tournamentName =
    getValue(
      transaction,
      "tournamentName",
      "tournament_name"
    );

  const amount =
    toNumber(
      getValue(
        transaction,
        "amount"
      )
    );

  const currency =
    getValue(
      transaction,
      "currency"
    ) ||
    "NGN";

  const method =
    getValue(
      transaction,
      "paymentMethod",
      "payment_method"
    ) ||
    "—";

  const provider =
    getValue(
      transaction,
      "paymentProvider",
      "payment_provider"
    );

  const status =
    getValue(
      transaction,
      "paymentStatus",
      "payment_status"
    ) ||
    "—";

  const paymentDate =
    getValue(
      transaction,
      "paymentDatetime",
      "payment_datetime"
    );

  return `
    <tr>

      <td>
        <strong class="ktms-payment-reference">
          ${escapeHtml(
            reference || "—"
          )}
        </strong>

        ${
          provider
            ? `
              <span class="ktms-payment-provider">
                ${escapeHtml(provider)}
              </span>
            `
            : ""
        }
      </td>

      <td>
        ${escapeHtml(playerName)}
      </td>

      <td>
        <strong>
          ${escapeHtml(
            tournamentId || "—"
          )}
        </strong>

        ${
          tournamentName
            ? `
              <span class="ktms-payment-secondary-text">
                ${escapeHtml(
                  tournamentName
                )}
              </span>
            `
            : ""
        }
      </td>

      <td>
        <strong>
          ${escapeHtml(
            formatMoney(
              amount,
              currency
            )
          )}
        </strong>
      </td>

      <td>
        ${escapeHtml(method)}
      </td>

      <td>
        ${paymentStatusBadge(status)}
      </td>

      <td>
        ${escapeHtml(
          formatDateTime(paymentDate)
        )}
      </td>

      <td>
        <button
          class="ktms-secondary-button ktms-payment-view-button"
          type="button"
          data-payment-id="${escapeAttribute(
            id || ""
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
          const id =
            button.dataset.paymentId;

          if (!id) {
            showMessage(
              "This transaction has no transaction history ID.",
              "error"
            );

            return;
          }

          await loadPaymentDetail(id);
        }
      );
    });
}

async function loadPaymentDetail(
  transactionHistoryId
) {
  const section =
    document.getElementById(
      "payment-detail-section"
    );

  if (!section) return;

  section.hidden = false;

  section.innerHTML = `
    <div class="ktms-detail-card">
      <div class="ktms-loading-state">
        Loading payment details...
      </div>
    </div>
  `;

  section.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });

  try {
    const data = await adminApi(
      "payment.detail",
      {
        transactionHistoryId
      }
    );

    paymentState.selectedTransaction =
      data;

    renderPaymentDetail(data);
  } catch (error) {
    section.innerHTML = `
      <div class="ktms-error-state">
        <strong>
          Unable to load payment
        </strong>

        <p>
          ${escapeHtml(
            error?.message ||
            "Unable to load payment details."
          )}
        </p>

        <button
          id="payment-detail-close-error"
          class="ktms-secondary-button"
          type="button"
        >
          CLOSE
        </button>
      </div>
    `;

    const closeButton =
      document.getElementById(
        "payment-detail-close-error"
      );

    if (closeButton) {
      closeButton.addEventListener(
        "click",
        closePaymentDetail
      );
    }
  }
}

function renderPaymentDetail(
  transaction
) {
  const section =
    document.getElementById(
      "payment-detail-section"
    );

  if (!section) return;

  const reference =
    getValue(
      transaction,
      "paymentReference",
      "payment_reference"
    ) ||
    "—";

  const status =
    getValue(
      transaction,
      "paymentStatus",
      "payment_status"
    ) ||
    "—";

  const method =
    getValue(
      transaction,
      "paymentMethod",
      "payment_method"
    ) ||
    "—";

  const provider =
    getValue(
      transaction,
      "paymentProvider",
      "payment_provider"
    ) ||
    "—";

  const amount =
    toNumber(
      getValue(
        transaction,
        "amount"
      )
    );

  const currency =
    getValue(
      transaction,
      "currency"
    ) ||
    "NGN";

  const transactionId =
    getValue(
      transaction,
      "transactionId",
      "transaction_id"
    ) ||
    "—";

  const playerId =
    getValue(
      transaction,
      "playerId",
      "player_id"
    ) ||
    "—";

  const playerName =
    getValue(
      transaction,
      "playerName",
      "player_name"
    ) ||
    "—";

  const tournamentId =
    getValue(
      transaction,
      "tournamentId",
      "tournament_id"
    ) ||
    "—";

  const tournamentName =
    getValue(
      transaction,
      "tournamentName",
      "tournament_name"
    ) ||
    "";

  const paymentDate =
    getValue(
      transaction,
      "paymentDatetime",
      "payment_datetime"
    );

  const createdDate =
    getValue(
      transaction,
      "createdDatetime",
      "created_datetime"
    );

  const verifiedDate =
    getValue(
      transaction,
      "verifiedDatetime",
      "verified_datetime"
    );

  const providerStatus =
    getValue(
      transaction,
      "providerStatus",
      "provider_status"
    ) ||
    "—";

  const paymentNote =
    getValue(
      transaction,
      "paymentNote",
      "payment_note"
    ) ||
    "";

  const paymentProof =
    getValue(
      transaction,
      "paymentProofUrl",
      "payment_proof_url"
    ) ||
    "";

  const registration =
    transaction?.registrationRequest ||
    transaction?.registration_request ||
    null;

  const registrationId =
    getValue(
      transaction,
      "registrationReferenceId",
      "registration_reference_id"
    ) ||
    getValue(
      registration,
      "requestId",
      "request_id"
    ) ||
    "—";

  const registrationStatus =
    getValue(
      registration,
      "requestStatus",
      "request_status"
    ) ||
    "—";

  const squadName =
    getValue(
      registration,
      "squadName",
      "squad_name"
    ) ||
    "—";

  const registrationFee =
    toNumber(
      getValue(
        registration,
        "registrationFee",
        "registration_fee"
      )
    );

  const submittedDate =
    getValue(
      registration,
      "paymentSubmittedDatetime",
      "payment_submitted_datetime"
    );

  const registrationVerifiedDate =
    getValue(
      registration,
      "paymentVerifiedDatetime",
      "payment_verified_datetime"
    );

  const canVerifyBank =
    isBankTransfer(method, provider) &&
    isAwaitingVerification(status);

  section.innerHTML = `
    <div class="ktms-detail-card">

      <div class="ktms-payment-detail-header">

        <div>
          <span class="ktms-payment-detail-eyebrow">
            PAYMENT DETAIL
          </span>

          <h3>
            ${escapeHtml(reference)}
          </h3>

          <div>
            ${paymentStatusBadge(status)}
          </div>
        </div>

        <button
          id="payment-detail-close"
          class="ktms-secondary-button"
          type="button"
        >
          CLOSE
        </button>

      </div>

      <div class="ktms-payment-detail-grid">

        ${detailItem(
          "Player",
          playerName
        )}

        ${detailItem(
          "Player ID",
          playerId
        )}

        ${detailItem(
          "Tournament",
          tournamentId
        )}

        ${detailItem(
          "Tournament Name",
          tournamentName || "—"
        )}

        ${detailItem(
          "Registration",
          registrationId
        )}

        ${detailItem(
          "Squad",
          squadName
        )}

        ${detailItem(
          "Registration Status",
          registrationStatus
        )}

        ${detailItem(
          "Payment Method",
          method
        )}

        ${detailItem(
          "Provider",
          provider
        )}

        ${detailItem(
          "Amount",
          formatMoney(
            amount,
            currency
          )
        )}

        ${detailItem(
          "Expected Registration Fee",
          registrationFee
            ? formatMoney(
                registrationFee,
                currency
              )
            : "—"
        )}

        ${detailItem(
          "Transaction ID",
          transactionId
        )}

        ${detailItem(
          "Provider Status",
          providerStatus
        )}

        ${detailItem(
          "Created",
          formatDateTime(
            createdDate
          )
        )}

        ${detailItem(
          "Payment Date",
          formatDateTime(
            paymentDate
          )
        )}

        ${detailItem(
          "Verified",
          formatDateTime(
            verifiedDate
          )
        )}

        ${detailItem(
          "Submitted",
          formatDateTime(
            submittedDate
          )
        )}

        ${detailItem(
          "Registration Payment Verified",
          formatDateTime(
            registrationVerifiedDate
          )
        )}

      </div>

      ${
        paymentNote
          ? `
            <div class="ktms-payment-detail-note">
              <strong>Payment Note</strong>
              <p>
                ${escapeHtml(paymentNote)}
              </p>
            </div>
          `
          : ""
      }

      ${
        paymentProof
          ? `
            <div class="ktms-payment-proof">
              <strong>Payment Proof</strong>

              <p>
                <a
                  href="${escapeAttribute(
                    paymentProof
                  )}"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  OPEN PAYMENT PROOF
                </a>
              </p>
            </div>
          `
          : ""
      }

      ${
        canVerifyBank
          ? `
            <div class="ktms-payment-verification-panel">

              <div>
                <h4>
                  Bank Transfer Verification
                </h4>

                <p>
                  This payment is awaiting manual
                  verification.
                </p>
              </div>

              <div class="ktms-payment-verification-actions">

                <button
                  id="payment-approve-bank"
                  class="ktms-primary-button"
                  type="button"
                >
                  APPROVE TRANSFER
                </button>

                <button
                  id="payment-reject-bank"
                  class="ktms-danger-button"
                  type="button"
                >
                  REJECT TRANSFER
                </button>

              </div>

            </div>
          `
          : ""
      }

    </div>
  `;

  const closeButton =
    document.getElementById(
      "payment-detail-close"
    );

  if (closeButton) {
    closeButton.addEventListener(
      "click",
      closePaymentDetail
    );
  }

  if (canVerifyBank) {
    const approveButton =
      document.getElementById(
        "payment-approve-bank"
      );

    const rejectButton =
      document.getElementById(
        "payment-reject-bank"
      );

    if (approveButton) {
      approveButton.addEventListener(
        "click",
        async () => {
          await verifyBankTransfer(
            transaction,
            "APPROVE"
          );
        }
      );
    }

    if (rejectButton) {
      rejectButton.addEventListener(
        "click",
        async () => {
          await verifyBankTransfer(
            transaction,
            "REJECT"
          );
        }
      );
    }
  }
}

async function verifyBankTransfer(
  transaction,
  decision
) {
  const transactionId =
    getValue(
      transaction,
      "transactionHistoryId",
      "transaction_history_id"
    );

  const paymentReference =
    getValue(
      transaction,
      "paymentReference",
      "payment_reference"
    );

  if (!transactionId) {
    showMessage(
      "Transaction history ID is missing.",
      "error"
    );

    return;
  }

  const action =
    decision === "APPROVE"
      ? "approve"
      : "reject";

  const reason = window.prompt(
    decision === "APPROVE"
      ? "Enter the reason for approving this bank transfer:"
      : "Enter the reason for rejecting this bank transfer:"
  );

  if (reason === null) {
    return;
  }

  const trimmedReason =
    reason.trim();

  if (!trimmedReason) {
    showMessage(
      "A reason is required.",
      "error"
    );

    return;
  }

  const confirmed =
    window.confirm(
      decision === "APPROVE"
        ? `Approve bank transfer ${paymentReference || transactionId}?`
        : `Reject bank transfer ${paymentReference || transactionId}?`
    );

  if (!confirmed) {
    return;
  }

  try {
    setVerificationButtonsDisabled(
      true
    );

    await adminApi(
      "payment.verifyBank",
      {
        transactionHistoryId:
          transactionId,

        decision:
          decision === "APPROVE"
            ? "APPROVED"
            : "REJECTED",

        reason:
          trimmedReason
      }
    );

    showMessage(
      decision === "APPROVE"
        ? "Bank transfer approved successfully."
        : "Bank transfer rejected successfully.",
      "success"
    );

    closePaymentDetail();

    await loadPayments();
  } catch (error) {
    setVerificationButtonsDisabled(
      false
    );

    showMessage(
      error?.message ||
      "Unable to update bank transfer.",
      "error"
    );
  }
}

function setVerificationButtonsDisabled(
  disabled
) {
  [
    "payment-approve-bank",
    "payment-reject-bank"
  ].forEach((id) => {
    const button =
      document.getElementById(id);

    if (button) {
      button.disabled =
        disabled;
    }
  });
}

function closePaymentDetail() {
  const section =
    document.getElementById(
      "payment-detail-section"
    );

  if (!section) return;

  section.hidden = true;
  section.innerHTML = "";
  paymentState.selectedTransaction =
    null;
}

function detailItem(
  label,
  value
) {
  return `
    <div class="ktms-payment-detail-item">

      <span>
        ${escapeHtml(label)}
      </span>

      <strong>
        ${escapeHtml(
          value || "—"
        )}
      </strong>

    </div>
  `;
}

function paymentStatusBadge(
  status
) {
  const normalized =
    String(
      status || ""
    )
      .trim()
      .toUpperCase();

  let className =
    "ktms-status";

  if (
    normalized === "SUCCESS"
  ) {
    className +=
      " ktms-status-active";
  } else if (
    normalized === "PENDING" ||
    normalized ===
      "AWAITING_VERIFICATION"
  ) {
    className +=
      " ktms-status-suspended";
  } else if (
    normalized === "FAILED"
  ) {
    className +=
      " ktms-status-failed";
  } else if (
    normalized === "REFUNDED"
  ) {
    className +=
      " ktms-status-registration-closed";
  }

  return `
    <span class="${className}">
      ${escapeHtml(
        formatStatus(normalized)
      )}
    </span>
  `;
}

function isBankTransfer(
  method,
  provider
) {
  const values = [
    method,
    provider
  ]
    .filter(Boolean)
    .map((value) =>
      String(value)
        .trim()
        .toLowerCase()
    );

  return values.includes(
    "bank transfer"
  );
}

function isAwaitingVerification(
  status
) {
  return (
    String(status || "")
      .trim()
      .toUpperCase() ===
    "AWAITING_VERIFICATION"
  );
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
  if (!value) return null;

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

function getValue(
  object,
  ...keys
) {
  if (!object) return "";

  for (const key of keys) {
    if (
      object[key] !== undefined &&
      object[key] !== null
    ) {
      return object[key];
    }
  }

  return "";
}

function toNumber(value) {
  const number =
    Number(value);

  return Number.isFinite(
    number
  )
    ? number
    : 0;
}

function formatNumber(value) {
  return new Intl.NumberFormat(
    "en-NG"
  ).format(
    toNumber(value)
  );
}

function formatMoney(
  amount,
  currency = "NGN"
) {
  return new Intl.NumberFormat(
    "en-NG",
    {
      style: "currency",
      currency:
        currency || "NGN",
      maximumFractionDigits: 2
    }
  ).format(
    toNumber(amount)
  );
}

function formatDateTime(
  value
) {
  if (!value) return "—";

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return "—";
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
  status
) {
  if (!status) return "Unknown";

  return String(status)
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/\b\w/g, (char) =>
      char.toUpperCase()
    );
}

function emptyState(
  title,
  message
) {
  return `
    <div class="ktms-empty-state">
      <h3>
        ${escapeHtml(title)}
      </h3>

      <p>
        ${escapeHtml(message)}
      </p>
    </div>
  `;
}

function showMessage(
  text,
  type = "info"
) {
  const message =
    document.getElementById(
      "payments-message"
    );

  if (!message) return;

  message.textContent =
    text;

  message.className =
    `ktms-message ktms-message-${type}`;
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

function escapeAttribute(
  value
) {
  return escapeHtml(value);
}
