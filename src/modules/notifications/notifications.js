import { adminApi } from "../../api/admin-api.js";

import {
  getNotificationInbox,
  getNotificationSent,
  getNotificationUnreadCount,
  getAdminNotificationCommunications,
  markNotificationRead,
  markNotificationUnread,
  retryNotification,
  sendNotification
} from "../../api/notification-api.js";

const state = {
  activeTab: "inbox",

  inbox: [],
  sent: [],
  adminCommunications: [],

  unreadCount: 0,

  players: [],
  admins: [],

  inboxFilters: {
    readStatus: "All",
    notificationType: "All",
    notificationMode: "All"
  },

  sentFilters: {
    readStatus: "All",
    notificationType: "All",
    notificationMode: "All"
  },

  loading: false
};

export async function renderNotifications(
  page,
  admin
) {
  page.innerHTML = `
    <div class="ktms-module">

      <div class="ktms-module-toolbar">

        <div>
          <h2>Notifications</h2>
          <p>
            KTMS communication centre for player and administrator
            notifications.
          </p>
        </div>

        <button
          id="notifications-refresh"
          class="ktms-secondary-button"
          type="button"
        >
          REFRESH
        </button>

      </div>

      <div
        id="notifications-message"
        class="ktms-message"
        aria-live="polite"
      ></div>

      <div class="ktms-notification-tabs">

        <button
          type="button"
          class="ktms-notification-tab active"
          data-notification-tab="inbox"
        >
          Inbox
          <span
            id="notification-unread-count"
            class="ktms-notification-count"
          >
            0
          </span>
        </button>

        <button
          type="button"
          class="ktms-notification-tab"
          data-notification-tab="sent"
        >
          Sent
        </button>

        ${
          admin?.role === "Game Master"
            ? `
              <button
                type="button"
                class="ktms-notification-tab"
                data-notification-tab="admin-oversight"
              >
                Admin Oversight
              </button>
            `
            : ""
        }

        <button
          type="button"
          class="ktms-notification-tab"
          data-notification-tab="compose"
        >
          Compose
        </button>

      </div>

      <div id="notifications-content"></div>

    </div>
  `;

  bindEvents(admin);

  await loadNotifications();
}

function bindEvents(admin) {
  document
    .getElementById("notifications-refresh")
    ?.addEventListener(
      "click",
      loadNotifications
    );

  document
    .querySelectorAll(
      "[data-notification-tab]"
    )
    .forEach((button) => {
      button.addEventListener(
        "click",
        async () => {
          state.activeTab =
            button.dataset.notificationTab;

          updateTabs();

          if (
            state.activeTab === "compose"
          ) {
            await renderCompose(admin);
            return;
          }

          renderCurrentTab();
        }
      );
    });
}

async function loadNotifications() {
  setMessage(
    "Loading notifications...",
    "info"
  );

  try {
    state.loading = true;

  const requests = [
    getNotificationInbox(),
    getNotificationSent(),
    getNotificationUnreadCount()
  ];
  
  const isGameMaster =
    admin?.role === "Game Master";
  
  if (isGameMaster) {
    requests.push(
      getAdminNotificationCommunications()
    );
  }
  
  const results =
    await Promise.all(requests);
  
  const inbox = results[0];
  const sent = results[1];
  const unreadCount = results[2];
  
  const adminCommunications =
    isGameMaster
      ? results[3]
      : [];

    state.inbox = normalizeRows(inbox);
    state.sent = normalizeRows(sent);
    state.adminCommunications =
      normalizeRows(adminCommunications);
    state.unreadCount =
      Number(unreadCount || 0);

    updateUnreadCount();
    renderCurrentTab();

    setMessage(
      "Notifications loaded.",
      "success"
    );
  } catch (error) {
    console.error(
      "KTMS notification load failed:",
      error
    );

    document.getElementById(
      "notifications-content"
    ).innerHTML = `
      <div class="ktms-error-card">
        <strong>
          Unable to load notifications.
        </strong>

        <p>
          ${escapeHtml(
            error?.message ||
            "An unexpected error occurred."
          )}
        </p>
      </div>
    `;

    setMessage(
      error?.message ||
        "Unable to load notifications.",
      "error"
    );
  } finally {
    state.loading = false;
  }
}

