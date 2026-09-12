const routes = {
  "/dashboard": "dashboard",
  "/tournaments": "tournaments",
  "/registrations": "registrations",
  "/players": "players",
  "/payments": "payments",
  "/matchdays": "matchdays",
  "/fixtures": "fixtures",
  "/results": "results",
  "/standings": "standings",
  "/progression": "progression",
  "/awards": "awards",
  "/notifications": "notifications",
  "/support": "support",
  "/operations": "operations",
  "/audit": "audit",
  "/administrators": "administrators"
};

export function getCurrentRoute() {
  const path = window.location.pathname.replace(/\/+$/, "") || "/dashboard";
  return routes[path] || "dashboard";
}

export function navigate(path) {
  window.history.pushState({}, "", path);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

export function startRouter(onRouteChange) {
  window.addEventListener("popstate", onRouteChange);
  onRouteChange();
}