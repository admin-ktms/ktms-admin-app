import { adminApi } from "../../api/admin-api.js";

/*
 * KTMS AWARDS MODULE
 *
 * Frontend responsibility:
 *   1. Send signal
 *   2. Receive backend result
 *   3. Display result
 *
 * Business rules, award evaluation, authorization,
 * status validation and persistence remain backend-owned.
 */

const state = {
  tab: "awards",
  admin: null,

  awards: [],
  rewardDefinitions: [],
  tournaments: [],

  awardFilters: {
    tournamentId: "",
    registrationSearch: "",
    prizeStatus: "",
    verificationMethod: ""
  },

  definitionFilters: {
    status: "",
    tournamentTypeId: "",
    category: "",
    rewardType: "",
    verificationMethod: ""
  },

  editingReward: null
};


/* =========================================================
   MODULE ENTRY
   ========================================================= */

export async function renderAwards(page, admin = null) {
  state.admin = admin;
  state.tab = "awards";
  state.editingReward = null;

  page.innerHTML = `
    <div class="ktms-module ktms-awards-module">

      <div class="ktms-module-toolbar">
        <div>
          <h2>Awards</h2>
          <p>Tournament awards and reward administration.</p>
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
      button.addEventListener("click", () => {
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
   DATA SIGNALS
   ========================================================= */

async function loadAll() {
  const content =
    document.getElementById("awards-content");

  if (!content) {
    return;
  }

  content.innerHTML = `
    <div class="ktms-loading-state">
      Loading awards...
    </div>
  `;

  try {
    /*
     * These are read signals only.
     *
     * The frontend does not calculate or create
     * award records.
     */

    const [
      awardsResponse,
      definitionsResponse,
      tournamentsResponse
    ] = await Promise.all([
      adminApi("award.list", {
        tournamentId:
          state.awardFilters.tournamentId || null,

        prizeStatus:
          state.awardFilters.prizeStatus || null,

        verificationMethod:
          state.awardFilters.verificationMethod || null
      }),

      adminApi("reward_definitions.list", {}),

      adminApi("tournament.list", {})
    ]);

    state.awards =
      toArray(awardsResponse);

    state.rewardDefinitions =
      toArray(definitionsResponse);

    state.tournaments =
      toArray(tournamentsResponse);

    renderTab();

    setActionBanner("");

  } catch (error) {
    console.error(
      "KTMS Awards module error:",
      error
    );

    content.innerHTML = `
      <div class="ktms-error-card">

        <strong>
          Unable to load awards.
        </strong>

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

  if (!content) {
    return;
  }

  if (state.tab === "definitions") {
    content.innerHTML =
      renderRewardDefinitionsContent();

    bindDefinitionFilters();
    bindDefinitionOperations();

    return;
  }

  content.innerHTML =
    renderAwardsContent();

  bindAwardFilters();
  bindAwardOperations();
}


/* =========================================================
   AWARDS DISPLAY
   ========================================================= */

