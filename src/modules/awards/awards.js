import { adminApi } from "../../api/admin-api.js";
import { getAdminIdentity } from "../../auth/auth.js";
import { navigate } from "../../app/router.js";

const state = {
  tab: "awards",

  admin: null,

  awards: [],
  rewards: [],
  tournaments: [],
  registrations: [],

  filters: {
    tournamentId: "",
    playerSearch: "",
    prizeStatus: "",
    verificationMethod: "",

    definitionStatus: "",
    definitionTournamentType: "",
    definitionCategory: "",
    definitionType: "",
    definitionVerification: ""
  },

  editingReward: null
};

/* =========================================================
   MODULE ENTRY
   ========================================================= */

export async function renderAwards(page) {
  page.innerHTML = `
    <div class="ktms-module ktms-awards-module">

      <div class="ktms-module-toolbar">
        <div>
          <h2>Awards</h2>
          <p>
            Tournament awards, reward history and award administration.
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
      });
    });

  await loadAll();
}

/* =========================================================
   DATA LOADING
   ========================================================= */

async function loadAll() {
  const content = document.getElementById("awards-content");

  if (!content) return;

  content.innerHTML = `
    <div class="ktms-loading-state">
      Loading awards...
    </div>
  `;

  try {
    if (!state.admin) {
      state.admin = await getAdminIdentity();
    }

    const [
      awardsResponse,
      rewardsResponse,
      tournamentsResponse,
      registrationsResponse
    ] = await Promise.all([
      adminApi("award.list", {
        tournamentId:
          state.filters.tournamentId || null,

        prizeStatus:
          state.filters.prizeStatus || null,

        verificationMethod:
          state.filters.verificationMethod || null
      }),

      adminApi("reward_definitions.list", {}),

      adminApi("tournament.list", {
        status: null
      }),

      adminApi("registration.list", {})
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

    state.registrations = extractRegistrations(
      registrationsResponse
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

/* =========================================================
   TAB RENDERING
   ========================================================= */

function renderTab() {
  const content =
    document.getElementById("awards-content");

  if (!content) return;

  if (state.tab === "definitions") {
    content.innerHTML =
      renderDefinitionsTab();

    bindDefinitionFilters();
    bindDefinitionActions();

    return;
  }

  content.innerHTML =
    renderAwardsTab();

  bindAwardFilters();
  bindAwardActions();
}

/* =========================================================
   AWARDS TAB
   ========================================================= */

function renderAwardsTab() {
  const filteredAwards =
    getFilteredAwards();

  const pending =
    state.awards.filter(
      (award) =>
        statusOf(award) === "Pending"
    );

  const approved =
    state.awards.filter(
      (award) =>
        statusOf(award) === "Approved"
    );

  const delivered =
    state.awards.filter(
      (award) =>
        statusOf(award) === "Delivered"
    );

  const pendingAdminAwards =
    state.awards.filter(
      isPendingAdminAward
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

        <input
          id="award-player-filter"
          class="ktms-filter"
          type="search"
          placeholder="Search player..."
          value="${escapeAttribute(
            state.filters.playerSearch
          )}"
        />

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

        <select
          id="award-verification-filter"
          class="ktms-filter"
        >
          <option value="">
            All verification
          </option>

          <option value="Automatic">
            Automatic
          </option>

          <option value="Manual">
            Manual
          </option>

          <option value="Admin">
            Admin
          </option>
        </select>

        <button
          id="clear-award-filters"
          class="ktms-secondary-button"
          type="button"
        >
          CLEAR
        </button>

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
                Review and approve or disapprove
                these awards in the Awards module.
                Notifications contains the alert
                that brought the award to attention.
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
            <th>Actions</th>
          </tr>
        </thead>

        <tbody>

          ${
            filteredAwards.length
              ? filteredAwards
                  .map(renderAwardRow)
                  .join("")
              : `
                <tr>
                  <td
                    colspan="7"
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

/* =========================================================
   AWARD ROW
   ========================================================= */

function renderAwardRow(award) {
  const id = awardId(award);
  const status = statusOf(award);

  const tournamentIdValue =
    award?.tournament_id ??
    award?.tournamentId ??
    "";

  const tournament =
    findTournamentName(
      tournamentIdValue
    );

  const registrationId =
    award?.registration_id ??
    award?.registrationId ??
    "";

  const registration =
    findRegistration(
      registrationId
    );

  const player =
    registration?.playerName ||
    registration?.managerName ||
    award?.player_name ||
    award?.playerName ||
    registration?.playerId ||
    registrationId ||
    "—";

  const reward =
    findRewardDefinition(
      award?.reward_definition_id ??
      award?.rewardDefinitionId
    );

  const rewardName =
    reward?.reward_name ??
    reward?.rewardName ??
    award?.reward_name ??
    award?.rewardName ??
    "—";

  const rewardValue =
    award?.reward_value ??
    award?.rewardValue ??
    reward?.reward_value ??
    reward?.rewardValue ??
    "—";

  const verification =
    reward?.verification_method ??
    reward?.verificationMethod ??
    "—";

  return `
    <tr>

      <td>
        <strong>
          ${escapeHtml(id)}
        </strong>
      </td>

      <td>
        <strong>
          ${escapeHtml(tournament)}
        </strong>

        ${
          tournamentIdValue
            ? `
              <div class="ktms-muted">
                ${escapeHtml(
                  tournamentIdValue
                )}
              </div>
            `
            : ""
        }
      </td>

      <td>
        <strong>
          ${escapeHtml(player)}
        </strong>

        ${
          registration?.playerId
            ? `
              <div class="ktms-muted">
                ${escapeHtml(
                  registration.playerId
                )}
              </div>
            `
            : ""
        }
      </td>

      <td>
        <strong>
          ${escapeHtml(rewardName)}
        </strong>

        <div class="ktms-muted">
          ${escapeHtml(rewardValue)}
        </div>
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

      <td>
        ${renderAwardActions(
          award,
          status
        )}
      </td>

    </tr>
  `;
}

/* =========================================================
   AWARD ACTIONS
   ========================================================= */

function renderAwardActions(
  award,
  status
) {
  const id = awardId(award);

  if (!id || id === "—") {
    return "—";
  }

  if (status === "Delivered") {
    return `
      <span class="ktms-muted">
        Completed
      </span>
    `;
  }

  if (status === "Pending") {
    return `
      <div class="ktms-toolbar-left">

        <button
          class="ktms-primary-button"
          type="button"
          data-award-action="approve"
          data-award-id="${escapeAttribute(id)}"
        >
          APPROVE
        </button>

        <button
          class="ktms-secondary-button"
          type="button"
          data-award-action="disapprove"
          data-award-id="${escapeAttribute(id)}"
        >
          DISAPPROVE
        </button>

      </div>
    `;
  }

  if (status === "Approved") {
    return `
      <button
        class="ktms-primary-button"
        type="button"
        data-award-action="deliver"
        data-award-id="${escapeAttribute(id)}"
      >
        MARK DELIVERED
      </button>
    `;
  }

  if (status === "Disapproved") {
    return `
      <button
        class="ktms-primary-button"
        type="button"
        data-award-action="approve"
        data-award-id="${escapeAttribute(id)}"
      >
        APPROVE
      </button>
    `;
  }

  return "—";
}

function bindAwardActions() {
  document
    .querySelectorAll("[data-award-action]")
    .forEach((button) => {
      button.addEventListener(
        "click",
        async () => {
          const action =
            button.dataset.awardAction;

          const awardIdValue =
            button.dataset.awardId;

          if (!awardIdValue) return;

          let nextStatus = null;

          if (action === "approve") {
            nextStatus = "Approved";
          }

          if (action === "disapprove") {
            nextStatus = "Disapproved";
          }

          if (action === "deliver") {
            nextStatus = "Delivered";
          }

          if (!nextStatus) return;

          const confirmed =
            window.confirm(
              `${nextStatus === "Delivered"
                ? "Mark this award as delivered?"
                : `${nextStatus} this award?`
              }`
            );

          if (!confirmed) return;

          await updateAwardStatus(
            awardIdValue,
            nextStatus
          );
        }
      );
    });

  document
    .getElementById(
      "view-award-notifications"
    )
    ?.addEventListener(
      "click",
      () => {
        navigate("/notifications");
      }
    );
}

/* =========================================================
   AWARD STATUS UPDATE
   ========================================================= */

async function updateAwardStatus(
  awardIdValue,
  prizeStatus
) {
  try {
    await adminApi(
      "award.status",
      {
        awardId: awardIdValue,
        prizeStatus
      }
    );

    await loadAll();

  } catch (error) {
    console.error(
      "KTMS award status update failed:",
      error
    );

    window.alert(
      error?.message ||
      "Unable to update award status."
    );
  }
}

/* =========================================================
   AWARD FILTERING
   ========================================================= */

function getFilteredAwards() {
  const search =
    state.filters.playerSearch
      .trim()
      .toLowerCase();

  return state.awards.filter(
    (award) => {
      if (
        state.filters.tournamentId &&
        String(
          award?.tournament_id ??
          award?.tournamentId ??
          ""
        ) !==
          state.filters.tournamentId
      ) {
        return false;
      }

      if (
        state.filters.prizeStatus &&
        statusOf(award) !==
          state.filters.prizeStatus
      ) {
        return false;
      }

      if (
        state.filters.verificationMethod
      ) {
        const reward =
          findRewardDefinition(
            award?.reward_definition_id ??
            award?.rewardDefinitionId
          );

        const verification =
          String(
            reward?.verification_method ??
            reward?.verificationMethod ??
            ""
          );

        if (
          verification !==
          state.filters.verificationMethod
        ) {
          return false;
        }
      }

      if (search) {
        const registration =
          findRegistration(
            award?.registration_id ??
            award?.registrationId
          );

        const player =
          String(
            registration?.playerName ??
            registration?.managerName ??
            award?.player_name ??
            award?.playerName ??
            registration?.playerId ??
            ""
          ).toLowerCase();

        if (!player.includes(search)) {
          return false;
        }
      }

      return true;
    }
  );
}

function bindAwardFilters() {
  const tournamentSelect =
    document.getElementById(
      "award-tournament-filter"
    );

  const playerInput =
    document.getElementById(
      "award-player-filter"
    );

  const statusSelect =
    document.getElementById(
      "award-status-filter"
    );

  const verificationSelect =
    document.getElementById(
      "award-verification-filter"
    );

  if (tournamentSelect) {
    tournamentSelect.value =
      state.filters.tournamentId;

    tournamentSelect.addEventListener(
      "change",
      async (event) => {
        state.filters.tournamentId =
          event.target.value;

        renderTab();
      }
    );
  }

  if (playerInput) {
    playerInput.value =
      state.filters.playerSearch;

    playerInput.addEventListener(
      "input",
      (event) => {
        state.filters.playerSearch =
          event.target.value;

        renderTab();
      }
    );

    setTimeout(() => {
      const input =
        document.getElementById(
          "award-player-filter"
        );

      if (input) {
        input.focus();

        const length =
          input.value.length;

        try {
          input.setSelectionRange(
            length,
            length
          );
        } catch {}
      }
    }, 0);
  }

  if (statusSelect) {
    statusSelect.value =
      state.filters.prizeStatus;

    statusSelect.addEventListener(
      "change",
      (event) => {
        state.filters.prizeStatus =
          event.target.value;

        renderTab();
      }
    );
  }

  if (verificationSelect) {
    verificationSelect.value =
      state.filters.verificationMethod;

    verificationSelect.addEventListener(
      "change",
      (event) => {
        state.filters.verificationMethod =
          event.target.value;

        renderTab();
      }
    );
  }

  document
    .getElementById(
      "clear-award-filters"
    )
    ?.addEventListener(
      "click",
      () => {
        state.filters.tournamentId = "";
        state.filters.playerSearch = "";
        state.filters.prizeStatus = "";
        state.filters.verificationMethod = "";

        renderTab();
      }
    );
}

/* =========================================================
   REWARD DEFINITIONS
   ========================================================= */

function renderDefinitionsTab() {
  const definitions =
    getFilteredDefinitions();

  const canManage =
    isGameMaster();

  const canChangeStatus =
    isGameMaster() ||
    isModerator();

  return `
    <div class="ktms-toolbar">

      <div class="ktms-toolbar-left">

        <strong>
          Reward Catalogue
        </strong>

        <span class="ktms-muted">
          ${definitions.length}
          definition${
            definitions.length === 1
              ? ""
              : "s"
          }
        </span>

      </div>

      ${
        canManage
          ? `
            <button
              id="create-reward-definition"
              class="ktms-primary-button"
              type="button"
            >
              CREATE REWARD
            </button>
          `
          : ""
      }

    </div>

    <div class="ktms-toolbar">

      <div class="ktms-toolbar-left">

        <select
          id="definition-status-filter"
          class="ktms-filter"
        >
          <option value="">
            All statuses
          </option>

          <option value="Active">
            Active
          </option>

          <option value="Disabled">
            Disabled
          </option>
        </select>

        <select
          id="definition-tournament-filter"
          class="ktms-filter"
        >
          <option value="">
            All tournament types
          </option>

          ${[
            "KT",
            "KC",
            "KS",
            "KW",
            "ALL"
          ]
            .map(
              (type) => `
                <option value="${type}">
                  ${type}
                </option>
              `
            )
            .join("")}
        </select>

        <input
          id="definition-category-filter"
          class="ktms-filter"
          type="search"
          placeholder="Category..."
          value="${escapeAttribute(
            state.filters.definitionCategory
          )}"
        />

        <input
          id="definition-type-filter"
          class="ktms-filter"
          type="search"
          placeholder="Reward type..."
          value="${escapeAttribute(
            state.filters.definitionType
          )}"
        />

        <select
          id="definition-verification-filter"
          class="ktms-filter"
        >
          <option value="">
            All verification
          </option>

          <option value="Automatic">
            Automatic
          </option>

          <option value="Manual">
            Manual
          </option>

          <option value="Admin">
            Admin
          </option>
        </select>

        <button
          id="clear-definition-filters"
          class="ktms-secondary-button"
          type="button"
        >
          CLEAR
        </button>

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
            <th>Actions</th>
          </tr>
        </thead>

        <tbody>

          ${
            definitions.length
              ? definitions
                  .map(
                    (reward) =>
                      renderDefinitionRow(
                        reward,
                        canManage,
                        canChangeStatus
                      )
                  )
                  .join("")
              : `
                <tr>
                  <td
                    colspan="8"
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

    <div id="reward-definition-editor"></div>
  `;
}

function renderDefinitionRow(
  reward,
  canManage,
  canChangeStatus
) {
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
              String(status).toLowerCase()
            )}
          "
        >
          ${escapeHtml(status)}
        </span>
      </td>

      <td>

        <div class="ktms-toolbar-left">

          ${
            canManage
              ? `
                <button
                  class="ktms-secondary-button"
                  type="button"
                  data-definition-action="edit"
                  data-definition-id="${escapeAttribute(id)}"
                >
                  EDIT
                </button>
              `
              : ""
          }

          ${
            canChangeStatus
              ? `
                <button
                  class="ktms-secondary-button"
                  type="button"
                  data-definition-action="status"
                  data-definition-id="${escapeAttribute(id)}"
                  data-definition-status="${
                    status === "Active"
                      ? "Disabled"
                      : "Active"
                  }"
                >
                  ${
                    status === "Active"
                      ? "DISABLE"
                      : "ENABLE"
                  }
                </button>
              `
              : ""
          }

        </div>

      </td>

    </tr>
  `;
}

