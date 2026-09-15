import { adminApi } from "../../api/admin-api.js";
import { navigate } from "../../app/router.js";

const state = {
  tab: "awards",
  awards: [],
  rewards: [],
  tournaments: [],
  filters: {
    tournamentId: "",
    prizeStatus: ""
  }
};

export async function renderAwards(page) {
  page.innerHTML = `
    <div class="ktms-module ktms-awards-module">

      <div class="ktms-module-toolbar">
        <div>
          <h2>Awards</h2>
          <p>
            Tournament awards, reward history and awards requiring administrative action.
          </p>
        </div>

        <button
          id="refresh-awards-button"
          class="ktms-secondary-button"
          type="button"
        >
          REFRESH
        </button>
      </div>

      <div id="awards-action-banner"></div>

      <div class="ktms-awards-tabs">
        <button
          type="button"
          class="ktms-award-tab active"
          data-award-tab="awards"
        >
          Awards
        </button>

        <button
          type="button"
          class="ktms-award-tab"
          data-award-tab="definitions"
        >
          Reward Definitions
        </button>
      </div>

      <div id="awards-content">
        Loading...
      </div>

    </div>
  `;

  document
    .getElementById("refresh-awards-button")
    ?.addEventListener("click", loadAll);

  document
    .querySelectorAll("[data-award-tab]")
    .forEach((button) => {
      button.addEventListener("click", async () => {
        state.tab = button.dataset.awardTab;

        document
          .querySelectorAll("[data-award-tab]")
          .forEach((tab) => {
            tab.classList.toggle(
              "active",
              tab.dataset.awardTab === state.tab
            );
          });

        renderTab();
        await loadAll();
      });
    });

  await loadAll();
}

async function loadAll() {
  const content = document.getElementById("awards-content");

  if (!content) return;

  content.innerHTML = `
    <div class="ktms-loading-state">
      Loading awards...
    </div>
  `;

  try {
    const [
      awardsResponse,
      rewardsResponse,
      tournamentsResponse
    ] = await Promise.all([
      adminApi("award.list", {
        tournamentId: state.filters.tournamentId || null,
        prizeStatus: state.filters.prizeStatus || null
      }),

      adminApi("reward_definitions.list", {}),

      adminApi("tournament.list", {
        status: null
      })
    ]);

    state.awards = arrayFrom(
      awardsResponse,
      ["awards", "items", "data"]
    );

    state.rewards = arrayFrom(
      rewardsResponse,
      [
        "rewardDefinitions",
        "reward_definitions",
        "items",
        "data"
      ]
    );

    state.tournaments = arrayFrom(
      tournamentsResponse,
      ["tournaments", "items", "data"]
    );

    renderTab();
    renderActionBanner();

  } catch (error) {
    console.error(
      "KTMS awards module failed:",
      error
    );

    content.innerHTML = `
      <div class="ktms-error-card">
        <strong>Unable to load awards.</strong>

        <p>
          ${escapeHtml(
            error?.message ||
            "An unexpected error occurred."
          )}
        </p>
      </div>
    `;

    setActionBanner("");
  }
}

function renderTab() {
  const content =
    document.getElementById("awards-content");

  if (!content) return;

  if (state.tab === "definitions") {
    content.innerHTML =
      renderDefinitionsTab();

    bindDefinitionFilters();

    return;
  }

  content.innerHTML =
    renderAwardsTab();

  bindAwardFilters();
}

