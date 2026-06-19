import { useEffect, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "./lib/supabase";
import { detectDigitalFootprint } from "./lib/footprintDetection";
import { computeAllRisks, computeRiskSummary } from "./lib/riskScoring";
import { generateInsights } from "./lib/aiInsights";
import { saveFootprintResults, loadFootprintAccounts, getLatestScanTime, deleteFootprintEntry } from "./lib/footprintStorage";
import { getFreshGmailToken } from "./lib/cloudStorage";

// ═══════════════════════════════════════════════════════════════════════════════
// STYLES (inline CSS — matches the dark theme of the rest of the app)
// ═══════════════════════════════════════════════════════════════════════════════

const S = `
  *, *::before, *::after { box-sizing: border-box; }
  .fp { position: relative; min-height: 100dvh; background: #0A0A0F; font-family: 'Space Grotesk', sans-serif; color: #F0EEE9; padding: 0 0 6rem; overflow-x: hidden; }
  .fp .top-bar { height: 1px; background: linear-gradient(90deg, transparent, #1E1E2A 30%, #6C63FF 50%, #1E1E2A 70%, transparent); }
  .fnv { display: flex; align-items: center; justify-content: space-between; padding: 1.25rem 2rem; border-bottom: 1px solid #1E1E2A; }
  .fnv .wm { font-size: 1rem; font-weight: 600; letter-spacing: 0.08em; color: #F0EEE9; }
  .fnv .wm span { color: #6C63FF; }
  .fnv .nr { display: flex; align-items: center; gap: 0.6rem; }
  .fnv img { width: 28px; height: 28px; border-radius: 50%; border: 1px solid #2A2A38; object-fit: cover; }
  .fnv .ne { font-size: 0.75rem; color: #6B6880; }
  .nbtn { font-family: 'Space Grotesk', sans-serif; font-size: 0.75rem; font-weight: 500; color: #4A4860; background: none; border: 1px solid #1E1E2A; border-radius: 6px; padding: 0.3rem 0.75rem; cursor: pointer; transition: color 0.2s, border-color 0.2s; }
  .nbtn:hover { color: #6B6880; border-color: #2A2A38; }
  .fhero { text-align: center; padding: 3rem 2rem 1rem; animation: fa 0.5s ease forwards; }
  .fhero h1 { font-size: clamp(1.6rem, 3.5vw, 2.2rem); font-weight: 700; letter-spacing: -0.03em; margin: 0 0 0.5rem; }
  .fhero p  { font-size: 0.85rem; color: #6B6880; font-weight: 300; margin: 0; }
  .fhero .lscan { font-size: 0.72rem; color: #4A4860; margin-top: 0.35rem; }
  .fgrd { display: grid; grid-template-columns: repeat(auto-fit, minmax(155px, 1fr)); gap: 0.85rem; max-width: 960px; margin: 2rem auto 0; padding: 0 2rem; animation: fa 0.5s ease 0.1s both; }
  .fcd { background: #111118; border: 1px solid #1E1E2A; border-radius: 14px; padding: 1.35rem 1.35rem 1.15rem; position: relative; overflow: hidden; transition: border-color 0.2s, transform 0.2s; }
  .fcd:hover { border-color: #2A2A38; transform: translateY(-2px); }
  .fcd .acb { position: absolute; top: 0; left: 0; right: 0; height: 2px; border-radius: 2px 2px 0 0; }
  .fcd .fico { width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; margin-bottom: 0.75rem; }
  .fcd .flbl { font-size: 0.68rem; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: #4A4860; margin-bottom: 0.25rem; }
  .fcd .fval { font-size: 2rem; font-weight: 700; letter-spacing: -0.04em; color: #F0EEE9; line-height: 1; margin-bottom: 0.25rem; }
  .fcd .fsb  { font-size: 0.7rem; color: #6B6880; font-weight: 300; }
  .fsec { max-width: 960px; margin: 2.5rem auto 0; padding: 0 2rem; animation: fa 0.5s ease 0.2s both; }
  .fsh { display: flex; align-items: center; gap: 0.6rem; margin-bottom: 1rem; }
  .fst { font-size: 0.9rem; font-weight: 600; color: #F0EEE9; }
  .fsh .fsi { width: 18px; height: 18px; }

  /* ── Insights ── */
  .insights { display: flex; flex-direction: column; gap: 0.6rem; }
  .insight { display: flex; gap: 0.75rem; background: #111118; border: 1px solid #1E1E2A; border-radius: 10px; padding: 0.85rem 1rem; transition: border-color 0.2s; }
  .insight:hover { border-color: #2A2A38; }
  .insight .ii { font-size: 1.15rem; flex-shrink: 0; line-height: 1.4; }
  .insight .ii2 { flex: 1; min-width: 0; }
  .insight .it { font-size: 0.82rem; font-weight: 600; color: #F0EEE9; margin-bottom: 2px; }
  .insight .im { font-size: 0.75rem; color: #6B6880; line-height: 1.55; }

  /* ── Categories grid ── */
  .catg { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 0.6rem; }
  .catc { background: #111118; border: 1px solid #1E1E2A; border-radius: 8px; padding: 0.65rem 0.75rem; text-align: center; }
  .catc .cn { font-size: 0.7rem; font-weight: 600; letter-spacing: 0.05em; text-transform: uppercase; color: #4A4860; margin-bottom: 2px; }
  .catc .cv { font-size: 1.35rem; font-weight: 700; color: #F0EEE9; }
  .catc .cp { font-size: 0.65rem; color: #6B6880; }

  /* ── Risk distribution ── */
  .riskb { display: flex; gap: 0.5rem; margin-bottom: 1rem; }
  .riskb .rb { flex: 1; padding: 0.75rem 0.5rem; border-radius: 8px; text-align: center; border: 1px solid; }
  .riskb .rb .rl { font-size: 0.65rem; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 2px; }
  .riskb .rb .rv { font-size: 1.25rem; font-weight: 700; }
  .riskb .rb.low    { background: rgba(34,197,94,0.06);  border-color: rgba(34,197,94,0.2);  color: #22C55E; }
  .riskb .rb.medium { background: rgba(245,158,11,0.06); border-color: rgba(245,158,11,0.2); color: #F59E0B; }
  .riskb .rb.high   { background: rgba(239,68,68,0.06);  border-color: rgba(239,68,68,0.2);  color: #EF4444; }

  /* ── Account list ── */
  .actls { display: flex; flex-direction: column; gap: 0.45rem; }
  .acrw { display: flex; align-items: center; gap: 0.7rem; background: #111118; border: 1px solid #1E1E2A; border-radius: 10px; padding: 0.7rem 1rem; transition: border-color 0.2s, background 0.2s; }
  .acrw:hover { border-color: #2A2A38; }
  .acrw .aic { width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 0.75rem; font-weight: 700; flex-shrink: 0; text-transform: uppercase; }
  .acrw .aic.dev    { background: rgba(99,102,241,0.1);  border: 1px solid rgba(99,102,241,0.2);  color: #818CF8; }
  .acrw .aic.shop   { background: rgba(236,72,153,0.1);  border: 1px solid rgba(236,72,153,0.2);  color: #F472B6; }
  .acrw .aic.social { background: rgba(59,130,246,0.1);  border: 1px solid rgba(59,130,246,0.2);  color: #60A5FA; }
  .acrw .aic.edu    { background: rgba(34,197,94,0.1);   border: 1px solid rgba(34,197,94,0.2);   color: #4ADE80; }
  .acrw .aic.fin    { background: rgba(245,158,11,0.1);  border: 1px solid rgba(245,158,11,0.2);  color: #FBBF24; }
  .acrw .aic.ai     { background: rgba(168,85,247,0.1);  border: 1px solid rgba(168,85,247,0.2);  color: #C084FC; }
  .acrw .aic.ent    { background: rgba(236,72,153,0.1);  border: 1px solid rgba(236,72,153,0.2);  color: #F472B6; }
  .acrw .aic.game   { background: rgba(34,211,238,0.1);  border: 1px solid rgba(34,211,238,0.2);  color: #67E8F9; }
  .acrw .aic.trav   { background: rgba(251,191,36,0.1);  border: 1px solid rgba(251,191,36,0.2);  color: #FCD34D; }
  .acrw .aic.food   { background: rgba(251,146,60,0.1);  border: 1px solid rgba(251,146,60,0.2);  color: #FB923C; }
  .acrw .aic.job    { background: rgba(129,140,248,0.1); border: 1px solid rgba(129,140,248,0.2); color: #A5B4FC; }
  .acrw .aic.prod   { background: rgba(148,163,184,0.1); border: 1px solid rgba(148,163,184,0.2); color: #94A3B8; }
  .acrw .aic.cloud  { background: rgba(56,189,248,0.1);  border: 1px solid rgba(56,189,248,0.2);  color: #38BDF8; }
  .acrw .aic.bus    { background: rgba(250,204,21,0.1);  border: 1px solid rgba(250,204,21,0.2);  color: #FACC15; }
  .acrw .aic.unk    { background: rgba(108,99,255,0.1);  border: 1px solid rgba(108,99,255,0.2);  color: #6C63FF; }
  .acrw .aii { flex: 1; min-width: 0; }
  .acrw .asn { font-size: 0.8rem; font-weight: 500; color: #F0EEE9; }
  .acrw .asd { font-size: 0.7rem; color: #4A4860; }
  .acrw .asm { display: flex; align-items: center; gap: 0.5rem; margin-top: 2px; flex-wrap: wrap; }
  .acrw .asm > * { font-size: 0.62rem; display: inline-flex; align-items: center; gap: 3px; }
  .acrw .conf { color: #6C63FF; }
  .acrw .risk-tag { padding: 1px 6px; border-radius: 99px; font-weight: 600; letter-spacing: 0.05em; }
  .acrw .risk-tag.low    { background: rgba(34,197,94,0.1);  color: #22C55E; border: 1px solid rgba(34,197,94,0.2); }
  .acrw .risk-tag.medium { background: rgba(245,158,11,0.1); color: #F59E0B; border: 1px solid rgba(245,158,11,0.2); }
  .acrw .risk-tag.high   { background: rgba(239,68,68,0.1);  color: #EF4444; border: 1px solid rgba(239,68,68,0.2); }
  .acrw .status-dot { width: 6px; height: 6px; border-radius: 50%; display: inline-block; }
  .acrw .status-dot.active   { background: #22C55E; }
  .acrw .status-dot.inactive { background: #F59E0B; }
  .acrw .status-dot.dormant  { background: #EF4444; }

  /* ── Empty state ── */
  .fempty { text-align: center; padding: 4rem 2rem; }
  .fempty .fei { font-size: 3rem; margin-bottom: 1rem; }
  .fempty h2 { font-size: 1.3rem; font-weight: 600; color: #F0EEE9; margin: 0 0 0.5rem; }
  .fempty p { font-size: 0.85rem; color: #6B6880; max-width: 380px; margin: 0 auto 1.5rem; line-height: 1.6; }
  .scan-now-btn {
    display: inline-flex; align-items: center; gap: 0.5rem;
    font-family: 'Space Grotesk', sans-serif; font-size: 0.9rem; font-weight: 600;
    color: #0A0A0F; background: #F0EEE9; border: none; border-radius: 8px;
    padding: 0.8rem 1.5rem; cursor: pointer; transition: background 0.2s, transform 0.15s;
  }
  .scan-now-btn:hover { background: #ffffff; transform: translateY(-1px); }
  .scan-now-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }

  /* ── Scan progress ── */
  .scan-progress { text-align: center; padding: 3rem 2rem; }
  .scan-progress .spi { margin-bottom: 1.5rem; }
  .scan-progress .spt { font-size: 1.1rem; font-weight: 600; color: #F0EEE9; margin-bottom: 0.5rem; }
  .scan-progress .sps { font-size: 0.82rem; color: #6B6880; margin-bottom: 0.75rem; }
  .scan-progress .spp { font-size: 0.7rem; color: #4A4860; }
  .sp-bar { width: 260px; height: 3px; background: #1E1E2A; border-radius: 99px; margin: 0.75rem auto; overflow: hidden; }
  .sp-bar .sp-fill { height: 100%; background: linear-gradient(90deg, #6C63FF, #A78BFA); border-radius: 99px; transition: width 0.4s ease; }

  /* ── Scan error ── */
  .scan-error { text-align: center; padding: 3rem 2rem; }
  .scan-error .sei { font-size: 2rem; margin-bottom: 0.75rem; }
  .scan-error .set { font-size: 0.9rem; color: #EF4444; margin-bottom: 0.5rem; }
  .scan-error .ses { font-size: 0.78rem; color: #6B6880; margin-bottom: 1rem; }

  /* ── Search bar ── */
  .fsbar { display: flex; gap: 0.5rem; margin-bottom: 1rem; flex-wrap: wrap; align-items: center; }
  .fsbar input {
    flex: 1; min-width: 160px; font-family: 'Space Grotesk', sans-serif;
    font-size: 0.78rem; background: #111118; border: 1px solid #1E1E2A; border-radius: 6px;
    padding: 0.5rem 0.75rem; color: #F0EEE9; outline: none;
    transition: border-color 0.2s;
  }
  .fsbar input::placeholder { color: #4A4860; }
  .fsbar input:focus { border-color: #6C63FF; }
  .fsbar select {
    font-family: 'Space Grotesk', sans-serif; font-size: 0.75rem;
    background: #111118; border: 1px solid #1E1E2A; border-radius: 6px;
    padding: 0.5rem 0.75rem; color: #F0EEE9; outline: none; cursor: pointer;
  }
  .fsbar select:focus { border-color: #6C63FF; }
  .fsbar .fcount { font-size: 0.7rem; color: #4A4860; }

  /* ── Forgotten section ── */
  .forg-badge { display: inline-flex; align-items: center; gap: 4px; font-size: 0.6rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; padding: 1px 6px; border-radius: 99px; background: rgba(239,68,68,0.1); color: #EF4444; border: 1px solid rgba(239,68,68,0.2); }

  /* ── Footer note ── */
  .fp .ftn { position: absolute; bottom: 2rem; left: 0; right: 0; text-align: center; font-size: 0.7rem; color: #6B6880; letter-spacing: 0.05em; }

  @keyframes fa { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes sp { to { transform: rotate(360deg); } }
  @media (max-width: 600px) {
    .fnv { padding: 1rem 1.25rem; } .fnv .ne { display: none; }
    .fgrd { grid-template-columns: repeat(2,1fr); padding: 0 1.25rem; }
    .fsec { padding: 0 1.25rem; } .catg { grid-template-columns: repeat(2,1fr); }
  }
`;

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

const CATEGORY_ICONS = {
  "Developer Tools": "🛠️",
  "Education":       "📚",
  "Social Media":    "👥",
  "Shopping":        "🛒",
  "Finance":         "💰",
  "Productivity":    "📋",
  "Entertainment":   "🎬",
  "AI Tools":        "🤖",
  "Job Portals":     "💼",
  "Travel":          "✈️",
  "Gaming":          "🎮",
  "Cloud Services":  "☁️",
  "Food":            "🍕",
  "Business":        "🏢",
  "Unknown":         "❓",
};

const CATEGORY_CSS_CLASSES = {
  "Developer Tools": "dev",
  "Education":       "edu",
  "Social Media":    "social",
  "Shopping":        "shop",
  "Finance":         "fin",
  "Productivity":    "prod",
  "Entertainment":   "ent",
  "AI Tools":        "ai",
  "Job Portals":     "job",
  "Travel":          "trav",
  "Gaming":          "game",
  "Cloud Services":  "cloud",
  "Food":            "food",
  "Business":        "bus",
  "Unknown":         "unk",
};

function fmt(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "numeric", month: "short", year: "numeric",
  });
}

