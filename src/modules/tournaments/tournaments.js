import { adminApi } from "../../api/admin-api.js";
import { navigate } from "../../app/router.js";

const LIFECYCLE_ACTIONS = {
  "Registration Open": [
    ["CLOSE_REGISTRATION", "CLOSE REGISTRATION"],
    ["SUSPEND", "SUSPEND"]
  ],

  "Registration Closed": [
    ["OPEN_REGISTRATION", "OPEN REGISTRATION"],
    ["SUSPEND", "SUSPEND"]
  ],

  "Suspended": [
    ["REOPEN", "REOPEN"]
  ]
};

export async function renderTournaments(page) {
  page.innerHTML = `
    <div class="ktms-module">

      <div class="ktms-module-toolbar">
        <div>
          <h2>Tournaments</h2>
          <p>
            Manage tournament lifecycle through KTMS Core.
          </p>
        </div>

        <button
          id="create-tournament-button"
          type="button"
          class="ktms-primary-button"
        >
          CREATE TOURNAMENT
        </button>
      </div>

      <div
        id="tournaments-message"
        class="ktms-message"
        aria-live="polite"
      ></div>

      <div id="tournaments-list">
        Loading tournaments...
      </div>

    </div>
  `;

  document
    .getElementById("create-tournament-button")
    .addEventListener("click", () => {
      renderCreateTournament(page);
    });

  await loadTournaments();
}

async function loadTournaments(status = null) {
  const container = document.getElementById("tournaments-list");
  const message = document.getElementById("tournaments-message");

  if (!container) {
    return;
  }

  try {
    setMessage(message, "");
    setContainerLoading(container);

    const data = await adminApi("tournament.list", {
      status
    });

    const tournaments = normalizeList(data);

    if (!tournaments.length) {
      container.innerHTML = `
        <div class="ktms-empty-state">
          <h3>No tournaments found</h3>
          <p>
            There are currently no tournaments matching the selected criteria.
          </p>
        </div>
      `;
      return;
    }

    container.innerHTML = `
      <div class="ktms-table-wrap">

        <table class="ktms-table">

          <thead>
            <tr>
              <th>Tournament ID</th>
              <th>Name</th>
              <th>Edition</th>
              <th>Year</th>
              <th>Status</th>
              <th>Start</th>
              <th>Players</th>
              <th>Action</th>
            </tr>
          </thead>

          <tbody>
            ${tournaments.map(renderTournamentRow).join("")}
          </tbody>

        </table>

      </div>
    `;

    container
      .querySelectorAll("[data-tournament-id]")
      .forEach((button) => {
        button.addEventListener("click", async () => {
          await openTournament(button.dataset.tournamentId);
        });
      });

  } catch (error) {
    renderErrorState(
      container,
      "Unable to load tournaments.",
      error
    );
  }
}

function renderTournamentRow(tournament) {
  const tournamentId = getTournamentId(tournament);

  return `
    <tr>

      <td>
        <strong>
          ${escapeHtml(tournamentId || "—")}
        </strong>
      </td>

      <td>
        ${escapeHtml(
          tournament.tournament_name ??
          tournament.Tournament_Name ??
          "—"
        )}
      </td>

      <td>
        ${escapeHtml(
          tournament.tournament_edition ??
          tournament.Tournament_Edition ??
          "—"
        )}
      </td>

      <td>
        ${escapeHtml(
          tournament.tournament_year ??
          tournament.Tournament_Year ??
          "—"
        )}
      </td>

      <td>
        <span class="ktms-status">
          ${escapeHtml(
            tournament.tournament_status ??
            tournament.Tournament_Status ??
            "—"
          )}
        </span>
      </td>

      <td>
        ${formatDate(
          tournament.tournament_start_date ??
          tournament.Tournament_Start_Date
        )}
      </td>

      <td>
        ${escapeHtml(
          tournament.maximum_players ??
          tournament.Maximum_Players ??
          "—"
        )}
      </td>

      <td>
        ${
          tournamentId
            ? `
              <button
                type="button"
                class="ktms-table-action"
                data-tournament-id="${escapeAttribute(tournamentId)}"
              >
                VIEW
              </button>
            `
            : "—"
        }
      </td>

    </tr>
  `;
}

