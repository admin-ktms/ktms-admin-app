import { adminApi } from "../../api/admin-api.js";

const playerState = {
  data: null,
  selectedPlayerId: null,
  filters: {
    search: "",
    playerStatus: "",
    accountStatus: "",
    emailVerificationStatus: ""
  }
};

export async function renderPlayers(page) {
  page.innerHTML = `
    <div class="ktms-module">
      <div class="ktms-module-toolbar">
        <div>
          <h2>Players</h2>
          <p>Platform-wide player identity, account and tournament administration.</p>
        </div>

        <button
          id="refresh-players-button"
          class="ktms-secondary-button"
          type="button"
        >
          REFRESH
        </button>
      </div>

      <div class="ktms-toolbar ktms-player-toolbar">
        <div class="ktms-toolbar-left ktms-player-search-wrap">
          <input
            id="player-search"
            class="ktms-filter ktms-player-search"
            type="search"
            placeholder="Search player ID, name, email, WhatsApp, username..."
            autocomplete="off"
          />
        </div>

        <div class="ktms-toolbar-right ktms-player-filter-wrap">
          <select
            id="player-status-filter"
            class="ktms-filter"
          >
            <option value="">All statuses</option>
          </select>

          <select
            id="player-account-status-filter"
            class="ktms-filter"
          >
            <option value="">All account statuses</option>
          </select>

          <select
            id="player-verification-filter"
            class="ktms-filter"
          >
            <option value="">All verification</option>
          </select>
        </div>
      </div>

      <div
        id="players-message"
        class="ktms-message"
        aria-live="polite"
      ></div>

      <div id="players-summary"></div>

      <div id="players-table-section"></div>

      <div id="player-detail-panel"></div>
    </div>
  `;

  document
    .getElementById("refresh-players-button")
    ?.addEventListener("click", loadPlayers);

  document
    .getElementById("player-search")
    ?.addEventListener("keydown", async (event) => {
      if (event.key !== "Enter") return;

      playerState.filters.search = event.target.value.trim();
      await loadPlayers();
    });

  document
    .getElementById("player-search")
    ?.addEventListener("input", (event) => {
      playerState.filters.search = event.target.value.trim();
    });

  bindSelect("player-status-filter", "playerStatus");
  bindSelect("player-account-status-filter", "accountStatus");
  bindSelect("player-verification-filter", "emailVerificationStatus");

  await loadPlayers();
}

function bindSelect(elementId, filterName) {
  document
    .getElementById(elementId)
    ?.addEventListener("change", async (event) => {
      playerState.filters[filterName] = event.target.value;
      await loadPlayers();
    });
}

async function loadPlayers() {
  setMessage("Loading players...", "info");

  try {
    const response = await adminApi("player.list", {
      search: playerState.filters.search || null,
      playerStatus: playerState.filters.playerStatus || null,
      accountStatus: playerState.filters.accountStatus || null,
      emailVerificationStatus:
        playerState.filters.emailVerificationStatus || null
    });

    const data = normalizePlayerList(response);

    playerState.data = data;

    populateFilters(data);
    renderSummary(data);
    renderPlayersTable(data);

    setMessage(
      `${data.players.length} player${data.players.length === 1 ? "" : "s"} loaded.`,
      "success"
    );
  } catch (error) {
    console.error("KTMS player.list failed:", error);

    renderSummary({
      players: [],
      counts: {}
    });

    document.getElementById("players-table-section").innerHTML = `
      <div class="ktms-error-card">
        <strong>Unable to load players.</strong>
        <p>${escapeHtml(error?.message || "An unexpected error occurred.")}</p>
      </div>
    `;

    setMessage(
      error?.message || "Unable to load players.",
      "error"
    );
  }
}

function normalizePlayerList(response) {
  const data = response?.data || response || {};

  return {
    players: Array.isArray(data.players)
      ? data.players
      : Array.isArray(data.items)
        ? data.items
        : [],

    counts: data.counts || {
      total: data.total ?? 0,
      active: data.active ?? 0,
      suspended: data.suspended ?? 0,
      banned: data.banned ?? 0
    },

    filters: data.filters || {}
  };
}

function populateFilters(data) {
  const filters = data.filters || {};

  populateSelect(
    "player-status-filter",
    filters.playerStatus ||
      filters.player_status ||
      uniqueValues(data.players, [
        "playerStatus",
        "player_status",
        "status"
      ])
  );

  populateSelect(
    "player-account-status-filter",
    filters.accountStatus ||
      filters.account_status ||
      uniqueValues(data.players, [
        "accountStatus",
        "account_status"
      ])
  );

  populateSelect(
    "player-verification-filter",
    filters.emailVerificationStatus ||
      filters.email_verification_status ||
      uniqueValues(data.players, [
        "emailVerificationStatus",
        "email_verification_status",
        "verificationStatus"
      ])
  );
}

function populateSelect(id, values) {
  const select = document.getElementById(id);
  if (!select || !Array.isArray(values)) return;

  const currentValue = select.value;

  const unique = [...new Set(
    values
      .filter(Boolean)
      .map((value) => String(value))
  )];

  select.innerHTML = `
    <option value="">${getSelectDefaultLabel(id)}</option>
    ${unique
      .sort()
      .map(
        (value) => `
          <option value="${escapeAttribute(value)}">
            ${escapeHtml(value)}
          </option>
        `
      )
      .join("")}
  `;

  if (unique.includes(currentValue)) {
    select.value = currentValue;
  }
}