function renderCurrentTab() {
  if (state.activeTab === "inbox") {
    renderInbox();
    return;
  }

  if (state.activeTab === "sent") {
    renderSent();
    return;
  }

  if (state.activeTab === "admin-oversight") {
  renderAdminOversight();
  return;
}

  if (state.activeTab === "compose") {
    renderCompose();
  }
}

function getFilteredNotifications(
  rows,
  filters
) {
  return rows.filter((notification) => {
    const readStatus =
      notification.read_status ||
      notification.readStatus ||
      "Unread";

    const type =
      notification.notification_type ||
      notification.notificationType ||
      "";

    const mode =
      notification.notification_mode ||
      notification.notificationMode ||
      "";

    const readMatches =
      filters.readStatus === "All" ||
      readStatus === filters.readStatus;

    const typeMatches =
      filters.notificationType === "All" ||
      type === filters.notificationType;

    const modeMatches =
      filters.notificationMode === "All" ||
      mode === filters.notificationMode;

    return (
      readMatches &&
      typeMatches &&
      modeMatches
    );
  });
}

function renderNotificationFilters(
  context,
  rows
) {
  const filters =
    context === "sent"
      ? state.sentFilters
      : state.inboxFilters;

  const types = [
    ...new Set(
      rows
        .map(
          (row) =>
            row.notification_type ||
            row.notificationType
        )
        .filter(Boolean)
    )
  ];

  const modes = [
    ...new Set(
      rows
        .map(
          (row) =>
            row.notification_mode ||
            row.notificationMode
        )
        .filter(Boolean)
    )
  ];

  return `
    <div
      class="ktms-notification-filters"
      data-filter-context="${context}"
    >

      <label>
        Read
        <select
          data-notification-filter="readStatus"
        >
          <option value="All"
            ${filters.readStatus === "All" ? "selected" : ""}>
            All
          </option>

          <option value="Unread"
            ${filters.readStatus === "Unread" ? "selected" : ""}>
            Unread
          </option>

          <option value="Read"
            ${filters.readStatus === "Read" ? "selected" : ""}>
            Read
          </option>
        </select>
      </label>

      <label>
        Notification Type
        <select
          data-notification-filter="notificationType"
        >
          <option value="All">All</option>

          ${types.map((type) => `
            <option
              value="${escapeAttribute(type)}"
              ${filters.notificationType === type ? "selected" : ""}
            >
              ${escapeHtml(type)}
            </option>
          `).join("")}
        </select>
      </label>

      <label>
        Notification Mode
        <select
          data-notification-filter="notificationMode"
        >
          <option value="All">All</option>

          ${modes.map((mode) => `
            <option
              value="${escapeAttribute(mode)}"
              ${filters.notificationMode === mode ? "selected" : ""}
            >
              ${escapeHtml(mode)}
            </option>
          `).join("")}
        </select>
      </label>

      <button
        type="button"
        class="ktms-secondary-button"
        data-notification-filter-reset="${context}"
      >
        RESET
      </button>

    </div>
  `;
}

function renderInbox() {
  const filtered =
  getFilteredNotifications(
    state.inbox,
    state.inboxFilters
  );
  const content =
    document.getElementById(
      "notifications-content"
    );

  if (!content) return;

  if (!state.inbox.length) {
    content.innerHTML = emptyState(
      "Inbox is empty.",
      "New player and administrator notifications will appear here."
    );

    return;
  }

  content.innerHTML = `
    ${renderNotificationFilters(
      "inbox",
      state.inbox
    )}
  
    ${
      !filtered.length
        ? emptyState(
            "No matching notifications.",
            "Change or reset the filters to view other notifications."
          )
        : `
          <div class="ktms-notification-list">
            ${filtered
              .map((notification) =>
                renderNotificationCard(
                  notification,
                  "inbox"
                )
              )
              .join("")}
          </div>
        `
    }
  `;

   bindNotificationActions();
   bindNotificationFilters("inbox");
}

