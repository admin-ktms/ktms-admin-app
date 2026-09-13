import { adminApi } from "../../api/admin-api.js";
import { navigate } from "../../app/router.js";

let registrationState = {
  data: null,
  filters: {
    tournamentTypeId: "",
    tournamentId: "",
    registrationStatus: "",
    paymentStatus: ""
  }
};

export async function renderRegistrations(page) {
  page.innerHTML = `
    <div class="ktms-module">

      <div class="ktms-module-toolbar">
        <div>
          <h2>Registrations</h2>
          <p>
            Monitor registration requests and official registrations
            across all KTMS tournament types.
          </p>
        </div>

        <button
          id="refresh-registrations-button"
          class="ktms-secondary-button"
          type="button"
        >
          REFRESH
        </button>
      </div>

      <div class="ktms-registration-filters">

        <div class="ktms-registration-filter">
          <label for="registration-tournament-type">
            Tournament Type
          </label>

          <select
            id="registration-tournament-type"
            class="ktms-filter"
          >
            <option value="">All tournament types</option>
          </select>
        </div>

        <div class="ktms-registration-filter">
          <label for="registration-tournament-id">
            Tournament ID
          </label>

          <select
            id="registration-tournament-id"
            class="ktms-filter"
          >
            <option value="">All tournaments</option>
          </select>
        </div>

        <div class="ktms-registration-filter">
          <label for="registration-status">
            Registration Status
          </label>

          <select
            id="registration-status"
            class="ktms-filter"
          >
            <option value="">All statuses</option>
          </select>
        </div>

        <div class="ktms-registration-filter">
          <label for="registration-payment-status">
            Payment Status
          </label>

          <select
            id="registration-payment-status"
            class="ktms-filter"
          >
            <option value="">All payment statuses</option>
          </select>
        </div>

      </div>

      <div id="registrations-message" class="ktms-message"></div>

      <div id="registrations-summary">
        Loading registration data...
      </div>

      <div id="registration-requests-section"></div>

      <div id="official-registrations-section"></div>

    </div>
  `;

  bindFilterEvents();

  document
    .getElementById("refresh-registrations-button")
    .addEventListener("click", async () => {
      await loadRegistrations();
    });

  await loadRegistrations();
}


function bindFilterEvents() {
  const filterIds = [
    "registration-tournament-type",
    "registration-tournament-id",
    "registration-status",
    "registration-payment-status"
  ];

  filterIds.forEach((id) => {
    const element = document.getElementById(id);

    if (!element) return;

    element.addEventListener("change", async (event) => {
      updateFilterFromElement(id, event.target.value);
      await loadRegistrations();
    });
  });
}


function updateFilterFromElement(id, value) {
  const mapping = {
    "registration-tournament-type": "tournamentTypeId",
    "registration-tournament-id": "tournamentId",
    "registration-status": "registrationStatus",
    "registration-payment-status": "paymentStatus"
  };

  const key = mapping[id];

  if (!key) return;

  registrationState.filters[key] = value || "";
}


async function loadRegistrations() {
  const message = document.getElementById(
    "registrations-message"
  );

  const summary = document.getElementById(
    "registrations-summary"
  );

  const requestsSection = document.getElementById(
    "registration-requests-section"
  );

  const registrationsSection = document.getElementById(
    "official-registrations-section"
  );

  if (!summary) return;

  summary.innerHTML = `
    <div class="ktms-loading-state">
      Loading registrations...
    </div>
  `;

  if (requestsSection) {
    requestsSection.innerHTML = "";
  }

  if (registrationsSection) {
    registrationsSection.innerHTML = "";
  }

  if (message) {
    message.textContent = "";
  }

  try {
    const data = await adminApi("registration.list", {
      tournamentTypeId:
        registrationState.filters.tournamentTypeId || null,

      tournamentId:
        registrationState.filters.tournamentId || null,

      registrationStatus:
        registrationState.filters.registrationStatus || null,

      paymentStatus:
        registrationState.filters.paymentStatus || null
    });

    registrationState.data = normalizeRegistrationData(data);

    populateTournamentTypeFilter(
      registrationState.data.tournamentTypes
    );

    populateTournamentFilter(
      registrationState.data.tournaments
    );

    populateStatusFilters(
      registrationState.data.requests,
      registrationState.data.registrations
    );

    renderRegistrationSummary(
      registrationState.data
    );

    renderRegistrationRequests(
      registrationState.data.requests
    );

    renderOfficialRegistrations(
      registrationState.data.registrations
    );

  } catch (error) {
    summary.innerHTML = `
      <div class="ktms-error-state">
        <strong>Unable to load registrations</strong>
        <p>${escapeHtml(error.message)}</p>
      </div>
    `;
  }
}