async function openTournament(tournamentId) {
  const normalizedId = String(tournamentId ?? "").trim();

  if (!normalizedId) {
    return;
  }

  const page = document.getElementById("ktms-page");

  if (!page) {
    return;
  }

  page.innerHTML = `
    <div class="ktms-module">
      <div class="ktms-loading-state">
        Loading tournament...
      </div>
    </div>
  `;

  try {
    const data = await adminApi("tournament.get", {
      tournamentId: normalizedId
    });

    const tournament = normalizeObject(data);

    if (!tournament) {
      throw new Error("Tournament record was not returned by KTMS Core.");
    }

    renderTournamentDetails(tournament);

  } catch (error) {
    page.innerHTML = `
      <div class="ktms-module">

        <button
          id="back-to-tournaments"
          type="button"
          class="ktms-back-button"
        >
          ← TOURNAMENTS
        </button>

        <div class="ktms-error-state">
          <h3>Unable to load tournament</h3>
          <p>${escapeHtml(error.message)}</p>
        </div>

      </div>
    `;

    document
      .getElementById("back-to-tournaments")
      ?.addEventListener("click", () => {
        navigate("/tournaments");
      });
  }
}

function renderTournamentDetails(tournament) {
  const page = document.getElementById("ktms-page");

  if (!page) {
    return;
  }

  const tournamentId = getTournamentId(tournament);

  const tournamentName =
    tournament.tournament_name ??
    tournament.Tournament_Name ??
    "Tournament";

  const edition =
    tournament.tournament_edition ??
    tournament.Tournament_Edition;

  const status =
    tournament.tournament_status ??
    tournament.Tournament_Status ??
    "—";

  page.innerHTML = `
    <div class="ktms-module">

      <button
        id="back-to-tournaments"
        type="button"
        class="ktms-back-button"
      >
        ← TOURNAMENTS
      </button>

      <div class="ktms-module-toolbar">

        <div>

          <h2>
            ${escapeHtml(tournamentName)}
          </h2>

          <p>
            ${escapeHtml(tournamentId || "—")}
            ${
              edition
                ? ` · Edition ${escapeHtml(edition)}`
                : ""
            }
          </p>

        </div>

        <span class="ktms-status ktms-status-large">
          ${escapeHtml(status)}
        </span>

      </div>

      <div class="ktms-detail-grid">

        ${detailCard(
          "Tournament ID",
          tournamentId
        )}

        ${detailCard(
          "Tournament Type",
          tournament.tournament_type_id ??
          tournament.Tournament_Type_ID
        )}

        ${detailCard(
          "Edition",
          edition
        )}

        ${detailCard(
          "Year",
          tournament.tournament_year ??
          tournament.Tournament_Year
        )}

        ${detailCard(
          "Registration Fee",
          formatAmount(
            tournament.registration_fee ??
            tournament.Registration_Fee
          )
        )}

        ${detailCard(
          "Minimum Age",
          tournament.minimum_age ??
          tournament.Minimum_Age
        )}

        ${detailCard(
          "Maximum Players",
          tournament.maximum_players ??
          tournament.Maximum_Players
        )}

        ${detailCard(
          "Start Date",
          formatDate(
            tournament.tournament_start_date ??
            tournament.Tournament_Start_Date
          )
        )}

        ${detailCard(
          "End Date",
          formatDate(
            tournament.tournament_end_date ??
            tournament.Tournament_End_Date
          )
        )}

        ${detailCard(
          "Registration Opens",
          formatDateTime(
            tournament.registration_open_datetime ??
            tournament.Registration_Open_DateTime
          )
        )}

        ${detailCard(
          "Registration Closes",
          formatDateTime(
            tournament.registration_close_datetime ??
            tournament.Registration_Close_DateTime
          )
        )}

      </div>

      <div class="ktms-section">

        <h3>Tournament Lifecycle</h3>

        <div class="ktms-action-row">
          ${renderLifecycleActions(tournament)}
        </div>

        <div
          id="tournament-action-message"
          class="ktms-message"
          aria-live="polite"
        ></div>

      </div>

    </div>
  `;

  document
    .getElementById("back-to-tournaments")
    ?.addEventListener("click", () => {
      navigate("/tournaments");
    });

  page
    .querySelectorAll("[data-tournament-action]")
    .forEach((button) => {
      button.addEventListener("click", async () => {
        await executeTournamentAction(
          tournamentId,
          button.dataset.tournamentAction
        );
      });
    });
}

function renderLifecycleActions(tournament) {
  const status =
    tournament.tournament_status ??
    tournament.Tournament_Status ??
    "";

  const actions = LIFECYCLE_ACTIONS[status] || [];

  if (!actions.length) {
    return `
      <span class="ktms-secondary-text">
        No lifecycle actions available for the current status.
      </span>
    `;
  }

  return actions
    .map(([action, label]) => `
      <button
        type="button"
        class="ktms-secondary-button"
        data-tournament-action="${escapeAttribute(action)}"
      >
        ${escapeHtml(label)}
      </button>
    `)
    .join("");
}