function getSelectDefaultLabel(id) {
  if (id === "player-status-filter") return "All statuses";
  if (id === "player-account-status-filter") return "All account statuses";
  if (id === "player-verification-filter") return "All verification";
  return "All";
}

function uniqueValues(players, keys) {
  const values = [];

  for (const player of players) {
    const value = firstValue(player, keys);
    if (value !== null && value !== undefined && value !== "") {
      values.push(value);
    }
  }

  return values;
}

function renderSummary(data) {
  const counts = data.counts || {};
  const players = data.players || [];

  const total =
    counts.total ??
    counts.all ??
    players.length;

  const active =
    counts.active ??
    players.filter(
      (player) =>
        normalizeStatus(
          firstValue(player, [
            "playerStatus",
            "player_status",
            "status"
          ])
        ) === "active"
    ).length;

  const suspended =
    counts.suspended ??
    players.filter(
      (player) =>
        normalizeStatus(
          firstValue(player, [
            "playerStatus",
            "player_status",
            "status"
          ])
        ) === "suspended"
    ).length;

  const banned =
    counts.banned ??
    players.filter(
      (player) =>
        normalizeStatus(
          firstValue(player, [
            "playerStatus",
            "player_status",
            "status"
          ])
        ) === "banned"
    ).length;

  document.getElementById("players-summary").innerHTML = `
    <div class="ktms-player-summary-grid">
      ${dossierStat("Players", total)}
      ${dossierStat("Active", active, "success")}
      ${dossierStat("Suspended", suspended, "warning")}
      ${dossierStat("Banned", banned, "danger")}
    </div>
  `;
}

function renderPlayersTable(data) {
  const players = data.players || [];

  if (!players.length) {
    document.getElementById("players-table-section").innerHTML = `
      <div class="ktms-player-empty">
        <strong>No players found.</strong>
        <p>Adjust the search or filters and try again.</p>
      </div>
    `;

    return;
  }

  document.getElementById("players-table-section").innerHTML = `
    <div class="ktms-table-wrap">
      <table class="ktms-table ktms-player-table">
        <thead>
          <tr>
            <th>Player ID</th>
            <th>Player</th>
            <th>Username</th>
            <th>Account</th>
            <th>Status</th>
            <th>Verification</th>
            <th></th>
          </tr>
        </thead>

        <tbody>
          ${players.map(renderPlayerRow).join("")}
        </tbody>
      </table>
    </div>
  `;

  document
    .querySelectorAll("[data-player-view]")
    .forEach((button) => {
      button.addEventListener("click", async () => {
        const playerId = button.dataset.playerView;
        await openPlayerDetail(playerId);
      });
    });
}

function renderPlayerRow(player) {
  const playerId = firstValue(player, [
    "playerId",
    "player_id"
  ]) || "—";

  const managerName = firstValue(player, [
    "managerName",
    "manager_name",
    "playerName",
    "name"
  ]) || "—";

  const username = firstValue(player, [
    "username",
    "accountUsername"
  ]) || "—";

  const accountStatus = firstValue(player, [
    "accountStatus",
    "account_status"
  ]) || "—";

  const playerStatus = firstValue(player, [
    "playerStatus",
    "player_status",
    "status"
  ]) || "—";

  const verification = firstValue(player, [
    "emailVerificationStatus",
    "email_verification_status",
    "verificationStatus"
  ]) || "—";

  return `
    <tr>
      <td>
        <span class="ktms-code">${escapeHtml(playerId)}</span>
      </td>

      <td>
        <div class="ktms-player-name-cell">
          <strong>${escapeHtml(managerName)}</strong>
          ${
            firstValue(player, [
              "emailAddress",
              "email_address",
              "email"
            ])
              ? `<span>${escapeHtml(
                  firstValue(player, [
                    "emailAddress",
                    "email_address",
                    "email"
                  ])
                )}</span>`
              : ""
          }
        </div>
      </td>

      <td>
        ${escapeHtml(username)}
      </td>

      <td>
        ${statusBadge(accountStatus)}
      </td>

      <td>
        ${statusBadge(playerStatus)}
      </td>

      <td>
        ${statusBadge(verification)}
      </td>

      <td>
        <button
          type="button"
          class="ktms-link-button"
          data-player-view="${escapeAttribute(playerId)}"
        >
          VIEW
        </button>
      </td>
    </tr>
  `;
}

async function openPlayerDetail(playerId) {
  if (!playerId) return;

  playerState.selectedPlayerId = playerId;

  const panel = document.getElementById("player-detail-panel");

  if (!panel) return;

  panel.innerHTML = `
    <div class="ktms-player-loading">
      Loading complete player dossier...
    </div>
  `;

  try {
    const response = await adminApi("player.detail", {
      playerId
    });

    const dossier = response?.data || response;

    playerState.detail = dossier;

    renderPlayerDossier(dossier);
  } catch (error) {
    console.error("KTMS player.detail failed:", error);

    panel.innerHTML = `
      <div class="ktms-error-card">
        <strong>Unable to load player dossier.</strong>
        <p>${escapeHtml(error?.message || "An unexpected error occurred.")}</p>

        <button
          type="button"
          class="ktms-secondary-button"
          id="retry-player-detail"
        >
          RETRY
        </button>
      </div>
    `;

    document
      .getElementById("retry-player-detail")
      ?.addEventListener("click", () => openPlayerDetail(playerId));
  }
}

