const KEY = "nucleus-crm:token";

/**
 * "Remember me" stores the token in localStorage, which survives closing
 * the browser. Otherwise it goes in sessionStorage and dies with the tab.
 */
export function getToken() {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(KEY) || window.sessionStorage.getItem(KEY);
}

export function setToken(token, remember = true) {
  clearToken();
  (remember ? window.localStorage : window.sessionStorage).setItem(KEY, token);
}

export function clearToken() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(KEY);
  window.sessionStorage.removeItem(KEY);
}