function renderSent() {
  const filtered =
  getFilteredNotifications(
    state.sent,
    state.sentFilters
  );
  const content =
    document.getElementById(
      "notifications-content"
    );

  if (!content) return;

  if (!state.sent.length) {
    content.innerHTML = emptyState(
      "No sent notifications.",
      "Messages sent from this administrator will appear here."
    );

    return;
  }

  content.innerHTML = `
    ${renderNotificationFilters(
      "sent",
      state.sent
    )}
  
    ${
      !filtered.length
        ? emptyState(
            "No matching sent notifications.",
            "Change or reset the filters to view other notifications."
          )
        : `
          <div class="ktms-notification-list">
            ${filtered
              .map((notification) =>
                renderNotificationCard(
                  notification,
                  "sent"
                )
              )
              .join("")}
          </div>
        `
    }
  `;

  bindNotificationActions();
  bindNotificationFilters("sent");

}

function bindNotificationFilters(context) {
  const filters =
    context === "sent"
      ? state.sentFilters
      : state.inboxFilters;

  document
    .querySelectorAll(
      `[data-filter-context="${context}"] [data-notification-filter]`
    )
    .forEach((select) => {
      select.addEventListener("change", () => {
        filters[select.dataset.notificationFilter] =
          select.value;

        if (context === "sent") {
          renderSent();
        } else {
          renderInbox();
        }
      });
    });

  document
    .querySelector(
      `[data-notification-filter-reset="${context}"]`
    )
    ?.addEventListener("click", () => {
      filters.readStatus = "All";
      filters.notificationType = "All";
      filters.notificationMode = "All";

      if (context === "sent") {
        renderSent();
      } else {
        renderInbox();
      }
    });
}

function renderAdminOversight() {
  const content =
    document.getElementById(
      "notifications-content"
    );

  if (!content) return;

  const rows =
    state.adminCommunications;

  if (!rows.length) {
    content.innerHTML = emptyState(
      "No administrator communications.",
      "Administrator-to-administrator communications will appear here."
    );

    return;
  }

  content.innerHTML = `
    <div class="ktms-admin-oversight-header">
      <div>
        <h3>Administrator Communications</h3>
        <p>
          Game Master oversight of administrator-to-administrator
          communications.
        </p>
      </div>
    </div>

    <div class="ktms-notification-list">
      ${rows
        .map((notification) =>
          renderNotificationCard(
            notification,
            "admin-oversight"
          )
        )
        .join("")}
    </div>
  `;
}