/* =========================================================
   REWARD DEFINITION FILTERS
   ========================================================= */

function getFilteredDefinitions() {
  return state.rewards.filter(
    (reward) => {
      const status =
        reward.reward_status ??
        reward.rewardStatus ??
        "Active";

      const tournamentType =
        reward.tournament_type_id ??
        reward.tournamentTypeId ??
        "";

      const category =
        String(
          reward.reward_category ??
          reward.rewardCategory ??
          ""
        ).toLowerCase();

      const type =
        String(
          reward.reward_type ??
          reward.rewardType ??
          ""
        ).toLowerCase();

      const verification =
        reward.verification_method ??
        reward.verificationMethod ??
        "";

      if (
        state.filters.definitionStatus &&
        status !==
          state.filters.definitionStatus
      ) {
        return false;
      }

      if (
        state.filters.definitionTournamentType &&
        tournamentType !==
          state.filters.definitionTournamentType
      ) {
        return false;
      }

      if (
        state.filters.definitionCategory &&
        !category.includes(
          state.filters.definitionCategory
            .toLowerCase()
        )
      ) {
        return false;
      }

      if (
        state.filters.definitionType &&
        !type.includes(
          state.filters.definitionType
            .toLowerCase()
        )
      ) {
        return false;
      }

      if (
        state.filters.definitionVerification &&
        verification !==
          state.filters.definitionVerification
      ) {
        return false;
      }

      return true;
    }
  );
}

