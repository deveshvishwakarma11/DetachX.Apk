import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  saveUnsubEntry,
  saveBlockEntry,
  migrateSupabaseStatuses,
} from "./lib/cloudStorage";

const S = `
  * { box-sizing: border-box; }
  .rp { position: relative; min-height: 100dvh; background: #0A0A0F; font-family: 'Space Grotesk', sans-serif; color: #F0EEE9; padding: 0 0 6rem; overflow-x: hidden; }
  .rp .top-bar { height: 1px; background: linear-gradient(90deg, transparent, #1E1E2A 30%, #6C63FF 50%, #1E1E2A 70%, transparent); }
  .rnav { display: flex; align-items: center; justify-content: space-between; padding: 1.5rem 2.5rem; border-bottom: 1px solid #1E1E2A; }
  .rnav .wm { font-size: 1rem; font-weight: 600; letter-spacing: 0.08em; color: #F0EEE9; }
  .rnav .wm span { color: #6C63FF; }
  .rnav .nr { display: flex; align-items: center; gap: 0.75rem; }
  .rnav img { width: 32px; height: 32px; border-radius: 50%; border: 1px solid #2A2A38; object-fit: cover; }
  .rnav .ne { font-size: 0.78rem; color: #6B6880; }
  .nbtn { font-family: 'Space Grotesk', sans-serif; font-size: 0.78rem; font-weight: 500; color: #4A4860; background: none; border: 1px solid #1E1E2A; border-radius: 6px; padding: 0.35rem 0.85rem; cursor: pointer; transition: color 0.2s, border-color 0.2s; }
  .nbtn:hover { color: #6B6880; border-color: #2A2A38; }
  .hero { text-align: center; padding: 3.5rem 2rem 0.5rem; animation: fu 0.5s ease forwards; }
  .hbadge { display: inline-flex; align-items: center; gap: 0.4rem; font-size: 0.7rem; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: #6C63FF; background: rgba(108,99,255,0.1); border: 1px solid rgba(108,99,255,0.2); border-radius: 99px; padding: 0.35rem 1rem; margin-bottom: 1.25rem; }
  .hero h1 { font-size: clamp(1.8rem, 4vw, 2.4rem); font-weight: 700; letter-spacing: -0.03em; margin: 0 0 0.6rem; }
  .hero p  { font-size: 0.9rem; color: #6B6880; font-weight: 300; margin: 0; }
  .smeta   { font-size: 0.72rem; color: #4A4860; margin-top: 0.5rem; }
  .sgrid { display: grid; grid-template-columns: repeat(auto-fit, minmax(155px, 1fr)); gap: 1rem; max-width: 900px; margin: 2.5rem auto 0; padding: 0 2rem; animation: fu 0.5s ease 0.1s both; }
  .scard { background: #111118; border: 1px solid #1E1E2A; border-radius: 14px; padding: 1.5rem 1.5rem 1.25rem; position: relative; overflow: hidden; transition: border-color 0.2s, transform 0.2s; }
  .scard:hover { border-color: #2A2A38; transform: translateY(-2px); }
  .scard .ac { position: absolute; top: 0; left: 0; right: 0; height: 2px; border-radius: 2px 2px 0 0; }
  .sico { width: 36px; height: 36px; border-radius: 8px; display: flex; align-items: center; justify-content: center; margin-bottom: 1rem; }
  .slbl { font-size: 0.7rem; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase; color: #4A4860; margin-bottom: 0.35rem; }
  .sval { font-size: 2.4rem; font-weight: 700; letter-spacing: -0.04em; color: #F0EEE9; line-height: 1; margin-bottom: 0.25rem; }
  .ssub { font-size: 0.73rem; color: #6B6880; font-weight: 300; }
  .sec { max-width: 900px; margin: 3rem auto 0; padding: 0 2rem; animation: fu 0.5s ease 0.2s both; }
  .shead { display: flex; align-items: center; margin-bottom: 1rem; }
  .stitle { font-size: 0.95rem; font-weight: 600; color: #F0EEE9; display: flex; align-items: center; gap: 0.5rem; }
  .tabs { display: flex; gap: 0.5rem; margin-bottom: 1.25rem; flex-wrap: wrap; }
  .tab { font-family: 'Space Grotesk', sans-serif; font-size: 0.78rem; font-weight: 600; padding: 0.4rem 1rem; border-radius: 99px; border: 1px solid #2A2A38; background: transparent; color: #6B6880; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; gap: 0.4rem; }
  .tab:hover { color: #F0EEE9; border-color: #444; }
  .tab.active         { background: rgba(108,99,255,0.12); border-color: rgba(108,99,255,0.35); color: #A89DFF; }
  .tab.t-green.active { background: rgba(34,197,94,0.1);   border-color: rgba(34,197,94,0.3);   color: #4ade80; }
  .tab.t-red.active   { background: rgba(239,68,68,0.1);   border-color: rgba(239,68,68,0.3);   color: #f87171; }
  .tab-count { font-size: 0.7rem; background: rgba(255,255,255,0.06); border-radius: 99px; padding: 0.1rem 0.5rem; }
  .ulist { display: flex; flex-direction: column; gap: 0.5rem; }
  .urow { display: flex; align-items: center; gap: 0.85rem; background: #111118; border: 1px solid #1E1E2A; border-radius: 10px; padding: 0.85rem 1.1rem; transition: border-color 0.2s, background 0.2s; }
  .urow:hover:not(.done) { border-color: #2A2A38; }
  .urow.done   { opacity: 0.65; }
  .urow.done-u { background: #0D150D; border-color: rgba(34,197,94,0.15); }
  .urow.done-f { background: #180E0E; border-color: rgba(245,158,11,0.2); opacity: 1; }
  .urow.done-b { background: #150D0D; border-color: rgba(239,68,68,0.15); }
  .ulet { width: 36px; height: 36px; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 0.85rem; font-weight: 700; flex-shrink: 0; text-transform: uppercase; }
  .ulet.purple { background: rgba(108,99,255,0.1); border: 1px solid rgba(108,99,255,0.15); color: #6C63FF; }
  .ulet.green  { background: rgba(34,197,94,0.08);  border: 1px solid rgba(34,197,94,0.2);  color: #22C55E; }
  .ulet.amber  { background: rgba(245,158,11,0.08); border: 1px solid rgba(245,158,11,0.2); color: #F59E0B; }
  .ulet.red    { background: rgba(239,68,68,0.08);  border: 1px solid rgba(239,68,68,0.2);  color: #EF4444; }
  .uinfo { flex: 1; min-width: 0; }
  .ufrom { font-size: 0.83rem; font-weight: 500; color: #F0EEE9; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  .usubj { font-size: 0.73rem; color: #4A4860; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; margin-top: 2px; }
  .umeta { font-size: 0.68rem; color: #3A3A4A; margin-top: 3px; }
  /* ✅ Status badges */
  .vstatus { display: inline-flex; align-items: center; gap: 5px; font-size: 0.68rem; font-weight: 600; margin-top: 5px; }
  .vstatus.us  { color: #22C55E; }
  .vstatus.uf  { color: #F59E0B; }
  /* Failed unsub warning box */
  .fail-warn {
    background: rgba(245,158,11,0.06); border: 1px solid rgba(245,158,11,0.18);
    border-radius: 8px; padding: 0.65rem 0.9rem; margin-top: 0.5rem;
    font-size: 0.72rem; color: #F59E0B; line-height: 1.55;
  }
  .fail-warn strong { color: #F0EEE9; font-weight: 600; display: block; margin-bottom: 2px; }
  /* Block CTA inside failed row */
  .block-cta {
    font-family: 'Space Grotesk', sans-serif; font-size: 0.65rem; font-weight: 700;
    letter-spacing: 0.06em; text-transform: uppercase; border-radius: 99px;
    padding: 0.28rem 0.85rem; border: 1px solid rgba(239,68,68,0.35);
    color: #EF4444; background: rgba(239,68,68,0.08);
    cursor: pointer; white-space: nowrap; flex-shrink: 0;
    transition: background 0.2s, transform 0.15s; line-height: 1.6;
  }
  .block-cta:hover { background: rgba(239,68,68,0.18); transform: scale(1.04); }
  .rbtn { font-family: 'Space Grotesk', sans-serif; font-size: 0.65rem; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; border-radius: 99px; padding: 0.28rem 0.85rem; border: 1px solid; cursor: pointer; white-space: nowrap; flex-shrink: 0; transition: background 0.2s, transform 0.15s; line-height: 1.6; }
  .rbtn.unsub  { color: #6C63FF; background: rgba(108,99,255,0.08); border-color: rgba(108,99,255,0.3); }
  .rbtn.unsub:hover { background: rgba(108,99,255,0.18); transform: scale(1.04); }
  .rbtn.block  { color: #EF4444; background: rgba(239,68,68,0.08); border-color: rgba(239,68,68,0.3); }
  .rbtn.block:hover { background: rgba(239,68,68,0.18); transform: scale(1.04); }
  .rbtn.done-u { color: #22C55E; background: rgba(34,197,94,0.08);  border-color: rgba(34,197,94,0.2);  cursor: default; }
  .rbtn.done-b { color: #EF4444; background: rgba(239,68,68,0.08);  border-color: rgba(239,68,68,0.2);  cursor: default; }
  .empty { text-align: center; padding: 2.5rem 1rem; color: #4A4860; font-size: 0.85rem; line-height: 1.7; }
  .empty svg { margin: 0 auto 0.75rem; display: block; opacity: 0.3; }
  .moverlay { position: fixed; inset: 0; background: rgba(0,0,0,0.8); z-index: 100; display: flex; align-items: center; justify-content: center; padding: 1.5rem; animation: fi 0.2s ease forwards; }
  @keyframes fi { from { opacity:0; } to { opacity:1; } }
  .mbox { background: #111118; border: 1px solid #2A2A38; border-radius: 16px; padding: 2.25rem 2rem 1.75rem; max-width: 440px; width: 100%; box-shadow: 0 32px 64px rgba(0,0,0,0.65); animation: mu 0.25s ease forwards; }
  @keyframes mu { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
  .mico { width: 48px; height: 48px; border-radius: 12px; display: flex; align-items: center; justify-content: center; margin-bottom: 1.25rem; }
  .mico.purple { background: rgba(108,99,255,0.1); border: 1px solid rgba(108,99,255,0.2); }
  .mico.red    { background: rgba(239,68,68,0.1);  border: 1px solid rgba(239,68,68,0.2); }
  .mico.amber  { background: rgba(245,158,11,0.1); border: 1px solid rgba(245,158,11,0.2); }
  .mtitle { font-size: 1.15rem; font-weight: 700; letter-spacing: -0.02em; color: #F0EEE9; margin: 0 0 0.5rem; }
  .mbody  { font-size: 0.85rem; color: #6B6880; font-weight: 300; line-height: 1.65; margin: 0 0 1.25rem; }
  .msbox  { background: #16161F; border: 1px solid #1E1E2A; border-radius: 8px; padding: 0.75rem 1rem; margin-bottom: 1.5rem; }
  .msname { font-size: 0.85rem; font-weight: 600; color: #F0EEE9; margin-bottom: 2px; }
  .msmail { font-size: 0.75rem; color: #6B6880; }
  .macts  { display: flex; gap: 0.75rem; }
  .macts.col { flex-direction: column; }
  .mcancel { flex: 1; font-family: 'Space Grotesk', sans-serif; font-size: 0.88rem; font-weight: 600; color: #6B6880; background: transparent; border: 1px solid #2A2A38; border-radius: 8px; padding: 0.75rem; cursor: pointer; transition: color 0.2s, border-color 0.2s; text-align: center; }
  .mcancel:hover { color: #F0EEE9; border-color: #444; }
  .mconfirm { font-family: 'Space Grotesk', sans-serif; font-size: 0.88rem; font-weight: 700; color: #fff; border: none; border-radius: 8px; padding: 0.75rem 1.25rem; cursor: pointer; transition: opacity 0.2s; text-align: center; }
  .mconfirm:hover { opacity: 0.88; }
  .mconfirm.purple { background: #6C63FF; flex: 2; }
  .mconfirm.red    { background: #EF4444; flex: 2; }
  .mproc { display: flex; align-items: center; justify-content: center; gap: 0.6rem; font-size: 0.82rem; color: #6B6880; padding: 0.75rem 0; }
  .spin  { width: 16px; height: 16px; border-radius: 50%; border: 2px solid #2A2A38; border-top-color: #6C63FF; animation: sp 0.7s linear infinite; }
  @keyframes sp { to { transform:rotate(360deg); } }
  .verify-q   { font-size: 1rem; font-weight: 600; color: #F0EEE9; margin: 0 0 0.6rem; }
  .verify-sub { font-size: 0.82rem; color: #6B6880; margin: 0 0 1.5rem; line-height: 1.6; }
  .vbtn { width: 100%; font-family: 'Space Grotesk', sans-serif; font-size: 0.9rem; font-weight: 700; border: none; border-radius: 10px; padding: 0.85rem; cursor: pointer; transition: opacity 0.2s, transform 0.15s; text-align: center; margin-bottom: 0.6rem; }
  .vbtn:hover { opacity: 0.88; transform: translateY(-1px); }
  .vbtn.yes { background: #22C55E; color: #fff; }
  .vbtn.no  { background: rgba(239,68,68,0.12); color: #f87171; border: 1px solid rgba(239,68,68,0.25); }
  .vbtn.blk { background: #EF4444; color: #fff; }
  .twrap { position: fixed; bottom: 2rem; left: 50%; transform: translateX(-50%); z-index: 999; display: flex; flex-direction: column; align-items: center; gap: 0.5rem; pointer-events: none; }
  .toast { font-family: 'Space Grotesk', sans-serif; font-size: 0.82rem; font-weight: 500; padding: 0.65rem 1.25rem; border-radius: 99px; border: 1px solid; white-space: nowrap; animation: ti 0.3s ease forwards; pointer-events: none; }
  .toast.success { color: #22C55E; background: rgba(34,197,94,0.1);  border-color: rgba(34,197,94,0.25); }
  .toast.warn    { color: #F59E0B; background: rgba(245,158,11,0.1); border-color: rgba(245,158,11,0.25); }
  .toast.info    { color: #6C63FF; background: rgba(108,99,255,0.1); border-color: rgba(108,99,255,0.25); }
  .toast.error   { color: #EF4444; background: rgba(239,68,68,0.1);  border-color: rgba(239,68,68,0.25); }
  @keyframes ti { from { opacity:0; transform:translateY(10px); } to { opacity:1; transform:translateY(0); } }
  .arow { max-width: 900px; margin: 2rem auto 0; padding: 0 2rem; display: flex; gap: 0.85rem; flex-wrap: wrap; }
  .abtn2 { display: inline-flex; align-items: center; gap: 0.5rem; font-family: 'Space Grotesk', sans-serif; font-size: 0.83rem; font-weight: 600; color: #6C63FF; background: rgba(108,99,255,0.08); border: 1px solid rgba(108,99,255,0.2); border-radius: 8px; padding: 0.65rem 1.2rem; cursor: pointer; transition: background 0.2s, border-color 0.2s; }
  .abtn2:hover { background: rgba(108,99,255,0.15); border-color: rgba(108,99,255,0.4); }
  @keyframes fu { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
  @media (max-width: 600px) {
    .rnav { padding: 1.25rem; } .rnav .ne { display: none; }
    .sgrid { grid-template-columns: repeat(2,1fr); padding: 0 1.25rem; }
    .sec { padding: 0 1.25rem; } .arow { padding: 0 1.25rem; }
    .mbox { padding: 1.75rem 1.25rem 1.5rem; }
  }
`;