function renderNotificationCard(
  notification,
  context
) {
  const id =
    notification.notification_id ||
    notification.notificationId ||
    "";

  const subject =
    notification.notification_subject ||
    notification.subject ||
    "KTMS Notification";

  const body =
    notification.notification_body ||
    notification.body ||
    "";

  const type =
    notification.notification_type ||
    notification.notificationType ||
    "";

  const mode =
    notification.notification_mode ||
    notification.notificationMode ||
    "System";

  const recipient =
    notification.recipient_id ||
    notification.recipientId ||
    "";

  const recipientType =
    notification.recipient_type ||
    notification.recipientType ||
    "";

  const sender =
    notification.sender_id ||
    notification.senderId ||
    "";

  const senderType =
    notification.sender_type ||
    notification.senderType ||
    "";

  const readStatus =
    notification.read_status ||
    notification.readStatus ||
    "Unread";

  const emailStatus =
    notification.email_status ||
    notification.emailStatus ||
    "";

  const inAppStatus =
    notification.in_app_status ||
    notification.inAppStatus ||
    "";

  const deliveryStatus =
    notification.delivery_status ||
    notification.deliveryStatus ||
    "";

  const created =
    notification.created_datetime ||
    notification.createdDatetime ||
    notification.created_at ||
    "";

  const isUnread =
    context === "inbox" &&
    readStatus === "Unread";

  const isFailed =
    emailStatus === "Failed" ||
    deliveryStatus === "Failed";

  return `
    <article
      class="
        ktms-notification-card
        ${isUnread ? "unread" : ""}
      "
      data-notification-id="${escapeAttribute(id)}"
    >

      <div class="ktms-notification-card-header">

        <div>

          <div class="ktms-notification-subject">
            ${escapeHtml(subject)}
          </div>

          <div class="ktms-notification-meta">
            ${escapeHtml(mode)}
            ${type
              ? ` · ${escapeHtml(type)}`
              : ""}
          </div>

        </div>

        <div class="ktms-notification-date">
          ${formatDate(created)}
        </div>

      </div>

      <div class="ktms-notification-routing">

        ${
          context === "sent"
            ? `
              <span>
                To:
                ${escapeHtml(recipientType)}
                ${escapeHtml(recipient)}
              </span>
            `
            : `
              <span>
                From:
                ${escapeHtml(senderType || "System")}
                ${escapeHtml(sender || "")}
              </span>
            `
        }

      </div>

      <div class="ktms-notification-body">
        ${escapeHtml(body)}
      </div>

      <div class="ktms-notification-status">

        ${
          inAppStatus
            ? `<span>In-App: ${escapeHtml(
                inAppStatus
              )}</span>`
            : ""
        }

        ${
          emailStatus
            ? `<span>Email: ${escapeHtml(
                emailStatus
              )}</span>`
            : ""
        }

        ${
          deliveryStatus
            ? `<span>Delivery: ${escapeHtml(
                deliveryStatus
              )}</span>`
            : ""
        }

      </div>

      <div class="ktms-notification-actions">

        ${
          context === "inbox"
            ? readStatus === "Unread"
              ? `
                <button
                  type="button"
                  class="ktms-secondary-button"
                  data-notification-action="read"
                  data-notification-id="${escapeAttribute(
                    id
                  )}"
                >
                  MARK READ
                </button>
              `
              : `
                <button
                  type="button"
                  class="ktms-secondary-button"
                  data-notification-action="unread"
                  data-notification-id="${escapeAttribute(
                    id
                  )}"
                >
                  MARK UNREAD
                </button>
              `
            : ""
        }

        ${
          context === "sent" && isFailed
            ? `
              <button
                type="button"
                class="ktms-secondary-button"
                data-notification-action="retry"
                data-notification-id="${escapeAttribute(
                  id
                )}"
              >
                RETRY EMAIL
              </button>
            `
            : ""
        }

      </div>

    </article>
  `;
}

async function renderCompose(admin) {
  const content =
    document.getElementById(
      "notifications-content"
    );

  if (!content) return;

  if (
    !state.players.length ||
    !state.admins.length
  ) {
    await loadRecipients();
  }

  const isGameMaster =
    admin?.role === "Game Master";

  content.innerHTML = `
    <div class="ktms-notification-compose">

      <div class="ktms-compose-header">
        <h3>Compose Notification</h3>

        <p>
          Send an in-app notification, email,
          or both to an existing KTMS identity.
        </p>
      </div>

      <form id="notification-compose-form">

        <div class="ktms-form-grid">

          <label>
            Recipient type

            <select
              id="notification-recipient-type"
              required
            >
              <option value="Player">
                Player
              </option>

              ${
                isGameMaster
                  ? `
                    <option value="Admin">
                      Administrator
                    </option>
                  `
                  : ""
              }

            </select>
          </label>

                    <label>
            Recipient
          
            <input
              id="notification-recipient-search"
              type="text"
              list="notification-recipient-options"
              placeholder="Search by name, ID or email..."
              autocomplete="off"
              required
            />
          
            <datalist
              id="notification-recipient-options"
            ></datalist>
          
            <input
              id="notification-recipient-id"
              type="hidden"
            />
          </label>

          <label>
            Notification mode

            <select
              id="notification-mode"
              required
            >
              <option value="Direct">
                Direct
              </option>

              <option value="Administrative">
                Administrative
              </option>
            </select>
          </label>

          <label>
            Delivery

            <select
              id="notification-channels"
              required
            >
              <option value="Both">
                In-App + Email
              </option>

              <option value="In-App">
                In-App only
              </option>

              <option value="Email">
                Email only
              </option>
            </select>
          </label>

          <label>
            Priority

            <select
              id="notification-priority"
              required
            >
              <option value="Normal">
                Normal
              </option>

              <option value="Low">
                Low
              </option>

              <option value="High">
                High
              </option>

              <option value="Critical">
                Critical
              </option>
            </select>
          </label>

          <label>
            Notification type

            <input
              id="notification-type"
              type="text"
              value="Direct"
              required
            />
          </label>

        </div>

        <label>
          Subject

          <input
            id="notification-subject"
            type="text"
            maxlength="200"
            required
          />
        </label>

        <label>
          Message

          <textarea
            id="notification-body"
            rows="8"
            maxlength="5000"
            required
          ></textarea>
        </label>

        <div
          id="notification-compose-message"
          class="ktms-message"
          aria-live="polite"
        ></div>

        <div class="ktms-form-actions">

          <button
            type="submit"
            class="ktms-primary-button"
          >
            SEND NOTIFICATION
          </button>

        </div>

      </form>

    </div>
  `;

  populateRecipientSelect();

  document
    .getElementById(
      "notification-recipient-type"
    )
    ?.addEventListener(
      "change",
      populateRecipientSelect
    );

  document
    .getElementById(
      "notification-compose-form"
    )
    ?.addEventListener(
      "submit",
      handleComposeSubmit
    );
}