function renderPlayerDossier(dossier) {
  const panel = document.getElementById("player-detail-panel");

  if (!panel) return;

  const player = dossier?.player || {};
  const account = dossier?.account || {};
  const squads = array(dossier?.squads);
  const tournaments = array(dossier?.tournaments);
  const competitive = dossier?.competitive || {};
  const fixtures = array(dossier?.fixtures);
  const results = array(dossier?.results);
  const standings = dossier?.standings || {};
  const awards = array(dossier?.awards);
  const financial = dossier?.financial || {};
  const notifications = array(dossier?.notifications);
  const support = array(dossier?.support);
  const audit = array(dossier?.audit);
  const access = dossier?.access || {};

  panel.innerHTML = `
    <div class="ktms-player-dossier">

      ${renderDossierHeader(player, account)}

      ${renderDossierNavigation()}

      <div class="ktms-player-dossier-content">

        <section
          id="player-section-overview"
          class="ktms-player-dossier-section"
        >
          ${renderOverview({
            player,
            account,
            squads,
            tournaments,
            competitive,
            fixtures,
            results,
            awards,
            financial,
            notifications,
            support
          })}
        </section>

        <section
          id="player-section-identity"
          class="ktms-player-dossier-section"
          hidden
        >
          ${renderIdentityAccount(player, account, squads)}
        </section>

        <section
          id="player-section-tournaments"
          class="ktms-player-dossier-section"
          hidden
        >
          ${renderTournaments(tournaments)}
        </section>

        <section
          id="player-section-competitive"
          class="ktms-player-dossier-section"
          hidden
        >
          ${renderCompetitive(competitive, standings)}
        </section>

        <section
          id="player-section-fixtures"
          class="ktms-player-dossier-section"
          hidden
        >
          ${renderFixtures(fixtures)}
        </section>

        <section
          id="player-section-results"
          class="ktms-player-dossier-section"
          hidden
        >
          ${renderResults(results)}
        </section>

        <section
          id="player-section-awards"
          class="ktms-player-dossier-section"
          hidden
        >
          ${renderAwards(awards)}
        </section>

        ${
          access.financial
            ? `
              <section
                id="player-section-financial"
                class="ktms-player-dossier-section"
                hidden
              >
                ${renderFinancial(financial)}
              </section>
            `
            : ""
        }

        <section
          id="player-section-notifications"
          class="ktms-player-dossier-section"
          hidden
        >
          ${renderNotifications(notifications)}
        </section>

        ${
          access.support
            ? `
              <section
                id="player-section-support"
                class="ktms-player-dossier-section"
                hidden
              >
                ${renderSupport(support)}
              </section>
            `
            : ""
        }

        ${
          access.audit
            ? `
              <section
                id="player-section-audit"
                class="ktms-player-dossier-section"
                hidden
              >
                ${renderAudit(audit)}
              </section>
            `
            : ""
        }

        <section
          id="player-section-administration"
          class="ktms-player-dossier-section"
          hidden
        >
          ${renderAdministration(access)}
        </section>

      </div>
    </div>
  `;

  bindDossierNavigation();
}

function renderDossierHeader(player, account) {
  const playerId = firstValue(player, [
    "playerId",
    "player_id"
  ]) || "—";

  const name = firstValue(player, [
    "managerName",
    "manager_name",
    "playerName",
    "name"
  ]) || "Unknown Player";

  const playerStatus = firstValue(player, [
    "playerStatus",
    "player_status",
    "status"
  ]) || "Unknown";

  const accountStatus = firstValue(account, [
    "accountStatus",
    "account_status"
  ]) || "Unknown";

  const verification = firstValue(account, [
    "emailVerificationStatus",
    "email_verification_status",
    "verificationStatus"
  ]) || "Unknown";

  return `
    <div class="ktms-player-dossier-header">

      <div class="ktms-player-dossier-title-row">

        <div>
          <button
            type="button"
            class="ktms-link-button ktms-player-back-button"
            id="close-player-dossier"
          >
            ← BACK TO PLAYERS
          </button>

          <div class="ktms-player-dossier-title">
            <span class="ktms-code">${escapeHtml(playerId)}</span>
            <h2>${escapeHtml(name)}</h2>
          </div>

          <p class="ktms-player-dossier-subtitle">
            Complete player identity, account, competition, financial,
            support and administrative dossier.
          </p>
        </div>

        <div class="ktms-player-dossier-badges">
          ${statusBadge(playerStatus)}
          ${statusBadge(accountStatus)}
          ${statusBadge(verification)}
        </div>

      </div>

      <div class="ktms-player-dossier-header-meta">
        ${detailCard(
          "Email",
          firstValue(player, [
            "emailAddress",
            "email_address",
            "email"
          ]) || "—"
        )}

        ${detailCard(
          "WhatsApp",
          firstValue(player, [
            "whatsappNumber",
            "whatsapp_number",
            "whatsapp"
          ]) || "—"
        )}

        ${detailCard(
          "Username",
          firstValue(account, [
            "username"
          ]) || "—"
        )}

        ${detailCard(
          "Player Created",
          formatDate(
            firstValue(player, [
              "createdDatetime",
              "created_datetime",
              "createdAt",
              "created_at"
            ])
          )
        )}
      </div>
    </div>
  `;
}