async function executeTournamentAction(tournamentId, action) {
  const normalizedId = String(tournamentId ?? "").trim();
  const normalizedAction = String(action ?? "").trim();

  if (!normalizedId || !normalizedAction) {
    return;
  }

  const labels = {
    OPEN_REGISTRATION: "open registration",
    CLOSE_REGISTRATION: "close registration",
    SUSPEND: "suspend this tournament",
    REOPEN: "reopen this tournament"
  };

  const label =
    labels[normalizedAction] ||
    normalizedAction
      .replaceAll("_", " ")
      .toLowerCase();

  if (
    !confirm(
      `Are you sure you want to ${label}?`
    )
  ) {
    return;
  }

  const page = document.getElementById("ktms-page");
  const message = document.getElementById(
    "tournament-action-message"
  );

  const buttons =
    page?.querySelectorAll(
      "[data-tournament-action]"
    ) || [];

  setButtonsDisabled(buttons, true);
  setMessage(message, `Processing: ${label}...`);

  try {
    /*
     * IMPORTANT:
     * The production ktms-admin-api expects:
     *
     * {
     *   tournamentId,
     *   tournamentAction
     * }
     *
     * "action" is NOT the backend field.
     */
    const updated = await adminApi(
      "tournament.action",
      {
        tournamentId: normalizedId,
        tournamentAction: normalizedAction
      }
    );

    const tournament = normalizeObject(updated);

    if (!tournament) {
      throw new Error(
        "KTMS Core completed the operation but did not return the updated tournament."
      );
    }

    renderTournamentDetails(tournament);

  } catch (error) {
    setButtonsDisabled(buttons, false);
    setMessage(
      message,
      error.message || "Tournament action failed."
    );

    if (page) {
      page
        .querySelectorAll(
          "[data-tournament-action]"
        )
        .forEach((button) => {
          button.disabled = false;
        });
    }
  }
}

function renderCreateTournament(page) {
  page.innerHTML = `
    <div class="ktms-module">

      <button
        id="back-to-tournaments"
        type="button"
        class="ktms-back-button"
      >
        ← TOURNAMENTS
      </button>

      <div class="ktms-module-toolbar">

        <div>
          <h2>Create KT Tournament</h2>

          <p>
            Create a tournament through the authoritative KTMS Core operation.
          </p>
        </div>

      </div>

      <form
        id="create-tournament-form"
        class="ktms-form"
        novalidate
      >

        <label>
          Tournament Name

          <input
            name="tournamentName"
            type="text"
            autocomplete="off"
            maxlength="200"
            required
          >
        </label>

        <label>
          Tournament Year

          <input
            name="year"
            type="number"
            min="2000"
            max="2100"
            step="1"
            required
          >
        </label>

        <label>
          Tournament Start Date

          <input
            name="startDate"
            type="date"
            required
          >
        </label>

        <label>
          Tournament End Date

          <input
            name="endDate"
            type="date"
            required
          >
        </label>

        <label>
          Registration Fee

          <input
            name="registrationFee"
            type="number"
            min="0"
            step="0.01"
            value="1000"
            required
          >
        </label>

        <label>
          Minimum Age

          <input
            name="minimumAge"
            type="number"
            min="0"
            max="120"
            step="1"
            value="18"
            required
          >
        </label>

        <label>
          Maximum Players

          <input
            name="maximumPlayers"
            type="number"
            min="1"
            step="1"
            value="100"
            required
          >
        </label>

        <div
          id="create-tournament-error"
          class="ktms-error-state"
          aria-live="polite"
        ></div>

        <button
          id="create-tournament-submit"
          type="submit"
          class="ktms-primary-button"
        >
          CREATE TOURNAMENT
        </button>

      </form>

    </div>
  `;

  document
    .getElementById("back-to-tournaments")
    ?.addEventListener("click", () => {
      navigate("/tournaments");
    });

  const form = document.getElementById(
    "create-tournament-form"
  );

  const submitButton = document.getElementById(
    "create-tournament-submit"
  );

  const errorBox = document.getElementById(
    "create-tournament-error"
  );

  form?.addEventListener(
    "submit",
    async (event) => {
      event.preventDefault();

      if (!form.reportValidity()) {
        return;
      }

      errorBox.textContent = "";
      submitButton.disabled = true;
      submitButton.textContent = "CREATING...";

      const values = new FormData(form);

      const tournamentName = String(
        values.get("tournamentName") ?? ""
      ).trim();

      const year = Number(
        values.get("year")
      );

      const startDate = String(
        values.get("startDate") ?? ""
      ).trim();

      const endDate = String(
        values.get("endDate") ?? ""
      ).trim();

      const registrationFee = Number(
        values.get("registrationFee")
      );

      const minimumAge = Number(
        values.get("minimumAge")
      );

      const maximumPlayers = Number(
        values.get("maximumPlayers")
      );

      const validationError =
        validateCreateTournament({
          tournamentName,
          year,
          startDate,
          endDate,
          registrationFee,
          minimumAge,
          maximumPlayers
        });

      if (validationError) {
        errorBox.textContent = validationError;
        submitButton.disabled = false;
        submitButton.textContent =
          "CREATE TOURNAMENT";
        return;
      }

      try {
        /*
         * This payload deliberately contains ONLY fields
         * currently accepted by production ktms-admin-api.
         *
         * Do not add tournament type, edition, registration
         * open/close fields here until the Admin API/Core
         * contract officially exposes them.
         */
        const tournament = await adminApi(
          "tournament.create",
          {
            tournamentName,
            year,
            startDate,
            endDate,
            registrationFee,
            minimumAge,
            maximumPlayers
          }
        );

        const createdTournament =
          normalizeObject(tournament);

        if (!createdTournament) {
          throw new Error(
            "Tournament creation completed but KTMS Core did not return the created tournament."
          );
        }

        renderTournamentDetails(
          createdTournament
        );

      } catch (error) {
        errorBox.textContent =
          error.message ||
          "Unable to create tournament.";

        submitButton.disabled = false;
        submitButton.textContent =
          "CREATE TOURNAMENT";
      }
    }
  );
}

