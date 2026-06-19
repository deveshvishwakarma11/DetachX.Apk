// ──────────────────────────────────────────────────────────────────────────────
// DetachX — Digital Footprint Detection Engine
//
// Phase 4 Step 1: Detect online accounts/services from Gmail evidence.
//
// This is a standalone module. It does NOT depend on ScanPage, ResultsPage,
// or any existing UI code. It only depends on the shared gmailApi.js utility.
//
// Future phases will build on this: risk scoring, forgotten account detection,
// AI insights, account deletion assistant, and a dedicated privacy dashboard.
// ──────────────────────────────────────────────────────────────────────────────

import { searchMessages } from "./gmailApi";

// ═══════════════════════════════════════════════════════════════════════════════
// CATEGORY DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════

export const CATEGORIES = [
  "Developer Tools",
  "Education",
  "Social Media",
  "Shopping",
  "Finance",
  "Productivity",
  "Entertainment",
  "AI Tools",
  "Job Portals",
  "Travel",
  "Gaming",
  "Cloud Services",
  "Food",
  "Business",
  "Unknown",
] ;

// ═══════════════════════════════════════════════════════════════════════════════
// EVIDENCE TYPE DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════════

export const EVIDENCE_TYPES = {
  ACCOUNT_CREATION: "account_creation",
  VERIFICATION:     "verification",
  SECURITY:         "security",
  PURCHASE:         "purchase",
  WEAK:             "weak",
};

// ═══════════════════════════════════════════════════════════════════════════════
// DETECTION PATTERNS
//
// Each pattern set defines:
//   type        — evidence type for grouping
//   baseScore   — confidence if this pattern matches (0-100)
//   patterns    — array of regex patterns to test against email subject
//
// The engine tests subject lines from most-specific to most-general.
// The highest-matching pattern determines the evidence type and base score.
// ═══════════════════════════════════════════════════════════════════════════════

