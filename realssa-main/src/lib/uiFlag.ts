const STORAGE_KEY = "realssa-ui";

export type UiVersion = "v1" | "v2";

export function resolveUiVersion(): UiVersion {
  if (typeof window === "undefined") return "v1";

  try {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = params.get("ui");
    if (fromQuery === "v2" || fromQuery === "new") {
      window.localStorage.setItem(STORAGE_KEY, "v2");
      return "v2";
    }
    if (fromQuery === "v1" || fromQuery === "old") {
      window.localStorage.setItem(STORAGE_KEY, "v1");
      return "v1";
    }
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "v2") return "v2";
  } catch {
    // private mode / blocked storage — stay on current UI
  }

  return "v1";
}

export function applyUiVersion(version: UiVersion = resolveUiVersion()) {
  if (typeof document === "undefined") return version;
  document.documentElement.classList.toggle("ui-v2", version === "v2");
  document.documentElement.dataset.ui = version;
  return version;
}
