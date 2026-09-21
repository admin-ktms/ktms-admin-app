import { adminApi } from "../../api/admin-api.js";
import { getLogs, clearLogs, setLogLevel } from "../../utils/logger.js";

const ALLOWED_ROLES = new Set(["Game Master", "Platform Manager"]);

export async function renderDiagnostics(page, admin) {
  page.innerHTML = `
    <div class="ktms-module ktms-diagnostics">
      <div class="ktms-module-toolbar">
        <div>
          <h2>Diagnostics</h2>
          <p>Protected application diagnostics for authorized technical operations.</p>
        </div>
        <div class="ktms-action-row">
          <button id="diagnostics-refresh" class="ktms-primary-button" type="button">REFRESH</button>
          <button id="diagnostics-copy" class="ktms-secondary-button" type="button">COPY</button>
          <button id="diagnostics-clear" class="ktms-danger-button" type="button">CLEAR</button>
        </div>
      </div>

      <div id="diagnostics-message" class="ktms-message" aria-live="polite"></div>
      <div id="diagnostics-security"></div>

      <section class="ktms-diagnostics-panel">
        <div class="ktms-diagnostics-panel-header">
          <div>
            <h3>Frontend Log Store</h3>
            <p>Session-local diagnostic events captured by the KTMS frontend logger.</p>
          </div>
          <label class="ktms-diagnostics-level">
            <span>LEVEL</span>
            <select id="diagnostics-level" class="ktms-filter">
              <option value="error">Error</option>
              <option value="warn">Warn</option>
              <option value="info" selected>Info</option>
              <option value="debug">Debug</option>
              <option value="trace">Trace</option>
            </select>
          </label>
        </div>

        <div class="ktms-diagnostics-filters">
          <input id="diagnostics-search" class="ktms-filter" type="search" placeholder="Search event, action, trace ID..." />
          <select id="diagnostics-level-filter" class="ktms-filter">
            <option value="">All levels</option>
            <option value="error">Error</option>
            <option value="warn">Warn</option>
            <option value="info">Info</option>
            <option value="debug">Debug</option>
            <option value="trace">Trace</option>
          </select>
        </div>

        <div id="diagnostics-log-count" class="ktms-diagnostics-count"></div>
        <div class="ktms-table-wrap">
          <table class="ktms-table ktms-diagnostics-table">
            <thead>
              <tr>
                <th>Time</th>
                <th>Level</th>
                <th>Event</th>
                <th>Action</th>
                <th>Trace ID</th>
                <th>Status</th>
                <th>Duration</th>
              </tr>
            </thead>
            <tbody id="diagnostics-log-body"></tbody>
          </table>
        </div>
      </section>

      <section class="ktms-diagnostics-panel">
        <div class="ktms-diagnostics-panel-header">
          <div>
            <h3>Selected Event</h3>
            <p>Safe diagnostic details. Authentication credentials are excluded from the logger.</p>
          </div>
        </div>
        <pre id="diagnostics-detail" class="ktms-diagnostics-detail">Select a log entry.</pre>
      </section>
    </div>
  `;

  bindDiagnosticsEvents(page);
  await authorizeDiagnostics(page, admin);
}

async function authorizeDiagnostics(page, admin) {
  const message = page.querySelector("#diagnostics-message");
  const security = page.querySelector("#diagnostics-security");

  if (!ALLOWED_ROLES.has(String(admin?.role || "").trim())) {
    renderDenied(security, "Your KTMS administrator role does not provide diagnostics access.");
    return;
  }

  try {
    const authorization = await adminApi("diagnostics.view");

    if (authorization?.diagnosticsEnabled !== true) {
      throw Object.assign(new Error("Diagnostics authorization is unavailable."), {
        code: "DIAGNOSTICS_NOT_ENABLED"
      });
    }

    security.innerHTML = `
      <div class="ktms-diagnostics-authorized">
        <span>AUTHORIZED</span>
        <strong>Diagnostics access verified by KTMS authorization.</strong>
        <small>Server time: ${escapeHtml(authorization.serverTime || "Unavailable")}</small>
      </div>
    `;

    renderLogs(page);
  } catch (error) {
    renderDenied(
      security,
      error?.code === "PERMISSION_DENIED"
        ? "KTMS authorization denied access to diagnostics."
        : error?.message || "Unable to authorize diagnostics."
    );
    if (message) {
      message.textContent = "Diagnostics access was not granted.";
    }
  }
}

