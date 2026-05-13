import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { useState, useEffect } from "react";

function SplashScreen({ onDone }: { onDone: () => void }) {
  const [phase, setPhase] = useState<"enter" | "hold" | "exit">("enter");

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("hold"), 400);
    const t2 = setTimeout(() => setPhase("exit"), 1800);
    const t3 = setTimeout(() => onDone(), 2400);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [onDone]);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(135deg, #fff1f4 0%, #fce7f3 40%, #f5f3ff 100%)",
        zIndex: 9999,
        transition: "opacity 0.5s ease",
        opacity: phase === "exit" ? 0 : 1,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "16px",
          transition: "transform 0.5s cubic-bezier(0.34,1.56,0.64,1), opacity 0.4s ease",
          transform: phase === "enter" ? "scale(0.7) translateY(20px)" : phase === "hold" ? "scale(1) translateY(0)" : "scale(1.05) translateY(-10px)",
          opacity: phase === "enter" ? 0 : 1,
        }}
      >
        <div style={{
          width: 80, height: 80,
          background: "linear-gradient(135deg, #f43f5e, #ec4899, #a855f7)",
          borderRadius: 24,
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 20px 60px rgba(244,63,94,0.4)",
        }}>
          <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
          </svg>
        </div>

        <div style={{ textAlign: "center" }}>
          <div style={{
            fontSize: 40, fontWeight: 900, letterSpacing: "-2px",
            background: "linear-gradient(135deg, #f43f5e, #a855f7)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
            fontFamily: "'Plus Jakarta Sans', sans-serif",
          }}>
            Rizz
          </div>
          <div style={{
            fontSize: 13, color: "#9ca3af", fontWeight: 600,
            letterSpacing: "0.15em", textTransform: "uppercase",
            marginTop: 2,
          }}>
            your vibe, amplified
          </div>
        </div>

        <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
          {[0, 1, 2].map(i => (
            <div
              key={i}
              style={{
                width: 8, height: 8, borderRadius: "50%",
                background: "linear-gradient(135deg, #f43f5e, #a855f7)",
                animation: "bounce 1.2s ease-in-out infinite",
                animationDelay: `${i * 0.2}s`,
              }}
            />
          ))}
        </div>
      </div>

      <style>{`
        @keyframes bounce {
          0%, 100% { transform: translateY(0); opacity: 0.5; }
          50% { transform: translateY(-8px); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

function Root() {
  const [showSplash, setShowSplash] = useState(true);

  return (
    <>
      {showSplash && <SplashScreen onDone={() => setShowSplash(false)} />}
      <div style={{ opacity: showSplash ? 0 : 1, transition: "opacity 0.3s ease", transitionDelay: "0.1s" }}>
        <App />
      </div>
    </>
  );
}

createRoot(document.getElementById("root")!).render(<Root />);