function renderDossierNavigation() {
  return `
    <nav class="ktms-player-dossier-nav" aria-label="Player dossier">
      <button class="ktms-player-dossier-tab is-active" data-player-tab="overview">
        Overview
      </button>

      <button class="ktms-player-dossier-tab" data-player-tab="identity">
        Identity & Account
      </button>

      <button class="ktms-player-dossier-tab" data-player-tab="tournaments">
        Tournaments
      </button>

      <button class="ktms-player-dossier-tab" data-player-tab="competitive">
        Competitive
      </button>

      <button class="ktms-player-dossier-tab" data-player-tab="fixtures">
        Fixtures
      </button>

      <button class="ktms-player-dossier-tab" data-player-tab="results">
        Results
      </button>

      <button class="ktms-player-dossier-tab" data-player-tab="awards">
        Awards
      </button>

      <button class="ktms-player-dossier-tab" data-player-tab="financial">
        Financial
      </button>

      <button class="ktms-player-dossier-tab" data-player-tab="notifications">
        Notifications
      </button>

      <button class="ktms-player-dossier-tab" data-player-tab="support">
        Support
      </button>

      <button class="ktms-player-dossier-tab" data-player-tab="audit">
        Audit
      </button>

      <button class="ktms-player-dossier-tab" data-player-tab="administration">
        Administration
      </button>
    </nav>
  `;
}

function bindDossierNavigation() {
  document
    .getElementById("close-player-dossier")
    ?.addEventListener("click", closePlayerDossier);

  document
    .querySelectorAll("[data-player-tab]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        const tab = button.dataset.playerTab;

        document
          .querySelectorAll(".ktms-player-dossier-tab")
          .forEach((item) => {
            item.classList.toggle(
              "is-active",
              item === button
            );
          });

        document
          .querySelectorAll(".ktms-player-dossier-section")
          .forEach((section) => {
            section.hidden = true;
          });

        const target =
          document.getElementById(
            `player-section-${tab}`
          );

        if (target) {
          target.hidden = false;
        }
      });
    });
}

function closePlayerDossier() {
  playerState.selectedPlayerId = null;
  playerState.detail = null;

  const panel = document.getElementById("player-detail-panel");

  if (panel) {
    panel.innerHTML = "";
  }

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}

function renderOverview({
  player,
  account,
  squads,
  tournaments,
  competitive,
  fixtures,
  results,
  awards,
  financial,
  notifications,
  support
}) {
  const matches =
    competitive.matches ??
    competitive.totalMatches ??
    fixtures.length;

  const wins =
    competitive.wins ??
    results.filter(
      (result) =>
        normalizeStatus(
          firstValue(result, [
            "outcome",
            "result",
            "playerOutcome"
          ])
        ) === "win"
    ).length;

  const losses =
    competitive.losses ??
    results.filter(
      (result) =>
        normalizeStatus(
          firstValue(result, [
            "outcome",
            "result",
            "playerOutcome"
          ])
        ) === "loss"
    ).length;

  const outstandingSupport =
    support.filter((item) =>
      ["open", "pending", "in progress", "escalated"].includes(
        normalizeStatus(
          firstValue(item, [
            "status",
            "caseStatus"
          ])
        )
      )
    ).length;

  const outstandingFinancial =
    financial.outstanding ??
    financial.outstandingAmount ??
    0;

  return `
    <div class="ktms-player-stat-grid">

      ${dossierStat(
        "Tournaments",
        tournaments.length
      )}

      ${dossierStat(
        "Matches",
        matches
      )}

      ${dossierStat(
        "Wins",
        wins,
        "success"
      )}

      ${dossierStat(
        "Losses",
        losses,
        "danger"
      )}

      ${dossierStat(
        "Awards",
        awards.length,
        "gold"
      )}

      ${dossierStat(
        "Notifications",
        notifications.length
      )}

      ${dossierStat(
        "Outstanding Support",
        outstandingSupport,
        outstandingSupport ? "warning" : "success"
      )}

      ${dossierStat(
        "Outstanding Finance",
        outstandingFinancial,
        outstandingFinancial ? "warning" : "success"
      )}
    </div>

    <div class="ktms-player-dossier-grid">

      <div class="ktms-player-card">
        <div class="ktms-player-card-heading">
          <h3>Identity</h3>
        </div>

        <div class="ktms-player-detail-list">
          ${field(
            "Player ID",
            firstValue(player, ["playerId", "player_id"])
          )}

          ${field(
            "Manager Name",
            firstValue(player, [
              "managerName",
              "manager_name"
            ])
          )}

          ${field(
            "Email",
            firstValue(player, [
              "emailAddress",
              "email_address",
              "email"
            ])
          )}

          ${field(
            "WhatsApp",
            firstValue(player, [
              "whatsappNumber",
              "whatsapp_number",
              "whatsapp"
            ])
          )}

          ${field(
            "Username",
            firstValue(account, ["username"])
          )}

          ${field(
            "Squads",
            squads.length
          )}
        </div>
      </div>

      <div class="ktms-player-card">
        <div class="ktms-player-card-heading">
          <h3>Account State</h3>
        </div>

        <div class="ktms-player-detail-list">
          ${field(
            "Account Status",
            firstValue(account, [
              "accountStatus",
              "account_status"
            ])
          )}

          ${field(
            "Email Verification",
            firstValue(account, [
              "emailVerificationStatus",
              "email_verification_status"
            ])
          )}

          ${field(
            "Last Login",
            formatDate(
              firstValue(account, [
                "lastLoginDatetime",
                "last_login_datetime",
                "lastLoginAt"
              ])
            )
          )}

          ${field(
            "Last Modified",
            formatDate(
              firstValue(account, [
                "lastModifiedDatetime",
                "last_modified_datetime",
                "lastModifiedAt"
              ])
            )
          )}

          ${field(
            "Locked Until",
            formatDate(
              firstValue(account, [
                "lockedUntilDatetime",
                "locked_until_datetime"
              ])
            )
          )}
        </div>
      </div>

      <div class="ktms-player-card ktms-player-card-wide">
        <div class="ktms-player-card-heading">
          <h3>Competitive Snapshot</h3>
        </div>

        ${renderCompetitiveSnapshot(competitive)}
      </div>

    </div>
  `;
}

