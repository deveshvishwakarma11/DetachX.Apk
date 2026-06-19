// ──────────────────────────────────────────────────────────────────────────────
// DetachX — Risk Scoring Engine
//
// Computes risk scores for discovered digital footprint services.
// Factors considered:
//   - Domain reputation (known safe, known spam, unknown, disposable)
//   - Inactivity (no email evidence in 12+ / 24+ months)
//   - Category sensitivity (Finance, Shopping, Social → higher risk)
//   - Confidence (low-confidence detections → higher risk)
//   - Evidence volume (more evidence = more exposure data)
//
// Risk thresholds  → Low: 0-30  |  Medium: 31-65  |  High: 66-100
// ──────────────────────────────────────────────────────────────────────────────

// ═══════════════════════════════════════════════════════════════════════════════
// DOMAIN REPUTATION LISTS
// ═══════════════════════════════════════════════════════════════════════════════

// Domains considered safe/reputable → decreases risk score
const SAFE_DOMAINS = new Set([
  "google.com", "accounts.google.com", "mail.google.com", "drive.google.com",
  "microsoft.com", "account.microsoft.com",
  "apple.com", "icloud.com",
  "github.com", "gitlab.com", "bitbucket.org",
  "aws.amazon.com", "aws.com", "cloudflare.com",
  "supabase.com", "vercel.com", "netlify.com", "render.com",
  "linkedin.com", "e.linkedin.com",
  "adobe.com", "figma.com", "notion.so", "notion.com",
  "slack.com", "zoom.us", "zoom.com",
  "dropbox.com", "atlassian.com",
  "stripe.com", "paypal.com",
  "coursera.org", "udemy.com", "edx.org", "khanacademy.org",
  "netflix.com", "spotify.com", "youtube.com",
  "reddit.com", "medium.com", "substack.com",
  "discord.com", "discord.gg", "twitch.tv",
  "uber.com", "airbnb.com", "booking.com",
]);

// Domains known to be risky (spam, temporary email, data brokers)
const RISKY_DOMAINS = new Set([
  // Temporary / disposable email domains (if user received email from these)
  "mailinator.com", "guerrillamail.com", "tempmail.com",
  "throwaway.email", "yopmail.com", "sharklasers.com",
  // Known data broker / people-search sites
  "whitepages.com", "spokeo.com", "beenverified.com",
  "pipl.com", "intelius.com", "peekyou.com",
  // Known spam domains
  "spam.com", "example.com",
]);

// Categories considered sensitive (higher risk)
const SENSITIVE_CATEGORIES = new Set([
  "Finance",
  "Shopping",
  "Social Media",
  "Job Portals",
]);

// ═══════════════════════════════════════════════════════════════════════════════
// COMPUTE RISK FOR A SINGLE SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Compute risk score and factors for a single discovered service.
 *
 * @param {Object} service        - Service object from detection engine
 * @param {Object} [options]
 * @param {number} [options.now]  - Reference timestamp (ms). Defaults to Date.now()
 *
 * @returns {Object} {
 *   riskScore:   number (0-100),
 *   riskLevel:   "low" | "medium" | "high",
 *   riskFactors: string[],
 *   status:      "active" | "inactive" | "dormant"
 * }
 */