function bindDefinitionFilters() {
  const status =
    document.getElementById(
      "definition-status-filter"
    );

  const tournament =
    document.getElementById(
      "definition-tournament-filter"
    );

  const category =
    document.getElementById(
      "definition-category-filter"
    );

  const type =
    document.getElementById(
      "definition-type-filter"
    );

  const verification =
    document.getElementById(
      "definition-verification-filter"
    );

  if (status) {
    status.value =
      state.filters.definitionStatus;

    status.addEventListener(
      "change",
      (event) => {
        state.filters.definitionStatus =
          event.target.value;

        renderTab();
      }
    );
  }

  if (tournament) {
    tournament.value =
      state.filters.definitionTournamentType;

    tournament.addEventListener(
      "change",
      (event) => {
        state.filters.definitionTournamentType =
          event.target.value;

        renderTab();
      }
    );
  }

  if (category) {
    category.addEventListener(
      "input",
      (event) => {
        state.filters.definitionCategory =
          event.target.value;

        renderTab();
      }
    );
  }

  if (type) {
    type.addEventListener(
      "input",
      (event) => {
        state.filters.definitionType =
          event.target.value;

        renderTab();
      }
    );
  }

  if (verification) {
    verification.value =
      state.filters.definitionVerification;

    verification.addEventListener(
      "change",
      (event) => {
        state.filters.definitionVerification =
          event.target.value;

        renderTab();
      }
    );
  }

  document
    .getElementById(
      "clear-definition-filters"
    )
    ?.addEventListener(
      "click",
      () => {
        state.filters.definitionStatus = "";
        state.filters.definitionTournamentType = "";
        state.filters.definitionCategory = "";
        state.filters.definitionType = "";
        state.filters.definitionVerification = "";

        renderTab();
      }
    );
}