// ── Storage helpers ───────────────────────────────────────────────────────────
const loadUnsub = () => { try { return JSON.parse(localStorage.getItem("detachx_unsub_history") || "[]"); } catch { return []; } };
const saveUnsubLocal = (d) => localStorage.setItem("detachx_unsub_history", JSON.stringify(d));
const loadBlock = () => { try { return JSON.parse(localStorage.getItem("detachx_block_history") || "[]"); } catch { return []; } };
const saveBlockLocal = (d) => localStorage.setItem("detachx_block_history", JSON.stringify(d));

function cleanBlockHistory() {
  const raw   = loadBlock();
  const valid = raw.filter((e) => e.filterId && typeof e.filterId === "string" && e.filterId.length > 0);
  if (valid.length !== raw.length) saveBlockLocal(valid);
  return valid;
}

// ✅ Migrate old statuses in localStorage on load
function migrateLocalStatuses(history) {
  const statusMap = {
    pending:          "user_unsubscribed",
    confirmed:        "user_unsubscribed",
    still_receiving:  "unsubscribe_failed",
    user_unsubscribed: "user_unsubscribed",
    unsubscribe_failed:"unsubscribe_failed",
  };
  return history.map((entry) => ({
    ...entry,
    verificationStatus: statusMap[entry.verificationStatus] || "user_unsubscribed",
    reportedAt: entry.reportedAt || entry.at,
  }));
}