async function loadRecipients() {
  try {
    const [
      playerResponse,
      adminResponse
    ] = await Promise.all([
      adminApi("player.list", {}),
      adminApi("admin.list", {})
    ]);

    state.players =
      normalizeRecipientRows(
        playerResponse
      );

    state.admins =
      normalizeRecipientRows(
        adminResponse
      );
  } catch (error) {
    console.error(
      "KTMS recipient loading failed:",
      error
    );

    throw error;
  }
}

function normalizeRecipientRows(response) {
  const data =
    response?.data ||
    response ||
    [];

  if (Array.isArray(data)) {
    return data;
  }

  if (Array.isArray(data.players)) {
    return data.players;
  }

  if (Array.isArray(data.items)) {
    return data.items;
  }

  return [];
}

function populateRecipientSelect() {
  const type =
    document.getElementById(
      "notification-recipient-type"
    )?.value || "Player";

  const search =
    document.getElementById(
      "notification-recipient-search"
    );

  const hidden =
    document.getElementById(
      "notification-recipient-id"
    );

  const datalist =
    document.getElementById(
      "notification-recipient-options"
    );

  if (!search || !hidden || !datalist) {
    return;
  }

  const rows =
    type === "Admin"
      ? state.admins
      : state.players;

  datalist.innerHTML =
    rows
      .map((row) => {
        const id =
          type === "Admin"
            ? row.admin_id
            : row.player_id;

        const name =
          type === "Admin"
            ? row.display_name
            : row.manager_name;

        const email =
          row.login_email ||
          row.email_address ||
          "";

        return `
          <option
            value="${escapeAttribute(
              name || id || ""
            )}"
            label="${escapeAttribute(
              `${id || ""}${email ? ` · ${email}` : ""}`
            )}"
            data-recipient-id="${escapeAttribute(
              id || ""
            )}"
          ></option>
        `;
      })
      .join("");

  search.value = "";
  hidden.value = "";

  search.oninput = () => {
    const value =
      search.value.trim().toLowerCase();

    const match =
      rows.find((row) => {
        const id =
          type === "Admin"
            ? row.admin_id
            : row.player_id;

        const name =
          type === "Admin"
            ? row.display_name
            : row.manager_name;

        const email =
          row.login_email ||
          row.email_address ||
          "";

        return (
          String(id || "").toLowerCase() === value ||
          String(name || "").toLowerCase() === value ||
          String(email || "").toLowerCase() === value
        );
      });

    hidden.value =
      match
        ? type === "Admin"
          ? match.admin_id
          : match.player_id
        : "";
  };
}