/* =========================================================
   REWARD DEFINITION ACTIONS
   ========================================================= */

function bindDefinitionActions() {
  document
    .getElementById(
      "create-reward-definition"
    )
    ?.addEventListener(
      "click",
      () => {
        openRewardDefinitionEditor(null);
      }
    );

  document
    .querySelectorAll(
      "[data-definition-action]"
    )
    .forEach((button) => {
      button.addEventListener(
        "click",
        async () => {
          const action =
            button.dataset.definitionAction;

          const id =
            button.dataset.definitionId;

          if (!id) return;

          if (action === "edit") {
            const reward =
              state.rewards.find(
                (item) =>
                  String(
                    item.reward_definition_id ??
                    item.rewardDefinitionId ??
                    item.id ??
                    ""
                  ) === String(id)
              );

            if (!reward) return;

            openRewardDefinitionEditor(
              reward
            );

            return;
          }

          if (action === "status") {
            const nextStatus =
              button.dataset.definitionStatus;

            await changeRewardDefinitionStatus(
              id,
              nextStatus
            );
          }
        }
      );
    });
}

/* =========================================================
   REWARD DEFINITION EDITOR
   ========================================================= */

function openRewardDefinitionEditor(
  reward
) {
  const container =
    document.getElementById(
      "reward-definition-editor"
    );

  if (!container) return;

  state.editingReward =
    reward || null;

  const isEdit =
    Boolean(reward);

  const value = (key, fallback = "") =>
    reward?.[key] ??
    reward?.[
      camelCaseKey(key)
    ] ??
    fallback;

  container.innerHTML = `
    <div class="ktms-card">

      <div class="ktms-module-toolbar">

        <div>
          <h3>
            ${
              isEdit
                ? "Edit Reward Definition"
                : "Create Reward Definition"
            }
          </h3>

          <p>
            ${
              isEdit
                ? "Modify the reward catalogue entry."
                : "Create a new platform reward definition."
            }
          </p>
        </div>

        <button
          id="close-reward-editor"
          class="ktms-secondary-button"
          type="button"
        >
          CANCEL
        </button>

      </div>

      <div class="ktms-toolbar">

        <input
          id="reward-definition-id"
          class="ktms-filter"
          type="text"
          placeholder="Reward definition ID"
          value="${escapeAttribute(
            value("reward_definition_id")
          )}"
          ${
            isEdit
              ? "readonly"
              : ""
          }
        />

        <input
          id="reward-name"
          class="ktms-filter"
          type="text"
          placeholder="Reward name"
          value="${escapeAttribute(
            value("reward_name")
          )}"
        />

        <input
          id="reward-category"
          class="ktms-filter"
          type="text"
          placeholder="Reward category"
          value="${escapeAttribute(
            value("reward_category")
          )}"
        />

        <input
          id="reward-type"
          class="ktms-filter"
          type="text"
          placeholder="Reward type"
          value="${escapeAttribute(
            value("reward_type")
          )}"
        />

        <input
          id="reward-value"
          class="ktms-filter"
          type="text"
          placeholder="Reward value"
          value="${escapeAttribute(
            value("reward_value")
          )}"
        />

        <select
          id="reward-verification"
          class="ktms-filter"
        >
          <option value="">
            Verification method
          </option>

          <option value="Automatic">
            Automatic
          </option>

          <option value="Manual">
            Manual
          </option>

          <option value="Admin">
            Admin
          </option>
        </select>

        <select
          id="reward-tournament-type"
          class="ktms-filter"
        >
          <option value="">
            Tournament type
          </option>

          <option value="KT">
            KT
          </option>

          <option value="KC">
            KC
          </option>

          <option value="KS">
            KS
          </option>

          <option value="KW">
            KW
          </option>

          <option value="ALL">
            ALL
          </option>
        </select>

      </div>

      <div class="ktms-toolbar">

        <button
          id="save-reward-definition"
          class="ktms-primary-button"
          type="button"
        >
          ${
            isEdit
              ? "SAVE CHANGES"
              : "CREATE REWARD"
          }
        </button>

      </div>

      <div
        id="reward-definition-editor-message"
        class="ktms-muted"
      ></div>

    </div>
  `;

  const verification =
    document.getElementById(
      "reward-verification"
    );

  const tournamentType =
    document.getElementById(
      "reward-tournament-type"
    );

  verification.value =
    value("verification_method");

  tournamentType.value =
    value("tournament_type_id");

  document
    .getElementById(
      "close-reward-editor"
    )
    ?.addEventListener(
      "click",
      () => {
        state.editingReward = null;
        container.innerHTML = "";
      }
    );

  document
    .getElementById(
      "save-reward-definition"
    )
    ?.addEventListener(
      "click",
      saveRewardDefinition
    );
}