function renderAwardsContent() {
  const awards =
    getFilteredAwards();

  const total =
    state.awards.length;

  const pending =
    state.awards.filter(
      (award) =>
        awardStatus(award) === "Pending"
    ).length;

  const approved =
    state.awards.filter(
      (award) =>
        awardStatus(award) === "Approved"
    ).length;

  const delivered =
    state.awards.filter(
      (award) =>
        awardStatus(award) === "Delivered"
    ).length;

  const adminPending =
    state.awards.filter(
      isPendingAdminAward
    ).length;

  return `
    <div class="ktms-toolbar">

      <div class="ktms-toolbar-left">

        <select
          id="award-tournament-filter"
          class="ktms-filter"
        >
          <option value="">
            All tournaments
          </option>

          ${state.tournaments
            .map((tournament) => `
              <option
                value="${escapeAttribute(
                  getTournamentId(tournament)
                )}"
                ${
                  getTournamentId(tournament) ===
                  state.awardFilters.tournamentId
                    ? "selected"
                    : ""
                }
              >
                ${escapeHtml(
                  getTournamentName(tournament)
                )}
              </option>
            `)
            .join("")}

        </select>

        <input
          id="award-registration-filter"
          class="ktms-filter"
          type="search"
          placeholder="Search registration / player..."
          value="${escapeAttribute(
            state.awardFilters.registrationSearch
          )}"
        />

        <select
          id="award-status-filter"
          class="ktms-filter"
        >
          <option value="">
            All award statuses
          </option>

          ${statusOption(
            "Pending",
            state.awardFilters.prizeStatus
          )}

          ${statusOption(
            "Approved",
            state.awardFilters.prizeStatus
          )}

          ${statusOption(
            "Disapproved",
            state.awardFilters.prizeStatus
          )}

          ${statusOption(
            "Delivered",
            state.awardFilters.prizeStatus
          )}

        </select>

        <select
          id="award-verification-filter"
          class="ktms-filter"
        >
          <option value="">
            All verification
          </option>

          ${statusOption(
            "Automatic",
            state.awardFilters.verificationMethod
          )}

          ${statusOption(
            "Admin",
            state.awardFilters.verificationMethod
          )}

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
        total
      )}

      ${summaryCard(
        "Pending",
        pending
      )}

      ${summaryCard(
        "Approved",
        approved
      )}

      ${summaryCard(
        "Delivered",
        delivered
      )}

    </div>


    ${
      adminPending > 0
        ? `
          <div class="ktms-award-action-banner">

            <strong>
              ${adminPending}
              admin-verified award
              ${
                adminPending === 1
                  ? "requires"
                  : "require"
              }
              action.
            </strong>

            <p>
              Use Award Operations below to
              approve or disapprove pending awards.
            </p>

          </div>
        `
        : ""
    }


    <div class="ktms-card">

      <div class="ktms-toolbar">

        <div>

          <strong>
            Awards
          </strong>

          <div class="ktms-muted">
            Showing
            ${awards.length}
            of
            ${state.awards.length}
            awards.
          </div>

        </div>

      </div>


      <div class="ktms-table-wrap">

        <table class="ktms-table">

          <thead>

            <tr>
              <th>Registration</th>
              <th>Award</th>
              <th>Reward</th>
              <th>Tournament</th>
              <th>Verification</th>
              <th>Status</th>
            </tr>

          </thead>

          <tbody>

            ${
              awards.length
                ? awards
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

    </div>


    <div
      class="ktms-card"
      style="margin-top:18px;"
    >

      <div class="ktms-toolbar">

        <div>

          <strong>
            Award Operations
          </strong>

          <div class="ktms-muted">
            Backend-authorized operations for
            admin-verified awards.
          </div>

        </div>

      </div>

      ${renderAwardOperations(awards)}

    </div>
  `;
}


/* =========================================================
   AWARD ROW
   ========================================================= */

