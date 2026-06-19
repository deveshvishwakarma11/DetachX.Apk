import { useEffect, useState } from "react";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { supabase } from "./lib/supabase";
import HomePage      from "./HomePage";
import LoginPage     from "./LoginPage";
import DashboardPage from "./DashboardPage";
import ScanPage      from "./ScanPage";
import ResultsPage   from "./ResultsPage";
import FootprintPage  from "./FootprintPage";

export default function App() {
  const [session,  setSession]  = useState(undefined);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    // ✅ Step 1: pehle URL mein code check karo (OAuth callback)
    const hasOAuthCode =
      window.location.search.includes("code=") ||
      window.location.hash.includes("access_token");

    // ✅ Step 2: session lo
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      // Agar OAuth code hai aur session nahi — thoda wait karo
      if (hasOAuthCode && !data.session) {
        // onAuthStateChange handle karega
        return;
      }
      setChecking(false);
    });

    // ✅ Step 3: Auth state changes suno
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      // Fix #14: only log PII in dev — prevents email exposure in production console
      if (import.meta.env.DEV) {
        console.log("[DetachX] auth event:", event, session?.user?.email);
      } else {
        console.log("[DetachX] auth event:", event);
      }
      setSession(session);
      setChecking(false);
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  // Loading spinner
  if (checking) {
    return (
      <div style={{
        minHeight: "100vh", background: "#0A0A0F",
        display: "flex", alignItems: "center", justifyContent: "center",
        flexDirection: "column", gap: "1rem",
      }}>
        <div style={{
          width: "24px", height: "24px", borderRadius: "50%",
          border: "2px solid #2A2A38", borderTopColor: "#6C63FF",
          animation: "spin 0.7s linear infinite",
        }} />
        <p style={{
          fontFamily: "'Space Grotesk', sans-serif",
          fontSize: "0.8rem", color: "#4A4860", letterSpacing: "0.05em",
        }}>
          Connecting…
        </p>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  return (
    <HashRouter>
      <AuthRedirect session={session} />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={
          session ? <Navigate to="/dashboard" replace /> : <LoginPage />
        } />
        <Route path="/dashboard" element={
          session ? <DashboardPage session={session} /> : <Navigate to="/login" replace />
        } />
        <Route path="/scan" element={
          session ? <ScanPage session={session} /> : <Navigate to="/login" replace />
        } />
        <Route path="/results" element={
          session ? <ResultsPage session={session} /> : <Navigate to="/login" replace />
        } />
        <Route path="/footprint" element={
          session ? <FootprintPage session={session} /> : <Navigate to="/login" replace />
        } />
      </Routes>
    </HashRouter>
  );
}

// ✅ Yeh component session milne pe dashboard pe bhejta hai
function AuthRedirect({ session }) {
  useEffect(() => {
    if (session) {
      // Agar user / ya /login pe hai aur session hai → dashboard
      const hash = window.location.hash;
      if (hash === "#/" || hash === "#/login" || hash === "" || !hash) {
        window.location.hash = "#/dashboard";
      }
    }
  }, [session]);

  return null;
}