/* =========================================================
   CREATE / UPDATE REWARD DEFINITION
   ========================================================= */

async function saveRewardDefinition() {
  const message =
    document.getElementById(
      "reward-definition-editor-message"
    );

  const rewardDefinitionId =
    inputValue(
      "reward-definition-id"
    );

  const rewardName =
    inputValue("reward-name");

  const rewardCategory =
    inputValue("reward-category");

  const rewardType =
    inputValue("reward-type");

  const rewardValue =
    inputValue("reward-value");

  const verificationMethod =
    inputValue(
      "reward-verification"
    );

  const tournamentTypeId =
    inputValue(
      "reward-tournament-type"
    );

  if (
    !rewardDefinitionId ||
    !rewardName ||
    !rewardCategory ||
    !rewardType ||
    !rewardValue ||
    !tournamentTypeId
  ) {
    setEditorMessage(
      "Complete all required reward fields.",
      true
    );

    return;
  }

  const reason =
    window.prompt(
      state.editingReward
        ? "Reason for modifying this reward definition:"
        : "Reason for creating this reward definition:"
    );

  if (reason === null) {
    return;
  }

  if (!reason.trim()) {
    setEditorMessage(
      "A reason is required.",
      true
    );

    return;
  }

  try {
    const action =
      state.editingReward
        ? "reward_definitions.update"
        : "reward_definitions.create";

    await adminApi(
      action,
      {
        rewardDefinitionId,
        rewardName,
        rewardCategory,
        rewardType,
        rewardValue,
        verificationMethod:
          verificationMethod || null,
        tournamentTypeId,
        reason: reason.trim()
      }
    );

    state.editingReward = null;

    const container =
      document.getElementById(
        "reward-definition-editor"
      );

    if (container) {
      container.innerHTML = "";
    }

    await loadAll();

  } catch (error) {
    console.error(
      "KTMS reward definition save failed:",
      error
    );

    setEditorMessage(
      error?.message ||
      "Unable to save reward definition.",
      true
    );
  }
}

