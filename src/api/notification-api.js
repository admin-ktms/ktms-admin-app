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

export async function getNotificationInbox() {
  return notificationApi(
    "notification.inbox"
  );
}

export async function getNotificationSent() {
  return notificationApi(
    "notification.sent"
  );
}

export async function getAdminNotificationCommunications() {
  return notificationApi(
    "notification.adminCommunications"
  );
}

export async function getNotificationUnreadCount() {
  return notificationApi(
    "notification.unreadCount"
  );
}

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

export async function sendNotification(payload) {
  return notificationApi(
    "notification.create",
    payload
  );
}