function normalizeRegistrationData(data) {
  return {
    filters: data?.filters || {},

    tournamentTypes: Array.isArray(
      data?.tournamentTypes
    )
      ? data.tournamentTypes
      : [],

    tournaments: Array.isArray(
      data?.tournaments
    )
      ? data.tournaments
      : [],

    requests: Array.isArray(
      data?.requests
    )
      ? data.requests
      : [],

    registrations: Array.isArray(
      data?.registrations
    )
      ? data.registrations
      : [],

    counts: {
      requests:
        Number(data?.counts?.requests) || 0,

      officialRegistrations:
        Number(
          data?.counts?.officialRegistrations
        ) || 0
    }
  };
}


function populateTournamentTypeFilter(
  tournamentTypes
) {
  const select = document.getElementById(
    "registration-tournament-type"
  );

  if (!select) return;

  const selected =
    registrationState.filters.tournamentTypeId;

  const options = tournamentTypes
    .map((type) => {
      const id = getValue(
        type,
        "tournamentTypeId",
        "tournament_type_id",
        "id"
      );

      const name = getValue(
        type,
        "tournamentTypeName",
        "tournament_type_name",
        "name"
      );

      if (!id) return "";

      return `
        <option value="${escapeAttribute(id)}">
          ${escapeHtml(name || id)}
        </option>
      `;
    })
    .filter(Boolean)
    .join("");

  select.innerHTML = `
    <option value="">All tournament types</option>
    ${options}
  `;

  select.value = selected || "";
}


function populateTournamentFilter(
  tournaments
) {
  const select = document.getElementById(
    "registration-tournament-id"
  );

  if (!select) return;

  const selected =
    registrationState.filters.tournamentId;

  const options = tournaments
    .map((tournament) => {
      const id = getValue(
        tournament,
        "tournamentId",
        "tournament_id",
        "id"
      );

      const name = getValue(
        tournament,
        "tournamentName",
        "tournament_name",
        "name"
      );

      const type = getValue(
        tournament,
        "tournamentTypeId",
        "tournament_type_id",
        "type"
      );

      if (!id) return "";

      const labelParts = [
        id,
        name,
        type ? `· ${type}` : ""
      ].filter(Boolean);

      return `
        <option value="${escapeAttribute(id)}">
          ${escapeHtml(labelParts.join(" "))}
        </option>
      `;
    })
    .filter(Boolean)
    .join("");

  select.innerHTML = `
    <option value="">All tournaments</option>
    ${options}
  `;

  select.value = selected || "";
}


function populateStatusFilters(
  requests,
  registrations
) {
  const registrationStatuses = uniqueValues(
    [
      ...requests,
      ...registrations
    ].map((item) =>
      getValue(
        item,
        "registrationStatus",
        "registration_status"
      )
    )
  );

  const paymentStatuses = uniqueValues(
    [
      ...requests,
      ...registrations
    ].map((item) =>
      getValue(
        item,
        "paymentStatus",
        "payment_status"
      )
    )
  );

  populateSimpleFilter(
    "registration-status",
    "All statuses",
    registrationStatuses,
    registrationState.filters.registrationStatus
  );

  populateSimpleFilter(
    "registration-payment-status",
    "All payment statuses",
    paymentStatuses,
    registrationState.filters.paymentStatus
  );
}


