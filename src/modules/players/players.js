import { adminApi } from "../../api/admin-api.js";

const playerState = {
  data: null,
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
          <p>
            Platform-wide player identity, account and squad administration.
          </p>
        </div>

        <button
          id="refresh-players-button"
          class="ktms-secondary-button"
          type="button"
        >
          REFRESH
        </button>
      </div>

      <div class="ktms-toolbar">
        <div class="ktms-toolbar-left" style="flex:1;min-width:0;">
          <input
            id="player-search"
            class="ktms-filter"
            type="search"
            placeholder="Search player ID, name, email, WhatsApp, username..."
            autocomplete="off"
            style="width:100%;max-width:620px;"
          />
        </div>

        <div class="ktms-toolbar-right">
          <select id="player-status-filter" class="ktms-filter">
            <option value="">All statuses</option>
          </select>

          <select id="player-account-status-filter" class="ktms-filter">
            <option value="">All account statuses</option>
          </select>

          <select id="player-verification-filter" class="ktms-filter">
            <option value="">All verification</option>
          </select>
        </div>
      </div>

      <div id="players-message" class="ktms-message" aria-live="polite"></div>
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
  bindSelect(
    "player-verification-filter",
    "emailVerificationStatus"
  );

  await loadPlayers();
}

function bindSelect(id, key) {
  document.getElementById(id)?.addEventListener("change", async (event) => {
    playerState.filters[key] = event.target.value || "";
    await loadPlayers();
  });
}

async function loadPlayers() {
  const summary = document.getElementById("players-summary");
  const table = document.getElementById("players-table-section");
  const message = document.getElementById("players-message");

  if (!summary || !table) return;

  summary.innerHTML = `
    <div class="ktms-loading-state">
      Loading players...
    </div>
  `;

  table.innerHTML = "";

  if (message) {
    message.textContent = "";
  }

  try {
    const data = await adminApi("player.list", {
      search: playerState.filters.search || null,
      playerStatus: playerState.filters.playerStatus || null,
      accountStatus: playerState.filters.accountStatus || null,
      emailVerificationStatus:
        playerState.filters.emailVerificationStatus || null
    });

    playerState.data = normalizePlayerData(data);

    populateSelect(
      "player-status-filter",
      playerState.data.playerStatuses,
      playerState.filters.playerStatus,
      "All statuses"
    );

    populateSelect(
      "player-account-status-filter",
      playerState.data.accountStatuses,
      playerState.filters.accountStatus,
      "All account statuses"
    );

    populateSelect(
      "player-verification-filter",
      playerState.data.emailVerificationStatuses,
      playerState.filters.emailVerificationStatus,
      "All verification"
    );

    renderSummary(playerState.data);
    renderPlayersTable(playerState.data.players);
  } catch (error) {
    summary.innerHTML = `
      <div class="ktms-error-state">
        <strong>Unable to load players</strong>
        <p>${escapeHtml(error?.message || "Unknown error")}</p>
      </div>
    `;
  }
}

function normalizePlayerData(data) {
  return {
    filters: data?.filters || {},

    playerStatuses: Array.isArray(data?.playerStatuses)
      ? data.playerStatuses
      : [],

    accountStatuses: Array.isArray(data?.accountStatuses)
      ? data.accountStatuses
      : [],

    emailVerificationStatuses: Array.isArray(
      data?.emailVerificationStatuses
    )
      ? data.emailVerificationStatuses
      : [],

    players: Array.isArray(data?.players)
      ? data.players
      : [],

    counts: {
      players: Number(data?.counts?.players) || 0,
      active: Number(data?.counts?.active) || 0,
      suspended: Number(data?.counts?.suspended) || 0,
      banned: Number(data?.counts?.banned) || 0,
      filtered: Number(data?.counts?.filtered) || 0
    }
  };
}

function populateSelect(id, values, selected, defaultLabel) {
  const select = document.getElementById(id);

  if (!select) return;

  select.innerHTML = `
    <option value="">${escapeHtml(defaultLabel)}</option>

    ${values
      .map(
        (value) => `
          <option value="${escapeAttribute(value)}">
            ${escapeHtml(value)}
          </option>
        `
      )
      .join("")}
  `;

  select.value = selected || "";
}

function renderSummary(data) {
  const container = document.getElementById("players-summary");

  if (!container) return;

  container.innerHTML = `
    <div
      class="ktms-dashboard-grid"
      style="margin-bottom:24px;"
    >
      ${statCard("PLAYERS", data.counts.players, "")}
      ${statCard("ACTIVE", data.counts.active, "primary")}
      ${statCard("SUSPENDED", data.counts.suspended, "gold")}
      ${statCard("BANNED", data.counts.banned, "danger")}
      ${statCard("FILTERED", data.counts.filtered, "")}
    </div>
  `;
}

function statCard(label, value, tone) {
  const className = tone
    ? ` ktms-player-stat-${tone}`
    : "";

  return `
    <div class="ktms-card${className}">
      <span class="ktms-registration-stat-label">
        ${escapeHtml(label)}
      </span>

      <strong class="ktms-registration-stat-value">
        ${value}
      </strong>
    </div>
  `;
}

