// ──────────────────────────────────────────────────────────────────────────────
// DetachX — AI Insights Engine
//
// Generates human-readable, personalized insights from detected digital
// footprint data. This is entirely rule-based — no LLM dependency.
//
// Each insight has:
//   type:     "stat" | "warning" | "tip" | "summary"
//   icon:     emoji representing the insight
//   title:    short headline
//   message:  full human-readable sentence(s)
//   priority: 0-10 (higher = more important to show first)
// ──────────────────────────────────────────────────────────────────────────────

// ═══════════════════════════════════════════════════════════════════════════════
// INSIGHT GENERATORS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate all insights from discovered services.
 *
 * @param {Object[]} services - Array of service objects (with risk scoring applied)
 * @returns {Object[]} Array of insight objects
 */
export function generateInsights(services) {
  const insights = [];

  if (!services || services.length === 0) {
    insights.push({
      type: "summary",
      icon: "🔍",
      title: "No accounts discovered yet",
      message: "Run a scan to discover where your email has been used across the web.",
      priority: 0,
    });
    return insights;
  }

  // ── Category breakdown insight ──────────────────────────────────────────
  const categoryCounts = {};
  for (const s of services) {
    const cat = s.category || "Unknown";
    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
  }

  const sortedCategories = Object.entries(categoryCounts)
    .sort((a, b) => b[1] - a[1]);

  const topCategory = sortedCategories[0];
  if (topCategory) {
    const pct = Math.round((topCategory[1] / services.length) * 100);
    insights.push({
      type: "stat",
      icon: "📊",
      title: `${topCategory[0]} dominates your footprint`,
      message: `You have ${topCategory[1]} ${topCategory[0].toLowerCase()} accounts — ${pct}% of your total digital footprint.`,
      priority: 5,
    });
  }

  // ── Largest category insights ───────────────────────────────────────────
  const largeCategories = sortedCategories.filter(([, count]) => count >= 5);
  for (const [cat, count] of largeCategories.slice(0, 3)) {
    insights.push({
      type: "stat",
      icon: cat === "Shopping"     ? "🛒" :
            cat === "Social Media" ? "👥" :
            cat === "Finance"      ? "💰" :
            cat === "Education"    ? "📚" :
            cat === "Developer Tools" ? "🛠️" :
            cat === "AI Tools"     ? "🤖" :
            cat === "Entertainment" ? "🎬" :
            cat === "Job Portals"  ? "💼" :
            cat === "Travel"       ? "✈️" : "📋",
      title: `${count} ${cat} accounts`,
      message: `You have ${count} ${cat.toLowerCase()} accounts linked to this email.`,
      priority: 4,
    });
  }

  // ── Forgotten accounts insight ──────────────────────────────────────────
  const now = Date.now();
  const twelveMonthsMs = 12 * 30.44 * 24 * 60 * 60 * 1000;
  const twentyFourMonthsMs = 24 * 30.44 * 24 * 60 * 60 * 1000;

  const forgottenAccounts = services.filter((s) => {
    if (!s.lastSeen) return true;
    const age = now - new Date(s.lastSeen).getTime();
    return age > twelveMonthsMs;
  });

  if (forgottenAccounts.length > 0) {
    const veryOld = forgottenAccounts.filter((s) => {
      if (!s.lastSeen) return false;
      return now - new Date(s.lastSeen).getTime() > twentyFourMonthsMs;
    });

    let message;
    if (veryOld.length > 0) {
      message = `${forgottenAccounts.length} accounts show no activity in over a year, including ${veryOld.length} with no activity in over 2 years. These may be completely forgotten.`;
    } else {
      message = `${forgottenAccounts.length} accounts show no activity in over a year. Consider reviewing whether you still need them.`;
    }

    insights.push({
      type: "warning",
      icon: "⏰",
      title: `${forgottenAccounts.length} forgotten accounts`,
      message,
      priority: 8,
    });
  }

  // ── High risk insight ───────────────────────────────────────────────────
  const highRisk = services.filter((s) => s.riskLevel === "high");
  if (highRisk.length > 0) {
    const riskServiceNames = highRisk.map((s) => s.serviceName).join(", ");
    insights.push({
      type: "warning",
      icon: "⚠️",
      title: `${highRisk.length} high-risk ${highRisk.length === 1 ? "service" : "services"}`,
      message: `${highRisk.length} ${highRisk.length === 1 ? "service has" : "services have"} been flagged as high risk: ${riskServiceNames}. Review these accounts and consider reducing exposure.`,
      priority: 10,
    });
  }

  // ── Shopping exposure insight ───────────────────────────────────────────
  const shoppingCount = categoryCounts["Shopping"] || 0;
  if (shoppingCount >= 5) {
    insights.push({
      type: "tip",
      icon: "🛒",
      title: `You have ${shoppingCount} shopping accounts`,
      message: `Shopping accounts often store payment info and addresses. Review ${shoppingCount} shopping accounts and delete unused ones.`,
      priority: 7,
    });
  }

  // ── Finance exposure insight ────────────────────────────────────────────
  const financeCount = categoryCounts["Finance"] || 0;
  if (financeCount >= 3) {
    insights.push({
      type: "warning",
      icon: "💰",
      title: `${financeCount} financial accounts detected`,
      message: `You have ${financeCount} financial or payment accounts. Ensure each has strong, unique passwords and 2FA enabled.`,
      priority: 9,
    });
  }

  // ── Social media sprawl ─────────────────────────────────────────────────
  const socialCount = categoryCounts["Social Media"] || 0;
  if (socialCount >= 5) {
    insights.push({
      type: "tip",
      icon: "👥",
      title: "Social media sprawl",
      message: `You have ${socialCount} social media accounts. Each one stores personal data. Consider deactivating unused profiles.`,
      priority: 6,
    });
  }

  // ── Data exposure summary ───────────────────────────────────────────────
  const sensitiveServices = services.filter(
    (s) => s.riskFactors?.some(
      (f) => f.includes("personal data") || f.includes("payment")
    )
  );
  if (sensitiveServices.length > 0) {
    insights.push({
      type: "summary",
      icon: "🔐",
      title: `${sensitiveServices.length} services may store your personal data`,
      message: `${sensitiveServices.length} detected services handle potentially sensitive data (payment info, personal details, or identity documents). Review their privacy policies.`,
      priority: 8,
    });
  }

  // ── Total accounts summary ──────────────────────────────────────────────
  insights.push({
    type: "summary",
    icon: "📱",
    title: `${services.length} total accounts discovered`,
    message: `Based on your Gmail history, DetachX found evidence of ${services.length} online services associated with your email address. This is a partial view — the actual number may be higher.`,
    priority: 3,
  });

  // ── Sort by priority (highest first) ─────────────────────────────────────
  insights.sort((a, b) => b.priority - a.priority);

  return insights;
}
