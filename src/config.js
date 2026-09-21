export const CONFIG = {
  SUPABASE_URL:
    "https://gfokwfsqsttrjueqjojz.supabase.co",

  SUPABASE_PUBLISHABLE_KEY:
    "sb_publishable__dF8ANtuBA8bW4rZQ6lYXw_3N3Xzqkg",

  ADMIN_API_URL:
    "https://gfokwfsqsttrjueqjojz.supabase.co/functions/v1/ktms-admin-api",

  ADMIN_LOGIN_API_URL:
    "https://gfokwfsqsttrjueqjojz.supabase.co/functions/v1/ktms-admin-login",

  NOTIFICATION_SERVICE_URL:
    "https://gfokwfsqsttrjueqjojz.supabase.co/functions/v1/ktms-notification-service",

  APP_NAME: "KTMS Admin",

  LOGGING: {
    enabled: true,
    level: "info",
    persist: true,
    maxEntries: 200
  },

  ROUTES: {
    LOGIN: "/",
    DASHBOARD: "/dashboard"
  }
};
