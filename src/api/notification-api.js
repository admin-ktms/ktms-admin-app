import { supabase } from "../lib/supabase.js";
import { CONFIG } from "../config.js";

async function notificationApi(action, payload = {}) {
  const {
    data: { session },
    error: sessionError
  } = await supabase.auth.getSession();

  if (sessionError) {
    throw sessionError;
  }

  if (!session?.access_token) {
    const error = new Error(
      "Authenticated Supabase session required."
    );

    error.code = "SUPABASE_AUTH_REQUIRED";
    error.status = 401;

    throw error;
  }

  const response = await fetch(
    CONFIG.NOTIFICATION_SERVICE_URL,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization":
          `Bearer ${session.access_token}`
      },
      body: JSON.stringify({
        action,
        ...payload
      })
    }
  );

  let result;

  try {
    result = await response.json();
  } catch {
    throw new Error(
      "Notification service returned an invalid response."
    );
  }

  if (!response.ok || result?.success !== true) {
    const error = new Error(
      result?.error ||
      result?.message ||
      "Notification service request failed."
    );

    error.status = response.status;
    error.code =
      result?.code ||
      "NOTIFICATION_SERVICE_ERROR";

    throw error;
  }

  return result.data ?? result;
}


/* =========================================================
   INBOX
   ========================================================= */

export async function getNotificationInbox(
  filters = {}
) {
  return notificationApi(
    "notification.inbox",
    {
      readStatus:
        filters.readStatus &&
        filters.readStatus !== "All"
          ? filters.readStatus
          : undefined,

      notificationType:
        filters.notificationType &&
        filters.notificationType !== "All"
          ? filters.notificationType
          : undefined,

      notificationMode:
        filters.notificationMode &&
        filters.notificationMode !== "All"
          ? filters.notificationMode
          : undefined
    }
  );
}


/* =========================================================
   SENT
   ========================================================= */

export async function getNotificationSent(
  filters = {}
) {
  return notificationApi(
    "notification.sent",
    {
      readStatus:
        filters.readStatus &&
        filters.readStatus !== "All"
          ? filters.readStatus
          : undefined,

      notificationType:
        filters.notificationType &&
        filters.notificationType !== "All"
          ? filters.notificationType
          : undefined,

      notificationMode:
        filters.notificationMode &&
        filters.notificationMode !== "All"
          ? filters.notificationMode
          : undefined
    }
  );
}


/* =========================================================
   GAME MASTER ADMIN OVERSIGHT
   ========================================================= */

export async function getAdminNotificationCommunications() {
  return notificationApi(
    "notification.adminCommunications"
  );
}


/* =========================================================
   UNREAD COUNT
   ========================================================= */

export async function getNotificationUnreadCount() {
  return notificationApi(
    "notification.unreadCount"
  );
}


/* =========================================================
   RECIPIENT SEARCH
   ========================================================= */

export async function searchNotificationRecipients(
  recipientType,
  search,
  limit = 10
) {
  return notificationApi(
    "notification.searchRecipients",
    {
      recipientType,
      search,
      limit
    }
  );
}


/* =========================================================
   READ STATE
   ========================================================= */

export async function markNotificationRead(
  notificationId
) {
  return notificationApi(
    "notification.markRead",
    {
      notificationId
    }
  );
}

export async function markNotificationUnread(
  notificationId
) {
  return notificationApi(
    "notification.markUnread",
    {
      notificationId
    }
  );
}


/* =========================================================
   DELIVERY RETRY
   ========================================================= */

export async function retryNotification(
  notificationId
) {
  return notificationApi(
    "notification.retry",
    {
      notificationId
    }
  );
}


/* =========================================================
   CREATE
   ========================================================= */

export async function sendNotification(
  payload
) {
  return notificationApi(
    "notification.create",
    payload
  );
}