const DETECTION_PATTERNS = [
  // ── Account Creation (High confidence) ──────────────────────────────────────
  {
    type:      EVIDENCE_TYPES.ACCOUNT_CREATION,
    baseScore: 95,
    patterns: [
      /^welcome to\b/i,
      /^welcome!\s*$/i,
      /^welcome aboard/i,
      /^thanks? (?:you )?for (?:signing up|joining|registering)/i,
      /^thank you for (?:signing up|joining|registering)/i,
      /^your account (?:has been )?created/i,
      /^account created/i,
      /^activate your account/i,
      /^activation (?:instructions|link|required)/i,
      /^registration successful/i,
      /^successfully registered/i,
      /^you're (?:in|all set)/i,
      /^let['’]s get started/i,
      /^complete your registration/i,
      /^welcome to the community/i,
      /^get started with/i,
      /^your new account/i,
      /^account (?:activation|confirmation)/i,
    ],
  },

  // ── Email Verification (Medium-high confidence) ─────────────────────────────
  {
    type:      EVIDENCE_TYPES.VERIFICATION,
    baseScore: 75,
    patterns: [
      /^verify your email/i,
      /^email verification/i,
      /^confirm your email/i,
      /^confirm your (?:account|registration)/i,
      /^please verify/i,
      /^verification (?:code|required|link|email)/i,
      /^confirm your email address/i,
      /^verify your email address/i,
      /^email address verification/i,
      /^please confirm your/i,
      /^one-time (?:code|password|pin)/i,
      /^(?:your )?verification code/i,
      /^confirm your account/i,
      /^account verification/i,
    ],
  },

  // ── Security & Login Alerts (Medium confidence) ─────────────────────────────
  {
    type:      EVIDENCE_TYPES.SECURITY,
    baseScore: 55,
    patterns: [
      /^new sign.in/i,
      /^new login/i,
      /^new device/i,
      /^security alert/i,
      /^security notice/i,
      /^unusual sign.in/i,
      /^suspicious (?:login|sign.in|activity)/i,
      /^your password (?:was )?(?:changed|updated|reset)/i,
      /^password (?:changed|updated|reset)/i,
      /^account recovery/i,
      /^two.factor (?:auth|authentication)/i,
      /^2.factor (?:auth|authentication)/i,
      /^2fa (?:enabled|disabled|setup)/i,
      /^recovery email/i,
      /^account (?:accessed|logged into)/i,
      /^we detected a new/i,
    ],
  },

  // ── Purchase / Subscription Confirmation (Medium-low confidence) ─────────────
  {
    type:      EVIDENCE_TYPES.PURCHASE,
    baseScore: 45,
    patterns: [
      /^order confirmation/i,
      /^payment received/i,
      /^subscription confirmed/i,
      /^purchase confirmation/i,
      /^your subscription/i,
      /^receipt from/i,
      /^your receipt/i,
      /^payment confirmation/i,
      /^invoice (?:from|for)/i,
      /^thanks for (?:your|the) (?:purchase|order|payment)/i,
    ],
  },
];

// ═══════════════════════════════════════════════════════════════════════════════
// SERVICE NORMALIZATION MAP
//
// Maps known email sender domains to human-readable service names and
// categories. For unknown domains, the engine attempts to extract a name
// from the "From" header display name.
//
// This grows over time. The engine gracefully handles unknown services by
// falling back to the domain name.
// ═══════════════════════════════════════════════════════════════════════════════

const SERVICE_NORMALIZATION = {
  // ── Developer Tools ──────────────────────────────────────────────────────────
  "github.com":                { name: "GitHub",          category: "Developer Tools" },
  "gitlab.com":                { name: "GitLab",          category: "Developer Tools" },
  "bitbucket.org":             { name: "Bitbucket",       category: "Developer Tools" },
  "figma.com":                 { name: "Figma",           category: "Developer Tools" },
  "linear.app":                { name: "Linear",          category: "Developer Tools" },
  "vercel.com":                { name: "Vercel",          category: "Developer Tools" },
  "netlify.com":               { name: "Netlify",         category: "Developer Tools" },
  "render.com":                { name: "Render",          category: "Developer Tools" },
  "mongodb.com":               { name: "MongoDB",         category: "Developer Tools" },
  "supabase.com":              { name: "Supabase",        category: "Developer Tools" },
  "sentry.io":                 { name: "Sentry",          category: "Developer Tools" },
  "datadoghq.com":             { name: "Datadog",         category: "Developer Tools" },
  "datadog.com":               { name: "Datadog",         category: "Developer Tools" },
  "newrelic.com":              { name: "New Relic",       category: "Developer Tools" },
  "docker.com":                { name: "Docker",          category: "Developer Tools" },
  "hashnode.com":              { name: "Hashnode",        category: "Developer Tools" },
  "dev.to":                    { name: "Dev.to",          category: "Developer Tools" },
  "stackoverflow.com":         { name: "Stack Overflow",  category: "Developer Tools" },
  "stackoverflow.email":       { name: "Stack Overflow",  category: "Developer Tools" },
  "producthunt.com":           { name: "Product Hunt",    category: "Developer Tools" },
  "indiehackers.com":          { name: "Indie Hackers",   category: "Developer Tools" },
  "npmjs.com":                 { name: "npm",             category: "Developer Tools" },
  "pypi.org":                  { name: "PyPI",            category: "Developer Tools" },
  "leetcode.com":              { name: "LeetCode",        category: "Developer Tools" },
  "codeforces.com":            { name: "Codeforces",      category: "Developer Tools" },
  "codechef.com":              { name: "CodeChef",        category: "Developer Tools" },
  "hackerrank.com":            { name: "HackerRank",      category: "Developer Tools" },
  "atlassian.com":             { name: "Atlassian",       category: "Developer Tools" },
  "jira.com":                  { name: "Jira",            category: "Developer Tools" },
  "jetbrains.com":             { name: "JetBrains",       category: "Developer Tools" },
  "sourcetree.com":            { name: "SourceTree",      category: "Developer Tools" },
  "postman.com":               { name: "Postman",         category: "Developer Tools" },
  "insomnia.rest":             { name: "Insomnia",        category: "Developer Tools" },
  "grafana.com":               { name: "Grafana",         category: "Developer Tools" },
  "digitalocean.com":          { name: "DigitalOcean",    category: "Developer Tools" },
  "fly.io":                    { name: "Fly.io",          category: "Developer Tools" },
  "railway.app":               { name: "Railway",         category: "Developer Tools" },
  "planetscale.com":           { name: "PlanetScale",     category: "Developer Tools" },
  "neon.tech":                 { name: "Neon",            category: "Developer Tools" },
  "cloudflare.com":            { name: "Cloudflare",      category: "Developer Tools" },
  "replit.com":                { name: "Replit",          category: "Developer Tools" },
  "codepen.io":                { name: "CodePen",         category: "Developer Tools" },
  "codesandbox.io":            { name: "CodeSandbox",     category: "Developer Tools" },
  "stackblitz.com":            { name: "StackBlitz",      category: "Developer Tools" },

  // ── Cloud Services ──────────────────────────────────────────────────────────
  "aws.amazon.com":            { name: "AWS",             category: "Cloud Services" },
  "aws.com":                   { name: "AWS",             category: "Cloud Services" },
  "amazonaws.com":             { name: "AWS",             category: "Cloud Services" },
  "heroku.com":                { name: "Heroku",          category: "Cloud Services" },
  "google.com":                { name: "Google",          category: "Cloud Services" },
  "accounts.google.com":       { name: "Google",          category: "Cloud Services" },
  "mail.google.com":           { name: "Gmail",           category: "Cloud Services" },
  "drive.google.com":          { name: "Google Drive",    category: "Cloud Services" },
  "microsoft.com":             { name: "Microsoft",       category: "Cloud Services" },
  "account.microsoft.com":     { name: "Microsoft",       category: "Cloud Services" },
  "apple.com":                 { name: "Apple",           category: "Cloud Services" },
  "icloud.com":                { name: "iCloud",          category: "Cloud Services" },
  "dropbox.com":               { name: "Dropbox",         category: "Cloud Services" },
  "firebase.google.com":       { name: "Firebase",        category: "Cloud Services" },

  // ── Social Media ────────────────────────────────────────────────────────────
  "linkedin.com":              { name: "LinkedIn",        category: "Social Media" },
  "e.linkedin.com":            { name: "LinkedIn",        category: "Social Media" },
  "twitter.com":               { name: "Twitter / X",     category: "Social Media" },
  "x.com":                     { name: "X / Twitter",     category: "Social Media" },
  "facebook.com":              { name: "Facebook",        category: "Social Media" },
  "fb.com":                    { name: "Facebook",        category: "Social Media" },
  "instagram.com":             { name: "Instagram",       category: "Social Media" },
  "threads.net":               { name: "Threads",         category: "Social Media" },
  "reddit.com":                { name: "Reddit",          category: "Social Media" },
  "medium.com":                { name: "Medium",          category: "Social Media" },
  "substack.com":              { name: "Substack",        category: "Social Media" },
  "telegram.org":              { name: "Telegram",        category: "Social Media" },
  "whatsapp.com":              { name: "WhatsApp",        category: "Social Media" },
  "pinterest.com":             { name: "Pinterest",       category: "Social Media" },
  "tumblr.com":                { name: "Tumblr",          category: "Social Media" },
  "snapchat.com":              { name: "Snapchat",        category: "Social Media" },
  "tiktok.com":                { name: "TikTok",          category: "Social Media" },
  "behance.net":               { name: "Behance",         category: "Social Media" },
  "dribbble.com":              { name: "Dribbble",        category: "Social Media" },
  "mastodon.social":           { name: "Mastodon",        category: "Social Media" },
  "quora.com":                 { name: "Quora",           category: "Social Media" },

  // ── Education ───────────────────────────────────────────────────────────────
  "coursera.org":              { name: "Coursera",        category: "Education" },
  "udemy.com":                 { name: "Udemy",           category: "Education" },
  "udacity.com":               { name: "Udacity",         category: "Education" },
  "edx.org":                   { name: "edX",             category: "Education" },
  "khanacademy.org":           { name: "Khan Academy",    category: "Education" },
  "duolingo.com":              { name: "Duolingo",        category: "Education" },
  "brilliant.org":             { name: "Brilliant",       category: "Education" },
  "skillshare.com":            { name: "Skillshare",      category: "Education" },
  "pluralsight.com":           { name: "Pluralsight",     category: "Education" },
  "geeksforgeeks.org":         { name: "GeeksforGeeks",   category: "Education" },
  "w3schools.com":             { name: "W3Schools",       category: "Education" },
  "freecodecamp.org":          { name: "freeCodeCamp",    category: "Education" },
  "codecademy.com":            { name: "Codecademy",      category: "Education" },
  "byjus.com":                 { name: "BYJU'S",          category: "Education" },
  "unacademy.com":             { name: "Unacademy",       category: "Education" },

  // ── Shopping ────────────────────────────────────────────────────────────────
  "amazon.com":                { name: "Amazon",          category: "Shopping" },
  "amazon.in":                 { name: "Amazon India",    category: "Shopping" },
  "amazon.co.uk":              { name: "Amazon UK",       category: "Shopping" },
  "flipkart.com":              { name: "Flipkart",        category: "Shopping" },
  "myntra.com":                { name: "Myntra",          category: "Shopping" },
  "nykaa.com":                 { name: "Nykaa",           category: "Shopping" },
  "meesho.com":                { name: "Meesho",          category: "Shopping" },
  "ajio.com":                  { name: "AJIO",            category: "Shopping" },
  "shopify.com":               { name: "Shopify",         category: "Shopping" },
  "ebay.com":                  { name: "eBay",            category: "Shopping" },
  "etsy.com":                  { name: "Etsy",            category: "Shopping" },
  "walmart.com":               { name: "Walmart",         category: "Shopping" },
  "target.com":                { name: "Target",          category: "Shopping" },
  "bestbuy.com":               { name: "Best Buy",        category: "Shopping" },
  "aliexpress.com":            { name: "AliExpress",      category: "Shopping" },
  "alibaba.com":               { name: "Alibaba",         category: "Shopping" },
  "shein.com":                 { name: "SHEIN",           category: "Shopping" },
  "zara.com":                  { name: "Zara",            category: "Shopping" },
  "hnimarket.com":             { name: "H&M",             category: "Shopping" },

  // ── Finance ─────────────────────────────────────────────────────────────────
  "paypal.com":                { name: "PayPal",          category: "Finance" },
  "stripe.com":                { name: "Stripe",          category: "Finance" },
  "razorpay.com":              { name: "Razorpay",        category: "Finance" },
  "phonepe.com":               { name: "PhonePe",         category: "Finance" },
  "paytm.com":                 { name: "Paytm",           category: "Finance" },
  "gpay.com":                  { name: "Google Pay",      category: "Finance" },
  "venmo.com":                 { name: "Venmo",           category: "Finance" },
  "square.com":                { name: "Square",          category: "Finance" },
  "coinbase.com":              { name: "Coinbase",        category: "Finance" },
  "binance.com":               { name: "Binance",         category: "Finance" },
  "coindcx.com":               { name: "CoinDCX",         category: "Finance" },
  "wazirx.com":                { name: "WazirX",          category: "Finance" },
  "bybit.com":                 { name: "Bybit",           category: "Finance" },
  "kraken.com":                { name: "Kraken",          category: "Finance" },
  "zerodha.com":               { name: "Zerodha",         category: "Finance" },
  "groww.in":                  { name: "Groww",           category: "Finance" },
  "angelone.in":               { name: "Angel One",       category: "Finance" },
  "upstox.com":                { name: "Upstox",          category: "Finance" },
  "hdfcbank.com":              { name: "HDFC Bank",       category: "Finance" },
  "icicibank.com":             { name: "ICICI Bank",      category: "Finance" },
  "sbicollect.com":            { name: "SBI",             category: "Finance" },
  "kotak.com":                 { name: "Kotak Mahindra",  category: "Finance" },
  "axisbank.com":              { name: "Axis Bank",       category: "Finance" },
  "cred.club":                 { name: "CRED",            category: "Finance" },
  "wealthy.in":                { name: "Wealthy",         category: "Finance" },

  // ── Productivity ────────────────────────────────────────────────────────────
  "notion.so":                 { name: "Notion",          category: "Productivity" },
  "notion.com":                { name: "Notion",          category: "Productivity" },
  "canva.com":                 { name: "Canva",           category: "Productivity" },
  "miro.com":                  { name: "Miro",            category: "Productivity" },
  "loom.com":                  { name: "Loom",            category: "Productivity" },
  "calendly.com":              { name: "Calendly",        category: "Productivity" },
  "typeform.com":              { name: "Typeform",        category: "Productivity" },
  "trello.com":                { name: "Trello",          category: "Productivity" },
  "asana.com":                 { name: "Asana",           category: "Productivity" },
  "clickup.com":               { name: "ClickUp",         category: "Productivity" },
  "notion.com":                { name: "Notion",          category: "Productivity" },
  "evernote.com":              { name: "Evernote",        category: "Productivity" },
  "todoist.com":               { name: "Todoist",         category: "Productivity" },
  "slack.com":                 { name: "Slack",           category: "Productivity" },
  "zoom.us":                   { name: "Zoom",            category: "Productivity" },
  "zoom.com":                  { name: "Zoom",            category: "Productivity" },
  "teams.microsoft.com":       { name: "Microsoft Teams", category: "Productivity" },
  "outlook.com":               { name: "Outlook",         category: "Productivity" },
  "adobe.com":                 { name: "Adobe",           category: "Productivity" },
  "adobesign.com":             { name: "Adobe Sign",      category: "Productivity" },
  "docusign.com":              { name: "DocuSign",        category: "Productivity" },
  "hellosign.com":             { name: "HelloSign",       category: "Productivity" },
  "zapier.com":                { name: "Zapier",          category: "Productivity" },
  "make.com":                  { name: "Make",            category: "Productivity" },
  "ifttt.com":                 { name: "IFTTT",           category: "Productivity" },

  // ── Entertainment ───────────────────────────────────────────────────────────
  "netflix.com":               { name: "Netflix",         category: "Entertainment" },
  "hulu.com":                  { name: "Hulu",            category: "Entertainment" },
  "disneyplus.com":            { name: "Disney+",         category: "Entertainment" },
  "hbomax.com":                { name: "HBO Max",         category: "Entertainment" },
  "max.com":                   { name: "Max",             category: "Entertainment" },
  "hotstar.com":               { name: "Disney+ Hotstar", category: "Entertainment" },
  "primevideo.com":            { name: "Amazon Prime",    category: "Entertainment" },
  "spotify.com":               { name: "Spotify",         category: "Entertainment" },
  "pandora.com":               { name: "Pandora",         category: "Entertainment" },
  "applemusic.com":            { name: "Apple Music",     category: "Entertainment" },
  "youtube.com":               { name: "YouTube",         category: "Entertainment" },
  "vimeo.com":                 { name: "Vimeo",           category: "Entertainment" },
  "soundcloud.com":            { name: "SoundCloud",      category: "Entertainment" },
  "applemusic.apple.com":      { name: "Apple Music",     category: "Entertainment" },

  // ── AI Tools ────────────────────────────────────────────────────────────────
  "openai.com":                { name: "OpenAI",          category: "AI Tools" },
  "chat.openai.com":           { name: "ChatGPT",         category: "AI Tools" },
  "chatgpt.com":               { name: "ChatGPT",         category: "AI Tools" },
  "anthropic.com":             { name: "Anthropic",       category: "AI Tools" },
  "claude.ai":                 { name: "Claude",          category: "AI Tools" },
  "perplexity.ai":             { name: "Perplexity",      category: "AI Tools" },
  "copilot.microsoft.com":     { name: "Copilot",         category: "AI Tools" },
  "gemini.google.com":         { name: "Google Gemini",   category: "AI Tools" },
  "midjourney.com":            { name: "Midjourney",      category: "AI Tools" },
  "huggingface.co":            { name: "Hugging Face",    category: "AI Tools" },
  "stability.ai":              { name: "Stability AI",    category: "AI Tools" },
  "runwayml.com":              { name: "Runway",          category: "AI Tools" },

  // ── Job Portals ─────────────────────────────────────────────────────────────
  "naukri.com":                { name: "Naukri",          category: "Job Portals" },
  "instahyre.com":             { name: "Instahyre",       category: "Job Portals" },
  "cutshort.com":              { name: "Cutshort",        category: "Job Portals" },
  "wellfound.com":             { name: "Wellfound",       category: "Job Portals" },
  "angel.co":                  { name: "AngelList",       category: "Job Portals" },
  "linkedin.com":              { name: "LinkedIn",        category: "Job Portals" },
  "glassdoor.com":             { name: "Glassdoor",       category: "Job Portals" },
  "indeed.com":                { name: "Indeed",          category: "Job Portals" },
  "monster.com":               { name: "Monster",         category: "Job Portals" },
  "timesjobs.com":             { name: "TimesJobs",       category: "Job Portals" },
  "foundit.in":                { name: "Foundit",         category: "Job Portals" },
  "hirect.in":                 { name: "Hirect",          category: "Job Portals" },

  // ── Travel ──────────────────────────────────────────────────────────────────
  "uber.com":                  { name: "Uber",            category: "Travel" },
  "lyft.com":                  { name: "Lyft",            category: "Travel" },
  "ola.com":                   { name: "Ola",             category: "Travel" },
  "airbnb.com":                { name: "Airbnb",          category: "Travel" },
  "booking.com":               { name: "Booking.com",     category: "Travel" },
  "expedia.com":               { name: "Expedia",         category: "Travel" },
  "makemytrip.com":            { name: "MakeMyTrip",      category: "Travel" },
  "cleartrip.com":             { name: "ClearTrip",       category: "Travel" },
  "ixigo.com":                 { name: "ixigo",           category: "Travel" },
  "goibibo.com":               { name: "Goibibo",         category: "Travel" },
  "irctc.co.in":               { name: "IRCTC",           category: "Travel" },
  "redbus.in":                 { name: "RedBus",          category: "Travel" },
  "agoda.com":                 { name: "Agoda",           category: "Travel" },

  // ── Gaming ──────────────────────────────────────────────────────────────────
  "discord.com":               { name: "Discord",         category: "Gaming" },
  "discord.gg":                { name: "Discord",         category: "Gaming" },
  "twitch.tv":                 { name: "Twitch",          category: "Gaming" },
  "steampowered.com":          { name: "Steam",           category: "Gaming" },
  "epicgames.com":             { name: "Epic Games",      category: "Gaming" },
  "nintendo.com":              { name: "Nintendo",        category: "Gaming" },
  "xbox.com":                  { name: "Xbox",            category: "Gaming" },
  "playstation.com":           { name: "PlayStation",     category: "Gaming" },
  "roblox.com":                { name: "Roblox",          category: "Gaming" },
  "minecraft.net":             { name: "Minecraft",       category: "Gaming" },

  // ── Food ────────────────────────────────────────────────────────────────────
  "zomato.com":                { name: "Zomato",          category: "Food" },
  "swiggy.com":                { name: "Swiggy",          category: "Food" },
  "doordash.com":              { name: "DoorDash",        category: "Food" },
  "ubereats.com":              { name: "Uber Eats",       category: "Food" },
  "grubhub.com":               { name: "Grubhub",         category: "Food" },

  // ── Business ────────────────────────────────────────────────────────────────
  "crunchbase.com":            { name: "Crunchbase",      category: "Business" },
  "pitchbook.com":             { name: "PitchBook",       category: "Business" },
  "saastr.com":                { name: "SaaStr",          category: "Business" },
};

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Extract domain from a "From" header value.
 * Handles: "Display Name <email@domain.com>" and "email@domain.com"
 */
function extractDomain(fromHeader) {
  if (!fromHeader) return null;
  const match = fromHeader.match(/@([\w.-]+)/);
  return match ? match[1].toLowerCase() : null;
}

/**
 * Extract display name from a "From" header value.
 * Handles: "Display Name <email@domain.com>" → "Display Name"
 */
function extractDisplayName(fromHeader) {
  if (!fromHeader) return null;
  const match = fromHeader.match(/^"?(.+?)"?\s*<[^>]+>$/);
  return match ? match[1].trim() : fromHeader.trim();
}

/**
 * Extract email address from a "From" header value.
 */
function extractEmail(fromHeader) {
  if (!fromHeader) return null;
  const match = fromHeader.match(/<([^>]+)>/);
  return match ? match[1] : fromHeader.trim();
}

/**
 * Normalize a domain to a human-readable service name.
 * Falls back to the display name from the From header, then the domain itself.
 */
function normalizeServiceName(domain, fromHeader) {
  if (!domain) return "Unknown";

  // Check the normalization map
  const normalized = SERVICE_NORMALIZATION[domain];
  if (normalized) return normalized.name;

  // Check for subdomain matches (e.g., "e.linkedin.com" → check "linkedin.com")
  const parts = domain.split(".");
  if (parts.length > 2) {
    const parentDomain = parts.slice(-2).join(".");
    const parentNorm = SERVICE_NORMALIZATION[parentDomain];
    if (parentNorm) return parentNorm.name;

    // Try one more level for co.uk style domains
    if (parts.length > 3) {
      const grandParentDomain = parts.slice(-3).join(".");
      const grandParentNorm = SERVICE_NORMALIZATION[grandParentDomain];
      if (grandParentNorm) return grandParentNorm.name;
    }
  }

  // Fall back to display name from From header
  const displayName = extractDisplayName(fromHeader);
  if (displayName && displayName !== extractEmail(fromHeader)) {
    return displayName;
  }

  // Last resort: capitalize the domain root (e.g., "github" → "Github")
  const root = parts[parts.length - 2] || parts[0];
  return root.charAt(0).toUpperCase() + root.slice(1);
}

/**
 * Normalize a domain to a category.
 */
function normalizeCategory(domain) {
  if (!domain) return "Unknown";
  const normalized = SERVICE_NORMALIZATION[domain];
  if (normalized) return normalized.category;

  // Check subdomain fallback
  const parts = domain.split(".");
  if (parts.length > 2) {
    const parentDomain = parts.slice(-2).join(".");
    const parentNorm = SERVICE_NORMALIZATION[parentDomain];
    if (parentNorm) return parentNorm.category;
  }

  return "Unknown";
}

/**
 * Score a single email's subject against all detection patterns.
 * Returns: { type, score } or null if no pattern matches.
 */
function scoreSubject(subject) {
  if (!subject) return null;

  let bestMatch = null;

  for (const group of DETECTION_PATTERNS) {
    for (const pattern of group.patterns) {
      if (pattern.test(subject)) {
        // If we found a match, this is the best so far (most specific patterns first)
        if (!bestMatch || group.baseScore > bestMatch.score) {
          bestMatch = { type: group.type, score: group.baseScore };
        }
        break; // Only one pattern per group can match a single subject
      }
    }
  }

  return bestMatch;
}

// ═══════════════════════════════════════════════════════════════════════════════
// GMAIL SEARCH QUERIES
//
// These queries are sent to Gmail's search API (`q` parameter) to efficiently
// find account-related emails across the entire mailbox history.
// Using search is orders of magnitude faster than scanning all messages.
// ═══════════════════════════════════════════════════════════════════════════════

const BUILD_SEARCH_QUERY = () => {
  // Build a single Gmail search query from all detection patterns
  // Gmail search syntax: OR between terms, "exact phrase" for multi-word
  const terms = [];

  // Hard-coded high-value search terms (these work best with Gmail search)
  terms.push('"welcome to"');
  terms.push('"thanks for signing up"');
  terms.push('"thank you for signing up"');
  terms.push('"verify your email"');
  terms.push('"confirm your email"');
  terms.push('"account created"');
  terms.push('"activate your account"');
  terms.push('"registration successful"');
  terms.push('"you\'re in"');
  terms.push('"let\'s get started"');
  terms.push('"get started with"');
  terms.push('"new sign-in"');
  terms.push('"new login"');
  terms.push('"security alert"');
  terms.push('"order confirmation"');
  terms.push('"payment received"');
  terms.push('"your subscription"');
  terms.push('"email verification"');
  terms.push('"one-time code"');
  terms.push('"verification code"');
  terms.push('"confirm your account"');
  terms.push('"account activation"');
  terms.push('"password changed"');
  terms.push('"password reset"');
  terms.push('"unusual sign-in"');
  terms.push('"suspicious login"');
  terms.push('"purchase confirmation"');
  terms.push('"payment confirmation"');
  terms.push('"receipt from"');
  terms.push('"two-factor"');

  return terms.join(" OR ");
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN DETECTION FUNCTION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Scan Gmail for evidence of online accounts and services.
 *
 * Uses the Gmail API search endpoint to efficiently find account-creation,
 * verification, security, and purchase confirmation emails. Results are
 * grouped by sender domain and enriched with service names, categories,
 * and confidence scores.
 *
 * @param {string}   token        - Gmail OAuth access token
 * @param {Object}   [options]
 * @param {Function} [options.onProgress] - Progress callback (0-100)
 * @param {Function} [options.onStatus]   - Status message callback
 * @param {Function} [options.onPhase]    - Phase description callback
 * @param {Function} [options.refreshToken] - Async token refresh function
 * @param {number}   [options.maxResults]  - Max emails to search (default 500)
 *
 * @returns {Promise<Object>} {
 *   totalEmailsScanned: number,
 *   servicesDiscovered: number,
 *   services: Array<{
 *     serviceName: string,
 *     domain: string,
 *     accountEmail: string,
 *     category: string,
 *     firstSeen: string (ISO),
 *     lastSeen: string (ISO),
 *     confidenceScore: number (0-100),
 *     evidenceCount: number,
 *     evidenceTypes: Array<string>,
 *     evidences: Array<{
 *       messageId: string,
 *       type: string,
 *       subject: string,
 *       from: string,
 *       receivedAt: string (ISO),
 *     }>,
 *   }>,
 *   scannedAt: string (ISO),
 * }
 */
export async function detectDigitalFootprint(token, options = {}) {
  const {
    onProgress    = () => {},
    onStatus      = () => {},
    onPhase       = () => {},
    refreshToken  = null,
    maxResults    = 500,
  } = options;

  const startTime = Date.now();
  console.log("[DetachX Footprint] Starting digital footprint detection…");

  // ── Phase 1: Search Gmail for account-related emails ─────────────────────-
  onPhase("Phase 1 — Searching for account evidence");
  onStatus("Building search query…");
  onProgress(5);

  const query = BUILD_SEARCH_QUERY();
  console.log("[DetachX Footprint] Search query length:", query.length, "chars");

  onStatus("Searching Gmail (this may take a moment)…");
  onProgress(10);

  let messages;
  try {
    messages = await searchMessages(token, query, {
      maxResults,
      refreshToken,
    });
  } catch (err) {
    console.error("[DetachX Footprint] Search failed:", err.message);
    throw err;
  }

  const totalEmails = messages.length;
  console.log(`[DetachX Footprint] Found ${totalEmails} matching emails`);

  if (totalEmails === 0) {
    onPhase("Complete");
    onStatus("No account evidence found in Gmail");
    onProgress(100);
    return {
      totalEmailsScanned: 0,
      servicesDiscovered: 0,
      services: [],
      scannedAt: new Date().toISOString(),
      scanDurationMs: Date.now() - startTime,
    };
  }

  onProgress(20);

  // ── Phase 2: Classify each email ──────────────────────────────────────────-
  onPhase("Phase 2 — Classifying evidence");
  onStatus(`Classifying ${totalEmails} emails…`);

  // Group evidence by domain
  const evidenceByDomain = {};

  for (let i = 0; i < totalEmails; i++) {
    const msg = messages[i];
    const headers = msg.payload?.headers || [];
    const from    = headers.find((h) => h.name === "From")?.value    || "";
    const subject = headers.find((h) => h.name === "Subject")?.value || "";
    const dateHdr = headers.find((h) => h.name === "Date")?.value    || "";

    const domain       = extractDomain(from);
    const receivedAt   = dateHdr ? new Date(dateHdr).toISOString() : null;
    const matchResult  = scoreSubject(subject);

    if (!domain) continue;

    // Initialize domain entry
    if (!evidenceByDomain[domain]) {
      evidenceByDomain[domain] = {
        domain,
        fromHeader:   from,
        firstSeen:    receivedAt,
        lastSeen:     receivedAt,
        totalScore:   0,
        evidenceCount: 0,
        evidenceTypes: new Set(),
        evidences:    [],
      };
    }

    const entry = evidenceByDomain[domain];

    // Track dates
    if (receivedAt) {
      if (!entry.firstSeen || receivedAt < entry.firstSeen) entry.firstSeen = receivedAt;
      if (!entry.lastSeen  || receivedAt > entry.lastSeen)  entry.lastSeen  = receivedAt;
    }

    // Record evidence
    const evidenceType = matchResult ? matchResult.type : EVIDENCE_TYPES.WEAK;
    const evidenceScore = matchResult ? matchResult.score : 15;

    entry.totalScore += evidenceScore;
    entry.evidenceCount++;
    entry.evidenceTypes.add(evidenceType);
    entry.evidences.push({
      messageId:  msg.id,
      type:       evidenceType,
      subject,
      from,
      receivedAt,
    });

    // Progress: 20 → 70
    const pct = 20 + Math.round(((i + 1) / totalEmails) * 50);
    onProgress(pct);
  }

  onProgress(75);

  // ── Phase 3: Build service results ────────────────────────────────────────-
  onPhase("Phase 3 — Building results");
  onStatus("Computing confidence scores…");

  const domains = Object.keys(evidenceByDomain);
  const services = domains.map((domain) => {
    const entry = evidenceByDomain[domain];

    // Calculate final confidence score (0-100, weighted)
    // Base: average of all evidence scores
    const avgScore = entry.totalScore / entry.evidenceCount;

    // Bonus: having account_creation evidence is a strong signal
    const hasCreationEvidence = entry.evidenceTypes.has(EVIDENCE_TYPES.ACCOUNT_CREATION);
    const hasVerificationEv   = entry.evidenceTypes.has(EVIDENCE_TYPES.VERIFICATION);

    // Bonus: +10 if we have account creation evidence
    // Bonus: +5 if we also have verification evidence
    let confidence = avgScore;
    if (hasCreationEvidence) confidence = Math.min(100, confidence + 10);
    if (hasVerificationEv)   confidence = Math.min(100, confidence + 5);

    // Boost for known services in the normalization map
    const normalized = SERVICE_NORMALIZATION[domain];
    if (normalized) {
      // Known service: confidence floor of 30 (even weak evidence is meaningful)
      confidence = Math.max(30, confidence);
    }

    // Round to nearest integer
    confidence = Math.round(confidence);

    // Determine category
    const category = normalizeCategory(domain);

    // Determine service name
    const serviceName = normalizeServiceName(domain, entry.fromHeader);

    // Account email
    const accountEmail = extractEmail(entry.fromHeader);

    // Sort evidences by date (newest first)
    entry.evidences.sort((a, b) => {
      if (!a.receivedAt) return 1;
      if (!b.receivedAt) return -1;
      return b.receivedAt.localeCompare(a.receivedAt);
    });

    return {
      serviceName,
      domain,
      accountEmail,
      category,
      firstSeen:    entry.firstSeen,
      lastSeen:     entry.lastSeen,
      confidenceScore: confidence,
      evidenceCount:    entry.evidenceCount,
      evidenceTypes:    [...entry.evidenceTypes],
      evidences:        entry.evidences,
    };
  });

  // Sort by confidence score (highest first), then by evidence count
  services.sort((a, b) => {
    if (b.confidenceScore !== a.confidenceScore) return b.confidenceScore - a.confidenceScore;
    return b.evidenceCount - a.evidenceCount;
  });

  onProgress(90);

  const elapsed = Date.now() - startTime;
  console.log(`[DetachX Footprint] Detection complete: ${services.length} services found in ${elapsed}ms`);
  console.log(`[DetachX Footprint] Detection complete: ${services.length} services found in ${elapsed}ms`);

  onPhase("Complete");
  onStatus(`Found ${services.length} services across ${totalEmails} emails`);
  onProgress(100);

  return {
    totalEmailsScanned: totalEmails,
    servicesDiscovered: services.length,
    services,
    scannedAt: new Date().toISOString(),
    scanDurationMs: elapsed,
  };
}