function renderIdentityAccount(player, account, squads) {
  return `
    <div class="ktms-player-dossier-grid">

      <div class="ktms-player-card">
        <div class="ktms-player-card-heading">
          <h3>Player Identity</h3>
        </div>

        <div class="ktms-player-detail-list">
          ${field("Player ID", firstValue(player, ["playerId", "player_id"]))}
          ${field("Manager Name", firstValue(player, ["managerName", "manager_name"]))}
          ${field("Email", firstValue(player, ["emailAddress", "email_address", "email"]))}
          ${field("WhatsApp", firstValue(player, ["whatsappNumber", "whatsapp_number", "whatsapp"]))}
          ${field("Player Status", firstValue(player, ["playerStatus", "player_status", "status"]))}
          ${field("Created", formatDate(firstValue(player, ["createdDatetime", "created_datetime", "createdAt"])))}
        </div>
      </div>

      <div class="ktms-player-card">
        <div class="ktms-player-card-heading">
          <h3>Player Account</h3>
        </div>

        <div class="ktms-player-detail-list">
          ${field("Account ID", firstValue(account, ["accountId", "account_id"]))}
          ${field("Username", firstValue(account, ["username"]))}
          ${field("Login Email", firstValue(account, ["loginEmail", "login_email"]))}
          ${field("Account Status", firstValue(account, ["accountStatus", "account_status"]))}
          ${field("Email Verification", firstValue(account, ["emailVerificationStatus", "email_verification_status"]))}
          ${field("Created", formatDate(firstValue(account, ["createdDatetime", "created_datetime"])))}
          ${field("Last Login", formatDate(firstValue(account, ["lastLoginDatetime", "last_login_datetime"])))}
          ${field("Username Change", formatDate(firstValue(account, ["lastUsernameChangeDatetime", "last_username_change_datetime"])))}
        </div>
      </div>

      <div class="ktms-player-card ktms-player-card-wide">
        <div class="ktms-player-card-heading">
          <h3>Squads</h3>
          <span>${squads.length}/3</span>
        </div>

        ${
          squads.length
            ? `
              <div class="ktms-player-squad-grid">
                ${squads
                  .map(
                    (squad) => `
                      <div class="ktms-player-squad">
                        <span class="ktms-player-squad-slot">
                          SLOT ${escapeHtml(
                            firstValue(squad, [
                              "slot",
                              "squadSlot"
                            ]) || "—"
                          )}
                        </span>

                        <strong>
                          ${escapeHtml(
                            firstValue(squad, [
                              "squadName",
                              "squad_name",
                              "name"
                            ]) || "—"
                          )}
                        </strong>

                        ${statusBadge(
                          firstValue(squad, [
                            "squadStatus",
                            "squad_status",
                            "status"
                          ]) || "—"
                        )}
                      </div>
                    `
                  )
                  .join("")}
              </div>
            `
            : `
              <div class="ktms-player-empty">
                No squads registered.
              </div>
            `
        }
      </div>

    </div>
  `;
}

function renderCompetitiveSnapshot(competitive) {
  const values = [
    ["Tournaments Entered", competitive.tournamentsEntered],
    ["Tournaments Completed", competitive.tournamentsCompleted],
    ["Matches", competitive.matches],
    ["Wins", competitive.wins],
    ["Losses", competitive.losses],
    ["Goals Scored", competitive.goalsScored],
    ["Goals Conceded", competitive.goalsConceded],
    ["Goal Difference", competitive.goalDifference],
    ["Points", competitive.points],
    ["Penalties", competitive.penalties],
    ["Performance", competitive.performance],
    ["Rank", competitive.rank]
  ];

  return `
    <div class="ktms-player-competitive-grid">
      ${values
        .map(
          ([label, value]) => `
            <div class="ktms-player-competitive-item">
              <span>${escapeHtml(label)}</span>
              <strong>${formatDisplayValue(value)}</strong>
            </div>
          `
        )
        .join("")}
    </div>
  `;
}