function isForgotten(service) {
  if (!service.lastSeen) return true;
  const age = Date.now() - new Date(service.lastSeen).getTime();
  return age > 12 * 30.44 * 24 * 60 * 60 * 1000;
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function FootprintPage({ session }) {
  const navigate = useNavigate();
  const user = session?.user;
  const userEmail = user?.email || "";
  const userPic = user?.user_metadata?.avatar_url || user?.user_metadata?.picture || "";

  const [viewState, setViewState] = useState("loading"); // loading | idle | scanning | complete | error
  const [progress,  setProgress]  = useState(0);
  const [phase,     setPhase]     = useState("");
  const [statusMsg, setStatusMsg] = useState("");
  const [errorMsg,  setErrorMsg]  = useState("");

  const [services,    setServices]    = useState([]);
  const [insights,    setInsights]    = useState([]);
  const [lastScanned, setLastScanned] = useState(null);
  const [search,      setSearch]      = useState("");
  const [catFilter,   setCatFilter]   = useState("all");

  // Load cached data on mount
  useEffect(() => {
    if (!userEmail) return;
    loadCachedData();
  }, [userEmail]);

  async function loadCachedData() {
    setViewState("loading");
    try {
      const [accounts, scanTime] = await Promise.all([
        loadFootprintAccounts(userEmail),
        getLatestScanTime(userEmail),
      ]);

      if (accounts.length > 0) {
        // Compute risk/insights for cached data if missing
        const scored = computeAllRisks(accounts);
        setServices(scored);
        setInsights(generateInsights(scored));
        setLastScanned(scanTime);
        setViewState("complete");
      } else {
        setViewState("idle");
      }
    } catch (err) {
      console.error("[DetachX Footprint] load error:", err);
      setViewState("idle");
    }
  }

  // ── Scan ──────────────────────────────────────────────────────────────────
  const handleScan = useCallback(async () => {
    setViewState("scanning");
    setProgress(0);
    setPhase("");
    setStatusMsg("Starting…");
    setErrorMsg("");

    try {
      // Get fresh token
      const token = await getFreshGmailToken();
      if (!token) {
        setErrorMsg("Gmail access expired. Please log in again.");
        setViewState("error");
        return;
      }

      // Run detection
      const rawResult = await detectDigitalFootprint(token, {
        onProgress:  setProgress,
        onStatus:    setStatusMsg,
        onPhase:     setPhase,
        maxResults:  500,
      });

      // Compute risk scores
      const scoredServices = computeAllRisks(rawResult.services);
      const riskSummary    = computeRiskSummary(scoredServices);
      const allInsights    = generateInsights(scoredServices);

      // Update state
      setServices(scoredServices);
      setInsights(allInsights);
      setLastScanned(rawResult.scannedAt);

      // Save to Supabase
      const fullResult = {
        ...rawResult,
        services: scoredServices,
      };
      await saveFootprintResults(userEmail, fullResult);

      setViewState("complete");
      console.log("[DetachX Footprint] Scan complete:", {
        services: scoredServices.length,
        riskSummary,
        insights: allInsights.length,
      });
    } catch (err) {
      console.error("[DetachX Footprint] Scan failed:", err);
      if (err.message === "TOKEN_EXPIRED") {
        setErrorMsg("Gmail access expired. Please log in again.");
      } else {
        setErrorMsg(err.message || "Something went wrong during the scan.");
      }
      setViewState("error");
    }
  }, [userEmail]);

  // ── Delete entry ──────────────────────────────────────────────────────────
  const handleDelete = useCallback(async (domain) => {
    const ok = await deleteFootprintEntry(userEmail, domain);
    if (ok) {
      setServices((prev) => prev.filter((s) => s.domain !== domain));
    }
  }, [userEmail]);

  // ── Filtered + sorted services ────────────────────────────────────────────
  const filteredServices = useMemo(() => {
    let result = [...services];

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter(
        (s) =>
          s.serviceName.toLowerCase().includes(q) ||
          s.domain.toLowerCase().includes(q)
      );
    }
    if (catFilter !== "all") {
      result = result.filter((s) => s.category === catFilter);
    }

    // Sort: high risk first, then by confidence desc
    result.sort((a, b) => {
      const riskOrder = { high: 0, medium: 1, low: 2 };
      const ra = riskOrder[a.riskLevel] || 1;
      const rb = riskOrder[b.riskLevel] || 1;
      if (ra !== rb) return ra - rb;
      return (b.confidenceScore || 0) - (a.confidenceScore || 0);
    });

    return result;
  }, [services, search, catFilter]);

  // ── Forgotten accounts ────────────────────────────────────────────────────
  const forgottenAccounts = useMemo(
    () => services.filter(isForgotten),
    [services]
  );

  // ── Categories ────────────────────────────────────────────────────────────
  const categoryCounts = useMemo(() => {
    const counts = {};
    for (const s of services) {
      const cat = s.category || "Unknown";
      counts[cat] = (counts[cat] || 0) + 1;
    }
    return Object.entries(counts).sort((a, b) => b[1] - a[1]);
  }, [services]);

  // ── Risk summary ──────────────────────────────────────────────────────────
  const riskSummary = useMemo(() => computeRiskSummary(services), [services]);

  // ── Render ────────────────────────────────────────────────────────────────
  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/");
  };

  return (
    <>
      <style>{S}</style>
      <div className="fp">
        <div className="top-bar" />

        {/* Nav */}
        <nav className="fnv">
          <div className="wm">Detach<span>X</span></div>
          <div className="nr">
            {userPic && <img src={userPic} alt="" referrerPolicy="no-referrer" />}
            <span className="ne">{userEmail}</span>
            <button className="nbtn" onClick={() => navigate("/dashboard")}>Dashboard</button>
            <button className="nbtn" onClick={handleLogout}>Log out</button>
          </div>
        </nav>

        {/* ── LOADING ── */}
        {viewState === "loading" && (
          <div className="fempty">
            <div className="fei">🔍</div>
            <p>Loading your digital footprint…</p>
          </div>
        )}

        {/* ── IDLE (no data) ── */}
        {viewState === "idle" && (
          <div className="fempty">
            <div className="fei">🔍</div>
            <h2>Discover Your Digital Footprint</h2>
            <p>
              DetachX will scan your Gmail history to find where you've used
              this email address — accounts you created, services you joined,
              and websites you signed up for.
            </p>
            <button className="scan-now-btn" onClick={handleScan}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 1v14M1 8h14" stroke="#0A0A0F" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
              Start Discovery Scan
            </button>
            <p style={{ marginTop: "1rem", fontSize: "0.72rem", color: "#4A4860" }}>
              Searches your entire mailbox history. May take 1-2 minutes.
            </p>
          </div>
        )}

        {/* ── SCANNING ── */}
        {viewState === "scanning" && (
          <div className="scan-progress">
            <div className="spi">
              <div style={{
                width: "64px", height: "64px", margin: "0 auto",
                borderRadius: "50%", border: "2px solid #2A2A38",
                borderTopColor: "#6C63FF",
                animation: "sp 0.7s linear infinite",
              }} />
            </div>
            <div className="spt">Scanning your Gmail</div>
            {phase && <div className="sps">{phase}</div>}
            <div className="sps">{statusMsg}</div>
            <div className="sp-bar">
              <div className="sp-fill" style={{ width: `${Math.min(100, progress)}%` }} />
            </div>
            <div className="spp">{Math.min(100, Math.round(progress))}%</div>
          </div>
        )}

        {/* ── ERROR ── */}
        {viewState === "error" && (
          <div className="scan-error">
            <div className="sei">⚠️</div>
            <div className="set">{errorMsg}</div>
            <div className="ses">You can try again or check your Gmail connection.</div>
            <button className="scan-now-btn" onClick={handleScan}>
              Try Again
            </button>
          </div>
        )}

        {/* ── COMPLETE ── */}
        {viewState === "complete" && (
          <>
            {/* Hero */}
            <div className="fhero">
              <h1>Your Digital Footprint</h1>
              <p>{services.length} accounts discovered · {categoryCounts.length} categories</p>
              {lastScanned && <p className="lscan">Last scanned: {fmt(lastScanned)}</p>}
            </div>

            {/* Stats cards */}
            <div className="fgrd">
              <div className="fcd">
                <div className="acb" style={{ background: "#6C63FF" }} />
                <div className="fico" style={{ background: "rgba(108,99,255,0.12)" }}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M2 3h12v10a1 1 0 01-1 1H3a1 1 0 01-1-1V3zm0 0l6 5 6-5" stroke="#6C63FF" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div className="flbl">Total Accounts</div>
                <div className="fval">{services.length}</div>
                <div className="fsb">services linked to your email</div>
              </div>
              <div className="fcd">
                <div className="acb" style={{ background: "#22C55E" }} />
                <div className="fico" style={{ background: "rgba(34,197,94,0.12)" }}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <circle cx="8" cy="8" r="6" stroke="#22C55E" strokeWidth="1.4"/>
                    <path d="M5 8l2 2 4-4" stroke="#22C55E" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div className="flbl">Categories</div>
                <div className="fval">{categoryCounts.length}</div>
                <div className="fsb">different service types</div>
              </div>
              <div className="fcd">
                <div className="acb" style={{ background: "#EF4444" }} />
                <div className="fico" style={{ background: "rgba(239,68,68,0.12)" }}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <circle cx="8" cy="8" r="6" stroke="#EF4444" strokeWidth="1.4"/>
                    <path d="M4 4l8 8" stroke="#EF4444" strokeWidth="1.4" strokeLinecap="round"/>
                  </svg>
                </div>
                <div className="flbl">High Risk</div>
                <div className="fval">{riskSummary.high}</div>
                <div className="fsb">need review</div>
              </div>
              <div className="fcd">
                <div className="acb" style={{ background: "#F59E0B" }} />
                <div className="fico" style={{ background: "rgba(245,158,11,0.12)" }}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <circle cx="8" cy="8" r="6" stroke="#F59E0B" strokeWidth="1.4"/>
                    <path d="M8 5v3.5l2 1.5" stroke="#F59E0B" strokeWidth="1.4" strokeLinecap="round"/>
                  </svg>
                </div>
                <div className="flbl">Forgotten</div>
                <div className="fval">{forgottenAccounts.length}</div>
                <div className="fsb">no activity in 12+ months</div>
              </div>
            </div>

            {/* AI Insights */}
            {insights.length > 0 && (
              <div className="fsec">
                <div className="fsh">
                  <svg className="fsi" viewBox="0 0 18 18" fill="none">
                    <path d="M9 1l2 5h5l-4 3 1.5 5.5L9 12l-4.5 2.5L6 9l-4-3h5L9 1z" stroke="#6C63FF" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span className="fst">AI Insights</span>
                </div>
                <div className="insights">
                  {insights.slice(0, 5).map((ins, i) => (
                    <div className="insight" key={i}>
                      <span className="ii">{ins.icon}</span>
                      <div className="ii2">
                        <div className="it">{ins.title}</div>
                        <div className="im">{ins.message}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Risk Analysis */}
            <div className="fsec">
              <div className="fsh">
                <svg className="fsi" viewBox="0 0 18 18" fill="none">
                  <path d="M9 2l7 14H2L9 2zm0 4v4m0 2v.01" stroke="#EF4444" strokeWidth="1.4" strokeLinecap="round"/>
                </svg>
                <span className="fst">Risk Analysis</span>
              </div>
              <div className="riskb">
                <div className="rb low">
                  <div className="rl">Low</div>
                  <div className="rv">{riskSummary.low}</div>
                </div>
                <div className="rb medium">
                  <div className="rl">Medium</div>
                  <div className="rv">{riskSummary.medium}</div>
                </div>
                <div className="rb high">
                  <div className="rl">High</div>
                  <div className="rv">{riskSummary.high}</div>
                </div>
              </div>
              {riskSummary.highestRiskService && (
                <p style={{ fontSize: "0.72rem", color: "#4A4860", margin: "0.25rem 0 0" }}>
                  Highest risk: {riskSummary.highestRiskService.serviceName} ({riskSummary.highestRiskService.riskScore}/100)
                </p>
              )}
            </div>

            {/* Category Breakdown */}
            <div className="fsec">
              <div className="fsh">
                <svg className="fsi" viewBox="0 0 18 18" fill="none">
                  <rect x="1" y="1" width="6" height="6" rx="1" stroke="#6C63FF" strokeWidth="1.4"/>
                  <rect x="11" y="1" width="6" height="6" rx="1" stroke="#6C63FF" strokeWidth="1.4"/>
                  <rect x="1" y="11" width="6" height="6" rx="1" stroke="#6C63FF" strokeWidth="1.4"/>
                  <rect x="11" y="11" width="6" height="6" rx="1" stroke="#6C63FF" strokeWidth="1.4"/>
                </svg>
                <span className="fst">Category Breakdown</span>
              </div>
              <div className="catg">
                {categoryCounts.map(([cat, count]) => (
                  <div className="catc" key={cat}>
                    <div className="cn">{cat}</div>
                    <div className="cv">{count}</div>
                    <div className="cp">{CATEGORY_ICONS[cat] || "❓"}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Forgotten Accounts */}
            {forgottenAccounts.length > 0 && (
              <div className="fsec">
                <div className="fsh">
                  <span style={{ fontSize: "1rem" }}>⏰</span>
                  <span className="fst">Forgotten Accounts ({forgottenAccounts.length})</span>
                </div>
                <div className="actls">
                  {forgottenAccounts.slice(0, 10).map((svc, i) => (
                    <div className="acrw" key={i}>
                      <div className={`aic ${CATEGORY_CSS_CLASSES[svc.category] || "unk"}`}>
                        {svc.serviceName?.[0] || "?"}
                      </div>
                      <div className="aii">
                        <div className="asn">{svc.serviceName}</div>
                        <div className="asm">
                          <span className="forg-badge">Forgotten</span>
                          {svc.lastSeen && <span>Last: {fmt(svc.lastSeen)}</span>}
                          {svc.confidenceScore && <span className="conf">{svc.confidenceScore}%</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                  {forgottenAccounts.length > 10 && (
                    <p style={{ textAlign: "center", fontSize: "0.72rem", color: "#4A4860", marginTop: "0.5rem" }}>
                      +{forgottenAccounts.length - 10} more forgotten accounts
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* All Accounts */}
            <div className="fsec">
              <div className="fsh">
                <svg className="fsi" viewBox="0 0 18 18" fill="none">
                  <path d="M3 15v-1a4 4 0 014-4h4a4 4 0 014 4v1M9 8a3 3 0 100-6 3 3 0 000 6z" stroke="#6C63FF" strokeWidth="1.4" strokeLinecap="round"/>
                </svg>
                <span className="fst">All Accounts ({filteredServices.length})</span>
              </div>

              {/* Search + Filter */}
              <div className="fsbar">
                <input
                  type="text"
                  placeholder="Search by name or domain…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)}>
                  <option value="all">All categories</option>
                  {categoryCounts.map(([cat]) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
                <span className="fcount">{filteredServices.length} shown</span>
              </div>

              {/* Account rows */}
              <div className="actls">
                {filteredServices.length === 0 ? (
                  <p style={{ textAlign: "center", padding: "2rem", color: "#4A4860", fontSize: "0.82rem" }}>
                    No accounts match your search.
                  </p>
                ) : (
                  filteredServices.map((svc, i) => (
                    <div className="acrw" key={svc.domain || i}>
                      <div className={`aic ${CATEGORY_CSS_CLASSES[svc.category] || "unk"}`}>
                        {svc.serviceName?.[0] || "?"}
                      </div>
                      <div className="aii">
                        <div className="asn">{svc.serviceName}</div>
                        <div className="asd">{svc.domain}</div>
                        <div className="asm">
                          <span className={`risk-tag ${svc.riskLevel || "medium"}`}>
                            {svc.riskLevel?.toUpperCase() || "MED"} · {svc.riskScore || "?"}
                          </span>
                          <span className="conf">{svc.confidenceScore}% confidence</span>
                          <span>
                            <span className={`status-dot ${svc.status || "active"}`} />
                            {" "}{svc.status || "active"}
                          </span>
                          {svc.lastSeen && <span>Last: {fmt(svc.lastSeen)}</span>}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Rescan button */}
            <div style={{ textAlign: "center", marginTop: "2rem", padding: "0 2rem" }}>
              <button className="scan-now-btn" onClick={handleScan}>
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M13 7A6 6 0 1 1 7 1" stroke="#0A0A0F" strokeWidth="1.5" strokeLinecap="round"/>
                  <path d="M13 1v6h-6" stroke="#0A0A0F" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Scan Again
              </button>
            </div>
          </>
        )}

        <p className="ftn">© 2026 DetachX · All rights reserved</p>
      </div>
    </>
  );
}