function renderAwardsTab() {
  const pendingAdminAwards =
    state.awards.filter(isPendingAdminAward);

  const pending =
    state.awards.filter(
      (award) => statusOf(award) === "Pending"
    );

  const approved =
    state.awards.filter(
      (award) => statusOf(award) === "Approved"
    );

  const delivered =
    state.awards.filter(
      (award) => statusOf(award) === "Delivered"
    );

  return `
    <div class="ktms-toolbar ktms-awards-toolbar">

      <div class="ktms-toolbar-left">

        <select
          id="award-tournament-filter"
          class="ktms-filter"
        >
          <option value="">
            All tournaments
          </option>

          ${state.tournaments
            .map(
              (tournament) => `
                <option
                  value="${escapeAttribute(
                    tournamentId(tournament)
                  )}"
                >
                  ${escapeHtml(
                    tournamentName(tournament)
                  )}
                </option>
              `
            )
            .join("")}
        </select>

        <select
          id="award-status-filter"
          class="ktms-filter"
        >
          <option value="">
            All award statuses
          </option>

          ${[
            "Pending",
            "Approved",
            "Disapproved",
            "Delivered"
          ]
            .map(
              (status) => `
                <option value="${status}">
                  ${status}
                </option>
              `
            )
            .join("")}
        </select>

      </div>

    </div>

    <div class="ktms-award-summary-grid">

      ${summaryCard(
        "Total Awards",
        state.awards.length
      )}

      ${summaryCard(
        "Pending",
        pending.length
      )}

      ${summaryCard(
        "Approved",
        approved.length
      )}

      ${summaryCard(
        "Delivered",
        delivered.length
      )}

    </div>

    ${
      pendingAdminAwards.length
        ? `
          <div class="ktms-award-action-banner">

            <div>
              <strong>
                ${pendingAdminAwards.length}
                award${
                  pendingAdminAwards.length === 1
                    ? ""
                    : "s"
                }
                require admin action.
              </strong>

              <p>
                Approval or disapproval is handled from
                the Notifications module.
              </p>
            </div>

            <button
              id="view-award-notifications"
              class="ktms-primary-button"
              type="button"
            >
              VIEW NOTIFICATIONS
            </button>

          </div>
        `
        : ""
    }

    <div class="ktms-table-wrap">

      <table class="ktms-table">

        <thead>
          <tr>
            <th>Award</th>
            <th>Tournament</th>
            <th>Player</th>
            <th>Reward</th>
            <th>Verification</th>
            <th>Status</th>
          </tr>
        </thead>

        <tbody>

          ${
            state.awards.length
              ? state.awards
                  .map(renderAwardRow)
                  .join("")
              : `
                <tr>
                  <td
                    colspan="6"
                    class="ktms-table-empty"
                  >
                    No awards found.
                  </td>
                </tr>
              `
          }

        </tbody>

      </table>

    </div>
  `;
}

function renderAwardRow(award) {
  const id = awardId(award);

  const status =
    statusOf(award);

  const verification =
    award.verification_method ??
    award.verificationMethod ??
    "—";

  const tournament =
    award.tournament_name ??
    award.tournamentName ??
    award.tournament_id ??
    award.tournamentId ??
    "—";

  const player =
    award.player_name ??
    award.playerName ??
    award.manager_name ??
    award.registration_id ??
    "—";

  const reward =
    award.reward_name ??
    award.rewardName ??
    award.reward_value ??
    award.rewardValue ??
    "—";

  return `
    <tr>

      <td>
        <strong>
          ${escapeHtml(id)}
        </strong>
      </td>

      <td>
        ${escapeHtml(tournament)}
      </td>

      <td>
        ${escapeHtml(player)}
      </td>

      <td>
        ${escapeHtml(reward)}
      </td>

      <td>
        ${escapeHtml(verification)}
      </td>

      <td>
        <span
          class="
            ktms-award-status
            ktms-award-status-${escapeAttribute(
              status.toLowerCase()
            )}
          "
        >
          ${escapeHtml(status)}
        </span>
      </td>

    </tr>
  `;
}

function renderDefinitionsTab() {
  return `
    <div class="ktms-toolbar">

      <div class="ktms-toolbar-left">

        <strong>
          Reward Catalogue
        </strong>

        <span class="ktms-muted">
          ${state.rewards.length}
          definition${
            state.rewards.length === 1
              ? ""
              : "s"
          }
        </span>

      </div>

    </div>

    <div class="ktms-table-wrap">

      <table class="ktms-table">

        <thead>
          <tr>
            <th>Reward</th>
            <th>Category</th>
            <th>Type</th>
            <th>Value</th>
            <th>Verification</th>
            <th>Applies To</th>
            <th>Status</th>
          </tr>
        </thead>

        <tbody>

          ${
            state.rewards.length
              ? state.rewards
                  .map(renderDefinitionRow)
                  .join("")
              : `
                <tr>
                  <td
                    colspan="7"
                    class="ktms-table-empty"
                  >
                    No reward definitions found.
                  </td>
                </tr>
              `
          }

        </tbody>

      </table>

    </div>
  `;
}

