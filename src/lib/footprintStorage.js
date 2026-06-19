// ──────────────────────────────────────────────────────────────────────────────
// DetachX — Footprint Storage (Supabase)
//
// CRUD operations for the Digital Footprint Discovery data:
//   discovered_accounts  — service/account records
//   evidence_messages    — supporting Gmail evidence
//
// Follows the same patterns as cloudStorage.js (unsub/block history).
// ──────────────────────────────────────────────────────────────────────────────

import { supabase } from "./supabase";

// ═══════════════════════════════════════════════════════════════════════════════
// SAVE FOOTPRINT RESULTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Save complete digital footprint scan results to Supabase.
 *
 * This upserts into discovered_accounts on (user_email, domain) so repeated
 * scans update rather than duplicate. Evidence messages are deleted and
 * re-inserted each time (CLEAR + INSERT strategy) to stay in sync.
 *
 * @param {string}   userEmail  - The authenticated user's email
 * @param {Object}   scanResult - The full result from detectDigitalFootprint()
 * @returns {Promise<boolean>}  - Whether the save succeeded
 */
export async function saveFootprintResults(userEmail, scanResult) {
  if (!userEmail || !scanResult?.services) {
    console.warn("[DetachX Footprint] saveFootprintResults: invalid input");
    return false;
  }

  const { services, scannedAt } = scanResult;
  console.log(`[DetachX Footprint] Saving ${services.length} accounts for ${userEmail}`);

  try {
    for (const service of services) {
      // ── Upsert account ──────────────────────────────────────────────────
      const { data: accountData, error: accountError } = await supabase
        .from("discovered_accounts")
        .upsert(
          {
            user_email:       userEmail,
            service_name:     service.serviceName,
            domain:           service.domain,
            account_email:    service.accountEmail || userEmail,
            category:         service.category     || "Unknown",
            confidence_score: service.confidenceScore || 0,
            risk_score:       service.riskScore    || 50,
            risk_level:       service.riskLevel    || "medium",
            risk_factors:     service.riskFactors || [],
            status:           service.status       || "active",
            first_seen:       service.firstSeen,
            last_seen:        service.lastSeen,
            evidence_count:   service.evidenceCount || 0,
            evidence_types:   service.evidenceTypes || [],
            scanned_at:       scannedAt,
          },
          {
            onConflict: "user_email,domain",
            ignoreDuplicates: false,
          }
        )
        .select("id")
        .single();

      if (accountError) {
        console.error("[DetachX Footprint] account upsert error:", accountError.message, "for", service.domain);
        continue;
      }

      if (!accountData?.id) {
        console.warn("[DetachX Footprint] no account ID returned for", service.domain);
        continue;
      }

      const accountId = accountData.id;

      // ── Save evidence messages (delete old, insert new) ──────────────────
      // First delete existing evidence for this account
      const { error: deleteError } = await supabase
        .from("evidence_messages")
        .delete()
        .eq("account_id", accountId);

      if (deleteError) {
        console.error("[DetachX Footprint] evidence delete error:", deleteError.message);
        continue;
      }

      // Then insert fresh evidence
      if (service.evidences?.length > 0) {
        const evidenceRows = service.evidences.map((ev) => ({
          account_id:    accountId,
          message_id:    ev.messageId,
          evidence_type: ev.type || "weak",
          subject:       ev.subject   || "",
          from_addr:     ev.from      || "",
          received_at:   ev.receivedAt || null,
        }));

        const { error: insertError } = await supabase
          .from("evidence_messages")
          .insert(evidenceRows);

        if (insertError) {
          console.error("[DetachX Footprint] evidence insert error:", insertError.message);
        }
      }
    }

    console.log("[DetachX Footprint] Save complete");
    return true;
  } catch (err) {
    console.error("[DetachX Footprint] saveFootprintResults error:", err);
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// LOAD FOOTPRINT RESULTS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Load all previously saved footprint accounts for a user.
 *
 * @param {string} userEmail - The authenticated user's email
 * @returns {Promise<Object[]>} Array of account objects (without evidence messages)
 */
export async function loadFootprintAccounts(userEmail) {
  if (!userEmail) return [];

  const { data, error } = await supabase
    .from("discovered_accounts")
    .select("*")
    .eq("user_email", userEmail)
    .order("confidence_score", { ascending: false });

  if (error) {
    console.error("[DetachX Footprint] loadFootprintAccounts error:", error.message);
    return [];
  }

  return data.map((row) => ({
    id:              row.id,
    userEmail:       row.user_email,
    serviceName:     row.service_name,
    domain:          row.domain,
    accountEmail:    row.account_email,
    category:        row.category,
    confidenceScore: row.confidence_score,
    riskScore:       row.risk_score,
    riskLevel:       row.risk_level,
    riskFactors:     row.risk_factors || [],
    status:          row.status,
    firstSeen:       row.first_seen,
    lastSeen:        row.last_seen,
    evidenceCount:   row.evidence_count,
    evidenceTypes:   row.evidence_types || [],
    scannedAt:       row.scanned_at,
  }));
}

// ═══════════════════════════════════════════════════════════════════════════════
// LOAD EVIDENCE FOR A SINGLE ACCOUNT
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Load evidence messages for a specific discovered account.
 *
 * @param {number} accountId - The discovered_accounts.id
 * @returns {Promise<Object[]>} Array of evidence message objects
 */
export async function loadEvidenceForAccount(accountId) {
  if (!accountId) return [];

  const { data, error } = await supabase
    .from("evidence_messages")
    .select("*")
    .eq("account_id", accountId)
    .order("received_at", { ascending: false });

  if (error) {
    console.error("[DetachX Footprint] loadEvidenceForAccount error:", error.message);
    return [];
  }

  return data.map((row) => ({
    id:           row.id,
    accountId:    row.account_id,
    messageId:    row.message_id,
    evidenceType: row.evidence_type,
    subject:      row.subject || "",
    fromAddr:     row.from_addr || "",
    snippet:      row.snippet || "",
    receivedAt:   row.received_at,
  }));
}

// ═══════════════════════════════════════════════════════════════════════════════
// GET LATEST SCAN TIMESTAMP
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get the timestamp of the most recent scan for a user.
 *
 * @param {string} userEmail
 * @returns {Promise<string|null>} ISO timestamp or null if never scanned
 */
export async function getLatestScanTime(userEmail) {
  if (!userEmail) return null;

  const { data, error } = await supabase
    .from("discovered_accounts")
    .select("scanned_at")
    .eq("user_email", userEmail)
    .order("scanned_at", { ascending: false })
    .limit(1);

  if (error || !data?.length) return null;
  return data[0].scanned_at;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DELETE FOOTPRINT ENTRY
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Delete a single discovered account (cascades to evidence_messages).
 *
 * @param {string} userEmail
 * @param {string} domain
 * @returns {Promise<boolean>}
 */
export async function deleteFootprintEntry(userEmail, domain) {
  const { error } = await supabase
    .from("discovered_accounts")
    .delete()
    .eq("user_email", userEmail)
    .eq("domain", domain);

  if (error) {
    console.error("[DetachX Footprint] deleteFootprintEntry error:", error.message);
    return false;
  }
  return true;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CHECK IF SCAN RESULTS EXIST (for displaying cached data)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Count total discovered accounts for a user.
 *
 * @param {string} userEmail
 * @returns {Promise<number>}
 */
export async function countFootprintAccounts(userEmail) {
  if (!userEmail) return 0;

  const { count, error } = await supabase
    .from("discovered_accounts")
    .select("*", { count: "exact", head: true })
    .eq("user_email", userEmail);

  if (error) {
    console.error("[DetachX Footprint] countFootprintAccounts error:", error.message);
    return 0;
  }
  return count || 0;
}
