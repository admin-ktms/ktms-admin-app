import {
  getNotificationInbox,
  getNotificationSent,
  getNotificationUnreadCount,
  getAdminNotificationCommunications,
  searchNotificationRecipients,
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

  recipientSearch: "",
  recipientResults: [],
  selectedRecipient: null,
  recipientSearchTimer: null,

  loading: false,
  admin: null
};


/* =========================================================
   MAIN RENDER
   ========================================================= */

export async function renderNotifications(
  page,
  admin
) {
  state.admin = admin;

  page.innerHTML = `
    <div class="ktms-module">

      <div class="ktms-module-toolbar">

        <div>
          <h2>Notifications</h2>

          <p>
            KTMS communication centre for player
            and administrator notifications.
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

  await loadNotifications(admin);
}


/* =========================================================
   EVENTS
   ========================================================= */

function bindEvents(admin) {
  document
    .getElementById("notifications-refresh")
    ?.addEventListener(
      "click",
      () => loadNotifications(admin)
    );

  document
    .querySelectorAll("[data-notification-tab]")
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
            renderCompose(admin);
            return;
          }

          renderCurrentTab();
        }
      );
    });
}


/* =========================================================
   LOAD DATA
   ========================================================= */

async function loadNotifications(admin) {
  setMessage(
    "Loading notifications...",
    "info"
  );

  try {
    state.loading = true;

    const isGameMaster =
      admin?.role === "Game Master";

    const requests = [
      getNotificationInbox(
        state.inboxFilters
      ),

      getNotificationSent(
        state.sentFilters
      ),

      getNotificationUnreadCount()
    ];

    if (isGameMaster) {
      requests.push(
        getAdminNotificationCommunications()
      );
    }

    const results =
      await Promise.all(requests);

    state.inbox =
      normalizeRows(results[0]);

    state.sent =
      normalizeRows(results[1]);

    state.unreadCount =
      Number(results[2] || 0);

    state.adminCommunications =
      isGameMaster
        ? normalizeRows(results[3])
        : [];

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

    const content =
      document.getElementById(
        "notifications-content"
      );

    if (content) {
      content.innerHTML = `
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
    }

    setMessage(
      error?.message ||
        "Unable to load notifications.",
      "error"
    );

  } finally {
    state.loading = false;
  }
}


/* =========================================================
   TAB ROUTING
   ========================================================= */

function renderCurrentTab() {
  if (state.activeTab === "inbox") {
    renderInbox();
    return;
  }

  if (state.activeTab === "sent") {
    renderSent();
    return;
  }

  if (
    state.activeTab ===
    "admin-oversight"
  ) {
    renderAdminOversight();
    return;
  }

  if (state.activeTab === "compose") {
    renderCompose(state.admin);
  }
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

  if (element) {
    element.textContent =
      String(state.unreadCount);
  }
}


/* =========================================================
   FILTERS
   ========================================================= */

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
          <option
            value="All"
            ${
              filters.readStatus === "All"
                ? "selected"
                : ""
            }
          >
            All
          </option>

          <option
            value="Unread"
            ${
              filters.readStatus === "Unread"
                ? "selected"
                : ""
            }
          >
            Unread
          </option>

          <option
            value="Read"
            ${
              filters.readStatus === "Read"
                ? "selected"
                : ""
            }
          >
            Read
          </option>
        </select>
      </label>


      <label>
        Notification Type

        <select
          data-notification-filter="notificationType"
        >
          <option
            value="All"
          >
            All
          </option>

          ${types
            .map(
              (type) => `
                <option
                  value="${escapeAttribute(type)}"
                  ${
                    filters.notificationType === type
                      ? "selected"
                      : ""
                  }
                >
                  ${escapeHtml(type)}
                </option>
              `
            )
            .join("")}
        </select>
      </label>


      <label>
        Notification Mode

        <select
          data-notification-filter="notificationMode"
        >
          <option
            value="All"
          >
            All
          </option>

          ${modes
            .map(
              (mode) => `
                <option
                  value="${escapeAttribute(mode)}"
                  ${
                    filters.notificationMode === mode
                      ? "selected"
                      : ""
                  }
                >
                  ${escapeHtml(mode)}
                </option>
              `
            )
            .join("")}
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
      select.addEventListener(
        "change",
        async () => {
          filters[
            select.dataset
              .notificationFilter
          ] = select.value;

          if (context === "sent") {
            await refreshSent();
          } else {
            await refreshInbox();
          }
        }
      );
    });

  document
    .querySelector(
      `[data-notification-filter-reset="${context}"]`
    )
    ?.addEventListener(
      "click",
      async () => {
        filters.readStatus = "All";
        filters.notificationType = "All";
        filters.notificationMode = "All";

        if (context === "sent") {
          await refreshSent();
        } else {
          await refreshInbox();
        }
      }
    );
}