function populateSimpleFilter(
  elementId,
  defaultLabel,
  values,
  selected
) {
  const select = document.getElementById(
    elementId
  );

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


function renderRegistrationSummary(data) {
  const container = document.getElementById(
    "registrations-summary"
  );

  if (!container) return;

  const requestCount =
    data.counts.requests ||
    data.requests.length ||
    0;

  const officialCount =
    data.counts.officialRegistrations ||
    data.registrations.length ||
    0;

  const selectedType =
    registrationState.filters.tournamentTypeId;

  const selectedTournament =
    registrationState.filters.tournamentId;

  container.innerHTML = `
    <div class="ktms-registration-summary">

      <article class="ktms-registration-stat">
        <span class="ktms-registration-stat-label">
          REGISTRATION REQUESTS
        </span>

        <strong class="ktms-registration-stat-value">
          ${requestCount}
        </strong>
      </article>

      <article class="ktms-registration-stat ktms-registration-stat-gold">
        <span class="ktms-registration-stat-label">
          OFFICIAL REGISTRATIONS
        </span>

        <strong class="ktms-registration-stat-value">
          ${officialCount}
        </strong>
      </article>

      <article class="ktms-registration-stat">
        <span class="ktms-registration-stat-label">
          TOURNAMENT TYPE
        </span>

        <strong class="ktms-registration-stat-text">
          ${escapeHtml(
            selectedType || "ALL"
          )}
        </strong>
      </article>

      <article class="ktms-registration-stat">
        <span class="ktms-registration-stat-label">
          TOURNAMENT
        </span>

        <strong class="ktms-registration-stat-text">
          ${escapeHtml(
            selectedTournament || "ALL"
          )}
        </strong>
      </article>

    </div>
  `;
}


function renderRegistrationRequests(
  requests
) {
  const container = document.getElementById(
    "registration-requests-section"
  );

  if (!container) return;

  container.innerHTML = `
    <section class="ktms-section">

      <div class="ktms-module-toolbar">
        <div>
          <h3>Registration Requests</h3>
          <p>
            Incoming registration records across the selected
            tournament scope.
          </p>
        </div>
      </div>

      ${
        requests.length
          ? `
            <div class="ktms-table-wrap">
              <table class="ktms-table">

                <thead>
                  <tr>
                    <th>Request</th>
                    <th>Player</th>
                    <th>Tournament</th>
                    <th>Type</th>
                    <th>Squad</th>
                    <th>Registration</th>
                    <th>Payment</th>
                    <th>Submitted</th>
                  </tr>
                </thead>

                <tbody>
                  ${requests
                    .map(
                      renderRegistrationRequestRow
                    )
                    .join("")}
                </tbody>

              </table>
            </div>
          `
          : emptyState(
              "No registration requests",
              "No registration requests match the current filters."
            )
      }

    </section>
  `;
}


function renderRegistrationRequestRow(
  request
) {
  const requestId = getValue(
    request,
    "requestId",
    "request_id",
    "registrationRequestId",
    "registration_request_id"
  );

  const player = getPlayerName(request);

  const tournamentId = getValue(
    request,
    "tournamentId",
    "tournament_id"
  );

  const tournamentType = getValue(
    request,
    "tournamentTypeId",
    "tournament_type_id"
  );

  const squadName = getValue(
    request,
    "squadName",
    "squad_name"
  );

  const registrationStatus = getValue(
    request,
    "registrationStatus",
    "registration_status"
  );

  const paymentStatus = getValue(
    request,
    "paymentStatus",
    "payment_status"
  );

  const submittedAt = getValue(
    request,
    "submittedAt",
    "submitted_at",
    "createdDatetime",
    "created_datetime",
    "createdAt",
    "created_at"
  );

  return `
    <tr>

      <td>
        <strong>
          ${escapeHtml(requestId || "—")}
        </strong>
      </td>

      <td>
        ${escapeHtml(player)}
      </td>

      <td>
        <span class="ktms-registration-id">
          ${escapeHtml(tournamentId || "—")}
        </span>
      </td>

      <td>
        ${escapeHtml(tournamentType || "—")}
      </td>

      <td>
        ${escapeHtml(squadName || "—")}
      </td>

      <td>
        ${statusBadge(registrationStatus)}
      </td>

      <td>
        ${statusBadge(paymentStatus)}
      </td>

      <td>
        ${formatDateTime(submittedAt)}
      </td>

    </tr>
  `;
}


function renderOfficialRegistrations(
  registrations
) {
  const container = document.getElementById(
    "official-registrations-section"
  );

  if (!container) return;

  container.innerHTML = `
    <section class="ktms-section">

      <div class="ktms-module-toolbar">
        <div>
          <h3>Official Registrations</h3>
          <p>
            Confirmed registrations currently recorded by
            the tournament domain.
          </p>
        </div>
      </div>

      ${
        registrations.length
          ? `
            <div class="ktms-table-wrap">
              <table class="ktms-table">

                <thead>
                  <tr>
                    <th>Registration</th>
                    <th>Player</th>
                    <th>Tournament</th>
                    <th>Type</th>
                    <th>Squad</th>
                    <th>Registration</th>
                    <th>Payment</th>
                    <th>Stage</th>
                  </tr>
                </thead>

                <tbody>
                  ${registrations
                    .map(
                      renderOfficialRegistrationRow
                    )
                    .join("")}
                </tbody>

              </table>
            </div>
          `
          : emptyState(
              "No official registrations",
              "No official registrations match the current filters."
            )
      }

    </section>
  `;
}


function renderOfficialRegistrationRow(
  registration
) {
  const registrationId = getValue(
    registration,
    "registrationId",
    "registration_id"
  );

  const player = getPlayerName(
    registration
  );

  const tournamentId = getValue(
    registration,
    "tournamentId",
    "tournament_id"
  );

  const tournamentType = getValue(
    registration,
    "tournamentTypeId",
    "tournament_type_id"
  );

  const squadName = getValue(
    registration,
    "squadName",
    "squad_name"
  );

  const registrationStatus = getValue(
    registration,
    "registrationStatus",
    "registration_status"
  );

  const paymentStatus = getValue(
    registration,
    "paymentStatus",
    "payment_status"
  );

  const currentStage = getValue(
    registration,
    "currentStage",
    "current_stage"
  );

  return `
    <tr>

      <td>
        <strong>
          ${escapeHtml(
            registrationId || "—"
          )}
        </strong>
      </td>

      <td>
        ${escapeHtml(player)}
      </td>

      <td>
        <span class="ktms-registration-id">
          ${escapeHtml(
            tournamentId || "—"
          )}
        </span>
      </td>

      <td>
        ${escapeHtml(
          tournamentType || "—"
        )}
      </td>

      <td>
        ${escapeHtml(
          squadName || "—"
        )}
      </td>

      <td>
        ${statusBadge(
          registrationStatus
        )}
      </td>

      <td>
        ${statusBadge(
          paymentStatus
        )}
      </td>

      <td>
        ${escapeHtml(
          currentStage || "—"
        )}
      </td>

    </tr>
  `;
}


function getPlayerName(item) {
  const directName = getValue(
    item,
    "playerName",
    "player_name",
    "displayName",
    "display_name",
    "managerName",
    "manager_name"
  );

  if (directName) {
    return directName;
  }

  const player = item?.player;

  if (player && typeof player === "object") {
    return (
      getValue(
        player,
        "displayName",
        "display_name",
        "playerName",
        "player_name",
        "managerName",
        "manager_name"
      ) || "—"
    );
  }

  const playerId = getValue(
    item,
    "playerId",
    "player_id"
  );

  return playerId || "—";
}


function statusBadge(status) {
  if (!status) {
    return `<span class="ktms-status">—</span>`;
  }

  return `
    <span class="ktms-status ktms-status-${statusClass(status)}">
      ${escapeHtml(status)}
    </span>
  `;
}


function emptyState(title, message) {
  return `
    <div class="ktms-empty-state">
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(message)}</p>
    </div>
  `;
}


function uniqueValues(values) {
  return [
    ...new Set(
      values
        .filter(
          (value) =>
            value !== null &&
            value !== undefined &&
            String(value).trim() !== ""
        )
        .map((value) => String(value))
    )
  ];
}


function getValue(object, ...keys) {
  if (!object || typeof object !== "object") {
    return null;
  }

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


function formatDateTime(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return escapeHtml(value);
  }

  return escapeHtml(
    new Intl.DateTimeFormat(
      undefined,
      {
        dateStyle: "medium",
        timeStyle: "short"
      }
    ).format(date)
  );
}


function statusClass(status) {
  return String(status || "")
    .toLowerCase()
    .replaceAll(" ", "-")
    .replaceAll("_", "-")
    .replaceAll("/", "-")
    .replace(/[^a-z0-9-]/g, "");
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
