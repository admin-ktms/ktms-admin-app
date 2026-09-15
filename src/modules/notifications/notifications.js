import { adminApi } from "../../api/admin-api.js";

import {
  getNotificationInbox,
  getNotificationSent,
  getNotificationUnreadCount,
  markNotificationRead,
  markNotificationUnread,
  retryNotification,
  sendNotification
} from "../../api/notification-api.js";

const state = {
  activeTab: "inbox",
  inbox: [],
  sent: [],
  unreadCount: 0,
  players: [],
  admins: [],
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

    const [
      inbox,
      sent,
      unreadCount
    ] = await Promise.all([
      getNotificationInbox(),
      getNotificationSent(),
      getNotificationUnreadCount()
    ]);

    state.inbox = normalizeRows(inbox);
    state.sent = normalizeRows(sent);
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

  if (state.activeTab === "compose") {
    renderCompose();
  }
}

function renderInbox() {
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
    <div class="ktms-notification-list">

      ${state.inbox
        .map((notification) =>
          renderNotificationCard(
            notification,
            "inbox"
          )
        )
        .join("")}

    </div>
  `;

  bindNotificationActions();
}

function renderSent() {
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
    <div class="ktms-notification-list">

      ${state.sent
        .map((notification) =>
          renderNotificationCard(
            notification,
            "sent"
          )
        )
        .join("")}

    </div>
  `;

  bindNotificationActions();
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

            <select
              id="notification-recipient-id"
              required
            ></select>
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

  const select =
    document.getElementById(
      "notification-recipient-id"
    );

  if (!select) return;

  const rows =
    type === "Admin"
      ? state.admins
      : state.players;

  select.innerHTML = `
    <option value="">
      Select ${type.toLowerCase()}...
    </option>

    ${rows
      .map((row) => {
        const id =
          type === "Admin"
            ? row.admin_id ||
              row.adminId
            : row.player_id ||
              row.playerId;

        const name =
          type === "Admin"
            ? row.display_name ||
              row.displayName ||
              row.login_email ||
              row.loginEmail ||
              id
            : row.display_name ||
              row.displayName ||
              row.player_name ||
              row.playerName ||
              id;

        const status =
          type === "Admin"
            ? row.admin_status ||
              row.adminStatus
            : row.player_status ||
              row.playerStatus;

        if (!id) return "";

        if (
          type === "Admin" &&
          status &&
          status !== "Active"
        ) {
          return "";
        }

        return `
          <option value="${escapeAttribute(id)}">
            ${escapeHtml(name)}
            — ${escapeHtml(id)}
          </option>
        `;
      })
      .join("")}
  `;
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
