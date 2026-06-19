import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "./lib/supabase";

const loginStyles = `
  .login-page {
    position: relative; min-height: 100dvh;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    padding: 2rem; overflow: hidden; background: #0A0A0F;
  }
  .login-page .bg-x {
    position: absolute; inset: 0; display: flex;
    align-items: center; justify-content: center;
    pointer-events: none; z-index: 0;
  }
  .login-page .bg-x svg {
    width: min(70vw, 600px); height: min(70vw, 600px);
    opacity: 0.025; animation: pulse-x 6s ease-in-out infinite;
  }
  .login-page::before {
    content: ''; position: absolute; inset: 0;
    background: radial-gradient(ellipse 70% 70% at 50% 50%, transparent 30%, #0A0A0F 100%);
    z-index: 1; pointer-events: none;
  }
  .login-page .top-bar {
    position: absolute; top: 0; left: 0; right: 0; height: 1px;
    background: linear-gradient(90deg, transparent, #1E1E2A 30%, #6C63FF 50%, #1E1E2A 70%, transparent);
    z-index: 10; opacity: 0; animation: bar-appear 1.2s ease forwards;
  }
  .back-link {
    position: absolute; top: 2rem; left: 2rem;
    display: inline-flex; align-items: center; gap: 0.45rem;
    font-family: 'Space Grotesk', sans-serif; font-size: 0.8rem;
    font-weight: 500; letter-spacing: 0.05em; color: #6B6880;
    background: none; border: none; cursor: pointer; z-index: 10;
    transition: color 0.2s ease; opacity: 0;
    animation: fade-up 0.6s ease 0.2s forwards;
  }
  .back-link:hover { color: #F0EEE9; }
  .login-page .wordmark {
    position: absolute; top: 2rem;
    font-family: 'Space Grotesk', sans-serif; font-size: 1rem;
    font-weight: 600; letter-spacing: 0.08em; color: #F0EEE9;
    z-index: 10; opacity: 0; animation: fade-up 0.7s ease 0.2s forwards;
  }
  .login-page .wordmark span { color: #6C63FF; }
  .login-card {
    position: relative; z-index: 10; width: 100%; max-width: 420px;
    display: flex; flex-direction: column; align-items: center;
    background: #111118; border: 1px solid #1E1E2A; border-radius: 16px;
    padding: 2.75rem 2.5rem 2.5rem;
    box-shadow: 0 0 0 1px rgba(108,99,255,0.06), 0 32px 64px rgba(0,0,0,0.5);
  }
  .login-icon {
    width: 48px; height: 48px; border-radius: 12px;
    background: rgba(108,99,255,0.12); border: 1px solid rgba(108,99,255,0.2);
    display: flex; align-items: center; justify-content: center;
    margin-bottom: 1.5rem; opacity: 0; animation: fade-up 0.6s ease 0.55s forwards;
  }
  .login-title {
    font-family: 'Space Grotesk', sans-serif; font-size: 1.6rem;
    font-weight: 700; letter-spacing: -0.02em; color: #F0EEE9;
    text-align: center; margin-bottom: 0.6rem;
    opacity: 0; animation: fade-up 0.6s ease 0.7s forwards;
  }
  .login-subtitle {
    font-size: 0.9rem; font-weight: 300; line-height: 1.6;
    color: #6B6880; text-align: center; max-width: 300px;
    margin-bottom: 2.25rem; opacity: 0; animation: fade-up 0.6s ease 0.85s forwards;
  }
  .login-divider {
    width: 100%; height: 1px; background: #1E1E2A;
    margin-bottom: 2.25rem; opacity: 0; animation: fade-up 0.6s ease 0.9s forwards;
  }
  .google-btn {
    position: relative; width: 100%; display: inline-flex;
    align-items: center; justify-content: center; gap: 0.75rem;
    font-family: 'Space Grotesk', sans-serif; font-size: 0.95rem;
    font-weight: 600; letter-spacing: 0.02em; color: #F0EEE9;
    padding: 0.9rem 1.5rem; border-radius: 8px; border: 1px solid #2A2A38;
    background: #16161F; cursor: pointer; overflow: hidden;
    transition: border-color 0.3s ease, background 0.3s ease;
    opacity: 0; animation: fade-up 0.6s ease 1s forwards; margin-bottom: 1rem;
  }
  .google-btn::before {
    content: ''; position: absolute; inset: 0;
    background: linear-gradient(135deg, rgba(108,99,255,0.08) 0%, transparent 60%);
    opacity: 0; transition: opacity 0.3s ease;
  }
  .google-btn:hover { border-color: rgba(108,99,255,0.4); background: #1A1A25; }
  .google-btn:hover::before { opacity: 1; }
  .google-btn:disabled { opacity: 0.5; cursor: not-allowed; }
  .google-btn svg { flex-shrink: 0; position: relative; z-index: 1; }
  .google-btn span { position: relative; z-index: 1; }
  .login-error {
    font-size: 0.78rem; color: #EF4444; text-align: center;
    background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.2);
    border-radius: 8px; padding: 0.6rem 1rem; margin-bottom: 1rem; width: 100%;
  }
  .terms-note {
    font-size: 0.68rem; color: #4A4860; text-align: center;
    line-height: 1.6; letter-spacing: 0.02em;
    opacity: 0; animation: fade-up 0.6s ease 1.15s forwards;
  }
  .login-page .footer-note {
    position: absolute; bottom: 2rem; font-size: 0.72rem;
    color: #6B6880; letter-spacing: 0.05em; z-index: 10;
    opacity: 0; animation: fade-up 0.7s ease 1.3s forwards;
  }
  @keyframes pulse-x {
    0%, 100% { opacity: 0.025; transform: scale(1); }
    50%       { opacity: 0.04;  transform: scale(1.04); }
  }
  @keyframes bar-appear { to { opacity: 1; } }
  @keyframes fade-up {
    from { opacity: 0; transform: translateY(18px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @media (max-width: 480px) { .login-card { padding: 2rem 1.5rem; } }
`;

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" fill="#34A853"/>
      <path d="M3.964 10.706A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.706V4.962H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.038l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.962L3.964 7.294C4.672 5.167 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  );
}