function validateCreateTournament(values) {
  if (!values.tournamentName) {
    return "Tournament name is required.";
  }

  if (!Number.isInteger(values.year)) {
    return "Tournament year must be a whole number.";
  }

  if (values.year < 2000 || values.year > 2100) {
    return "Tournament year must be between 2000 and 2100.";
  }

  if (!isValidDateInput(values.startDate)) {
    return "A valid tournament start date is required.";
  }

  if (!isValidDateInput(values.endDate)) {
    return "A valid tournament end date is required.";
  }

  if (
    values.endDate <
    values.startDate
  ) {
    return "Tournament end date cannot be before the start date.";
  }

  if (
    !Number.isFinite(values.registrationFee) ||
    values.registrationFee < 0
  ) {
    return "Registration fee must be zero or greater.";
  }

  if (
    !Number.isInteger(values.minimumAge) ||
    values.minimumAge < 0 ||
    values.minimumAge > 120
  ) {
    return "Minimum age must be a whole number between 0 and 120.";
  }

  if (
    !Number.isInteger(values.maximumPlayers) ||
    values.maximumPlayers < 1
  ) {
    return "Maximum players must be at least 1.";
  }

  return null;
}

function detailCard(label, value) {
  return `
    <article class="ktms-detail-card">

      <span>
        ${escapeHtml(label)}
      </span>

      <strong>
        ${escapeHtml(
          value === null ||
          value === undefined ||
          value === ""
            ? "—"
            : value
        )}
      </strong>

    </article>
  `;
}

function formatDate(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(
    `${String(value).slice(0, 10)}T00:00:00`
  );

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleDateString(
    undefined,
    {
      year: "numeric",
      month: "short",
      day: "numeric"
    }
  );
}

function formatDateTime(value) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleString(
    undefined,
    {
      dateStyle: "medium",
      timeStyle: "short"
    }
  );
}

function formatAmount(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "—";
  }

  return `₦${number.toLocaleString(
    undefined,
    {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }
  )}`;
}

function getTournamentId(tournament) {
  return String(
    tournament?.tournament_id ??
    tournament?.Tournament_ID ??
    ""
  ).trim();
}

function normalizeList(data) {
  if (Array.isArray(data)) {
    return data;
  }

  if (
    data &&
    Array.isArray(data.data)
  ) {
    return data.data;
  }

  if (
    data &&
    Array.isArray(data.tournaments)
  ) {
    return data.tournaments;
  }

  return [];
}

function normalizeObject(data) {
  if (!data) {
    return null;
  }

  if (Array.isArray(data)) {
    return data[0] || null;
  }

  if (
    data.data &&
    !Array.isArray(data.data) &&
    typeof data.data === "object"
  ) {
    return data.data;
  }

  return data;
}

function setContainerLoading(container) {
  container.innerHTML = `
    <div class="ktms-loading-state">
      Loading tournaments...
    </div>
  `;
}

function renderErrorState(
  container,
  title,
  error
) {
  container.innerHTML = `
    <div class="ktms-error-state">

      <h3>
        ${escapeHtml(title)}
      </h3>

      <p>
        ${escapeHtml(
          error?.message ||
          "An unexpected error occurred."
        )}
      </p>

    </div>
  `;
}

function setMessage(element, message) {
  if (element) {
    element.textContent = message || "";
  }
}

function setButtonsDisabled(
  buttons,
  disabled
) {
  buttons.forEach((button) => {
    button.disabled = disabled;
  });
}

function isValidDateInput(value) {
  if (!value) {
    return false;
  }

  const date = new Date(
    `${value}T00:00:00`
  );

  return !Number.isNaN(
    date.getTime()
  );
}

function escapeAttribute(value) {
  return escapeHtml(value);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