function renderPlayersTable(players) {
  const container = document.getElementById(
    "players-table-section"
  );

  if (!container) return;

  if (!players.length) {
    container.innerHTML = `
      <section class="ktms-section">
        <div class="ktms-empty-state">
          <h2>No players found</h2>

          <p>
            ${
              hasActiveFilters()
                ? "No players match the current filters."
                : "No player accounts have been created yet."
            }
          </p>
        </div>
      </section>
    `;

    return;
  }

  container.innerHTML = `
    <section class="ktms-section">

      <div class="ktms-table-wrap">

        <table class="ktms-table">

          <thead>
            <tr>
              <th>Player ID</th>
              <th>Player</th>
              <th>Username</th>
              <th>Account</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>

          <tbody>
            ${players.map(renderPlayerRow).join("")}
          </tbody>

        </table>

      </div>

    </section>
  `;

  container
    .querySelectorAll("[data-player-id]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        const player = players.find(
          (item) =>
            String(item.playerId) ===
            button.dataset.playerId
        );

        if (player) {
          renderPlayerDetail(player);
        }
      });
    });
}

function renderPlayerRow(player) {
  const account = player?.account || null;

  const playerStatus =
    player?.playerStatus || "Unknown";

  const accountStatus =
    account?.accountStatus || "No account";

  return `
    <tr>

      <td>
        <span class="ktms-registration-id">
          ${escapeHtml(player?.playerId || "—")}
        </span>
      </td>

      <td>
        <strong>
          ${escapeHtml(player?.managerName || "—")}
        </strong>

        <div class="ktms-table-secondary">
          ${escapeHtml(
            player?.emailAddress || "No email"
          )}
        </div>
      </td>

      <td>
        ${escapeHtml(account?.username || "—")}
      </td>

      <td>
        ${statusBadge(accountStatus)}
      </td>

      <td>
        ${statusBadge(playerStatus)}
      </td>

      <td>
        <button
          type="button"
          class="ktms-secondary-button"
          data-player-id="${escapeAttribute(
            player?.playerId || ""
          )}"
        >
          VIEW
        </button>
      </td>

    </tr>
  `;
}

function renderPlayerDetail(player) {
  const panel = document.getElementById(
    "player-detail-panel"
  );

  if (!panel) return;

  const account = player?.account || null;

  const squads = Array.isArray(player?.squads)
    ? player.squads
    : [];

  panel.innerHTML = `
    <section
      class="ktms-detail-card"
      style="margin-top:24px;"
    >

      <div class="ktms-module-toolbar">

        <div>
          <h2>
            ${escapeHtml(
              player?.managerName || "Player"
            )}
          </h2>

          <p>
            ${escapeHtml(
              player?.playerId || "—"
            )}
          </p>
        </div>

        <button
          id="close-player-detail"
          class="ktms-secondary-button"
          type="button"
        >
          CLOSE
        </button>

      </div>

      <div class="ktms-form-grid">

        <div class="ktms-card">
          <h3>Player</h3>

          <p>
            <strong>Player ID:</strong>
            ${escapeHtml(player?.playerId || "—")}
          </p>

          <p>
            <strong>Name:</strong>
            ${escapeHtml(player?.managerName || "—")}
          </p>

          <p>
            <strong>Status:</strong>
            ${statusBadge(player?.playerStatus)}
          </p>

          <p>
            <strong>Created:</strong>
            ${formatDate(player?.createdDatetime)}
          </p>
        </div>

        <div class="ktms-card">
          <h3>Contact</h3>

          <p>
            <strong>Email:</strong>
            ${escapeHtml(
              player?.emailAddress || "—"
            )}
          </p>

          <p>
            <strong>WhatsApp:</strong>
            ${escapeHtml(
              player?.whatsappNumber || "—"
            )}
          </p>
        </div>

        <div class="ktms-card">
          <h3>Account</h3>

          <p>
            <strong>Username:</strong>
            ${escapeHtml(
              account?.username || "—"
            )}
          </p>

          <p>
            <strong>Login email:</strong>
            ${escapeHtml(
              account?.loginEmail || "—"
            )}
          </p>

          <p>
            <strong>Status:</strong>
            ${statusBadge(
              account?.accountStatus
            )}
          </p>

          <p>
            <strong>Verification:</strong>
            ${statusBadge(
              account?.emailVerificationStatus
            )}
          </p>

          <p>
            <strong>Last login:</strong>
            ${formatDate(
              account?.lastLoginDatetime
            )}
          </p>

          <p>
            <strong>Locked until:</strong>
            ${formatDate(
              account?.lockedUntilDatetime
            )}
          </p>
        </div>

        <div class="ktms-card">
          <h3>Squads</h3>

          ${
            squads.length
              ? squads.map(renderSquad).join("")
              : `<p>No squads registered.</p>`
          }
        </div>

      </div>

    </section>
  `;

  document
    .getElementById("close-player-detail")
    ?.addEventListener("click", () => {
      panel.innerHTML = "";
    });

  panel.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

function renderSquad(squad) {
  return `
    <div
      style="
        padding:10px 0;
        border-bottom:1px solid var(--ktms-border);
      "
    >
      <strong>
        ${escapeHtml(squad?.squadName || "—")}
      </strong>

      <div class="ktms-table-secondary">
        Slot ${escapeHtml(
          squad?.slot ?? "—"
        )} · ${escapeHtml(
          squad?.squadStatus || "—"
        )}
      </div>
    </div>
  `;
}

function statusBadge(value) {
  const text = value || "—";

  const slug = String(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

  return `
    <span
      class="ktms-status ktms-status-${escapeAttribute(slug)}"
    >
      ${escapeHtml(text)}
    </span>
  `;
}

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return escapeHtml(value);
  }

  return escapeHtml(
    new Intl.DateTimeFormat("en-GB", {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(date)
  );
}

function hasActiveFilters() {
  return Object.values(
    playerState.filters
  ).some(Boolean);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}