function extractEmail(from) {
  const m = from.match(/<([^>]+)>/);
  return m ? m[1] : from.trim();
}

async function createGmailFilter(token, filterEmail, timeoutMs = 30000) {
  const payload = {
    criteria: { from: filterEmail },
    action: { removeLabelIds: ["INBOX"], addLabelIds: ["TRASH"] },
  };
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(
      "https://gmail.googleapis.com/gmail/v1/users/me/settings/filters",
      {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: controller.signal,
      }
    );
    clearTimeout(timeoutId);
    if (res.status === 401) throw new Error("TOKEN_EXPIRED");
    if (res.status === 403) throw new Error("PERMISSION_DENIED");
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error?.message || `FILTER_ERROR_${res.status}`);
    if (!data.id || typeof data.id !== "string" || !data.id.trim())
      throw new Error("FILTER_ID_MISSING");
    return data;
  } catch (err) {
    clearTimeout(timeoutId);
    if (err.name === "AbortError") throw new Error("REQUEST_TIMEOUT");
    throw err;
  }
}

let tid = 0;

export default function ResultsPage({ session }) {
  const navigate  = useNavigate();
  const user      = session?.user;
  const userEmail = user?.email || "";
  const userPic   = user?.user_metadata?.avatar_url || user?.user_metadata?.picture || "";

  const [result,    setResult]    = useState(null);
  const [unsubHist, setUnsubHist] = useState([]);
  const [blockHist, setBlockHist] = useState([]);
  const [activeTab, setActiveTab] = useState("active");
  const [toasts,    setToasts]    = useState([]);
  const [modal,     setModal]     = useState({
    open: false, type: null, item: null, processing: false,
  });

  // ── Load ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const raw = localStorage.getItem("scan_result");
    if (!raw) { navigate("/dashboard"); return; }
    const data = JSON.parse(raw);
    if (data.userEmail && data.userEmail !== userEmail) {
      localStorage.removeItem("scan_result");
      navigate("/dashboard");
      return;
    }
    setResult(data);

    // ✅ Migrate old statuses on load
    const rawUnsub    = loadUnsub();
    const migratedUnsub = migrateLocalStatuses(rawUnsub);
    // Save migrated back to localStorage
    saveUnsubLocal(migratedUnsub);
    setUnsubHist(migratedUnsub);
    setBlockHist(cleanBlockHistory());

    // ✅ Migrate Supabase records once
    if (userEmail) {
      migrateSupabaseStatuses(userEmail).catch(() => {});
    }
  }, []);

  // ── Toast ──────────────────────────────────────────────────────────────────
  const toast = useCallback((msg, type = "info", dur = 3500) => {
    const id = ++tid;
    setToasts((p) => [...p, { id, msg, type }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), dur);
  }, []);

  const closeModal = () => {
    if (!modal.processing)
      setModal({ open: false, type: null, item: null, processing: false });
  };

  const unsubDomains   = new Set(unsubHist.map((h) => h.domain));
  const blockDomains   = new Set(blockHist.map((h) => h.domain));
  const handledDomains = new Set([...unsubDomains, ...blockDomains]);

  // ── Unsub flow ─────────────────────────────────────────────────────────────
  const clickUnsub = useCallback((item) => {
    setModal({ open: true, type: "unsub-confirm", item, processing: false });
  }, []);

  const proceedUnsub = useCallback((item) => {
    const opened = window.open(item.unsubUrl, "_blank", "noopener,noreferrer");
    if (!opened || opened.closed || typeof opened.closed === "undefined") {
      // Fix #11: Popup was blocked — show URL in toast and as direct link
      toast(`Popup blocked. Open the link manually: ${item.unsubUrl}`, "warn", 8000);
      // Still show verification but with the URL displayed
      setModal({ open: true, type: "unsub-verify-blocked", item, processing: false });
    } else {
      setModal({ open: true, type: "unsub-verify", item, processing: false });
    }
  }, [toast]);

  /* Fix #11: Handle case where user opens the link manually after popup was blocked */
  const proceedUnsubManual = useCallback((item) => {
    // User clicked the manual link — same flow as if popup succeeded
    setModal({ open: true, type: "unsub-verify", item, processing: false });
  }, []);

  const confirmUnsubSuccess = useCallback(async (item) => {
    const now = new Date().toISOString();
    const entry = {
      domain:             item.domain,
      from:               item.from,
      email:              extractEmail(item.from),
      subject:            item.subject,
      unsubUrl:           item.unsubUrl,
      action:             "unsubscribed",
      // ✅ New status model
      verificationStatus: "user_unsubscribed",
      reportedAt:         now,
      at:                 now,
    };
    const upd = [...unsubHist, entry];
    setUnsubHist(upd);
    saveUnsubLocal(upd);
    await saveUnsubEntry(userEmail, entry);
    setModal({ open: false, type: null, item: null, processing: false });
    toast(`${item.domain} marked as unsubscribed`, "success");
  }, [unsubHist, userEmail]);

  const reportUnsubFailed = useCallback((item) => {
    setModal({ open: true, type: "unsub-failed", item, processing: false });
  }, []);

  const switchToBlock = useCallback((item) => {
    setModal({ open: true, type: "block-confirm", item, processing: false });
  }, []);

  // ── Block flow ─────────────────────────────────────────────────────────────
  const clickBlock = useCallback((item) => {
    setModal({ open: true, type: "block-confirm", item, processing: false });
  }, []);

  // ✅ Block CTA from failed unsub row — reuses existing block system
  const clickBlockFromFailed = useCallback((item) => {
    setModal({ open: true, type: "block-confirm", item, processing: false });
  }, []);

  const confirmBlock = useCallback(async () => {
    const { item } = modal;
    if (!item) return;
    setModal((m) => ({ ...m, processing: true }));
    const token       = sessionStorage.getItem("gmail_token") || localStorage.getItem("gmail_token");
    const filterEmail = extractEmail(item.from || item.email || item.domain);
    try {
      const filterResult = await createGmailFilter(token, filterEmail);
      if (!filterResult.id) throw new Error("FILTER_ID_MISSING");

      const entry = {
        domain:      item.domain,
        from:        item.from || item.email || item.domain,
        email:       filterEmail,
        subject:     item.subject || "",
        action:      "blocked",
        filterId:    filterResult.id,
        filterEmail: filterEmail,
        at:          new Date().toISOString(),
      };

      // If this was a failed unsub → remove from unsub history first
      const updatedUnsub = unsubHist.filter((h) => h.domain !== item.domain);
      setUnsubHist(updatedUnsub);
      saveUnsubLocal(updatedUnsub);

      const updatedBlock = [...blockHist, entry];
      setBlockHist(updatedBlock);
      saveBlockLocal(updatedBlock);
      await saveBlockEntry(userEmail, entry);

      setModal({ open: false, type: null, item: null, processing: false });
      toast(`${item.domain} filtered ✓ — Filter ID: ${filterResult.id}`, "success", 5000);
    } catch (err) {
      setModal((m) => ({ ...m, processing: false }));
      if (err.message === "TOKEN_EXPIRED") {
        sessionStorage.removeItem("gmail_token");
        localStorage.removeItem("gmail_token"); navigate("/login"); return;
      }
      if (err.message === "REQUEST_TIMEOUT") {
        toast("Gmail is not responding. Check your connection and try again.", "error", 6000);
      } else if (err.message === "PERMISSION_DENIED") {
        toast("Permission denied. Log out and log in again.", "error", 6000);
      } else if (err.message.includes("FILTER_ID_MISSING")) {
        toast("Gmail did not confirm the filter. Sender stays Active.", "error", 5000);
      } else {
        toast(`Filter failed: ${err.message}`, "error", 5000);
      }
    }
  }, [modal, blockHist, unsubHist, userEmail, navigate]);

  const handleLogout = async () => {
    const { supabase } = await import("./lib/supabase");
    await supabase.auth.signOut();
    localStorage.removeItem("detachx_user");
    sessionStorage.removeItem("gmail_token");
    localStorage.removeItem("gmail_token");
    localStorage.removeItem("scan_result");
    localStorage.removeItem("detachx_migrated");
    navigate("/");
  };

  const fmtS = (iso) => iso
    ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
    : "";
  const fmt = (iso) => iso
    ? new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "";

  if (!result) return null;

  const activeList = result.unsubList.filter((i) => !handledDomains.has(i.domain));

  // Split unsub history by status
  const userUnsubbed  = unsubHist.filter((h) => h.verificationStatus === "user_unsubscribed");
  const failedUnsubs  = unsubHist.filter((h) => h.verificationStatus === "unsubscribe_failed");

  return (
    <>
      <style>{S}</style>
      <div className="rp">
        <div className="top-bar" />

        {/* Nav */}
        <nav className="rnav">
          <div className="wm">Detach<span>X</span></div>
          <div className="nr">
            {userPic && <img src={userPic} alt="" referrerPolicy="no-referrer" />}
            <span className="ne">{userEmail}</span>
            <button className="nbtn" onClick={() => navigate("/dashboard")}>Dashboard</button>
            <button className="nbtn" onClick={handleLogout}>Log out</button>
          </div>
        </nav>

        {/* Hero */}
        <div className="hero">
          <div className="hbadge">
            <svg width="8" height="8" viewBox="0 0 8 8" fill="currentColor"><circle cx="4" cy="4" r="4"/></svg>
            Scan Complete
          </div>
          <h1>Your Digital Footprint</h1>
          <p>Real results — {userEmail}</p>
          {result.scannedAt && <p className="smeta">Scanned on {fmt(result.scannedAt)}</p>}
        </div>

        {/* Stats */}
        <div className="sgrid">
          <div className="scard">
            <div className="ac" style={{ background: "#6C63FF" }} />
            <div className="sico" style={{ background: "rgba(108,99,255,0.12)" }}>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M2 4h14v10a1 1 0 01-1 1H3a1 1 0 01-1-1V4zm0 0l7 5.5L16 4" stroke="#6C63FF" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="slbl">Total Scanned</div>
            <div className="sval">{result.total.toLocaleString()}</div>
            <div className="ssub">emails</div>
          </div>
          <div className="scard">
            <div className="ac" style={{ background: "#F59E0B" }} />
            <div className="sico" style={{ background: "rgba(245,158,11,0.12)" }}>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <circle cx="9" cy="9" r="7" stroke="#F59E0B" strokeWidth="1.4"/>
                <path d="M9 6v3.5l2 2" stroke="#F59E0B" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
            </div>
            <div className="slbl">Active</div>
            <div className="sval">{activeList.length}</div>
            <div className="ssub">pending action</div>
          </div>
          <div className="scard">
            <div className="ac" style={{ background: "#22C55E" }} />
            <div className="sico" style={{ background: "rgba(34,197,94,0.12)" }}>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path d="M3 9l4 4 8-8" stroke="#22C55E" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div className="slbl">Unsubscribed</div>
            <div className="sval">{unsubHist.length}</div>
            <div className="ssub">user reported</div>
          </div>
          <div className="scard">
            <div className="ac" style={{ background: "#EF4444" }} />
            <div className="sico" style={{ background: "rgba(239,68,68,0.12)" }}>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <circle cx="9" cy="9" r="7" stroke="#EF4444" strokeWidth="1.4"/>
                <path d="M4 4l10 10" stroke="#EF4444" strokeWidth="1.4" strokeLinecap="round"/>
              </svg>
            </div>
            <div className="slbl">Filtered to Trash</div>
            <div className="sval">{blockHist.length}</div>
            <div className="ssub">Gmail filtered</div>
          </div>
        </div>

        {/* Section */}
        <div className="sec">
          <div className="shead">
            <span className="stitle">
              <svg width="15" height="15" viewBox="0 0 15 15" fill="none">
                <path d="M7.5 1L9 5.5H14L10 8.5L11.5 13L7.5 10.5L3.5 13L5 8.5L1 5.5H6L7.5 1Z"
                  stroke="#6C63FF" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              Sender Management
            </span>
          </div>

          {/* Tabs */}
          <div className="tabs">
            <button
              className={`tab${activeTab === "active" ? " active" : ""}`}
              onClick={() => setActiveTab("active")}
            >
              Active <span className="tab-count">{activeList.length}</span>
            </button>
            <button
              className={`tab t-green${activeTab === "unsub" ? " active" : ""}`}
              onClick={() => setActiveTab("unsub")}
            >
              Unsubscribed <span className="tab-count">{unsubHist.length}</span>
            </button>
            <button
              className={`tab t-red${activeTab === "blocked" ? " active" : ""}`}
              onClick={() => setActiveTab("blocked")}
            >
              Filtered <span className="tab-count">{blockHist.length}</span>
            </button>
          </div>

          {/* ══ ACTIVE ══ */}
          {activeTab === "active" && (
            <div className="ulist">
              {activeList.length === 0 ? (
                <div className="empty">
                  <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                    <circle cx="16" cy="16" r="14" stroke="#6C63FF" strokeWidth="1.5"/>
                    <path d="M10 16l4 4 8-8" stroke="#6C63FF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <p>All senders handled!<br/>Inbox looks clean.</p>
                </div>
              ) : (
                activeList.map((item, i) => {
                  const hasLink = !!item.unsubUrl;
                  return (
                    <div className="urow" key={i}>
                      <div className="ulet purple">
                        {(item.domain?.[0] || "?").toUpperCase()}
                      </div>
                      <div className="uinfo">
                        <div className="ufrom">{item.from}</div>
                        <div className="usubj">{item.subject || "No subject"}</div>
                        {item.emailCount > 1 && (
                          <div className="umeta">
                            {item.emailCount} emails
                            {item.lastReceived && (
                              <span style={{ color: "#3A3A4A" }}>
                                {" · "}Last: {fmtS(item.lastReceived)}
                              </span>
                            )}
                          </div>
                        )}
                        {!hasLink && (
                          <div className="umeta" style={{ color: "#4A4860" }}>
                            No unsubscribe link — filter to trash
                          </div>
                        )}
                      </div>
                      {hasLink
                        ? <button className="rbtn unsub" onClick={() => clickUnsub(item)}>Unsub</button>
                        : <button className="rbtn block" onClick={() => clickBlock(item)}>Filter</button>
                      }
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* ══ UNSUBSCRIBED ══ */}
          {activeTab === "unsub" && (
            <div className="ulist">
              {unsubHist.length === 0 ? (
                <div className="empty">
                  <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                    <circle cx="16" cy="16" r="14" stroke="#22C55E" strokeWidth="1.5"/>
                    <path d="M10 16l4 4 8-8" stroke="#22C55E" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <p>No unsubscriptions yet.<br/>Click Unsub on any sender with a link.</p>
                </div>
              ) : (
                [...unsubHist].reverse().map((item, i) => {
                  const isFailed = item.verificationStatus === "unsubscribe_failed";
                  return (
                    <div
                      className={`urow done ${isFailed ? "done-f" : "done-u"}`}
                      key={i}
                    >
                      <div className={`ulet ${isFailed ? "amber" : "green"}`}>
                        {(item.domain?.[0] || "?").toUpperCase()}
                      </div>
                      <div className="uinfo" style={{ flex: 1 }}>
                        <div className="ufrom">{item.from}</div>
                        <div className="usubj">{item.email || extractEmail(item.from)}</div>
                        <div className="umeta">
                          Reported on {fmtS(item.reportedAt || item.at)}
                        </div>

                        {/* ✅ Status 1: user_unsubscribed */}
                        {!isFailed && (
                          <div className="vstatus us">
                            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                              <circle cx="5" cy="5" r="4.5" fill="rgba(34,197,94,0.15)" stroke="#22C55E" strokeWidth="0.8"/>
                              <path d="M2.5 5l2 2 3-3" stroke="#22C55E" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/>
                            </svg>
                            User Unsubscribed
                          </div>
                        )}

                        {/* ✅ Status 2: unsubscribe_failed */}
                        {isFailed && (
                          <div className="fail-warn">
                            <strong>⚠ Unsubscribe May Not Have Worked</strong>
                            We detected new promotional emails after you reported unsubscribing.
                          </div>
                        )}
                      </div>

                      {/* ✅ Block CTA for failed unsub — reuses existing block system */}
                      {isFailed
                        ? (                    <button className="block-cta"
                            onClick={() => clickBlockFromFailed(item)}
                            title="Create Gmail filter to trash this sender's emails"
                          >
                            Filter
                          </button>
                        )
                        : (
                          <button className="rbtn done-u" disabled>Done ✓</button>
                        )
                      }
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* ══ BLOCKED ══ */}
          {activeTab === "blocked" && (
            <div className="ulist">
              {blockHist.length === 0 ? (
                <div className="empty">
                  <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
                    <circle cx="16" cy="16" r="14" stroke="#EF4444" strokeWidth="1.5"/>
                    <path d="M5 5l22 22" stroke="#EF4444" strokeWidth="1.8" strokeLinecap="round"/>
                  </svg>
                  <p>No filtered senders yet.</p>
                </div>
              ) : (
                [...blockHist].reverse().map((item, i) => (
                  <div className="urow done done-b" key={i}>
                    <div className="ulet red">{(item.domain?.[0] || "?").toUpperCase()}</div>
                    <div className="uinfo">
                      <div className="ufrom">{item.from}</div>
                      <div className="usubj">{item.email}</div>
                      <div className="umeta">
                        Filtered on {fmtS(item.at)}
                        {" · "}
                        <span style={{ color: "#22C55E" }}>Filter: {item.filterId}</span>
                      </div>
                    </div>
                    <button className="rbtn done-b" disabled>Filtered ✓</button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>

        {/* Bottom actions */}
        <div className="arow">
          <button className="abtn2" onClick={() => navigate("/scan")}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M13 7A6 6 0 1 1 7 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              <path d="M13 1v6h-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Scan Again
          </button>
          <button className="abtn2" onClick={() => navigate("/dashboard")}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M13 7H1M6 2L1 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            Back to Dashboard
          </button>
        </div>
      </div>

      {/* ══ MODALS ══ */}

      {/* 1. Pre-unsub confirm */}
      {modal.open && modal.type === "unsub-confirm" && modal.item && (
        <div className="moverlay" onClick={closeModal}>
          <div className="mbox" onClick={(e) => e.stopPropagation()}>
            <div className="mico purple">
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                <path d="M2 6h18v12a1 1 0 01-1 1H3a1 1 0 01-1-1V6zm0 0l9 7 9-7"
                  stroke="#6C63FF" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <h2 className="mtitle">Open Unsubscribe Page</h2>
            <p className="mbody">
              The sender's unsubscribe page will open in a new tab.
              Complete the process there, then come back and confirm if it worked.
            </p>
            <div className="msbox">
              <div className="msname">{modal.item.domain}</div>
              <div className="msmail">{extractEmail(modal.item.from)}</div>
            </div>
            <div className="macts">
              <button className="mcancel" onClick={closeModal}>Cancel</button>
              <button className="mconfirm purple" onClick={() => proceedUnsub(modal.item)}>
                Open Unsubscribe Page →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 2. Post-unsub verify */}
      {modal.open && modal.type === "unsub-verify" && modal.item && (
        <div className="moverlay">
          <div className="mbox">
            <div className="mico amber">
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                <path d="M11 4v7M11 15h.01" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round"/>
                <circle cx="11" cy="11" r="9" stroke="#F59E0B" strokeWidth="1.6"/>
              </svg>
            </div>
            <p className="verify-q">Did the unsubscribe work?</p>
            <p className="verify-sub">
              Check the tab that just opened. Only confirm if you saw a
              success message — not an error page.
            </p>
            <div className="msbox">
              <div className="msname">{modal.item.domain}</div>
              <div className="msmail">{extractEmail(modal.item.from)}</div>
            </div>
            <button className="vbtn yes" onClick={() => confirmUnsubSuccess(modal.item)}>
              ✓ Yes, I unsubscribed successfully
            </button>
            <button className="vbtn no" onClick={() => reportUnsubFailed(modal.item)}>
              ✗ No, the page showed an error
            </button>
          </div>
        </div>
      )}

      {/* 2b. Post-unsub verify — popup was blocked (Fix #11) */}
      {modal.open && modal.type === "unsub-verify-blocked" && modal.item && (
        <div className="moverlay">
          <div className="mbox">
            <div className="mico amber">
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                <path d="M11 4v7M11 15h.01" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round"/>
                <circle cx="11" cy="11" r="9" stroke="#F59E0B" strokeWidth="1.6"/>
              </svg>
            </div>
            <p className="verify-q">⚠ Popup was blocked</p>
            <p className="verify-sub">
              Your browser blocked the popup. Click the link below to open
              the unsubscribe page, then come back and confirm.
            </p>
            <div className="msbox">
              <div className="msname">{modal.item.domain}</div>
              <div className="msmail" style={{
                wordBreak: "break-all", fontSize: "0.7rem",
                color: "#6C63FF", marginTop: "4px"
              }}>
                {modal.item.unsubUrl}
              </div>
            </div>
            <button
              className="vbtn yes"
              onClick={() => {
                window.open(modal.item.unsubUrl, "_blank", "noopener,noreferrer");
                proceedUnsubManual(modal.item);
              }}
              style={{ marginBottom: "0.4rem" }}
            >
              🔗 Open Unsubscribe Page
            </button>
            <button className="vbtn no" onClick={() => reportUnsubFailed(modal.item)}>
              ✗ Skip (unsubscribe failed)
            </button>
          </div>
        </div>
      )}

      {/* 3. Unsub failed — offer block */}
      {modal.open && modal.type === "unsub-failed" && modal.item && (
        <div className="moverlay" onClick={closeModal}>
          <div className="mbox" onClick={(e) => e.stopPropagation()}>
            <div className="mico red">
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                <circle cx="11" cy="11" r="9" stroke="#EF4444" strokeWidth="1.6"/>
                <path d="M4 4l14 14" stroke="#EF4444" strokeWidth="1.6" strokeLinecap="round"/>
              </svg>
            </div>
            <h2 className="mtitle">Unsubscribe Failed</h2>
            <p className="mbody">
              The page didn't work for{" "}
              <strong style={{ color: "#F0EEE9" }}>{modal.item.domain}</strong>.
              Filter this sender instead — future emails will go to Trash automatically.
            </p>
            <div className="macts col">
              <button className="vbtn blk" onClick={() => switchToBlock(modal.item)}>
                Filter to Trash
              </button>
              <button className="mcancel" onClick={closeModal}>
                Keep Active (try again later)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Block confirm */}
      {modal.open && modal.type === "block-confirm" && modal.item && (
        <div className="moverlay" onClick={closeModal}>
          <div className="mbox" onClick={(e) => e.stopPropagation()}>
            <div className="mico red">
              <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
                <circle cx="11" cy="11" r="9" stroke="#EF4444" strokeWidth="1.6"/>
                <path d="M4 4l14 14" stroke="#EF4444" strokeWidth="1.6" strokeLinecap="round"/>
              </svg>
            </div>
            <h2 className="mtitle">Filter Sender to Trash</h2>
            <p className="mbody">
              A Gmail filter will be created. Future emails from this sender
              move to Trash automatically. Saved to Filtered only after
              Gmail confirms the filter.
            </p>
            <div className="msbox">
              <div className="msname">{modal.item.domain}</div>
              <div className="msmail">{extractEmail(modal.item.from || modal.item.email || "")}</div>
            </div>
            {modal.processing
              ? <div className="mproc"><div className="spin" />Creating Gmail filter…</div>
              : (
                <div className="macts">
                  <button className="mcancel" onClick={closeModal}>Cancel</button>
                  <button className="mconfirm red" onClick={confirmBlock}>
                    Confirm — Filter to Trash
                  </button>
                </div>
              )
            }
          </div>
        </div>
      )}

      {/* Toasts */}
      <div className="twrap">
        {toasts.map((t) => (
          <div key={t.id} className={`toast ${t.type}`}>{t.msg}</div>
        ))}
      </div>
    </>
  );
}