function renderTournaments(tournaments) {
  return sectionWithTable(
    "Tournament History",
    tournaments,
    [
      ["Tournament", ["tournamentName", "tournament_name"]],
      ["ID", ["tournamentId", "tournament_id"]],
      ["Type", ["tournamentType", "tournament_type", "type"]],
      ["Registration", ["registrationStatus", "registration_status"]],
      ["Squad", ["squadName", "squad_name"]],
      ["Payment", ["paymentStatus", "payment_status"]],
      ["Stage", ["currentStage", "current_stage", "stage"]],
      ["Rank", ["rank", "position"]],
      ["Status", ["status", "tournamentStatus"]]
    ]
  );
}

function renderCompetitive(competitive, standings) {
  return `
    <div class="ktms-player-dossier-grid">

      <div class="ktms-player-card ktms-player-card-wide">
        <div class="ktms-player-card-heading">
          <h3>Competitive Record</h3>
        </div>

        ${renderCompetitiveSnapshot(competitive)}
      </div>

      <div class="ktms-player-card">
        <div class="ktms-player-card-heading">
          <h3>Group Standings</h3>
        </div>

        ${renderStandings(standings.group)}
      </div>

      <div class="ktms-player-card">
        <div class="ktms-player-card-heading">
          <h3>Overall Standings</h3>
        </div>

        ${renderStandings(standings.overall)}
      </div>

    </div>
  `;
}

