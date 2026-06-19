import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "./lib/supabase";
import {
  loadUnsubHistory,
  loadBlockHistory,
  migrateFromLocalStorage,
  getFreshGmailToken,
} from "./lib/cloudStorage";

const dashStyles = `
  .dash-page {
    position: relative; min-height: 100dvh; display: flex;
    flex-direction: column; align-items: center; justify-content: center;
    padding: 2rem; overflow: hidden;
    background: #0A0A0F; font-family: 'Space Grotesk', sans-serif;
  }
  .dash-page::before {
    content: ''; position: absolute; inset: 0;
    background: radial-gradient(ellipse 70% 70% at 50% 50%, transparent 30%, #0A0A0F 100%);
    z-index: 1; pointer-events: none;
  }
  .dash-page .bg-x {
    position: absolute; inset: 0; display: flex;
    align-items: center; justify-content: center;
    pointer-events: none; z-index: 0;
  }
  .dash-page .bg-x svg {
    width: min(70vw, 600px); height: min(70vw, 600px);
    opacity: 0.025; animation: pulse-x 6s ease-in-out infinite;
  }
  .dash-page .top-bar {
    position: absolute; top: 0; left: 0; right: 0; height: 1px;
    background: linear-gradient(90deg, transparent, #1E1E2A 30%, #6C63FF 50%, #1E1E2A 70%, transparent);
    z-index: 10;
  }
  .dash-page .wordmark {
    position: absolute; top: 2rem; font-size: 1rem; font-weight: 600;
    letter-spacing: 0.08em; color: #F0EEE9; z-index: 10;
  }
  .dash-page .wordmark span { color: #6C63FF; }
  .dash-card {
    position: relative; z-index: 10; width: 100%; max-width: 420px;
    display: flex; flex-direction: column; align-items: center;
    background: #111118; border: 1px solid #1E1E2A; border-radius: 16px;
    padding: 2.75rem 2.5rem 2.5rem;
    box-shadow: 0 0 0 1px rgba(108,99,255,0.06), 0 32px 64px rgba(0,0,0,0.5);
    animation: fade-up 0.6s ease forwards;
  }
  .dash-avatar {
    width: 80px; height: 80px; border-radius: 50%;
    border: 2px solid #2A2A38; margin-bottom: 1.25rem; object-fit: cover;
  }
  .dash-name {
    font-size: 1.4rem; font-weight: 700; letter-spacing: -0.02em;
    color: #F0EEE9; margin: 0 0 0.35rem; text-align: center;
  }
  .dash-email {
    font-size: 0.85rem; font-weight: 300; color: #6B6880;
    margin: 0 0 2rem; text-align: center;
  }
  .dash-divider { width: 100%; height: 1px; background: #1E1E2A; margin-bottom: 2rem; }
  .sync-note {
    font-size: 0.72rem; color: #4A4860; text-align: center;
    margin-bottom: 1.25rem; display: flex; align-items: center;
    justify-content: center; gap: 0.4rem;
  }
  .sync-note.syncing { color: #6C63FF; }
  .sync-note.done    { color: #22C55E; }
  .sync-note.error   { color: #EF4444; }
  .token-warn {
    font-size: 0.72rem; color: #F59E0B; text-align: center;
    background: rgba(245,158,11,0.08); border: 1px solid rgba(245,158,11,0.2);
    border-radius: 8px; padding: 0.5rem 0.85rem; margin-bottom: 1rem;
    width: 100%;
  }
  .scan-btn {
    position: relative; width: 100%; display: inline-flex;
    align-items: center; justify-content: center; gap: 0.6rem;
    font-family: 'Space Grotesk', sans-serif; font-size: 0.95rem;
    font-weight: 600; letter-spacing: 0.02em; color: #0A0A0F;
    padding: 0.9rem 1.5rem; border-radius: 8px; border: none;
    background: #F0EEE9; cursor: pointer; margin-bottom: 0.85rem;
    transition: background 0.2s ease, transform 0.15s ease;
  }
  .scan-btn:hover { background: #ffffff; transform: translateY(-1px); }
  .scan-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
  .fp-btn {
    position: relative; width: 100%; display: inline-flex;
    align-items: center; justify-content: center; gap: 0.6rem;
    font-family: 'Space Grotesk', sans-serif; font-size: 0.95rem;
    font-weight: 600; letter-spacing: 0.02em; color: #6C63FF;
    padding: 0.9rem 1.5rem; border-radius: 8px; border: 1px solid rgba(108,99,255,0.3);
    background: rgba(108,99,255,0.06); cursor: pointer; margin-bottom: 0.85rem;
    transition: background 0.2s ease, border-color 0.2s ease, transform 0.15s ease;
  }
  .fp-btn:hover { background: rgba(108,99,255,0.12); border-color: rgba(108,99,255,0.5); transform: translateY(-1px); }
  .fp-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none; }
  .logout-btn {
    width: 100%; display: inline-flex; align-items: center; justify-content: center;
    font-family: 'Space Grotesk', sans-serif; font-size: 0.85rem; font-weight: 500;
    color: #4A4860; padding: 0.75rem 1.5rem; border-radius: 8px;
    border: 1px solid #1E1E2A; background: transparent; cursor: pointer;
    transition: color 0.2s ease, border-color 0.2s ease;
  }
  .logout-btn:hover { color: #6B6880; border-color: #2A2A38; }
  .dash-page .footer-note {
    position: absolute; bottom: 2rem; font-size: 0.72rem;
    color: #6B6880; letter-spacing: 0.05em; z-index: 10;
  }
  @keyframes pulse-x {
    0%, 100% { opacity: 0.025; transform: scale(1); }
    50%       { opacity: 0.04;  transform: scale(1.04); }
  }
  @keyframes fade-up {
    from { opacity: 0; transform: translateY(18px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @media (max-width: 480px) { .dash-card { padding: 2rem 1.5rem; } }
`;