export default function LoginPage() {
  const navigate   = useNavigate();
  const [loading,  setLoading]  = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleGoogleLogin = async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          // ✅ Request Gmail readonly scope in addition to default scopes
          scopes: [
            "https://www.googleapis.com/auth/gmail.readonly",
            "https://www.googleapis.com/auth/gmail.settings.basic",
          ].join(" "),
        
         redirectTo: import.meta.env.VITE_APP_URL || window.location.origin,
          queryParams: {
            access_type: "offline",
            prompt:      "consent",
          },
        },
      });
      if (error) throw error;
      // Supabase redirects to Google — no navigate needed here
    } catch (err) {
      console.error("[DetachX] login error:", err);
      setErrorMsg("Login failed. Please try again.");
      setLoading(false);
    }
  };

  return (
    <>
      <style>{loginStyles}</style>
      <div className="login-page page-enter">
        <div className="top-bar" />
        <div className="bg-x" aria-hidden="true">
          <svg viewBox="0 0 200 200" fill="none">
            <line x1="20" y1="20" x2="180" y2="180" stroke="#6C63FF" strokeWidth="14" strokeLinecap="round"/>
            <line x1="180" y1="20" x2="20"  y2="180" stroke="#6C63FF" strokeWidth="14" strokeLinecap="round"/>
          </svg>
        </div>
        <button className="back-link" onClick={() => navigate("/")}>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M13 7H1M6 2L1 7l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Back
        </button>
        <div className="wordmark">Detach<span>X</span></div>
        <div className="login-card">
          <div className="login-icon">
            <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
              <path d="M11 2L13.5 7.5L19.5 8.27L15.25 12.4L16.31 18.38L11 15.6L5.69 18.38L6.75 12.4L2.5 8.27L8.5 7.5L11 2Z" stroke="#6C63FF" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h1 className="login-title">Welcome to DetachX</h1>
          <p className="login-subtitle">Connect your Gmail account to scan your digital footprint.</p>
          <div className="login-divider" />
          {errorMsg && <div className="login-error">{errorMsg}</div>}
          <button
            className="google-btn"
            onClick={handleGoogleLogin}
            disabled={loading}
          >
            <GoogleIcon />
            <span>{loading ? "Redirecting…" : "Continue with Google"}</span>
          </button>
          <p className="terms-note">
            By continuing, you agree to our Terms of Service<br />and Privacy Policy.
          </p>
        </div>
        <p className="footer-note">© 2026 DetachX · All rights reserved</p>
      </div>
    </>
  );
}