function renderStandings(rows) {
  rows = array(rows);

  if (!rows.length) {
    return `<div class="ktms-player-empty">No standings data available.</div>`;
  }

  return `
    <div class="ktms-table-wrap">
      <table class="ktms-table">
        <thead>
          <tr>
            <th>Tournament</th>
            <th>Stage</th>
            <th>Position</th>
            <th>Played</th>
            <th>Wins</th>
            <th>Losses</th>
            <th>Points</th>
            <th>Performance</th>
          </tr>
        </thead>

        <tbody>
          ${rows
            .map(
              (row) => `
                <tr>
                  <td>${escapeHtml(
                    firstValue(row, [
                      "tournamentName",
                      "tournament_name"
                    ]) || "—"
                  )}</td>

                  <td>${escapeHtml(
                    firstValue(row, [
                      "stage",
                      "currentStage",
                      "current_stage"
                    ]) || "—"
                  )}</td>

                  <td>${formatDisplayValue(
                    firstValue(row, [
                      "position",
                      "rank"
                    ])
                  )}</td>

                  <td>${formatDisplayValue(
                    firstValue(row, [
                      "played",
                      "matches",
                      "matchesPlayed"
                    ])
                  )}</td>

                  <td>${formatDisplayValue(
                    firstValue(row, ["wins"])
                  )}</td>

                  <td>${formatDisplayValue(
                    firstValue(row, ["losses"])
                  )}</td>

                  <td>${formatDisplayValue(
                    firstValue(row, ["points"])
                  )}</td>

                  <td>${formatDisplayValue(
                    firstValue(row, ["performance"])
                  )}</td>
                </tr>
              `
            )
            .join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderFixtures(fixtures) {
  return sectionWithTable(
    "Fixtures",
    fixtures,
    [
      ["Fixture", ["fixtureId", "fixture_id"]],
      ["Matchday", ["matchdayName", "matchday_name", "matchday"]],
      ["Stage", ["stage", "currentStage"]],
      ["Round", ["round", "roundName"]],
      ["Match Code", ["matchCode", "match_code"]],
      ["Opponent", ["opponentName", "opponent_name", "opponent"]],
      ["Status", ["status", "fixtureStatus"]],
      ["Scheduled", ["scheduledAt", "scheduled_at", "fixtureDatetime"]],
      ["Submission", ["submissionDeadline", "submission_deadline"]],
      ["Result", ["resultStatus", "result_status"]],
      ["Dispute", ["disputeStatus", "dispute_status"]]
    ]
  );
}

function renderResults(results) {
  return sectionWithTable(
    "Results",
    results,
    [
      ["Fixture", ["fixtureId", "fixture_id"]],
      ["Tournament", ["tournamentName", "tournament_name"]],
      ["Stage", ["stage", "currentStage"]],
      ["Opponent", ["opponentName", "opponent_name", "opponent"]],
      ["Score", ["score", "finalScore"]],
      ["Winner", ["winner", "winnerName"]],
      ["Winning Method", ["winningMethod", "winning_method"]],
      ["Result Type", ["resultType", "result_type"]],
      ["Verification", ["verificationStatus", "verification_status"]],
      ["Lock", ["lockStatus", "lock_status"]],
      ["Dispute", ["disputeStatus", "dispute_status"]],
      ["Official", ["official", "isOfficial"]]
    ]
  );
}

function renderAwards(awards) {
  return sectionWithTable(
    "Awards & Rewards",
    awards,
    [
      ["Award", ["awardName", "award_name", "name"]],
      ["Tournament", ["tournamentName", "tournament_name"]],
      ["Reward", ["reward", "rewardName", "reward_name"]],
      ["Date", ["awardedAt", "awarded_at", "awardDate"]],
      ["Prize Status", ["prizeStatus", "prize_status"]],
      ["Coupon", ["coupon", "couponCode", "coupon_code"]]
    ]
  );
}

function renderFinancial(financial) {
  const transactions =
    array(financial.transactions);

  return `
    <div class="ktms-player-card ktms-player-card-wide">

      <div class="ktms-player-card-heading">
        <h3>Financial Summary</h3>
      </div>

      <div class="ktms-player-stat-grid">
        ${dossierStat(
          "Total Paid",
          formatMoney(
            financial.totalPaid,
            financial.currency
          ),
          "success"
        )}

        ${dossierStat(
          "Pending",
          formatMoney(
            financial.pendingAmount,
            financial.currency
          ),
          "warning"
        )}

        ${dossierStat(
          "Refunded",
          formatMoney(
            financial.refundedAmount,
            financial.currency
          )
        )}

        ${dossierStat(
          "Outstanding",
          formatMoney(
            financial.outstandingAmount,
            financial.currency
          ),
          financial.outstandingAmount ? "warning" : "success"
        )}
      </div>

      ${sectionWithTable(
        "Transactions",
        transactions,
        [
          ["Date", ["transactionDate", "transaction_date", "createdDatetime"]],
          ["Tournament", ["tournamentName", "tournament_name"]],
          ["Amount", ["amount"]],
          ["Currency", ["currency"]],
          ["Method", ["paymentMethod", "payment_method"]],
          ["Provider", ["provider"]],
          ["Status", ["status", "paymentStatus"]],
          ["Reference", ["reference", "transactionReference"]],
          ["Verification", ["verificationStatus", "verification_status"]],
          ["Refund", ["refundStatus", "refund_status"]]
        ]
      )}

    </div>
  `;
}

function renderNotifications(notifications) {
  return sectionWithTable(
    "Notification History",
    notifications,
    [
      ["Date", ["createdDatetime", "created_datetime", "createdAt"]],
      ["Type", ["notificationType", "notification_type", "type"]],
      ["Subject", ["subject", "title"]],
      ["Priority", ["priority"]],
      ["Delivery", ["deliveryStatus", "delivery_status"]],
      ["Read", ["readStatus", "read_status", "isRead"]],
      ["Failure", ["failureReason", "failure_reason"]]
    ]
  );
}

function renderSupport(support) {
  return sectionWithTable(
    "Support & Disputes",
    support,
    [
      ["Case ID", ["caseId", "case_id", "supportCaseId"]],
      ["Type", ["caseType", "case_type", "type"]],
      ["Category", ["category"]],
      ["Tournament", ["tournamentName", "tournament_name"]],
      ["Related Entity", ["relatedEntity", "related_entity"]],
      ["Subject", ["subject", "title"]],
      ["Status", ["status", "caseStatus"]],
      ["Created", ["createdDatetime", "created_datetime", "createdAt"]],
      ["Updated", ["updatedDatetime", "updated_datetime", "updatedAt"]],
      ["Resolution", ["resolution", "resolutionSummary"]]
    ]
  );
}

function renderAudit(audit) {
  return sectionWithTable(
    "Audit History",
    audit,
    [
      ["Date", ["createdDatetime", "created_datetime", "createdAt"]],
      ["Action", ["action", "actionType"]],
      ["Source", ["source"]],
      ["Status", ["status"]],
      ["Summary", ["summary", "description"]],
      ["Entity", ["entity", "entityType"]],
      ["Record", ["recordId", "record_id"]],
      ["Reason", ["reason"]],
      ["Performer", ["performedBy", "performed_by", "actor"]]
    ]
  );
}

function renderAdministration(access) {
  const permissions = array(access.permissions);

  return `
    <div class="ktms-player-card ktms-player-card-wide ktms-player-admin-panel">

      <div class="ktms-player-card-heading">
        <div>
          <h3>Administrative Actions</h3>
          <p>
            Player state changes must be executed through KTMS Core
            authorization and business rules.
          </p>
        </div>

        ${
          access.playerAdministration
            ? statusBadge("Authorized")
            : statusBadge("Read Only")
        }
      </div>

      <div class="ktms-player-admin-capabilities">

        <div class="ktms-player-admin-capability">
          <span>Player Administration</span>
          <strong>
            ${access.playerAdministration ? "AVAILABLE" : "READ ONLY"}
          </strong>
        </div>

        <div class="ktms-player-admin-capability">
          <span>Financial Access</span>
          <strong>
            ${access.financial ? "AVAILABLE" : "RESTRICTED"}
          </strong>
        </div>

        <div class="ktms-player-admin-capability">
          <span>Support Access</span>
          <strong>
            ${access.support ? "AVAILABLE" : "RESTRICTED"}
          </strong>
        </div>

        <div class="ktms-player-admin-capability">
          <span>Audit Access</span>
          <strong>
            ${access.audit ? "AVAILABLE" : "RESTRICTED"}
          </strong>
        </div>

      </div>

      <div class="ktms-player-card-heading">
        <h3>Effective Permissions</h3>
      </div>

      ${
        permissions.length
          ? `
            <div class="ktms-player-permission-list">
              ${permissions
                .map(
                  (permission) => `
                    <span class="ktms-player-permission">
                      ${escapeHtml(permission)}
                    </span>
                  `
                )
                .join("")}
            </div>
          `
          : `
            <div class="ktms-player-empty">
              No effective permissions were returned for this role.
            </div>
          `
      }

      <div class="ktms-player-admin-notice">
        <strong>Core-controlled actions</strong>
        <p>
          Account lock/unlock, disable/recovery, player suspension,
          reinstatement, banning, identity correction, squad management,
          tournament interventions and support interventions must only
          be exposed here after their corresponding KTMS Core operation
          and permission are verified.
        </p>
      </div>

    </div>
  `;
}

function sectionWithTable(title, rows, columns) {
  rows = array(rows);

  return `
    <div class="ktms-player-card ktms-player-card-wide">

      <div class="ktms-player-card-heading">
        <h3>${escapeHtml(title)}</h3>
        <span>${rows.length}</span>
      </div>

      ${
        rows.length
          ? `
            <div class="ktms-table-wrap">
              <table class="ktms-table ktms-player-dossier-table">
                <thead>
                  <tr>
                    ${columns
                      .map(
                        ([label]) =>
                          `<th>${escapeHtml(label)}</th>`
                      )
                      .join("")}
                  </tr>
                </thead>

                <tbody>
                  ${rows
                    .map(
                      (row) => `
                        <tr>
                          ${columns
                            .map(
                              ([, keys]) => `
                                <td>
                                  ${renderCell(row, keys)}
                                </td>
                              `
                            )
                            .join("")}
                        </tr>
                      `
                    )
                    .join("")}
                </tbody>
              </table>
            </div>
          `
          : `
            <div class="ktms-player-empty">
              No ${escapeHtml(title.toLowerCase())} available.
            </div>
          `
      }

    </div>
  `;
}

function renderCell(row, keys) {
  const value = firstValue(row, keys);

  if (
    typeof value === "boolean"
  ) {
    return value ? "Yes" : "No";
  }

  if (
    keys.some(
      (key) =>
        key.toLowerCase().includes("date") ||
        key.toLowerCase().includes("datetime") ||
        key.toLowerCase().includes("_at") ||
        key.toLowerCase().endsWith("at")
    )
  ) {
    return escapeHtml(formatDate(value));
  }

  return escapeHtml(formatDisplayValue(value));
}

function detailCard(label, value) {
  return `
    <div class="ktms-player-header-meta-card">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(formatDisplayValue(value))}</strong>
    </div>
  `;
}

function field(label, value) {
  return `
    <div class="ktms-player-detail-item">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(formatDisplayValue(value))}</strong>
    </div>
  `;
}

function dossierStat(label, value, tone = "") {
  return `
    <div class="ktms-player-stat ${tone ? `is-${tone}` : ""}">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(formatDisplayValue(value))}</strong>
    </div>
  `;
}

function statusBadge(value) {
  const text = formatDisplayValue(value);

  const normalized = normalizeStatus(value);

  let tone = "";

  if (
    [
      "active",
      "verified",
      "successful",
      "paid",
      "completed",
      "official",
      "authorized",
      "available",
      "win"
    ].includes(normalized)
  ) {
    tone = "success";
  } else if (
    [
      "pending",
      "pending payment",
      "open",
      "in progress",
      "suspended",
      "locked",
      "warning",
      "read only"
    ].includes(normalized)
  ) {
    tone = "warning";
  } else if (
    [
      "banned",
      "disabled",
      "failed",
      "rejected",
      "cancelled",
      "disputed",
      "loss",
      "restricted"
    ].includes(normalized)
  ) {
    tone = "danger";
  } else if (
    [
      "gold",
      "winner"
    ].includes(normalized)
  ) {
    tone = "gold";
  }

  return `
    <span class="ktms-status-badge ${tone ? `is-${tone}` : ""}">
      ${escapeHtml(text)}
    </span>
  `;
}

function formatMoney(value, currency = "NGN") {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "—";
  }

  const numeric = Number(value);

  if (!Number.isFinite(numeric)) {
    return String(value);
  }

  try {
    return new Intl.NumberFormat("en-NG", {
      style: "currency",
      currency: currency || "NGN",
      maximumFractionDigits: 2
    }).format(numeric);
  } catch {
    return `${currency || "NGN"} ${numeric.toLocaleString()}`;
  }
}

function formatDate(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString();
}

function formatDisplayValue(value) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return "—";
  }

  if (Array.isArray(value)) {
    return value.join(", ");
  }

  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return "[object]";
    }
  }

  return String(value);
}

function firstValue(object, keys) {
  if (!object || !Array.isArray(keys)) return null;

  for (const key of keys) {
    if (
      object[key] !== undefined &&
      object[key] !== null &&
      object[key] !== ""
    ) {
      return object[key];
    }
  }

  return null;
}

function array(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeStatus(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

function setMessage(message, type = "info") {
  const element = document.getElementById("players-message");

  if (!element) return;

  element.className = `ktms-message is-${type}`;
  element.textContent = message;
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