export default function DashboardPage({ session }) {
  const navigate   = useNavigate();
  const [syncState, setSyncState] = useState("syncing");
  const [syncMsg,   setSyncMsg]   = useState("Loading your history…");
  const [tokenOk,   setTokenOk]   = useState(true); // ✅ track token health

  const user      = session?.user;
  const userEmail = user?.email || "";
  const userName  = user?.user_metadata?.full_name
                 || user?.user_metadata?.name
                 || "User";
  const userPic   = user?.user_metadata?.avatar_url
                 || user?.user_metadata?.picture
                 || "";

  useEffect(() => {
    if (!userEmail) return;
    initDashboard();
  }, [userEmail]);

  async function initDashboard() {
    setSyncState("syncing");
    setSyncMsg("Loading your history…");

    try {
      // ── Step 1: Get fresh Gmail token ─────────────────────────────────────
      setSyncMsg("Verifying Gmail access…");
      const freshToken = await getFreshGmailToken();

      if (!freshToken) {
        // provider_token missing — this happens when user logs in
        // from a different device/browser where token wasn't issued
        setTokenOk(false);
        console.warn("[DetachX] No Gmail token — user needs to re-login");
      } else {
        setTokenOk(true);
      }

      // Save user info regardless
      localStorage.setItem("detachx_user", JSON.stringify({
        name:    userName,
        email:   userEmail,
        picture: userPic,
      }));

      // ── Step 2: Migration ──────────────────────────────────────────────────
      const alreadyMigrated = localStorage.getItem("detachx_migrated");
      if (!alreadyMigrated) {
        setSyncMsg("Migrating local data to cloud…");
        await migrateFromLocalStorage(userEmail);
      }

      // ── Step 3: Load from Supabase ─────────────────────────────────────────
      setSyncMsg("Syncing from cloud…");
      const [cloudUnsub, cloudBlock] = await Promise.all([
        loadUnsubHistory(userEmail),
        loadBlockHistory(userEmail),
      ]);

      // Write to localStorage as cache
      localStorage.setItem("detachx_unsub_history", JSON.stringify(cloudUnsub));
      localStorage.setItem("detachx_block_history", JSON.stringify(cloudBlock));

      setSyncState("done");
      setSyncMsg(
        `Synced — ${cloudUnsub.length} unsubscribed, ${cloudBlock.length} blocked`
      );
      console.log("[DetachX] dashboard ready:", {
        unsub: cloudUnsub.length,
        block: cloudBlock.length,
        tokenOk: !!freshToken,
      });
    } catch (err) {
      console.error("[DetachX] dashboard init error:", err);
      setSyncState("error");
      setSyncMsg("Cloud sync failed — using local data");
    }
  }

  // ✅ Refresh token right before scan
  const handleScan = async () => {
    setSyncState("syncing");
    setSyncMsg("Refreshing Gmail access…");

    // Fix #10: Retry once before logging out
    let freshToken = await getFreshGmailToken();
    if (!freshToken) {
      // Transient failure — retry once after a brief delay
      console.log("[DetachX] handleScan: first token refresh failed, retrying…");
      setSyncMsg("Retrying…");
      await new Promise((r) => setTimeout(r, 2000));
      freshToken = await getFreshGmailToken();
    }

    if (!freshToken) {
      // Both attempts failed — show error instead of destroying state
      console.warn("[DetachX] handleScan: token refresh failed after retry");
      setSyncState("error");
      setSyncMsg("Could not refresh Gmail access. Try again.");
      setTokenOk(false);
      return;
    }

    setSyncState("done");
    setSyncMsg("Ready");
    setTokenOk(true);
    navigate("/scan");
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem("detachx_user");
    sessionStorage.removeItem("gmail_token");
    localStorage.removeItem("gmail_token");
    localStorage.removeItem("scan_result");
    localStorage.removeItem("detachx_migrated");
    navigate("/");
  };

  return (
    <>
      <style>{dashStyles}</style>
      <div className="dash-page">
        <div className="top-bar" />
        <div className="bg-x" aria-hidden="true">
          <svg viewBox="0 0 200 200" fill="none">
            <line x1="20" y1="20" x2="180" y2="180" stroke="#6C63FF" strokeWidth="14" strokeLinecap="round"/>
            <line x1="180" y1="20" x2="20"  y2="180" stroke="#6C63FF" strokeWidth="14" strokeLinecap="round"/>
          </svg>
        </div>
        <div className="wordmark">Detach<span>X</span></div>

        <div className="dash-card">
          {userPic && (
            <img
              src={userPic} alt="Profile"
              referrerPolicy="no-referrer" className="dash-avatar"
            />
          )}
          <h1 className="dash-name">{userName}</h1>
          <p className="dash-email">{userEmail}</p>

          {/* Sync status */}
          <div className={`sync-note ${syncState}`}>
            {syncState === "syncing" && (
              <>
                <div style={{
                  width: "10px", height: "10px", borderRadius: "50%",
                  border: "1.5px solid #2A2A38", borderTopColor: "#6C63FF",
                  animation: "spin 0.7s linear infinite", flexShrink: 0,
                }} />
                <style>{`@keyframes spin { to { transform:rotate(360deg); } }`}</style>
              </>
            )}
            {syncState === "done" && (
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                <circle cx="5" cy="5" r="4.5" fill="rgba(34,197,94,0.15)" stroke="#22C55E" strokeWidth="0.8"/>
                <path d="M2.5 5l2 2 3-3" stroke="#22C55E" strokeWidth="1.1" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            )}
            {syncMsg}
          </div>

          {/* ✅ Token warning — shown only if token missing */}
          {!tokenOk && (
            <div className="token-warn">
              ⚠ Gmail access expired — you'll be asked to log in again before scanning
            </div>
          )}

          <div className="dash-divider" />

          <button
            className="scan-btn"
            onClick={handleScan}
            disabled={syncState === "syncing"}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 1v14M1 8h14" stroke="#0A0A0F" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
            {syncState === "syncing" ? "Syncing…" : "Scan Gmail"}
          </button>

          {/* Digital Footprint button */}
          <button
            className="fp-btn"
            onClick={() => navigate("/footprint")}
            disabled={syncState === "syncing"}
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M8 1C4.1 1 1 4.1 1 8s3.1 7 7 7 7-3.1 7-7-3.1-7-7-7zM8 4v4l2.5 1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              <circle cx="8" cy="8" r="1.5" fill="currentColor"/>
            </svg>
            Digital Footprint
          </button>

          <button className="logout-btn" onClick={handleLogout}>Log out</button>
        </div>

        <p className="footer-note">© 2026 DetachX · All rights reserved</p>
      </div>
    </>
  );
}