function renderDefinitionRow(reward) {
  const id =
    reward.reward_definition_id ??
    reward.rewardDefinitionId ??
    reward.id ??
    "";

  const status =
    reward.reward_status ??
    reward.rewardStatus ??
    "Active";

  return `
    <tr>

      <td>
        <strong>
          ${escapeHtml(
            reward.reward_name ??
            reward.rewardName ??
            id
          )}
        </strong>

        <div class="ktms-muted">
          ${escapeHtml(id)}
        </div>
      </td>

      <td>
        ${escapeHtml(
          reward.reward_category ??
          reward.rewardCategory ??
          "—"
        )}
      </td>

      <td>
        ${escapeHtml(
          reward.reward_type ??
          reward.rewardType ??
          "—"
        )}
      </td>

      <td>
        ${escapeHtml(
          reward.reward_value ??
          reward.rewardValue ??
          "—"
        )}
      </td>

      <td>
        ${escapeHtml(
          reward.verification_method ??
          reward.verificationMethod ??
          "—"
        )}
      </td>

      <td>
        ${escapeHtml(
          reward.tournament_type_id ??
          reward.tournamentTypeId ??
          "—"
        )}
      </td>

      <td>
        <span
          class="
            ktms-award-status
            ktms-award-status-${escapeAttribute(
              status.toLowerCase()
            )}
          "
        >
          ${escapeHtml(status)}
        </span>
      </td>

    </tr>
  `;
}

function bindAwardFilters() {
  const tournamentSelect =
    document.getElementById(
      "award-tournament-filter"
    );

  const statusSelect =
    document.getElementById(
      "award-status-filter"
    );

  if (tournamentSelect) {
    tournamentSelect.value =
      state.filters.tournamentId;

    tournamentSelect.addEventListener(
      "change",
      async (event) => {
        state.filters.tournamentId =
          event.target.value;

        await loadAll();
      }
    );
  }

  if (statusSelect) {
    statusSelect.value =
      state.filters.prizeStatus;

    statusSelect.addEventListener(
      "change",
      async (event) => {
        state.filters.prizeStatus =
          event.target.value;

        await loadAll();
      }
    );
  }

  document
    .getElementById("view-award-notifications")
    ?.addEventListener("click", () => {
      navigate("/notifications");
    });
}

function bindDefinitionFilters() {
  // Definitions are currently read-only in this module.
  // Create/update/status controls belong here only after
  // the corresponding role-aware UI is implemented.
}

function renderActionBanner() {
  const pendingAdminAwards =
    state.awards.filter(
      isPendingAdminAward
    );

  if (!pendingAdminAwards.length) {
    setActionBanner("");
    return;
  }

  setActionBanner(`
    <div class="ktms-award-action-banner">
      <div>
        <strong>
          ${pendingAdminAwards.length}
          award${
            pendingAdminAwards.length === 1
              ? ""
              : "s"
          }
          require admin action.
        </strong>

        <p>
          Review these awards from Notifications.
        </p>
      </div>

      <button
        id="view-award-notifications-top"
        class="ktms-primary-button"
        type="button"
      >
        VIEW NOTIFICATIONS
      </button>
    </div>
  `);

  document
    .getElementById(
      "view-award-notifications-top"
    )
    ?.addEventListener("click", () => {
      navigate("/notifications");
    });
}

function setActionBanner(html) {
  const element =
    document.getElementById(
      "awards-action-banner"
    );

  if (!element) return;

  element.innerHTML = html || "";
}

function isPendingAdminAward(award) {
  return (
    statusOf(award) === "Pending" &&
    String(
      award.verification_method ??
      award.verificationMethod ??
      ""
    ).toLowerCase() === "admin"
  );
}

function statusOf(row) {
  return String(
    row?.prize_status ??
    row?.prizeStatus ??
    row?.status ??
    "Pending"
  );
}

function awardId(row) {
  return (
    row?.award_id ??
    row?.awardId ??
    row?.id ??
    "—"
  );
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
    tournamentId(row)
  );
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

function summaryCard(label, value) {
  return `
    <div class="ktms-award-summary-card">
      <span>
        ${escapeHtml(label)}
      </span>

      <strong>
        ${escapeHtml(value)}
      </strong>
    </div>
  `;
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
  return escapeHtml(value)
    .replaceAll("`", "&#096;");
}
