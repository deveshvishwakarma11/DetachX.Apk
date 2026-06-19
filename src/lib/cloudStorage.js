import { supabase } from "./supabase";

// ── Status migration helper ───────────────────────────────────────────────────
// Old statuses → new statuses
function migrateStatus(oldStatus) {
  if (oldStatus === "still_receiving") return "unsubscribe_failed";
  if (oldStatus === "confirmed")       return "user_unsubscribed";
  if (oldStatus === "pending")         return "user_unsubscribed";
  // Already new format
  if (oldStatus === "user_unsubscribed") return "user_unsubscribed";
  if (oldStatus === "unsubscribe_failed") return "unsubscribe_failed";
  // Default
  return "user_unsubscribed";
}

// ── Unsub History ─────────────────────────────────────────────────────────────

export async function loadUnsubHistory(userEmail) {
  const { data, error } = await supabase
    .from("unsub_history")
    .select("*")
    .eq("user_email", userEmail)
    .order("action_at", { ascending: false });

  if (error) {
    console.error("[DetachX] loadUnsubHistory error:", error.message);
    return [];
  }

  return data.map((row) => ({
    domain:             row.domain,
    from:               row.from_addr,
    email:              row.email,
    subject:            row.subject   || "",
    unsubUrl:           row.unsub_url || "",
    action:             row.action,
    // ✅ Migrate old statuses on load
    verificationStatus: migrateStatus(row.verification_status || "user_unsubscribed"),
    // ✅ reportedAt = when user clicked "Yes I unsubscribed"
    reportedAt:         row.action_at || row.created_at,
    at:                 row.action_at || row.created_at,
  }));
}

export async function saveUnsubEntry(userEmail, entry) {
  const { error } = await supabase
    .from("unsub_history")
    .upsert(
      {
        user_email:          userEmail,
        domain:              entry.domain,
        from_addr:           entry.from,
        email:               entry.email,
        subject:             entry.subject  || "",
        unsub_url:           entry.unsubUrl || "",
        action:              "unsubscribed",
        // ✅ Only new statuses saved
        verification_status: migrateStatus(entry.verificationStatus || "user_unsubscribed"),
        needs_verification:  false,
        still_receiving:     entry.verificationStatus === "unsubscribe_failed",
        action_at:           entry.reportedAt || entry.at || new Date().toISOString(),
        updated_at:          new Date().toISOString(),
      },
      { onConflict: "user_email,domain" }
    );

  if (error) {
    console.error("[DetachX] saveUnsubEntry error:", error.message);
    return false;
  }
  console.log("[DetachX] saveUnsubEntry → saved:", entry.domain);
  return true;
}

export async function updateUnsubStatus(userEmail, domain, verificationStatus) {
  // ✅ Renamed from updateUnsubVerification — cleaner name
  const { error } = await supabase
    .from("unsub_history")
    .update({
      verification_status: verificationStatus,
      still_receiving:     verificationStatus === "unsubscribe_failed",
      updated_at:          new Date().toISOString(),
    })
    .eq("user_email", userEmail)
    .eq("domain", domain);

  if (error) {
    console.error("[DetachX] updateUnsubStatus error:", error.message);
    return false;
  }
  console.log("[DetachX] updateUnsubStatus →", domain, "→", verificationStatus);
  return true;
}

// ── Block History ─────────────────────────────────────────────────────────────

export async function loadBlockHistory(userEmail) {
  const { data, error } = await supabase
    .from("block_history")
    .select("*")
    .eq("user_email", userEmail)
    .order("action_at", { ascending: false });

  if (error) {
    console.error("[DetachX] loadBlockHistory error:", error.message);
    return [];
  }

  return data.map((row) => ({
    domain:      row.domain,
    from:        row.from_addr,
    email:       row.email,
    subject:     row.subject      || "",
    action:      row.action,
    filterId:    row.filter_id,
    filterEmail: row.filter_email,
    at:          row.action_at    || row.created_at,
  }));
}

export async function saveBlockEntry(userEmail, entry) {
  const { error } = await supabase
    .from("block_history")
    .upsert(
      {
        user_email:   userEmail,
        domain:       entry.domain,
        from_addr:    entry.from,
        email:        entry.email,
        subject:      entry.subject      || "",
        action:       "blocked",
        filter_id:    entry.filterId,
        filter_email: entry.filterEmail,
        action_at:    entry.at           || new Date().toISOString(),
      },
      { onConflict: "user_email,domain" }
    );

  if (error) {
    console.error("[DetachX] saveBlockEntry error:", error.message);
    return false;
  }
  console.log("[DetachX] saveBlockEntry → saved:", entry.domain);
  return true;
}