async function refreshInbox() {
  try {
    setMessage(
      "Loading inbox...",
      "info"
    );

    state.inbox =
      normalizeRows(
        await getNotificationInbox(
          state.inboxFilters
        )
      );

    renderInbox();

    setMessage(
      "Inbox updated.",
      "success"
    );

  } catch (error) {
    console.error(
      "KTMS notification inbox refresh failed:",
      error
    );

    setMessage(
      error?.message ||
        "Unable to refresh inbox.",
      "error"
    );
  }
}


async function refreshSent() {
  try {
    setMessage(
      "Loading sent notifications...",
      "info"
    );

    state.sent =
      normalizeRows(
        await getNotificationSent(
          state.sentFilters
        )
      );

    renderSent();

    setMessage(
      "Sent notifications updated.",
      "success"
    );

  } catch (error) {
    console.error(
      "KTMS notification sent refresh failed:",
      error
    );

    setMessage(
      error?.message ||
        "Unable to refresh sent notifications.",
      "error"
    );
  }
}


/* =========================================================
   INBOX
   ========================================================= */

function renderInbox() {
  const content =
    document.getElementById(
      "notifications-content"
    );

  if (!content) return;

  content.innerHTML = `
    ${renderNotificationFilters(
      "inbox",
      state.inbox
    )}

    ${
      !state.inbox.length
        ? emptyState(
            "Inbox is empty.",
            "New KTMS notifications will appear here."
          )
        : `
          <div class="ktms-notification-list">
            ${state.inbox
              .map(
                (notification) =>
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


/* =========================================================
   SENT
   ========================================================= */

function renderSent() {
  const content =
    document.getElementById(
      "notifications-content"
    );

  if (!content) return;

  content.innerHTML = `
    ${renderNotificationFilters(
      "sent",
      state.sent
    )}

    ${
      !state.sent.length
        ? emptyState(
            "No sent notifications.",
            "Messages sent from this administrator will appear here."
          )
        : `
          <div class="ktms-notification-list">
            ${state.sent
              .map(
                (notification) =>
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


/* =========================================================
   GAME MASTER OVERSIGHT
   ========================================================= */

function renderAdminOversight() {
  const content =
    document.getElementById(
      "notifications-content"
    );

  if (!content) return;

  if (
    state.admin?.role !== "Game Master"
  ) {
    content.innerHTML =
      emptyState(
        "Access restricted.",
        "Game Master authority is required."
      );

    return;
  }

  if (!state.adminCommunications.length) {
    content.innerHTML =
      emptyState(
        "No administrator communications.",
        "Administrator-to-administrator communications will appear here."
      );

    return;
  }

  content.innerHTML = `
    <div class="ktms-admin-oversight-header">

      <div>
        <h3>
          Administrator Communications
        </h3>

        <p>
          Game Master oversight of
          administrator-to-administrator
          communications.
        </p>
      </div>

    </div>

    <div class="ktms-notification-list">

      ${state.adminCommunications
        .map(
          (notification) =>
            renderNotificationCard(
              notification,
              "admin-oversight"
            )
        )
        .join("")}

    </div>
  `;
}


/* =========================================================
   COMPOSE
   ========================================================= */

function renderCompose(admin) {
  const content =
    document.getElementById(
      "notifications-content"
    );

  if (!content) return;

  state.recipientSearch = "";
  state.recipientResults = [];
  state.selectedRecipient = null;

  content.innerHTML = `
    <div class="ktms-notification-compose">

      <div class="ktms-section-header">

        <div>
          <h3>
            Compose Notification
          </h3>

          <p>
            Send an authenticated KTMS
            communication to an existing
            player or administrator.
          </p>
        </div>

      </div>


      <form
        id="notification-compose-form"
        class="ktms-form"
      >

        <div class="ktms-form-row">

          <label>
            Recipient Type

            <select
              id="notification-recipient-type"
              required
            >

              <option value="Player">
                Player
              </option>

              ${
                admin?.role === "Game Master"
                  ? `
                    <option value="Admin">
                      Administrator
                    </option>
                  `
                  : ""
              }

            </select>
          </label>

        </div>


        <div class="ktms-form-row">

          <label>
            Recipient

            <div class="ktms-notification-recipient-search">

              <input
                id="notification-recipient-search"
                type="text"
                autocomplete="off"
                placeholder="Search by name, ID or email..."
                required
              />

              <input
                id="notification-recipient-id"
                type="hidden"
              />

              <div
                id="notification-recipient-results"
                class="ktms-notification-recipient-results"
              ></div>

            </div>

          </label>

        </div>


        <div class="ktms-form-row">

          <label>
            Notification Mode

            <select
              id="notification-mode"
              required
            >

              <option value="Direct">
                Direct
              </option>

              ${
                admin?.role === "Game Master"
                  ? `
                    <option value="Administrative">
                      Administrative
                    </option>
                  `
                  : ""
              }

            </select>
          </label>


          <label>
            Delivery

            <select
              id="notification-delivery"
              required
            >

              <option value="Both">
                In-App + Email
              </option>

              <option value="In-App">
                In-App Only
              </option>

              <option value="Email">
                Email Only
              </option>

            </select>
          </label>

        </div>


        <div class="ktms-form-row">

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
            Notification Type

            <input
              id="notification-type"
              type="text"
              value="Direct"
              required
            />

          </label>

        </div>


        <div class="ktms-form-row">

          <label>
            Subject

            <input
              id="notification-subject"
              type="text"
              maxlength="200"
              required
            />

          </label>

        </div>


        <div class="ktms-form-row">

          <label>
            Message

            <textarea
              id="notification-message"
              rows="8"
              maxlength="5000"
              required
            ></textarea>

          </label>

        </div>


        <div
          id="notification-compose-status"
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

  bindComposeEvents(admin);
}


/* =========================================================
   RECIPIENT SEARCH
   ========================================================= */

function bindComposeEvents(admin) {
  const recipientType =
    document.getElementById(
      "notification-recipient-type"
    );

  const recipientSearch =
    document.getElementById(
      "notification-recipient-search"
    );

  recipientType?.addEventListener(
    "change",
    () => {
      state.recipientSearch = "";
      state.recipientResults = [];
      state.selectedRecipient = null;

      if (recipientSearch) {
        recipientSearch.value = "";
      }

      clearRecipientResults();
    }
  );


  recipientSearch?.addEventListener(
    "input",
    () => {
      state.recipientSearch =
        recipientSearch.value.trim();

      state.selectedRecipient = null;

      const hidden =
        document.getElementById(
          "notification-recipient-id"
        );

      if (hidden) {
        hidden.value = "";
      }

      clearTimeout(
        state.recipientSearchTimer
      );

      if (
        state.recipientSearch.length < 2
      ) {
        clearRecipientResults();
        return;
      }

      state.recipientSearchTimer =
        setTimeout(
          searchRecipients,
          300
        );
    }
  );


  document
    .getElementById(
      "notification-compose-form"
    )
    ?.addEventListener(
      "submit",
      (event) =>
        handleComposeSubmit(
          event,
          admin
        )
    );
}


async function searchRecipients() {
  const search =
    state.recipientSearch.trim();

  if (search.length < 2) {
    clearRecipientResults();
    return;
  }

  const recipientType =
    document.getElementById(
      "notification-recipient-type"
    )?.value;

  if (!recipientType) {
    return;
  }

  const resultsContainer =
    document.getElementById(
      "notification-recipient-results"
    );

  if (!resultsContainer) {
    return;
  }

  resultsContainer.innerHTML = `
    <div class="ktms-notification-recipient-loading">
      Searching...
    </div>
  `;

  try {
    const results =
      await searchNotificationRecipients(
        recipientType,
        search,
        10
      );

    state.recipientResults =
      normalizeRows(results);

    renderRecipientResults();

  } catch (error) {
    console.error(
      "KTMS recipient search failed:",
      error
    );

    resultsContainer.innerHTML = `
      <div class="ktms-notification-recipient-error">
        ${escapeHtml(
          error?.message ||
          "Unable to search recipients."
        )}
      </div>
    `;
  }
}


function renderRecipientResults() {
  const container =
    document.getElementById(
      "notification-recipient-results"
    );

  if (!container) return;

  if (!state.recipientResults.length) {
    container.innerHTML = `
      <div class="ktms-notification-recipient-empty">
        No matching recipients found.
      </div>
    `;

    return;
  }

  container.innerHTML =
    state.recipientResults
      .map((recipient, index) => {
        const id =
          recipient.player_id ||
          recipient.playerId ||
          recipient.admin_id ||
          recipient.adminId ||
          recipient.id ||
          "";

        const name =
          recipient.manager_name ||
          recipient.managerName ||
          recipient.display_name ||
          recipient.displayName ||
          recipient.name ||
          id;

        const email =
          recipient.email_address ||
          recipient.emailAddress ||
          recipient.login_email ||
          recipient.loginEmail ||
          recipient.email ||
          "";

        return `
          <button
            type="button"
            class="ktms-notification-recipient-result"
            data-recipient-index="${index}"
          >

            <strong>
              ${escapeHtml(name)}
            </strong>

            <span>
              ${escapeHtml(id)}
              ${
                email
                  ? ` · ${escapeHtml(email)}`
                  : ""
              }
            </span>

          </button>
        `;
      })
      .join("");


  container
    .querySelectorAll(
      "[data-recipient-index]"
    )
    .forEach((button) => {
      button.addEventListener(
        "click",
        () => {
          const index =
            Number(
              button.dataset
                .recipientIndex
            );

          selectRecipient(
            state.recipientResults[index]
          );
        }
      );
    });
}


function selectRecipient(recipient) {
  const id =
    recipient.player_id ||
    recipient.playerId ||
    recipient.admin_id ||
    recipient.adminId ||
    recipient.id ||
    "";

  const name =
    recipient.manager_name ||
    recipient.managerName ||
    recipient.display_name ||
    recipient.displayName ||
    recipient.name ||
    id;

  const email =
    recipient.email_address ||
    recipient.emailAddress ||
    recipient.login_email ||
    recipient.loginEmail ||
    recipient.email ||
    "";

  state.selectedRecipient = {
    ...recipient,
    id,
    name,
    email
  };

  const searchInput =
    document.getElementById(
      "notification-recipient-search"
    );

  const hiddenInput =
    document.getElementById(
      "notification-recipient-id"
    );

  if (searchInput) {
    searchInput.value =
      email
        ? `${name} — ${email}`
        : name;
  }

  if (hiddenInput) {
    hiddenInput.value = id;
  }

  clearRecipientResults();
}


function clearRecipientResults() {
  const container =
    document.getElementById(
      "notification-recipient-results"
    );

  if (container) {
    container.innerHTML = "";
  }
}


/* =========================================================
   COMPOSE SUBMIT
   ========================================================= */

async function handleComposeSubmit(
  event,
  admin
) {
  event.preventDefault();

  const recipientType =
    document.getElementById(
      "notification-recipient-type"
    )?.value;

  const recipientId =
    document.getElementById(
      "notification-recipient-id"
    )?.value;

  const notificationMode =
    document.getElementById(
      "notification-mode"
    )?.value;

  const deliveryChannels =
    document.getElementById(
      "notification-delivery"
    )?.value;

  const notificationPriority =
    document.getElementById(
      "notification-priority"
    )?.value;

  const notificationType =
    document.getElementById(
      "notification-type"
    )?.value
      ?.trim();

  const subject =
    document.getElementById(
      "notification-subject"
    )?.value
      ?.trim();

  const message =
    document.getElementById(
      "notification-message"
    )?.value
      ?.trim();

  const status =
    document.getElementById(
      "notification-compose-status"
    );

  if (!recipientId) {
    setComposeStatus(
      status,
      "Select a valid KTMS recipient from the search results.",
      "error"
    );

    return;
  }

  if (!subject) {
    setComposeStatus(
      status,
      "Subject is required.",
      "error"
    );

    return;
  }

  if (!message) {
    setComposeStatus(
      status,
      "Message is required.",
      "error"
    );

    return;
  }

  if (
    recipientType === "Admin" &&
    admin?.role !== "Game Master"
  ) {
    setComposeStatus(
      status,
      "Only the Game Master can send administrator communications.",
      "error"
    );

    return;
  }

  try {
    setComposeStatus(
      status,
      "Sending notification...",
      "info"
    );

    await sendNotification({
      recipientType,
      recipientId,
      notificationMode,
      deliveryChannels,
      notificationPriority,
      notificationType:
        notificationType || "Direct",
      subject,
      message
    });

    setComposeStatus(
      status,
      "Notification sent successfully.",
      "success"
    );

    state.recipientSearch = "";
    state.recipientResults = [];
    state.selectedRecipient = null;

    document
      .getElementById(
        "notification-compose-form"
      )
      ?.reset();

    const hidden =
      document.getElementById(
        "notification-recipient-id"
      );

    if (hidden) {
      hidden.value = "";
    }

    clearRecipientResults();

  } catch (error) {
    console.error(
      "KTMS notification send failed:",
      error
    );

    setComposeStatus(
      status,
      error?.message ||
        "Unable to send notification.",
      "error"
    );
  }
}


/* =========================================================
   NOTIFICATION ACTIONS
   ========================================================= */

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

          const notificationId =
            button.dataset
              .notificationId;

          if (!notificationId) {
            return;
          }

          try {
            button.disabled = true;

            if (action === "mark-read") {
              await markNotificationRead(
                notificationId
              );

              await refreshInbox();

              return;
            }

            if (action === "mark-unread") {
              await markNotificationUnread(
                notificationId
              );

              await refreshInbox();

              return;
            }

            if (action === "retry") {
              await retryNotification(
                notificationId
              );

              await loadNotifications(
                state.admin
              );

              return;
            }

          } catch (error) {
            console.error(
              "KTMS notification action failed:",
              error
            );

            setMessage(
              error?.message ||
                "Notification action failed.",
              "error"
            );

          } finally {
            button.disabled = false;
          }
        }
      );
    });
}


/* =========================================================
   CARD
   ========================================================= */

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
    notification.message ||
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

          <h3>
            ${escapeHtml(subject)}
          </h3>

          <div class="ktms-notification-meta">

            ${
              type
                ? `
                  <span>
                    Type:
                    ${escapeHtml(type)}
                  </span>
                `
                : ""
            }

            <span>
              Mode:
              ${escapeHtml(mode)}
            </span>

            ${
              created
                ? `
                  <span>
                    ${escapeHtml(
                      formatDate(created)
                    )}
                  </span>
                `
                : ""
            }

          </div>

        </div>

        ${
          isUnread
            ? `
              <span class="ktms-notification-badge">
                UNREAD
              </span>
            `
            : ""
        }

      </div>


      <div class="ktms-notification-card-body">

        <p>
          ${escapeHtml(body)}
        </p>

      </div>


      <div class="ktms-notification-card-details">

        ${
          context === "sent" ||
          context === "admin-oversight"
            ? `
              <span>
                Recipient:
                ${escapeHtml(
                  recipientType
                    ? `${recipientType} · `
                    : ""
                )}
                ${escapeHtml(recipient)}
              </span>
            `
            : `
              <span>
                Sender:
                ${escapeHtml(
                  senderType
                    ? `${senderType} · `
                    : ""
                )}
                ${escapeHtml(sender)}
              </span>
            `
        }

        ${
          inAppStatus
            ? `
              <span>
                In-App:
                ${escapeHtml(inAppStatus)}
              </span>
            `
            : ""
        }

        ${
          emailStatus
            ? `
              <span>
                Email:
                ${escapeHtml(emailStatus)}
              </span>
            `
            : ""
        }

      </div>


      <div class="ktms-notification-card-actions">

        ${
          context === "inbox"
            ? readStatus === "Unread"
              ? `
                <button
                  type="button"
                  class="ktms-secondary-button"
                  data-notification-action="mark-read"
                  data-notification-id="${escapeAttribute(id)}"
                >
                  MARK READ
                </button>
              `
              : `
                <button
                  type="button"
                  class="ktms-secondary-button"
                  data-notification-action="mark-unread"
                  data-notification-id="${escapeAttribute(id)}"
                >
                  MARK UNREAD
                </button>
              `
            : ""
        }

        ${
          isFailed
            ? `
              <button
                type="button"
                class="ktms-secondary-button"
                data-notification-action="retry"
                data-notification-id="${escapeAttribute(id)}"
              >
                RETRY DELIVERY
              </button>
            `
            : ""
        }

      </div>

    </article>
  `;
}


/* =========================================================
   HELPERS
   ========================================================= */

function normalizeRows(value) {
  if (Array.isArray(value)) {
    return value;
  }

  if (Array.isArray(value?.rows)) {
    return value.rows;
  }

  if (Array.isArray(value?.data)) {
    return value.data;
  }

  return [];
}


function emptyState(
  title,
  message
) {
  return `
    <div class="ktms-empty-state">

      <h3>
        ${escapeHtml(title)}
      </h3>

      <p>
        ${escapeHtml(message)}
      </p>

    </div>
  `;
}


function setMessage(
  message,
  type = "info"
) {
  const element =
    document.getElementById(
      "notifications-message"
    );

  if (!element) return;

  element.className =
    `ktms-message ${type}`;

  element.textContent =
    message;
}


function setComposeStatus(
  element,
  message,
  type = "info"
) {
  if (!element) return;

  element.className =
    `ktms-message ${type}`;

  element.textContent =
    message;
}


function formatDate(value) {
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
