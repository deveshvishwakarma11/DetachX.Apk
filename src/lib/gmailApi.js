// ──────────────────────────────────────────────────────────────────────────────
// DetachX — Shared Gmail API utilities
// Extracted from ScanPage.jsx to support both the existing inbox scanner and
// the new Digital Footprint Detection Engine.
// ──────────────────────────────────────────────────────────────────────────────

export const GMAIL_TIMEOUT_MS  = 30000;  // 30 second timeout per request
export const GMAIL_MAX_RETRIES = 3;      // max retries for rate limits / timeouts

// ── Resilient Gmail API fetch ────────────────────────────────────────────────
// On 401, attempts token refresh via refreshToken callback then retries once.
// AbortController with GMAIL_TIMEOUT_MS timeout.
export async function gmailFetch(url, token, { refreshToken, timeoutMs = GMAIL_TIMEOUT_MS } = {}) {
  const execute = async (t) => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${t}` },
        signal: controller.signal,
      });
      clearTimeout(timeoutId);
      return res;
    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === "AbortError") throw new Error("REQUEST_TIMEOUT");
      throw err;
    }
  };

  let res = await execute(token);

  // On 401, refresh the token and retry once
  if (res.status === 401 && refreshToken) {
    const newToken = await refreshToken();
    if (newToken && newToken !== token) {
      localStorage.setItem("gmail_token", newToken);
      res = await execute(newToken);
    }
  }

  if (res.status === 401) throw new Error("TOKEN_EXPIRED");
  if (!res.ok) throw new Error(`API_ERROR_${res.status}`);
  return res.json();
}

// ── Wraps gmailFetch with exponential backoff + jitter for retryable errors ──
// Retries on: REQUEST_TIMEOUT, 429 (rate limit), 5xx (server errors except 501)
export async function gmailFetchWithRetry(url, token, opts = {}) {
  const { maxRetries = GMAIL_MAX_RETRIES, ...fetchOpts } = opts;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await gmailFetch(url, token, fetchOpts);
    } catch (err) {
      // TOKEN_EXPIRED is not retryable — needs user re-auth
      if (err.message === "TOKEN_EXPIRED") throw err;

      // Determine if this error is retryable
      const isRetryable =
        err.message === "REQUEST_TIMEOUT" ||
        err.message.startsWith("API_ERROR_429") ||
        (err.message.startsWith("API_ERROR_5") && err.message !== "API_ERROR_501");

      if (!isRetryable || attempt >= maxRetries) throw err;

      // Exponential backoff with jitter: ~1s, ~2.5s, ~5.5s... capped at 16s
      const baseDelay = 1000 * Math.pow(2, attempt);
      const jitter = Math.random() * 1000;
      const delay = Math.min(baseDelay + jitter, 16000);

      console.log(
        `[DetachX] Gmail API retry ${attempt + 1}/${maxRetries}`,
        `after ${Math.round(delay)}ms — ${err.message}`
      );
      await new Promise((r) => setTimeout(r, delay));
    }
  }
}

// ── Convenience: list messages with pagination ───────────────────────────────
// Returns an array of { id, threadId } objects.
// Capped at maxResults total (default 500).
export async function listMessages(token, { query, maxResults = 500, pageSize = 50, refreshToken } = {}) {
  let pageToken = null;
  const allMessages = [];

  while (allMessages.length < maxResults) {
    const params = new URLSearchParams({ maxResults: pageSize });
    if (query)     params.set("q", query);
    if (pageToken) params.set("pageToken", pageToken);

    const data = await gmailFetchWithRetry(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages?${params}`,
      token,
      { refreshToken }
    );

    if (!data.messages?.length) break;
    allMessages.push(...data.messages);
    pageToken = data.nextPageToken;

    if (!pageToken) break;
  }

  return allMessages;
}

// ── Convenience: fetch full message metadata ─────────────────────────────────
export async function getMessage(token, messageId, { format = "metadata", metadataHeaders, refreshToken } = {}) {
  let url = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${messageId}?format=${format}`;
  if (metadataHeaders?.length) {
    url += "&" + metadataHeaders.map((h) => `metadataHeaders=${encodeURIComponent(h)}`).join("&");
  }
  return gmailFetchWithRetry(url, token, { refreshToken });
}

// ── Convenience: search messages by query ────────────────────────────────────
// Combines listMessages + getMessage for each result.
// Uses batched concurrency (CHUNK_SIZE = 15) to avoid overwhelming the Gmail API
// with hundreds of simultaneous requests.
const SEARCH_CHUNK_SIZE = 15;

export async function searchMessages(token, query, { maxResults = 200, refreshToken } = {}) {
  const messages = await listMessages(token, { query, maxResults, refreshToken });
  if (!messages.length) return [];

  const details = [];
  for (let i = 0; i < messages.length; i += SEARCH_CHUNK_SIZE) {
    const chunk = messages.slice(i, i + SEARCH_CHUNK_SIZE);
    const chunkResults = await Promise.all(
      chunk.map((m) =>
        getMessage(token, m.id, {
          format: "metadata",
          metadataHeaders: ["From", "Subject", "Date", "List-Unsubscribe"],
          refreshToken,
        })
      )
    );
    details.push(...chunkResults);
  }

  return details;
}