/* =========================================================
   REWARD DEFINITION STATUS
   ========================================================= */

async function changeRewardDefinitionStatus(
  rewardDefinitionId,
  rewardStatus
) {
  const confirmed =
    window.confirm(
      `${rewardStatus === "Active"
        ? "Enable"
        : "Disable"
      } this reward definition?`
    );

  if (!confirmed) return;

  const reason =
    window.prompt(
      `Reason for ${
        rewardStatus === "Active"
          ? "enabling"
          : "disabling"
      } this reward definition:`
    );

  if (reason === null) {
    return;
  }

  if (!reason.trim()) {
    window.alert(
      "A reason is required."
    );

    return;
  }

  try {
    await adminApi(
      "reward_definitions.status",
      {
        rewardDefinitionId,
        rewardStatus,
        reason: reason.trim()
      }
    );

    await loadAll();

  } catch (error) {
    console.error(
      "KTMS reward definition status update failed:",
      error
    );

    window.alert(
      error?.message ||
      "Unable to change reward definition status."
    );
  }
}

/* =========================================================
   ACTION BANNER
   ========================================================= */

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
          Approval and disapproval are performed
          from Awards. Notifications contains the
          corresponding alert.
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
    ?.addEventListener(
      "click",
      () => {
        navigate("/notifications");
      }
    );
}

