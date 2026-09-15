import { adminApi } from "../../api/admin-api.js";

const state = {
  tab: "awards",
  admin: null,

  awards: [],
  rewards: [],
  tournaments: [],

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

export async function renderAwards(page, admin = null) {
  state.admin = admin;

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

  document.querySelectorAll("[data-award-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      state.tab = button.dataset.awardTab;

      document.querySelectorAll("[data-award-tab]").forEach((tab) => {
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
     * Do not call registration.list here.
     *
     * Awards must not depend on the registrations module merely
     * to render the awards screen.
     */
    const [
      awardsResponse,
      rewardsResponse,
      tournamentsResponse
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
      })
    ]);

    state.awards = extractArray(
      awardsResponse,
      [
        "awards",
        "items",
        "data"
      ]
    );

    state.rewards = extractArray(
      rewardsResponse,
      [
        "rewardDefinitions",
        "reward_definitions",
        "items",
        "data"
      ]
    );

    state.tournaments = extractArray(
      tournamentsResponse,
      [
        "tournaments",
        "items",
        "data"
      ]
    );

    renderTab();
    renderActionBanner();

  } catch (error) {
    console.error("KTMS Awards module error:", error);

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

  if (!content) {
    return;
  }

  if (state.tab === "definitions") {
    content.innerHTML =
      renderRewardDefinitions();

    bindDefinitionFilters();
    bindDefinitionOperations();

    return;
  }

  content.innerHTML =
    renderAwards();

  bindAwardFilters();
  bindAwardOperations();
}


/* =========================================================
   AWARDS
   ========================================================= */

function renderAwards() {
  const filteredAwards =
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
              >
                ${escapeHtml(
                  getTournamentName(tournament)
                )}
              </option>
            `)
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

          <option value="Pending">
            Pending
          </option>

          <option value="Approved">
            Approved
          </option>

          <option value="Disapproved">
            Disapproved
          </option>

          <option value="Delivered">
            Delivered
          </option>
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

            <div>
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
                Approval and delivery are handled
                from the Award Operations section.
              </p>
            </div>

          </div>
        `
        : ""
    }


    <!-- =====================================================
         AWARD TABLE
         ===================================================== -->

    <div class="ktms-card">

      <div class="ktms-toolbar">

        <div>
          <strong>Awards</strong>

          <div class="ktms-muted">
            Showing ${filteredAwards.length}
            of ${state.awards.length} awards.
          </div>
        </div>

      </div>


      <div class="ktms-table-wrap">

        <table class="ktms-table">

          <thead>
            <tr>
              <th>Player</th>
              <th>Award</th>
              <th>Reward</th>
              <th>Tournament</th>
              <th>Verification</th>
              <th>Status</th>
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


    <!-- =====================================================
         AWARD OPERATIONS
         ===================================================== -->

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
            Approve admin-verified awards
            and mark approved awards as sent.
          </div>
        </div>

      </div>

      ${renderAwardOperations(filteredAwards)}

    </div>
  `;
}


/* =========================================================
   AWARD TABLE ROW
   ========================================================= */

function renderAwardRow(award) {
  const status =
    awardStatus(award);

  const rewardDefinition =
    findRewardDefinition(
      getAwardRewardDefinitionId(award)
    );

  const rewardName =
    rewardDefinition?.reward_name ??
    rewardDefinition?.rewardName ??
    award?.reward_name ??
    award?.rewardName ??
    "—";

  const rewardValue =
    award?.reward_value ??
    award?.rewardValue ??
    rewardDefinition?.reward_value ??
    rewardDefinition?.rewardValue ??
    "—";

  const verification =
    rewardDefinition?.verification_method ??
    rewardDefinition?.verificationMethod ??
    award?.verification_method ??
    award?.verificationMethod ??
    "—";

  const tournamentId =
    getAwardTournamentId(award);

  return `
    <tr>

      <td>
        <strong>
          ${escapeHtml(
            getAwardPlayerName(award)
          )}
        </strong>

        ${
          getAwardPlayerId(award)
            ? `
              <div class="ktms-muted">
                ${escapeHtml(
                  getAwardPlayerId(award)
                )}
              </div>
            `
            : ""
        }
      </td>


      <td>
        <strong>
          ${escapeHtml(
            getAwardId(award)
          )}
        </strong>
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

        <strong>
          ${escapeHtml(
            findTournamentName(tournamentId)
          )}
        </strong>

        ${
          tournamentId
            ? `
              <div class="ktms-muted">
                ${escapeHtml(tournamentId)}
              </div>
            `
            : ""
        }

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


/* =========================================================
   AWARD OPERATIONS
   ========================================================= */

function renderAwardOperations(awards) {
  const operations =
    awards.filter((award) => {

      const status =
        awardStatus(award);

      /*
       * Only admin-verified Pending awards
       * are eligible for approval/disapproval.
       */

      if (
        status === "Pending" &&
        isPendingAdminAward(award)
      ) {
        return true;
      }

      /*
       * Approved awards can be marked
       * as Delivered.
       */

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
            <th>Player</th>
            <th>Award</th>
            <th>Reward</th>
            <th>Status</th>
            <th>Operation</th>
          </tr>

        </thead>

        <tbody>

          ${operations
            .map((award) => {

              const status =
                awardStatus(award);

              const rewardDefinition =
                findRewardDefinition(
                  getAwardRewardDefinitionId(
                    award
                  )
                );

              const rewardName =
                rewardDefinition?.reward_name ??
                rewardDefinition?.rewardName ??
                award?.reward_name ??
                award?.rewardName ??
                "—";

              if (status === "Pending") {
                return `
                  <tr>

                    <td>
                      ${escapeHtml(
                        getAwardPlayerName(
                          award
                        )
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

              return `
                <tr>

                  <td>
                    ${escapeHtml(
                      getAwardPlayerName(
                        award
                      )
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
            })
            .join("")}

        </tbody>

      </table>

    </div>
  `;
}


/* =========================================================
   AWARD OPERATION EVENTS
   ========================================================= */

function bindAwardOperations() {
  document
    .querySelectorAll("[data-award-operation]")
    .forEach((button) => {

      button.addEventListener(
        "click",
        async () => {

          const awardId =
            button.dataset.awardId;

          const operation =
            button.dataset.awardOperation;

          if (!awardId || !operation) {
            return;
          }

          let nextStatus = "";

          if (operation === "approve") {
            nextStatus = "Approved";
          }

          if (operation === "disapprove") {
            nextStatus = "Disapproved";
          }

          if (operation === "deliver") {
            nextStatus = "Delivered";
          }

          if (!nextStatus) {
            return;
          }

          let message =
            `${nextStatus} this award?`;

          if (
            nextStatus === "Delivered"
          ) {
            message =
              "Mark this award as sent/delivered?";
          }

          if (!window.confirm(message)) {
            return;
          }

          await updateAwardStatus(
            awardId,
            nextStatus
          );
        }
      );
    });
}


async function updateAwardStatus(
  awardId,
  prizeStatus
) {
  try {

    await adminApi(
      "award.status",
      {
        awardId,
        prizeStatus
      }
    );

    await loadAll();

  } catch (error) {

    window.alert(
      error?.message ||
      "Unable to update award status."
    );

  }
}


/* =========================================================
   AWARD FILTERS
   ========================================================= */

function bindAwardFilters() {
  const tournament =
    document.getElementById(
      "award-tournament-filter"
    );

  const player =
    document.getElementById(
      "award-player-filter"
    );

  const status =
    document.getElementById(
      "award-status-filter"
    );

  const verification =
    document.getElementById(
      "award-verification-filter"
    );


  if (tournament) {

    tournament.value =
      state.filters.tournamentId;

    tournament.addEventListener(
      "change",
      async (event) => {

        state.filters.tournamentId =
          event.target.value;

        await loadAll();
      }
    );
  }


  if (player) {

    player.addEventListener(
      "input",
      (event) => {

        state.filters.playerSearch =
          event.target.value;

        renderTab();
      }
    );

    player.focus();

    /*
     * Keep the cursor at the end when the
     * table is re-rendered during searching.
     */
    try {
      player.setSelectionRange(
        player.value.length,
        player.value.length
      );
    } catch (_) {}
  }


  if (status) {

    status.value =
      state.filters.prizeStatus;

    status.addEventListener(
      "change",
      async (event) => {

        state.filters.prizeStatus =
          event.target.value;

        await loadAll();
      }
    );
  }


  if (verification) {

    verification.value =
      state.filters.verificationMethod;

    verification.addEventListener(
      "change",
      async (event) => {

        state.filters.verificationMethod =
          event.target.value;

        await loadAll();
      }
    );
  }


  document
    .getElementById(
      "clear-award-filters"
    )
    ?.addEventListener(
      "click",
      async () => {

        state.filters.tournamentId =
          "";

        state.filters.playerSearch =
          "";

        state.filters.prizeStatus =
          "";

        state.filters.verificationMethod =
          "";

        await loadAll();
      }
    );
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

      if (search) {

        const values = [
          getAwardPlayerName(award),
          getAwardPlayerId(award),
          award?.registration_id,
          award?.registrationId,
          getAwardId(award)
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();

        if (!values.includes(search)) {
          return false;
        }
      }

      return true;
    }
  );
}


/* =========================================================
   REWARD DEFINITIONS
   ========================================================= */

function renderRewardDefinitions() {
  const filtered =
    getFilteredRewardDefinitions();

  const canManage =
    isGameMaster();

  const canChangeStatus =
    canManage ||
    isModerator();

  return `

    ${
      canManage
        ? `
          <div
            class="ktms-card"
            style="margin-bottom:18px;"
          >

            <div class="ktms-toolbar">

              <div>
                <strong>
                  ${
                    state.editingReward
                      ? "Update Reward Definition"
                      : "Create Reward Definition"
                  }
                </strong>

                <div class="ktms-muted">
                  Game Master reward definition
                  operations.
                </div>
              </div>

              ${
                state.editingReward
                  ? `
                    <button
                      id="cancel-reward-edit"
                      class="ktms-secondary-button"
                      type="button"
                    >
                      CANCEL EDIT
                    </button>
                  `
                  : ""
              }

            </div>


            <form id="reward-definition-form">

              <div
                class="ktms-toolbar-left"
                style="flex-wrap:wrap;"
              >

                <input
                  id="reward-definition-id"
                  class="ktms-filter"
                  placeholder="Reward definition ID"
                  value="${escapeAttribute(
                    state.editingReward
                      ? definitionField(
                          state.editingReward,
                          "reward_definition_id",
                          "rewardDefinitionId"
                        )
                      : ""
                  )}"
                  ${
                    state.editingReward
                      ? "readonly"
                      : ""
                  }
                  required
                />


                <input
                  id="reward-name"
                  class="ktms-filter"
                  placeholder="Reward name"
                  value="${escapeAttribute(
                    state.editingReward
                      ? definitionField(
                          state.editingReward,
                          "reward_name",
                          "rewardName"
                        )
                      : ""
                  )}"
                  required
                />


                <input
                  id="reward-category"
                  class="ktms-filter"
                  placeholder="Category"
                  value="${escapeAttribute(
                    state.editingReward
                      ? definitionField(
                          state.editingReward,
                          "reward_category",
                          "rewardCategory"
                        )
                      : ""
                  )}"
                  required
                />


                <input
                  id="reward-type"
                  class="ktms-filter"
                  placeholder="Reward type"
                  value="${escapeAttribute(
                    state.editingReward
                      ? definitionField(
                          state.editingReward,
                          "reward_type",
                          "rewardType"
                        )
                      : ""
                  )}"
                  required
                />


                <input
                  id="reward-value"
                  class="ktms-filter"
                  placeholder="Reward value"
                  value="${escapeAttribute(
                    state.editingReward
                      ? definitionField(
                          state.editingReward,
                          "reward_value",
                          "rewardValue"
                        )
                      : ""
                  )}"
                  required
                />


                <select
                  id="reward-verification"
                  class="ktms-filter"
                >

                  <option
                    value="Automatic"
                    ${
                      state.editingReward &&
                      definitionField(
                        state.editingReward,
                        "verification_method",
                        "verificationMethod"
                      ) === "Automatic"
                        ? "selected"
                        : ""
                    }
                  >
                    Automatic
                  </option>

                  <option
                    value="Admin"
                    ${
                      state.editingReward &&
                      definitionField(
                        state.editingReward,
                        "verification_method",
                        "verificationMethod"
                      ) === "Admin"
                        ? "selected"
                        : ""
                    }
                  >
                    Admin
                  </option>

                </select>


                <select
                  id="reward-tournament-type"
                  class="ktms-filter"
                >

                  ${[
                    "KT",
                    "KC",
                    "KS",
                    "KW",
                    "ALL"
                  ]
                    .map((type) => {

                      const selected =
                        state.editingReward
                          ? definitionField(
                              state.editingReward,
                              "tournament_type_id",
                              "tournamentTypeId"
                            )
                          : "KT";

                      return `
                        <option
                          value="${type}"
                          ${
                            type === selected
                              ? "selected"
                              : ""
                          }
                        >
                          ${type}
                        </option>
                      `;
                    })
                    .join("")}

                </select>

              </div>


              <div style="margin-top:12px;">

                <button
                  class="ktms-primary-button"
                  type="submit"
                >
                  ${
                    state.editingReward
                      ? "UPDATE REWARD"
                      : "CREATE REWARD"
                  }
                </button>

              </div>


              <div
                id="reward-definition-message"
                class="ktms-muted"
                style="margin-top:8px;"
              ></div>

            </form>

          </div>
        `
        : ""
    }


    <!-- =====================================================
         REWARD DEFINITION FILTERS
         ===================================================== -->

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
          id="definition-type-filter"
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
          id="definition-reward-type-filter"
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


    <!-- =====================================================
         REWARD DEFINITION TABLE
         ===================================================== -->

    <div class="ktms-card">

      <div class="ktms-toolbar">

        <div>
          <strong>
            Reward Definitions
          </strong>

          <div class="ktms-muted">
            Showing ${filtered.length}
            of ${state.rewards.length}
            reward definitions.
          </div>
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
              <th>Operations</th>
            </tr>

          </thead>


          <tbody>

            ${
              filtered.length
                ? filtered
                    .map(
                      (reward) =>
                        renderRewardDefinitionRow(
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

    </div>
  `;
}


/* =========================================================
   REWARD DEFINITION ROW
   ========================================================= */

function renderRewardDefinitionRow(
  reward,
  canManage,
  canChangeStatus
) {
  const id =
    definitionField(
      reward,
      "reward_definition_id",
      "rewardDefinitionId"
    );

  const name =
    definitionField(
      reward,
      "reward_name",
      "rewardName"
    ) || id;

  const category =
    definitionField(
      reward,
      "reward_category",
      "rewardCategory"
    ) || "—";

  const type =
    definitionField(
      reward,
      "reward_type",
      "rewardType"
    ) || "—";

  const value =
    definitionField(
      reward,
      "reward_value",
      "rewardValue"
    ) || "—";

  const verification =
    definitionField(
      reward,
      "verification_method",
      "verificationMethod"
    ) || "—";

  const tournamentType =
    definitionField(
      reward,
      "tournament_type_id",
      "tournamentTypeId"
    ) || "—";

  const status =
    definitionField(
      reward,
      "reward_status",
      "rewardStatus"
    ) || "Active";

  return `
    <tr>

      <td>

        <strong>
          ${escapeHtml(name)}
        </strong>

        <div class="ktms-muted">
          ${escapeHtml(id)}
        </div>

      </td>

      <td>
        ${escapeHtml(category)}
      </td>

      <td>
        ${escapeHtml(type)}
      </td>

      <td>
        ${escapeHtml(value)}
      </td>

      <td>
        ${escapeHtml(verification)}
      </td>

      <td>
        ${escapeHtml(tournamentType)}
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

        <div class="ktms-toolbar-left">

          ${
            canManage
              ? `
                <button
                  class="ktms-secondary-button"
                  type="button"
                  data-definition-action="edit"
                  data-definition-id="${escapeAttribute(
                    id
                  )}"
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
                  data-definition-id="${escapeAttribute(
                    id
                  )}"
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

function bindDefinitionFilters() {
  const status =
    document.getElementById(
      "definition-status-filter"
    );

  const tournamentType =
    document.getElementById(
      "definition-type-filter"
    );

  const category =
    document.getElementById(
      "definition-category-filter"
    );

  const rewardType =
    document.getElementById(
      "definition-reward-type-filter"
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


  if (tournamentType) {

    tournamentType.value =
      state.filters.definitionTournamentType;

    tournamentType.addEventListener(
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


  if (rewardType) {

    rewardType.addEventListener(
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

        state.filters.definitionStatus =
          "";

        state.filters.definitionTournamentType =
          "";

        state.filters.definitionCategory =
          "";

        state.filters.definitionType =
          "";

        state.filters.definitionVerification =
          "";

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
      "reward-definition-form"
    )
    ?.addEventListener(
      "submit",
      async (event) => {

        event.preventDefault();

        await saveRewardDefinition();
      }
    );


  document
    .getElementById(
      "cancel-reward-edit"
    )
    ?.addEventListener(
      "click",
      () => {

        state.editingReward = null;

        renderTab();
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

          if (!id) {
            return;
          }


          if (action === "edit") {

            state.editingReward =
              state.rewards.find(
                (reward) =>
                  definitionField(
                    reward,
                    "reward_definition_id",
                    "rewardDefinitionId"
                  ) === id
              ) || null;

            renderTab();

            return;
          }


          if (action === "status") {

            await changeRewardDefinitionStatus(
              id,
              button.dataset.definitionStatus
            );

          }
        }
      );
    });
}


/* =========================================================
   CREATE / UPDATE REWARD DEFINITION
   ========================================================= */

async function saveRewardDefinition() {
  const rewardDefinitionId =
    getInputValue(
      "reward-definition-id"
    );

  const rewardName =
    getInputValue(
      "reward-name"
    );

  const rewardCategory =
    getInputValue(
      "reward-category"
    );

  const rewardType =
    getInputValue(
      "reward-type"
    );

  const rewardValue =
    getInputValue(
      "reward-value"
    );

  const verificationMethod =
    getInputValue(
      "reward-verification"
    ) || null;

  const tournamentTypeId =
    getInputValue(
      "reward-tournament-type"
    );

  const message =
    document.getElementById(
      "reward-definition-message"
    );


  if (
    !rewardDefinitionId ||
    !rewardName ||
    !rewardCategory ||
    !rewardType ||
    !rewardValue ||
    !tournamentTypeId
  ) {

    setMessage(
      message,
      "All reward definition fields are required."
    );

    return;
  }


  const reason =
    window.prompt(
      state.editingReward
        ? "Reason for updating this reward definition:"
        : "Reason for creating this reward definition:"
    );


  if (!reason?.trim()) {
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
        verificationMethod,
        tournamentTypeId,
        reason: reason.trim()
      }
    );


    state.editingReward = null;

    await loadAll();

    state.tab = "definitions";

    renderTab();

  } catch (error) {

    setMessage(
      message,
      error?.message ||
      "Unable to save reward definition."
    );

  }
}


/* =========================================================
   ENABLE / DISABLE REWARD DEFINITION
   ========================================================= */

async function changeRewardDefinitionStatus(
  rewardDefinitionId,
  rewardStatus
) {
  const reason =
    window.prompt(
      `${
        rewardStatus === "Active"
          ? "Enable"
          : "Disable"
      } this reward definition. Reason:`
    );


  if (!reason?.trim()) {
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

    state.tab = "definitions";

    renderTab();

  } catch (error) {

    window.alert(
      error?.message ||
      "Unable to change reward definition status."
    );

  }
}


/* =========================================================
   REWARD DEFINITION FILTERING
   ========================================================= */

function getFilteredRewardDefinitions() {
  const category =
    state.filters.definitionCategory
      .trim()
      .toLowerCase();

  const rewardType =
    state.filters.definitionType
      .trim()
      .toLowerCase();


  return state.rewards.filter(
    (reward) => {

      const status =
        definitionField(
          reward,
          "reward_status",
          "rewardStatus"
        ) || "Active";

      const tournamentType =
        definitionField(
          reward,
          "tournament_type_id",
          "tournamentTypeId"
        );

      const rewardCategory =
        definitionField(
          reward,
          "reward_category",
          "rewardCategory"
        );

      const type =
        definitionField(
          reward,
          "reward_type",
          "rewardType"
        );

      const verification =
        definitionField(
          reward,
          "verification_method",
          "verificationMethod"
        );


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
        category &&
        !String(
          rewardCategory || ""
        )
          .toLowerCase()
          .includes(category)
      ) {
        return false;
      }


      if (
        rewardType &&
        !String(type || "")
          .toLowerCase()
          .includes(rewardType)
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


/* =========================================================
   ACTION BANNER
   ========================================================= */

function renderActionBanner() {
  const pendingAdminAwards =
    state.awards.filter(
      isPendingAdminAward
    ).length;


  if (!pendingAdminAwards) {

    setActionBanner("");

    return;
  }


  setActionBanner(`
    <div class="ktms-award-action-banner">

      <div>

        <strong>
          ${pendingAdminAwards}
          admin-verified award
          ${
            pendingAdminAwards === 1
              ? "requires"
              : "require"
          }
          action.
        </strong>

        <p>
          Open the Award Operations section
          to approve or disapprove the award.
        </p>

      </div>

    </div>
  `);
}


function setActionBanner(html) {
  const element =
    document.getElementById(
      "awards-action-banner"
    );

  if (element) {
    element.innerHTML =
      html || "";
  }
}


/* =========================================================
   AWARD HELPERS
   ========================================================= */

function isPendingAdminAward(award) {
  if (
    awardStatus(award) !==
    "Pending"
  ) {
    return false;
  }


  const rewardDefinition =
    findRewardDefinition(
      getAwardRewardDefinitionId(
        award
      )
    );


  const verification =
    award?.verification_method ??
    award?.verificationMethod ??
    rewardDefinition?.verification_method ??
    rewardDefinition?.verificationMethod ??
    "";


  return (
    String(verification)
      .toLowerCase() ===
    "admin"
  );
}


function awardStatus(award) {
  return String(
    award?.prize_status ??
    award?.prizeStatus ??
    award?.status ??
    "Pending"
  );
}


function getAwardId(award) {
  return (
    award?.award_id ??
    award?.awardId ??
    award?.id ??
    "—"
  );
}


function getAwardPlayerName(award) {
  return (
    award?.player_name ??
    award?.playerName ??
    award?.manager_name ??
    award?.managerName ??
    award?.player_display_name ??
    award?.playerDisplayName ??
    award?.registration_player_name ??
    award?.registrationPlayerName ??
    award?.player_id ??
    award?.playerId ??
    "—"
  );
}


function getAwardPlayerId(award) {
  return (
    award?.player_id ??
    award?.playerId ??
    ""
  );
}


function getAwardTournamentId(award) {
  return (
    award?.tournament_id ??
    award?.tournamentId ??
    ""
  );
}


function getAwardRewardDefinitionId(
  award
) {
  return (
    award?.reward_definition_id ??
    award?.rewardDefinitionId ??
    ""
  );
}


/* =========================================================
   TOURNAMENT HELPERS
   ========================================================= */

function getTournamentId(tournament) {
  return (
    tournament?.tournament_id ??
    tournament?.tournamentId ??
    tournament?.id ??
    ""
  );
}


function getTournamentName(tournament) {
  return (
    tournament?.tournament_name ??
    tournament?.tournamentName ??
    tournament?.name ??
    getTournamentId(tournament) ||
    "—"
  );
}


function findTournamentName(
  tournamentId
) {
  if (!tournamentId) {
    return "—";
  }


  const tournament =
    state.tournaments.find(
      (item) =>
        getTournamentId(item) ===
        tournamentId
    );


  if (!tournament) {
    return tournamentId;
  }


  return getTournamentName(
    tournament
  );
}


/* =========================================================
   REWARD HELPERS
   ========================================================= */

function findRewardDefinition(id) {
  if (!id) {
    return null;
  }


  return (
    state.rewards.find(
      (reward) =>
        definitionField(
          reward,
          "reward_definition_id",
          "rewardDefinitionId"
        ) === id
    ) || null
  );
}


function definitionField(
  row,
  snakeCase,
  camelCase
) {
  return (
    row?.[snakeCase] ??
    row?.[camelCase] ??
    ""
  );
}


/* =========================================================
   ADMIN ROLE HELPERS
   ========================================================= */

function isGameMaster() {
  return (
    String(
      state.admin?.role || ""
    ) === "Game Master"
  );
}


function isModerator() {
  return (
    String(
      state.admin?.role || ""
    ) === "Moderator"
  );
}


/* =========================================================
   RESPONSE HELPERS
   ========================================================= */

function extractArray(
  response,
  preferredKeys = []
) {
  if (Array.isArray(response)) {
    return response;
  }


  for (
    const key of preferredKeys
  ) {
    if (
      Array.isArray(
        response?.[key]
      )
    ) {
      return response[key];
    }
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


function getInputValue(id) {
  return (
    document
      .getElementById(id)
      ?.value
      ?.trim() || ""
  );
}


function setMessage(
  element,
  message
) {
  if (element) {
    element.textContent =
      message || "";
  }
}


/* =========================================================
   ESCAPING
   ========================================================= */

function escapeHtml(value) {
  return String(value ?? "")
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


function escapeAttribute(value) {
  return escapeHtml(value);
}