function renderAwardRow(award) {
  const status =
    awardStatus(award);

  const reward =
    findRewardDefinition(
      getAwardRewardDefinitionId(award)
    );

  const rewardName =
    award?.reward_name ??
    award?.rewardName ??
    reward?.reward_name ??
    reward?.rewardName ??
    "—";

  const rewardValue =
    award?.reward_value ??
    award?.rewardValue ??
    reward?.reward_value ??
    reward?.rewardValue ??
    "—";

  const verification =
    award?.verification_method ??
    award?.verificationMethod ??
    reward?.verification_method ??
    reward?.verificationMethod ??
    "—";

  const tournamentId =
    getAwardTournamentId(award);

  return `
    <tr>

      <td>

        <strong>
          ${escapeHtml(
            getAwardRegistrationId(award)
          )}
        </strong>

      </td>


      <td>

        <strong>
          ${escapeHtml(
            getAwardId(award)
          )}
        </strong>

        ${
          award?.awarded_datetime
            ? `
              <div class="ktms-muted">
                ${escapeHtml(
                  formatDateTime(
                    award.awarded_datetime
                  )
                )}
              </div>
            `
            : ""
        }

      </td>


      <td>

        <strong>
          ${escapeHtml(
            rewardName
          )}
        </strong>

        <div class="ktms-muted">
          ${escapeHtml(
            String(rewardValue)
          )}
        </div>

      </td>


      <td>

        <strong>
          ${escapeHtml(
            findTournamentName(
              tournamentId
            )
          )}
        </strong>

        ${
          tournamentId
            ? `
              <div class="ktms-muted">
                ${escapeHtml(
                  tournamentId
                )}
              </div>
            `
            : ""
        }

      </td>


      <td>
        ${escapeHtml(
          verification
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


/* =========================================================
   AWARD OPERATIONS DISPLAY
   ========================================================= */

function renderAwardOperations(awards) {
  const operations =
    awards.filter((award) => {

      const status =
        awardStatus(award);

      if (
        status === "Pending" &&
        isPendingAdminAward(award)
      ) {
        return true;
      }

      if (status === "Approved") {
        return true;
      }

      return false;
    });

  if (!operations.length) {
    return `
      <div class="ktms-muted">
        No award operations are currently
        required for the selected awards.
      </div>
    `;
  }

  return `
    <div class="ktms-table-wrap">

      <table class="ktms-table">

        <thead>

          <tr>
            <th>Registration</th>
            <th>Award</th>
            <th>Reward</th>
            <th>Status</th>
            <th>Operation</th>
          </tr>

        </thead>

        <tbody>

          ${operations
            .map(renderAwardOperationRow)
            .join("")}

        </tbody>

      </table>

    </div>
  `;
}


function renderAwardOperationRow(award) {
  const status =
    awardStatus(award);

  const reward =
    findRewardDefinition(
      getAwardRewardDefinitionId(award)
    );

  const rewardName =
    award?.reward_name ??
    award?.rewardName ??
    reward?.reward_name ??
    reward?.rewardName ??
    "—";

  if (status === "Pending") {
    return `
      <tr>

        <td>
          ${escapeHtml(
            getAwardRegistrationId(award)
          )}
        </td>

        <td>
          ${escapeHtml(
            getAwardId(award)
          )}
        </td>

        <td>
          ${escapeHtml(
            rewardName
          )}
        </td>

        <td>
          <span
            class="
              ktms-award-status
              ktms-award-status-pending
            "
          >
            Pending
          </span>
        </td>

        <td>

          <div class="ktms-toolbar-left">

            <button
              class="ktms-primary-button"
              type="button"
              data-award-operation="approve"
              data-award-id="${escapeAttribute(
                getAwardId(award)
              )}"
            >
              APPROVE
            </button>

            <button
              class="ktms-secondary-button"
              type="button"
              data-award-operation="disapprove"
              data-award-id="${escapeAttribute(
                getAwardId(award)
              )}"
            >
              DISAPPROVE
            </button>

          </div>

        </td>

      </tr>
    `;
  }

  if (status === "Approved") {
    return `
      <tr>

        <td>
          ${escapeHtml(
            getAwardRegistrationId(award)
          )}
        </td>

        <td>
          ${escapeHtml(
            getAwardId(award)
          )}
        </td>

        <td>
          ${escapeHtml(
            rewardName
          )}
        </td>

        <td>
          <span
            class="
              ktms-award-status
              ktms-award-status-approved
            "
          >
            Approved
          </span>
        </td>

        <td>

          <button
            class="ktms-primary-button"
            type="button"
            data-award-operation="deliver"
            data-award-id="${escapeAttribute(
              getAwardId(award)
            )}"
          >
            MARK AS SENT
          </button>

        </td>

      </tr>
    `;
  }

  return "";
}


/* =========================================================
   AWARD FILTERS
   ========================================================= */

function bindAwardFilters() {
  const tournament =
    document.getElementById(
      "award-tournament-filter"
    );

  const registration =
    document.getElementById(
      "award-registration-filter"
    );

  const status =
    document.getElementById(
      "award-status-filter"
    );

  const verification =
    document.getElementById(
      "award-verification-filter"
    );

  const clear =
    document.getElementById(
      "clear-award-filters"
    );

  tournament?.addEventListener(
    "change",
    async () => {
      state.awardFilters.tournamentId =
        tournament.value;

      await loadAll();
    }
  );

  registration?.addEventListener(
    "input",
    () => {
      state.awardFilters.registrationSearch =
        registration.value;

      renderTab();
    }
  );

  status?.addEventListener(
    "change",
    async () => {
      state.awardFilters.prizeStatus =
        status.value;

      await loadAll();
    }
  );

  verification?.addEventListener(
    "change",
    async () => {
      state.awardFilters.verificationMethod =
        verification.value;

      await loadAll();
    }
  );

  clear?.addEventListener(
    "click",
    async () => {
      state.awardFilters = {
        tournamentId: "",
        registrationSearch: "",
        prizeStatus: "",
        verificationMethod: ""
      };

      await loadAll();
    }
  );
}


/* =========================================================
   AWARD OPERATIONS SIGNALS
   ========================================================= */

function bindAwardOperations() {
  document
    .querySelectorAll(
      "[data-award-operation]"
    )
    .forEach((button) => {

      button.addEventListener(
        "click",
        async () => {

          const operation =
            button.dataset.awardOperation;

          const awardId =
            button.dataset.awardId;

          if (!awardId) {
            return;
          }

          let prizeStatus = "";

          if (operation === "approve") {
            prizeStatus = "Approved";
          }

          if (operation === "disapprove") {
            prizeStatus = "Disapproved";
          }

          if (operation === "deliver") {
            prizeStatus = "Delivered";
          }

          if (!prizeStatus) {
            return;
          }

          await updateAwardStatus(
            awardId,
            prizeStatus
          );
        }
      );

    });
}


async function updateAwardStatus(
  awardId,
  prizeStatus
) {
  setActionBanner(
    "Processing award operation..."
  );

  try {
    /*
     * One command signal.
     *
     * Backend owns:
     * - authorization
     * - valid status transition
     * - persistence
     * - audit handling
     */

    await adminApi(
      "award.status",
      {
        awardId,
        prizeStatus
      }
    );

    setActionBanner(
      "Award operation completed."
    );

    await loadAll();

  } catch (error) {
    console.error(
      "KTMS award status operation failed:",
      error
    );

    setActionBanner(
      error?.message ||
      "Award operation failed.",
      true
    );
  }
}


/* =========================================================
   REWARD DEFINITIONS
   ========================================================= */

function renderRewardDefinitionsContent() {
  const definitions =
    getFilteredRewardDefinitions();

  const canManageDefinitions =
    isGameMaster();

  return `
    <div class="ktms-toolbar">

      <div class="ktms-toolbar-left">

        <select
          id="definition-status-filter"
          class="ktms-filter"
        >
          <option value="">
            All statuses
          </option>

          ${statusOption(
            "Active",
            state.definitionFilters.status
          )}

          ${statusOption(
            "Disabled",
            state.definitionFilters.status
          )}

        </select>


        <select
          id="definition-tournament-type-filter"
          class="ktms-filter"
        >
          <option value="">
            All tournament types
          </option>

          ${typeOption(
            "KT",
            state.definitionFilters.tournamentTypeId
          )}

          ${typeOption(
            "KC",
            state.definitionFilters.tournamentTypeId
          )}

          ${typeOption(
            "KS",
            state.definitionFilters.tournamentTypeId
          )}

          ${typeOption(
            "KW",
            state.definitionFilters.tournamentTypeId
          )}

          ${typeOption(
            "ALL",
            state.definitionFilters.tournamentTypeId
          )}

        </select>


        <input
          id="definition-category-filter"
          class="ktms-filter"
          type="search"
          placeholder="Category..."
          value="${escapeAttribute(
            state.definitionFilters.category
          )}"
        />


        <select
          id="definition-type-filter"
          class="ktms-filter"
        >
          <option value="">
            All reward types
          </option>

          <option
            value="Cash"
            ${
              state.definitionFilters.rewardType ===
              "Cash"
                ? "selected"
                : ""
            }
          >
            Cash
          </option>

          <option
            value="Coupon"
            ${
              state.definitionFilters.rewardType ===
              "Coupon"
                ? "selected"
                : ""
            }
          >
            Coupon
          </option>

          <option
            value="Physical"
            ${
              state.definitionFilters.rewardType ===
              "Physical"
                ? "selected"
                : ""
            }
          >
            Physical
          </option>

          <option
            value="Other"
            ${
              state.definitionFilters.rewardType ===
              "Other"
                ? "selected"
                : ""
            }
          >
            Other
          </option>

        </select>


        <select
          id="definition-verification-filter"
          class="ktms-filter"
        >
          <option value="">
            All verification
          </option>

          ${statusOption(
            "Automatic",
            state.definitionFilters.verificationMethod
          )}

          ${statusOption(
            "Admin",
            state.definitionFilters.verificationMethod
          )}

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


    <div class="ktms-card">

      <div class="ktms-toolbar">

        <div>

          <strong>
            Reward Definitions
          </strong>

          <div class="ktms-muted">
            Showing
            ${definitions.length}
            of
            ${state.rewardDefinitions.length}
            reward definitions.
          </div>

        </div>

        ${
          canManageDefinitions
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


      ${
        canManageDefinitions &&
        state.editingReward
          ? renderRewardEditor()
          : ""
      }


      <div class="ktms-table-wrap">

        <table class="ktms-table">

          <thead>

            <tr>
              <th>Name</th>
              <th>Category</th>
              <th>Type</th>
              <th>Value</th>
              <th>Verification</th>
              <th>Tournament Type</th>
              <th>Status</th>
              <th>Operation</th>
            </tr>

          </thead>

          <tbody>

            ${
              definitions.length
                ? definitions
                    .map(
                      renderRewardDefinitionRow
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

    </div>
  `;
}


function renderRewardDefinitionRow(
  definition
) {
  const id =
    getRewardDefinitionId(
      definition
    );

  const status =
    getRewardDefinitionStatus(
      definition
    );

  const canManage =
    isGameMaster();

  return `
    <tr>

      <td>

        <strong>
          ${escapeHtml(
            getRewardDefinitionName(
              definition
            )
          )}
        </strong>

        <div class="ktms-muted">
          ${escapeHtml(id)}
        </div>

      </td>

      <td>
        ${escapeHtml(
          definition?.reward_category ??
          definition?.rewardCategory ??
          "—"
        )}
      </td>

      <td>
        ${escapeHtml(
          definition?.reward_type ??
          definition?.rewardType ??
          "—"
        )}
      </td>

      <td>
        ${escapeHtml(
          String(
            definition?.reward_value ??
            definition?.rewardValue ??
            "—"
          )
        )}
      </td>

      <td>
        ${escapeHtml(
          definition?.verification_method ??
          definition?.verificationMethod ??
          "—"
        )}
      </td>

      <td>
        ${escapeHtml(
          definition?.tournament_type_id ??
          definition?.tournamentTypeId ??
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
                  data-definition-operation="edit"
                  data-definition-id="${escapeAttribute(id)}"
                >
                  EDIT
                </button>
              `
              : ""
          }

          ${
            canManage
              ? `
                <button
                  class="ktms-secondary-button"
                  type="button"
                  data-definition-operation="toggle"
                  data-definition-id="${escapeAttribute(id)}"
                  data-definition-status="${escapeAttribute(status)}"
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
   REWARD DEFINITION EDITOR
   ========================================================= */

function renderRewardEditor() {
  const reward =
    state.editingReward;

  const editing =
    Boolean(reward);

  return `
    <div
      class="ktms-card"
      style="margin-bottom:18px;"
    >

      <div class="ktms-toolbar">

        <div>
          <strong>
            ${
              editing
                ? "Update Reward Definition"
                : "Create Reward Definition"
            }
          </strong>

          <div class="ktms-muted">
            The backend remains authoritative for
            validation and authorization.
          </div>
        </div>

      </div>


      <div class="ktms-toolbar">

        <input
          id="reward-definition-id"
          class="ktms-filter"
          type="text"
          placeholder="Reward definition ID"
          value="${escapeAttribute(
            reward?.reward_definition_id ??
            reward?.rewardDefinitionId ??
            ""
          )}"
          ${editing ? "readonly" : ""}
        />

        <input
          id="reward-name"
          class="ktms-filter"
          type="text"
          placeholder="Reward name"
          value="${escapeAttribute(
            reward?.reward_name ??
            reward?.rewardName ??
            ""
          )}"
        />

        <input
          id="reward-category"
          class="ktms-filter"
          type="text"
          placeholder="Reward category"
          value="${escapeAttribute(
            reward?.reward_category ??
            reward?.rewardCategory ??
            ""
          )}"
        />

        <select
          id="reward-type"
          class="ktms-filter"
        >

          <option value="">
            Reward type
          </option>

          ${editorOption(
            "Cash",
            reward?.reward_type ??
            reward?.rewardType
          )}

          ${editorOption(
            "Coupon",
            reward?.reward_type ??
            reward?.rewardType
          )}

          ${editorOption(
            "Physical",
            reward?.reward_type ??
            reward?.rewardType
          )}

          ${editorOption(
            "Other",
            reward?.reward_type ??
            reward?.rewardType
          )}

        </select>


        <input
          id="reward-value"
          class="ktms-filter"
          type="text"
          placeholder="Reward value"
          value="${escapeAttribute(
            reward?.reward_value ??
            reward?.rewardValue ??
            ""
          )}"
        />

        <select
          id="reward-verification"
          class="ktms-filter"
        >

          <option value="">
            Verification method
          </option>

          ${editorOption(
            "Automatic",
            reward?.verification_method ??
            reward?.verificationMethod
          )}

          ${editorOption(
            "Admin",
            reward?.verification_method ??
            reward?.verificationMethod
          )}

        </select>


        <select
          id="reward-tournament-type"
          class="ktms-filter"
        >

          <option value="">
            Tournament type
          </option>

          ${editorOption(
            "KT",
            reward?.tournament_type_id ??
            reward?.tournamentTypeId
          )}

          ${editorOption(
            "KC",
            reward?.tournament_type_id ??
            reward?.tournamentTypeId
          )}

          ${editorOption(
            "KS",
            reward?.tournament_type_id ??
            reward?.tournamentTypeId
          )}

          ${editorOption(
            "KW",
            reward?.tournament_type_id ??
            reward?.tournamentTypeId
          )}

          ${editorOption(
            "ALL",
            reward?.tournament_type_id ??
            reward?.tournamentTypeId
          )}

        </select>

      </div>


      <div class="ktms-toolbar-left">

        <button
          id="save-reward-definition"
          class="ktms-primary-button"
          type="button"
        >
          ${
            editing
              ? "UPDATE REWARD"
              : "CREATE REWARD"
          }
        </button>

        <button
          id="cancel-reward-definition"
          class="ktms-secondary-button"
          type="button"
        >
          CANCEL
        </button>

      </div>

    </div>
  `;
}


/* =========================================================
   REWARD DEFINITION FILTERS
   ========================================================= */

function bindDefinitionFilters() {
  const status =
    document.getElementById(
      "definition-status-filter"
    );

  const tournamentType =
    document.getElementById(
      "definition-tournament-type-filter"
    );

  const category =
    document.getElementById(
      "definition-category-filter"
    );

  const rewardType =
    document.getElementById(
      "definition-type-filter"
    );

  const verification =
    document.getElementById(
      "definition-verification-filter"
    );

  const clear =
    document.getElementById(
      "clear-definition-filters"
    );

  status?.addEventListener(
    "change",
    () => {
      state.definitionFilters.status =
        status.value;

      renderTab();
    }
  );

  tournamentType?.addEventListener(
    "change",
    () => {
      state.definitionFilters.tournamentTypeId =
        tournamentType.value;

      renderTab();
    }
  );

  category?.addEventListener(
    "input",
    () => {
      state.definitionFilters.category =
        category.value;

      renderTab();
    }
  );

  rewardType?.addEventListener(
    "change",
    () => {
      state.definitionFilters.rewardType =
        rewardType.value;

      renderTab();
    }
  );

  verification?.addEventListener(
    "change",
    () => {
      state.definitionFilters.verificationMethod =
        verification.value;

      renderTab();
    }
  );

  clear?.addEventListener(
    "click",
    () => {
      state.definitionFilters = {
        status: "",
        tournamentTypeId: "",
        category: "",
        rewardType: "",
        verificationMethod: ""
      };

      renderTab();
    }
  );
}


/* =========================================================
   REWARD DEFINITION OPERATIONS
   ========================================================= */

function bindDefinitionOperations() {
  document
    .getElementById(
      "create-reward-definition"
    )
    ?.addEventListener(
      "click",
      () => {
        state.editingReward = {};

        renderTab();

        document
          .getElementById(
            "reward-definition-id"
          )
          ?.focus();
      }
    );


  document
    .querySelectorAll(
      "[data-definition-operation]"
    )
    .forEach((button) => {

      button.addEventListener(
        "click",
        async () => {

          const operation =
            button.dataset.definitionOperation;

          const id =
            button.dataset.definitionId;

          const definition =
            state.rewardDefinitions.find(
              (item) =>
                getRewardDefinitionId(
                  item
                ) === id
            );

          if (!definition) {
            return;
          }

          if (operation === "edit") {
            state.editingReward =
              definition;

            renderTab();

            return;
          }

          if (operation === "toggle") {
            await toggleRewardDefinition(
              definition
            );
          }

        }
      );

    });


  document
    .getElementById(
      "cancel-reward-definition"
    )
    ?.addEventListener(
      "click",
      () => {
        state.editingReward = null;

        renderTab();
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
   REWARD DEFINITION COMMAND SIGNALS
   ========================================================= */

async function saveRewardDefinition() {
  const rewardDefinitionId =
    valueOf(
      "reward-definition-id"
    );

  const rewardName =
    valueOf("reward-name");

  const rewardCategory =
    valueOf("reward-category");

  const rewardType =
    valueOf("reward-type");

  const rewardValue =
    valueOf("reward-value");

  const verificationMethod =
    valueOf("reward-verification");

  const tournamentTypeId =
    valueOf(
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
    setActionBanner(
      "Complete all required reward fields.",
      true
    );

    return;
  }

  const isUpdate =
    Boolean(
      state.editingReward &&
      (
        state.editingReward
          .reward_definition_id ||
        state.editingReward
          .rewardDefinitionId
      )
    );

  const action =
    isUpdate
      ? "reward_definitions.update"
      : "reward_definitions.create";

  setActionBanner(
    isUpdate
      ? "Updating reward definition..."
      : "Creating reward definition..."
  );

  try {
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

        /*
         * Backend requires a reason for
         * reward-definition mutations.
         *
         * This is not business logic; it is
         * an operator input passed to backend.
         */
        reason:
          isUpdate
            ? "Reward definition updated from Awards module."
            : "Reward definition created from Awards module."
      }
    );

    state.editingReward = null;

    setActionBanner(
      isUpdate
        ? "Reward definition updated."
        : "Reward definition created."
    );

    await loadAll();

  } catch (error) {
    console.error(
      "KTMS reward definition operation failed:",
      error
    );

    setActionBanner(
      error?.message ||
      "Reward definition operation failed.",
      true
    );
  }
}


async function toggleRewardDefinition(
  definition
) {
  const id =
    getRewardDefinitionId(
      definition
    );

  const currentStatus =
    getRewardDefinitionStatus(
      definition
    );

  const nextStatus =
    currentStatus === "Active"
      ? "Disabled"
      : "Active";

  setActionBanner(
    `${
      nextStatus === "Active"
        ? "Enabling"
        : "Disabling"
    } reward definition...`
  );

  try {
    await adminApi(
      "reward_definitions.status",
      {
        rewardDefinitionId: id,
        rewardStatus: nextStatus,
        reason:
          nextStatus === "Active"
            ? "Reward definition enabled from Awards module."
            : "Reward definition disabled from Awards module."
      }
    );

    setActionBanner(
      `Reward definition ${
        nextStatus === "Active"
          ? "enabled"
          : "disabled"
      }.`
    );

    await loadAll();

  } catch (error) {
    console.error(
      "KTMS reward definition status operation failed:",
      error
    );

    setActionBanner(
      error?.message ||
      "Reward definition status operation failed.",
      true
    );
  }
}


/* =========================================================
   PRESENTATION FILTERING
   ========================================================= */

function getFilteredAwards() {
  const search =
    state.awardFilters.registrationSearch
      .trim()
      .toLowerCase();

  return state.awards.filter(
    (award) => {

      if (!search) {
        return true;
      }

      const registrationId =
        String(
          getAwardRegistrationId(
            award
          )
        ).toLowerCase();

      const awardId =
        String(
          getAwardId(award)
        ).toLowerCase();

      const playerId =
        String(
          award?.player_id ??
          award?.playerId ??
          ""
        ).toLowerCase();

      return (
        registrationId.includes(search) ||
        awardId.includes(search) ||
        playerId.includes(search)
      );
    }
  );
}


function getFilteredRewardDefinitions() {
  const filters =
    state.definitionFilters;

  return state.rewardDefinitions.filter(
    (definition) => {

      const status =
        getRewardDefinitionStatus(
          definition
        );

      const tournamentType =
        String(
          definition?.tournament_type_id ??
          definition?.tournamentTypeId ??
          ""
        );

      const category =
        String(
          definition?.reward_category ??
          definition?.rewardCategory ??
          ""
        ).toLowerCase();

      const rewardType =
        String(
          definition?.reward_type ??
          definition?.rewardType ??
          ""
        );

      const verification =
        String(
          definition?.verification_method ??
          definition?.verificationMethod ??
          ""
        );

      if (
        filters.status &&
        status !== filters.status
      ) {
        return false;
      }

      if (
        filters.tournamentTypeId &&
        tournamentType !==
          filters.tournamentTypeId
      ) {
        return false;
      }

      if (
        filters.category &&
        !category.includes(
          filters.category
            .toLowerCase()
        )
      ) {
        return false;
      }

      if (
        filters.rewardType &&
        rewardType !==
          filters.rewardType
      ) {
        return false;
      }

      if (
        filters.verificationMethod &&
        verification !==
          filters.verificationMethod
      ) {
        return false;
      }

      return true;
    }
  );
}


/* =========================================================
   AWARD PRESENTATION HELPERS
   ========================================================= */

function isPendingAdminAward(award) {
  if (
    awardStatus(award) !==
    "Pending"
  ) {
    return false;
  }

  /*
   * Prefer backend-returned verification data.
   *
   * If get_kt_awards() only returns kt_awards,
   * the reward definition is used purely to
   * display the verification method.
   */
  const reward =
    findRewardDefinition(
      getAwardRewardDefinitionId(
        award
      )
    );

  const verification =
    award?.verification_method ??
    award?.verificationMethod ??
    reward?.verification_method ??
    reward?.verificationMethod ??
    "";

  return (
    String(
      verification
    ).toLowerCase() ===
    "admin"
  );
}


function findRewardDefinition(id) {
  if (!id) {
    return null;
  }

  return (
    state.rewardDefinitions.find(
      (definition) =>
        getRewardDefinitionId(
          definition
        ) === String(id)
    ) || null
  );
}


function findTournamentName(id) {
  if (!id) {
    return "—";
  }

  const tournament =
    state.tournaments.find(
      (item) =>
        getTournamentId(item) ===
        String(id)
    );

  return tournament
    ? getTournamentName(tournament)
    : String(id);
}


/* =========================================================
   FIELD ACCESS
   ========================================================= */

function awardStatus(award) {
  return String(
    award?.prize_status ??
    award?.prizeStatus ??
    "—"
  );
}


function getAwardId(award) {
  return String(
    award?.award_id ??
    award?.awardId ??
    "—"
  );
}


function getAwardRegistrationId(award) {
  return String(
    award?.registration_id ??
    award?.registrationId ??
    "—"
  );
}


function getAwardRewardDefinitionId(
  award
) {
  return String(
    award?.reward_definition_id ??
    award?.rewardDefinitionId ??
    ""
  );
}


function getAwardTournamentId(award) {
  return String(
    award?.tournament_id ??
    award?.tournamentId ??
    ""
  );
}


function getTournamentId(tournament) {
  return String(
    tournament?.tournament_id ??
    tournament?.tournamentId ??
    ""
  );
}


function getTournamentName(tournament) {
  return (
    tournament?.tournament_name ??
    tournament?.tournamentName ??
    tournament?.name ??
    getTournamentId(tournament) ??
    "—"
  );
}


function getRewardDefinitionId(
  definition
) {
  return String(
    definition?.reward_definition_id ??
    definition?.rewardDefinitionId ??
    ""
  );
}


function getRewardDefinitionName(
  definition
) {
  return String(
    definition?.reward_name ??
    definition?.rewardName ??
    "—"
  );
}


function getRewardDefinitionStatus(
  definition
) {
  return String(
    definition?.reward_status ??
    definition?.rewardStatus ??
    "—"
  );
}


/* =========================================================
   ADMIN ROLE
   ========================================================= */

function isGameMaster() {
  return (
    String(
      state.admin?.role ||
      ""
    ) === "Game Master"
  );
}


/* =========================================================
   RESPONSE NORMALIZATION
   ========================================================= */

function toArray(response) {
  if (Array.isArray(response)) {
    return response;
  }

  if (
    Array.isArray(
      response?.data
    )
  ) {
    return response.data;
  }

  if (
    Array.isArray(
      response?.items
    )
  ) {
    return response.items;
  }

  if (
    Array.isArray(
      response?.awards
    )
  ) {
    return response.awards;
  }

  if (
    Array.isArray(
      response?.rewardDefinitions
    )
  ) {
    return response.rewardDefinitions;
  }

  if (
    Array.isArray(
      response?.reward_definitions
    )
  ) {
    return response.reward_definitions;
  }

  if (
    Array.isArray(
      response?.tournaments
    )
  ) {
    return response.tournaments;
  }

  return [];
}


/* =========================================================
   UI HELPERS
   ========================================================= */

function summaryCard(
  label,
  value
) {
  return `
    <div class="ktms-card">

      <div class="ktms-muted">
        ${escapeHtml(label)}
      </div>

      <strong
        style="
          display:block;
          font-size:24px;
          margin-top:6px;
        "
      >
        ${escapeHtml(
          String(value)
        )}
      </strong>

    </div>
  `;
}


function statusOption(
  value,
  selected
) {
  return `
    <option
      value="${escapeAttribute(value)}"
      ${
        selected === value
          ? "selected"
          : ""
      }
    >
      ${escapeHtml(value)}
    </option>
  `;
}


function typeOption(
  value,
  selected
) {
  return `
    <option
      value="${escapeAttribute(value)}"
      ${
        selected === value
          ? "selected"
          : ""
      }
    >
      ${escapeHtml(value)}
    </option>
  `;
}


function editorOption(
  value,
  selected
) {
  return `
    <option
      value="${escapeAttribute(value)}"
      ${
        String(selected || "") ===
        value
          ? "selected"
          : ""
      }
    >
      ${escapeHtml(value)}
    </option>
  `;
}


function valueOf(id) {
  return String(
    document.getElementById(id)
      ?.value ||
    ""
  ).trim();
}


function setActionBanner(
  message,
  isError = false
) {
  const banner =
    document.getElementById(
      "awards-action-banner"
    );

  if (!banner) {
    return;
  }

  if (!message) {
    banner.innerHTML = "";
    return;
  }

  banner.innerHTML = `
    <div
      class="ktms-award-action-banner"
      ${
        isError
          ? 'data-state="error"'
          : ""
      }
    >
      ${escapeHtml(message)}
    </div>
  `;
}


function formatDateTime(value) {
  if (!value) {
    return "";
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

  return date.toLocaleString();
}


/* =========================================================
   HTML SAFETY
   ========================================================= */

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