async function handleComposeSubmit(
  event
) {
  event.preventDefault();

  const message =
    document.getElementById(
      "notification-compose-message"
    );

  const recipientType =
    document.getElementById(
      "notification-recipient-type"
    ).value;

  const recipientId =
    document.getElementById(
      "notification-recipient-id"
    ).value;

  const mode =
    document.getElementById(
      "notification-mode"
    ).value;

  const channels =
    document.getElementById(
      "notification-channels"
    ).value;

  const priority =
    document.getElementById(
      "notification-priority"
    ).value;

  const type =
    document.getElementById(
      "notification-type"
    ).value.trim();

  const subject =
    document.getElementById(
      "notification-subject"
    ).value.trim();

  const body =
    document.getElementById(
      "notification-body"
    ).value.trim();

  if (!recipientId) {
    setComposeMessage(
      "Select a recipient.",
      "error"
    );

    return;
  }

  if (!subject) {
    setComposeMessage(
      "Subject is required.",
      "error"
    );

    return;
  }

  if (!body) {
    setComposeMessage(
      "Message body is required.",
      "error"
    );

    return;
  }

  setComposeMessage(
    "Sending notification...",
    "info"
  );

  try {
    await sendNotification({
      recipientType,
      recipientId,
      notificationMode: mode,
      deliveryChannels: channels,
      notificationPriority: priority,
      notificationType:
        type || "Direct",
      subject,
      body
    });

    setComposeMessage(
      "Notification sent successfully.",
      "success"
    );

    document
      .getElementById(
        "notification-compose-form"
      )
      ?.reset();

    await loadNotifications();

    state.activeTab = "sent";

    updateTabs();
    renderSent();
  } catch (error) {
    console.error(
      "KTMS notification send failed:",
      error
    );

    setComposeMessage(
      error?.message ||
        "Unable to send notification.",
      "error"
    );
  }
}

function bindNotificationActions() {
  document
    .querySelectorAll(
      "[data-notification-action]"
    )
    .forEach((button) => {
      button.addEventListener(
        "click",
        async () => {
          const action =
            button.dataset
              .notificationAction;

          const id =
            button.dataset
              .notificationId;

          if (!id) return;

          button.disabled = true;

          try {
            if (action === "read") {
              await markNotificationRead(id);
            }

            if (action === "unread") {
              await markNotificationUnread(id);
            }

            if (action === "retry") {
              await retryNotification(id);
            }

            await loadNotifications();

            if (
              state.activeTab === "inbox"
            ) {
              renderInbox();
            }

            if (
              state.activeTab === "sent"
            ) {
              renderSent();
            }
          } catch (error) {
            console.error(
              "KTMS notification action failed:",
              error
            );

            setMessage(
              error?.message ||
                "Notification operation failed.",
              "error"
            );

            button.disabled = false;
          }
        }
      );
    });
}

function updateTabs() {
  document
    .querySelectorAll(
      "[data-notification-tab]"
    )
    .forEach((button) => {
      button.classList.toggle(
        "active",
        button.dataset.notificationTab ===
          state.activeTab
      );
    });
}

function updateUnreadCount() {
  const element =
    document.getElementById(
      "notification-unread-count"
    );

  if (!element) return;

  element.textContent =
    String(state.unreadCount);
}

function setMessage(
  text,
  type = "info"
) {
  const element =
    document.getElementById(
      "notifications-message"
    );

  if (!element) return;

  element.textContent = text;
  element.className =
    `ktms-message ${type}`;
}

function setComposeMessage(
  text,
  type = "info"
) {
  const element =
    document.getElementById(
      "notification-compose-message"
    );

  if (!element) return;

  element.textContent = text;
  element.className =
    `ktms-message ${type}`;
}

function emptyState(
  title,
  description
) {
  return `
    <div class="ktms-empty-state">
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(description)}</p>
    </div>
  `;
}

function normalizeRows(response) {
  const data =
    response?.data ||
    response ||
    [];

  return Array.isArray(data)
    ? data
    : [];
}

function formatDate(value) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString();
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll(
      "'",
      "&#039;"
    );
}

function escapeAttribute(value) {
  return escapeHtml(value);
}
