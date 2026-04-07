import { useState } from "react";
import { signIn, signUp, resetPassword } from "../lib/auth";

const C = {
  ochre: "#B8622D", char: "#2C2C2C", mid: "#7A746B",
  warm: "#F5F0E8", warmDark: "#E8E1D5", white: "#FEFDFB",
  green: "#2D5A27", alert: "#C4652A",
};
const font = "'Source Sans 3', -apple-system, system-ui, sans-serif";

export default function Login() {
  const [mode, setMode] = useState("login"); // login | signup | forgot
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [signupDone, setSignupDone] = useState(false);
  const [resetSent, setResetSent] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (mode === "forgot") {
        await resetPassword(email);
        setResetSent(true);
      } else if (mode === "login") {
        await signIn(email, password);
      } else {
        await signUp(email, password, name);
        setSignupDone(true);
      }
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  }

  if (signupDone) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: C.warm, fontFamily: font, padding: 20 }}>
        <div style={{ background: C.white, borderRadius: 12, padding: 32, maxWidth: 380, width: "100%", textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>✉️</div>
          <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, color: C.char }}>Check your email</div>
          <p style={{ fontSize: 14, color: C.mid, lineHeight: 1.6, marginBottom: 20 }}>
            We sent a confirmation link to <strong>{email}</strong>. Click it to activate your account, then come back and log in.
          </p>
          <button onClick={() => { setSignupDone(false); setMode("login"); }} style={{ padding: "12px 24px", border: "none", borderRadius: 8, fontSize: 15, fontWeight: 700, fontFamily: font, cursor: "pointer", background: C.ochre, color: "#fff" }}>
            Back to login
          </button>
        </div>
      </div>
    );
  }

  if (resetSent) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: C.warm, fontFamily: font, padding: 20 }}>
        <div style={{ background: C.white, borderRadius: 12, padding: 32, maxWidth: 380, width: "100%", textAlign: "center" }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>🔑</div>
          <div style={{ fontSize: 20, fontWeight: 700, marginBottom: 8, color: C.char }}>Reset link sent</div>
          <p style={{ fontSize: 14, color: C.mid, lineHeight: 1.6, marginBottom: 20 }}>
            We sent a password reset link to <strong>{email}</strong>. Check your inbox and follow the link to set a new password.
          </p>
          <button onClick={() => { setResetSent(false); setMode("login"); }} style={{ padding: "12px 24px", border: "none", borderRadius: 8, fontSize: 15, fontWeight: 700, fontFamily: font, cursor: "pointer", background: C.ochre, color: "#fff" }}>
            Back to login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: C.warm, fontFamily: font, padding: 20 }}>
      <div style={{ background: C.white, borderRadius: 12, padding: 32, maxWidth: 380, width: "100%" }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontWeight: 700, fontSize: 22, color: C.ochre, letterSpacing: 0.5 }}>Munda</div>
          <div style={{ fontSize: 12, color: C.mid, letterSpacing: 1, marginTop: 4 }}>FFS TRACKER</div>
        </div>

        {mode === "forgot" ? (
          <div style={{ textAlign: "center", marginBottom: 24, fontSize: 14, color: C.mid }}>
            Enter your email and we'll send you a reset link.
          </div>
        ) : (
          <div style={{ display: "flex", gap: 0, marginBottom: 24, borderRadius: 6, overflow: "hidden" }}>
            {[["login", "Log in"], ["signup", "New account"]].map(([id, label]) => (
              <button key={id} onClick={() => { setMode(id); setError(""); }} style={{ flex: 1, padding: "10px 0", border: "none", cursor: "pointer", background: mode === id ? C.ochre : C.warmDark, color: mode === id ? "#fff" : C.mid, fontSize: 13, fontWeight: 700, fontFamily: font }}>
                {label}
              </button>
            ))}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {mode === "signup" && (
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.mid, letterSpacing: 0.8, marginBottom: 6, textTransform: "uppercase" }}>Full name</div>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Your name" required style={{ width: "100%", padding: "10px 12px", border: "1.5px solid " + C.warmDark, borderRadius: 6, fontSize: 16, fontFamily: font, background: C.white, color: C.char, outline: "none", boxSizing: "border-box" }} />
            </div>
          )}
          <div style={{ marginBottom: 14 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.mid, letterSpacing: 0.8, marginBottom: 6, textTransform: "uppercase" }}>Email</div>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required style={{ width: "100%", padding: "10px 12px", border: "1.5px solid " + C.warmDark, borderRadius: 6, fontSize: 16, fontFamily: font, background: C.white, color: C.char, outline: "none", boxSizing: "border-box" }} />
          </div>
          {mode !== "forgot" && (
            <div style={{ marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.mid, letterSpacing: 0.8, marginBottom: 6, textTransform: "uppercase" }}>Password</div>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder={mode === "signup" ? "Min 6 characters" : "Your password"} required minLength={6} style={{ width: "100%", padding: "10px 12px", border: "1.5px solid " + C.warmDark, borderRadius: 6, fontSize: 16, fontFamily: font, background: C.white, color: C.char, outline: "none", boxSizing: "border-box" }} />
            </div>
          )}

          {error && <div style={{ padding: "10px 12px", background: "#FDF0E6", borderRadius: 6, fontSize: 13, color: C.alert, marginBottom: 14 }}>{error}</div>}

          <button type="submit" disabled={loading} style={{ display: "block", width: "100%", padding: "13px", border: "none", borderRadius: 8, fontSize: 15, fontWeight: 700, fontFamily: font, cursor: loading ? "default" : "pointer", background: loading ? C.warmDark : C.green, color: "#fff", opacity: loading ? 0.6 : 1 }}>
            {loading ? "..." : mode === "forgot" ? "Send reset link" : mode === "login" ? "Log in" : "Create account"}
          </button>

          {mode === "login" && (
            <div style={{ textAlign: "center", marginTop: 14 }}>
              <button type="button" onClick={() => { setMode("forgot"); setError(""); }} style={{ background: "none", border: "none", color: C.ochre, fontSize: 13, cursor: "pointer", fontFamily: font, textDecoration: "underline" }}>
                Forgot password?
              </button>
            </div>
          )}
          {mode === "forgot" && (
            <div style={{ textAlign: "center", marginTop: 14 }}>
              <button type="button" onClick={() => { setMode("login"); setError(""); }} style={{ background: "none", border: "none", color: C.ochre, fontSize: 13, cursor: "pointer", fontFamily: font, textDecoration: "underline" }}>
                Back to login
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