function setActionBanner(html) {
  const element =
    document.getElementById(
      "awards-action-banner"
    );

  if (!element) return;

  element.innerHTML =
    html || "";
}

/* =========================================================
   ROLE CHECKS
   ========================================================= */

function currentRole() {
  return String(
    state.admin?.role || ""
  );
}

function isGameMaster() {
  return (
    currentRole() ===
    "Game Master"
  );
}

function isModerator() {
  return (
    currentRole() ===
    "Moderator"
  );
}

/* =========================================================
   AWARD HELPERS
   ========================================================= */

function isPendingAdminAward(
  award
) {
  const status =
    statusOf(award);

  const reward =
    findRewardDefinition(
      award?.reward_definition_id ??
      award?.rewardDefinitionId
    );

  const verification =
    String(
      reward?.verification_method ??
      reward?.verificationMethod ??
      ""
    ).toLowerCase();

  return (
    status === "Pending" &&
    verification === "admin"
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

function findRewardDefinition(
  rewardDefinitionId
) {
  if (!rewardDefinitionId) {
    return null;
  }

  return (
    state.rewards.find(
      (reward) =>
        String(
          reward.reward_definition_id ??
          reward.rewardDefinitionId ??
          reward.id ??
          ""
        ) ===
        String(rewardDefinitionId)
    ) || null
  );
}

function findTournamentName(
  id
) {
  if (!id) return "—";

  const tournament =
    state.tournaments.find(
      (item) =>
        String(
          item.tournament_id ??
          item.tournamentId ??
          item.id ??
          ""
        ) === String(id)
    );

  if (!tournament) {
    return String(id);
  }

  return (
    tournament.tournament_name ??
    tournament.tournamentName ??
    tournament.name ??
    id
  );
}

function findRegistration(
  registrationId
) {
  if (!registrationId) {
    return null;
  }

  return (
    state.registrations.find(
      (registration) =>
        String(
          registration.registrationId ??
          registration.registration_id ??
          registration.id ??
          ""
        ) ===
        String(registrationId)
    ) || null
  );
}

function extractRegistrations(
  response
) {
  if (
    response &&
    !Array.isArray(response)
  ) {
    if (
      Array.isArray(
        response.registrations
      )
    ) {
      return response.registrations;
    }

    if (
      Array.isArray(
        response.data?.registrations
      )
    ) {
      return response.data.registrations;
    }
  }

  return arrayFrom(
    response,
    [
      "registrations",
      "items",
      "data"
    ]
  );
}

/* =========================================================
   GENERAL HELPERS
   ========================================================= */

function summaryCard(
  label,
  value
) {
  return `
    <div class="ktms-award-summary-card">

      <span>
        ${escapeHtml(label)}
      </span>

      <strong>
        ${escapeHtml(
          String(value)
        )}
      </strong>

    </div>
  `;
}

function inputValue(id) {
  return String(
    document.getElementById(id)
      ?.value || ""
  ).trim();
}

function setEditorMessage(
  message,
  error = false
) {
  const element =
    document.getElementById(
      "reward-definition-editor-message"
    );

  if (!element) return;

  element.textContent =
    String(message || "");

  if (error) {
    element.setAttribute(
      "role",
      "alert"
    );
  } else {
    element.removeAttribute(
      "role"
    );
  }
}

function camelCaseKey(key) {
  return key.replace(
    /_([a-z])/g,
    (_, letter) =>
      letter.toUpperCase()
  );
}

function arrayFrom(
  response,
  keys = []
) {
  if (Array.isArray(response)) {
    return response;
  }

  for (const key of keys) {
    if (
      Array.isArray(
        response?.[key]
      )
    ) {
      return response[key];
    }
  }

  if (
    Array.isArray(
      response?.data
    )
  ) {
    return response.data;
  }

  return [];
}

function escapeHtml(value) {
  return String(
    value ?? ""
  )
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value);
}