function bindDiagnosticsEvents(page) {
  page.querySelector("#diagnostics-refresh")?.addEventListener("click", () => {
    renderLogs(page);
  });

  page.querySelector("#diagnostics-clear")?.addEventListener("click", () => {
    clearLogs();
    renderLogs(page);
    const detail = page.querySelector("#diagnostics-detail");
    if (detail) detail.textContent = "Diagnostic log store cleared.";
  });

  page.querySelector("#diagnostics-copy")?.addEventListener("click", async () => {
    const logs = getLogs();
    const payload = JSON.stringify(logs, null, 2);

    try {
      await navigator.clipboard.writeText(payload);
      const message = page.querySelector("#diagnostics-message");
      if (message) message.textContent = "Diagnostics copied to clipboard.";
    } catch {
      const detail = page.querySelector("#diagnostics-detail");
      if (detail) detail.textContent = payload;
    }
  });

  page.querySelector("#diagnostics-level")?.addEventListener("change", (event) => {
    setLogLevel(event.target.value);
    renderLogs(page);
  });

  page.querySelector("#diagnostics-search")?.addEventListener("input", () => {
    renderLogs(page);
  });

  page.querySelector("#diagnostics-level-filter")?.addEventListener("change", () => {
    renderLogs(page);
  });
}

function renderLogs(page) {
  const body = page.querySelector("#diagnostics-log-body");
  const count = page.querySelector("#diagnostics-log-count");
  if (!body || !count) return;

  const search = String(page.querySelector("#diagnostics-search")?.value || "").trim().toLowerCase();
  const level = String(page.querySelector("#diagnostics-level-filter")?.value || "");

  const logs = getLogs().filter((entry) => {
    if (level && entry.level !== level) return false;
    if (!search) return true;
    return JSON.stringify(entry).toLowerCase().includes(search);
  }).reverse();

  count.textContent = `${logs.length} matching event${logs.length === 1 ? "" : "s"}`;

  body.innerHTML = logs.length
    ? logs.map((entry, index) => `
        <tr data-diagnostic-index="${index}">
          <td>${escapeHtml(formatTime(entry.timestamp))}</td>
          <td><span class="ktms-diagnostics-level-badge ktms-diagnostics-level-${escapeHtml(entry.level)}">${escapeHtml(entry.level)}</span></td>
          <td>${escapeHtml(entry.event || "")}</td>
          <td>${escapeHtml(entry.action || "—")}</td>
          <td class="ktms-diagnostics-mono">${escapeHtml(entry.traceId || entry.backendTraceId || "—")}</td>
          <td>${escapeHtml(entry.status ?? "—")}</td>
          <td>${escapeHtml(entry.durationMs != null ? `${entry.durationMs} ms` : "—")}</td>
        </tr>
      `).join("")
    : `
        <tr>
          <td colspan="7" class="ktms-diagnostics-empty">No matching diagnostic events.</td>
        </tr>
      `;

  body.querySelectorAll("[data-diagnostic-index]").forEach((row) => {
    row.addEventListener("click", () => {
      const entry = logs[Number(row.dataset.diagnosticIndex)];
      const detail = page.querySelector("#diagnostics-detail");
      if (detail) detail.textContent = JSON.stringify(entry, null, 2);
    });
  });
}

function renderDenied(container, message) {
  if (!container) return;
  container.innerHTML = `
    <div class="ktms-diagnostics-denied">
      <strong>Diagnostics access denied</strong>
      <p>${escapeHtml(message)}</p>
      <span>Access is controlled by the existing KTMS administrator authorization boundary.</span>
    </div>
  `;
}

function formatTime(timestamp) {
  if (!timestamp) return "—";
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? String(timestamp) : date.toLocaleString();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
