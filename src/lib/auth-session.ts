const TOKEN_KEY = "iqx-intelligence-token";

export function getStoredSessionToken() {
  return window.localStorage.getItem(TOKEN_KEY);
}

export function storeSessionToken(token: string) {
  window.localStorage.setItem(TOKEN_KEY, token);
}

export function clearStoredSessionToken() {
  window.localStorage.removeItem(TOKEN_KEY);
}