export function computeServiceRisk(service, { now = Date.now() } = {}) {
  const factors = [];
  let score = 10; // Base score: 10 (lowest possible)
  let computedStatus = "active";

  const domain = service.domain?.toLowerCase() || "";

  // ── 1. Domain reputation ──────────────────────────────────────────────────
  if (SAFE_DOMAINS.has(domain)) {
    score -= 15; // Known safe → reduce risk
  } else if (RISKY_DOMAINS.has(domain)) {
    score += 35; // Known risky → major increase
    factors.push("Suspicious domain");
  } else {
    score += 8;  // Unknown domain → slight increase
    factors.push("Unknown service");
  }

  // ── 2. Inactivity ─────────────────────────────────────────────────────────
  if (service.lastSeen) {
    const lastSeen = new Date(service.lastSeen).getTime();
    const monthsSinceLastActivity = (now - lastSeen) / (1000 * 60 * 60 * 24 * 30.44);

    if (monthsSinceLastActivity > 24) {
      score += 35;
      factors.push("No activity in over 2 years");
      computedStatus = "dormant";
    } else if (monthsSinceLastActivity > 12) {
      score += 25;
      factors.push("No activity in over a year");
      computedStatus = "inactive";
    } else if (monthsSinceLastActivity > 6) {
      score += 10;
      computedStatus = "active";
    } else {
      computedStatus = "active";
    }
  } else {
    // No date information → assume old / unknown
    score += 15;
    factors.push("Unknown activity date");
    computedStatus = "dormant";
  }

  // ── 3. Category sensitivity ───────────────────────────────────────────────
  if (SENSITIVE_CATEGORIES.has(service.category)) {
    score += 15;
    factors.push(`${service.category} service — may store payment or personal data`);
  }

  // ── 4. Low confidence ─────────────────────────────────────────────────────
  if (service.confidenceScore < 40) {
    score += 10;
    factors.push("Low detection confidence");
  }

  // ── 5. Evidence volume (more emails = more data exposure) ─────────────────
  if (service.evidenceCount >= 10) {
    score += 5;
    factors.push("Extensive email history — more data exposure");
  } else if (service.evidenceCount >= 5) {
    score += 3;
  }

  // ── 6. Evidence type: security alerts → higher concern ────────────────────
  if (service.evidenceTypes?.includes("security")) {
    score += 5;
    factors.push("Security alerts detected — monitor this account");
  }

  // ── Clamp and classify ────────────────────────────────────────────────────
  score = Math.max(0, Math.min(100, Math.round(score)));

  let riskLevel;
  if (score <= 30)            riskLevel = "low";
  else if (score <= 65)       riskLevel = "medium";
  else                        riskLevel = "high";

  // Deduplicate factors (keep first occurrence)
  const uniqueFactors = [];
  const seen = new Set();
  for (const f of factors) {
    if (!seen.has(f)) { seen.add(f); uniqueFactors.push(f); }
  }

  return { riskScore: score, riskLevel, riskFactors: uniqueFactors, status: computedStatus };
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPUTE RISK FOR ALL SERVICES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Enrich an array of services with risk scores.
 * Mutates services in-place and returns them.
 *
 * @param {Object[]} services - Array of service objects from detection engine
 * @returns {Object[]} services with riskScore, riskLevel, riskFactors, and status added
 */
export function computeAllRisks(services) {
  const now = Date.now();

  for (const service of services) {
    const risk = computeServiceRisk(service, { now });
    service.riskScore   = risk.riskScore;
    service.riskLevel   = risk.riskLevel;
    service.riskFactors = risk.riskFactors;
    service.status      = service.status || risk.status || "active";
  }

  return services;
}

// ═══════════════════════════════════════════════════════════════════════════════
// RISK SUMMARY STATISTICS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Compute risk summary stats from an array of scored services.
 *
 * @param {Object[]} services - Services with riskScore and riskLevel
 * @returns {Object} { low, medium, high, averageRisk, highestRisk }
 */
export function computeRiskSummary(services) {
  const counts = { low: 0, medium: 0, high: 0 };
  let totalScore = 0;
  let highestRisk = null;

  for (const s of services) {
    counts[s.riskLevel || "medium"]++;
    totalScore += s.riskScore || 50;

    if (!highestRisk || (s.riskScore || 0) > (highestRisk.riskScore || 0)) {
      highestRisk = s;
    }
  }

  return {
    ...counts,
    total:          services.length,
    averageRisk:    services.length > 0 ? Math.round(totalScore / services.length) : 0,
    highestRiskService: highestRisk,
  };
}
