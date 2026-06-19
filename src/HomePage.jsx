import { useNavigate } from "react-router-dom";

const styles = `
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=Inter:wght@300;400;500&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --bg:         #0A0A0F;
    --surface:    #111118;
    --border:     #1E1E2A;
    --text:       #F0EEE9;
    --muted:      #6B6880;
    --accent:     #6C63FF;
    --accent-dim: rgba(108,99,255,0.15);
  }

  html, body { background: var(--bg); color: var(--text); font-family: 'Inter', sans-serif; }

  /* ── Page transition ── */
  .page-enter {
    animation: page-in 0.45s cubic-bezier(0.22, 1, 0.36, 1) forwards;
  }
  @keyframes page-in {
    from { opacity: 0; transform: translateY(12px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  /* ── Hero shell ── */
  .hero {
    position: relative;
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    overflow: hidden;
    background: var(--bg);
  }

  /* Ambient background X */
  .bg-x {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
    z-index: 0;
  }
  .bg-x svg {
    width: min(70vw, 600px);
    height: min(70vw, 600px);
    opacity: 0.035;
    animation: pulse-x 6s ease-in-out infinite;
  }
  @keyframes pulse-x {
    0%, 100% { opacity: 0.035; transform: scale(1); }
    50%       { opacity: 0.055; transform: scale(1.04); }
  }

  /* Radial vignette */
  .hero::before {
    content: '';
    position: absolute;
    inset: 0;
    background: radial-gradient(ellipse 70% 70% at 50% 50%, transparent 30%, var(--bg) 100%);
    z-index: 1;
    pointer-events: none;
  }

  /* Top rule */
  .top-bar {
    position: absolute;
    top: 0; left: 0; right: 0;
    height: 1px;
    background: linear-gradient(90deg, transparent, var(--border) 30%, var(--accent) 50%, var(--border) 70%, transparent);
    z-index: 10;
    opacity: 0;
    animation: bar-appear 1.2s ease forwards;
  }
  @keyframes bar-appear { to { opacity: 1; } }

  /* Wordmark */
  .wordmark {
    position: absolute;
    top: 2rem;
    font-family: 'Space Grotesk', sans-serif;
    font-size: 1rem;
    font-weight: 600;
    letter-spacing: 0.08em;
    color: var(--text);
    z-index: 10;
    opacity: 0;
    animation: fade-up 0.7s ease 0.2s forwards;
  }
  .wordmark span { color: var(--accent); }

  /* Content stack */
  .content {
    position: relative;
    z-index: 10;
    text-align: center;
    max-width: 760px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1.75rem;
  }

  /* Eyebrow */
  .eyebrow {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    font-size: 0.72rem;
    font-weight: 500;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: var(--accent);
    border: 1px solid rgba(108,99,255,0.3);
    border-radius: 999px;
    padding: 0.35rem 0.85rem;
    background: var(--accent-dim);
    opacity: 0;
    animation: fade-up 0.7s ease 0.5s forwards;
  }
  .eyebrow-dot {
    width: 5px; height: 5px;
    border-radius: 50%;
    background: var(--accent);
    animation: blink 2s ease-in-out infinite;
  }
  @keyframes blink {
    0%, 100% { opacity: 1; }
    50%       { opacity: 0.3; }
  }

  /* Headline */
  .headline {
    font-family: 'Space Grotesk', sans-serif;
    font-size: clamp(3.2rem, 9vw, 7rem);
    font-weight: 700;
    line-height: 1;
    letter-spacing: -0.03em;
    color: var(--text);
    opacity: 0;
    animation: fade-up 0.8s ease 0.75s forwards;
  }
  .headline-x {
    color: var(--accent);
    display: inline-block;
  }

  /* Tagline */
  .tagline {
    font-size: clamp(1rem, 2.2vw, 1.2rem);
    font-weight: 300;
    line-height: 1.65;
    color: var(--muted);
    max-width: 480px;
    opacity: 0;
    animation: fade-up 0.8s ease 1s forwards;
  }

  /* CTA */
  .cta-wrap {
    margin-top: 0.5rem;
    opacity: 0;
    animation: fade-up 0.8s ease 1.25s forwards;
  }
  .cta {
    position: relative;
    display: inline-flex;
    align-items: center;
    gap: 0.6rem;
    font-family: 'Space Grotesk', sans-serif;
    font-size: 0.95rem;
    font-weight: 600;
    letter-spacing: 0.04em;
    color: var(--text);
    padding: 0.85rem 2.2rem;
    border-radius: 6px;
    border: 1px solid rgba(108,99,255,0.5);
    background: transparent;
    cursor: pointer;
    overflow: hidden;
    transition: border-color 0.3s ease, color 0.3s ease;
    text-decoration: none;
  }
  .cta::before {
    content: '';
    position: absolute;
    inset: 0;
    background: var(--accent);
    transform: translateX(-102%);
    transition: transform 0.4s cubic-bezier(0.76, 0, 0.24, 1);
    z-index: 0;
  }
  .cta:hover::before  { transform: translateX(0); }
  .cta:hover          { border-color: var(--accent); color: #fff; }
  .cta span, .cta svg { position: relative; z-index: 1; }

  /* Footer */
  .footer-note {
    position: absolute;
    bottom: 2rem;
    font-size: 0.72rem;
    color: var(--muted);
    letter-spacing: 0.05em;
    z-index: 10;
    opacity: 0;
    animation: fade-up 0.7s ease 1.6s forwards;
  }

  @keyframes fade-up {
    from { opacity: 0; transform: translateY(18px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  @media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
      animation-duration: 0.01ms !important;
      animation-delay:    0.01ms !important;
      transition-duration: 0.01ms !important;
    }
  }
`;

export default function HomePage() {
  const navigate = useNavigate();

  return (
    <>
      <style>{styles}</style>
      <main className="hero page-enter">
        <div className="top-bar" />

        {/* Ambient X */}
        <div className="bg-x" aria-hidden="true">
          <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg">
            <line x1="20" y1="20" x2="180" y2="180" stroke="#6C63FF" strokeWidth="14" strokeLinecap="round"/>
            <line x1="180" y1="20" x2="20"  y2="180" stroke="#6C63FF" strokeWidth="14" strokeLinecap="round"/>
          </svg>
        </div>

        {/* Wordmark */}
        <div className="wordmark">
          Detach<span>X</span>
        </div>

        {/* Hero content */}
        <div className="content">
          <div className="eyebrow">
            <span className="eyebrow-dot" />
            Digital freedom starts here
          </div>

          <h1 className="headline">
            Detach<span className="headline-x">X</span>
          </h1>

          <p className="tagline">
            Detach yourself from unwanted accounts, emails, and digital clutter.
          </p>

          <div className="cta-wrap">
            <button className="cta" onClick={() => navigate("/login")}>
              <span>Get Started</span>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M1 7h12M8 2l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        </div>

        <p className="footer-note">© 2026 DetachX · All rights reserved</p>
      </main>
    </>
  );
}