// ── Migration: localStorage → Supabase ───────────────────────────────────────
export async function migrateFromLocalStorage(userEmail) {
  let migrated = false;

  try {
    const localUnsub = JSON.parse(
      localStorage.getItem("detachx_unsub_history") || "[]"
    );
    if (localUnsub.length > 0) {
      console.log(`[DetachX] migrate: ${localUnsub.length} unsub entries`);
      for (const entry of localUnsub) {
        // ✅ Migrate old statuses during upload
        await saveUnsubEntry(userEmail, {
          ...entry,
          verificationStatus: migrateStatus(entry.verificationStatus || "user_unsubscribed"),
        });
      }
      migrated = true;
    }
  } catch (e) {
    console.error("[DetachX] migrate unsub error:", e);
  }

  try {
    const localBlock = JSON.parse(
      localStorage.getItem("detachx_block_history") || "[]"
    );
    const validBlock = localBlock.filter(
      (e) => e.filterId && typeof e.filterId === "string" && e.filterId.length > 0
    );
    if (validBlock.length > 0) {
      console.log(`[DetachX] migrate: ${validBlock.length} block entries`);
      for (const entry of validBlock) {
        await saveBlockEntry(userEmail, entry);
      }
      migrated = true;
    }
  } catch (e) {
    console.error("[DetachX] migrate block error:", e);
  }

  if (migrated) {
    localStorage.setItem("detachx_migrated", "true");
    console.log("[DetachX] migration complete");
  }
}

// ── Token refresh helpers ─────────────────────────────────────────────────────

// Check if a token is within 5 minutes of expiry or already expired
function isTokenExpiredOrExpiring(session) {
  if (!session?.expires_at) return true;
  const expiresAt  = session.expires_at * 1000; // seconds → ms
  const now        = Date.now();
  const fiveMinMs  = 5 * 60 * 1000;
  return now >= expiresAt - fiveMinMs;
}

// ✅ Get a fresh Gmail OAuth token — refresh if needed
export async function getFreshGmailToken() {
  try {
    // Ask Supabase for current session
    const { data, error } = await supabase.auth.getSession();
    if (error || !data.session) {
      console.warn("[DetachX] getFreshGmailToken: no session");
      return null;
    }

    let session = data.session;

    // If token is expired or expiring soon — refresh it
    if (isTokenExpiredOrExpiring(session)) {
      console.log("[DetachX] token expiring — refreshing session");
      const { data: refreshed, error: refreshError } =
        await supabase.auth.refreshSession();
      if (refreshError || !refreshed.session) {
        console.error("[DetachX] session refresh failed:", refreshError?.message);
        return null;
      }
      session = refreshed.session;
    }

    const token = session.provider_token;
    if (!token) {
      console.warn("[DetachX] provider_token missing from session");
      return null;
    }

    // ✅ Always update localStorage with latest token
    sessionStorage.setItem("gmail_token", token);
    console.log("[DetachX] getFreshGmailToken → token saved, expires_at:",
      new Date(session.expires_at * 1000).toLocaleTimeString());
    return token;
  } catch (err) {
    console.error("[DetachX] getFreshGmailToken error:", err);
    return null;
  }
}

// ── Migrate old statuses already in Supabase ──────────────────────────────────
// Run once to fix existing DB records
// Fix #5: Uses localStorage checkpoint to avoid re-running on every page load
export async function migrateSupabaseStatuses(userEmail) {
  // Checkpoint: if already migrated on this device, skip entirely
  const alreadyMigrated = localStorage.getItem("detachx_supabase_migrated");
  if (alreadyMigrated) {
    return;
  }

  const { data, error } = await supabase
    .from("unsub_history")
    .select("domain, verification_status")
    .eq("user_email", userEmail);

  if (error || !data) return;

  const toUpdate = data.filter((row) =>
    ["pending", "confirmed", "still_receiving"].includes(row.verification_status)
  );

  if (toUpdate.length === 0) {
    // Nothing to migrate — set checkpoint so we never query again
    localStorage.setItem("detachx_supabase_migrated", "true");
    console.log("[DetachX] migrateSupabaseStatuses: nothing to migrate — marked done");
    return;
  }

  console.log(`[DetachX] migrateSupabaseStatuses: updating ${toUpdate.length} rows`);

  for (const row of toUpdate) {
    const newStatus = migrateStatus(row.verification_status);
    await updateUnsubStatus(userEmail, row.domain, newStatus);
  }

  // Set checkpoint after successful migration
  localStorage.setItem("detachx_supabase_migrated", "true");
  console.log("[DetachX] migrateSupabaseStatuses: done");
}