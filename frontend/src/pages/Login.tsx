import React, { useState } from "react";
import { api } from "../api/client";
import { getErrorMessage } from "../utils/errorHandler";

export default function Login({ onAuth }: { onAuth: (token: string) => void }) {
  const [email, setEmail] = useState("user@example.com");
  const [password, setPassword] = useState("test12345");
  const [mode, setMode] = useState<"login" | "register">("login");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setBusy(true);
    setErr(null);
    try {
      const res =
        mode === "register"
          ? await api.register(email, password)
          : await api.login(email, password);
      onAuth(res.access_token);
    } catch (e: any) {
      setErr(getErrorMessage(e, mode === "login" ? "Login failed" : "Registration failed"));
    } finally {
      setBusy(false);
    }
  }

  const buttonStyle = (isActive: boolean) => ({
    flex: 1,
    padding: "12px 24px",
    background: isActive ? "#1a1a1a" : "#f5f5f5",
    border: "none",
    borderRadius: 8,
    color: isActive ? "#fff" : "#666",
    fontWeight: 600,
    cursor: isActive ? "default" : "pointer",
    fontSize: 15,
    transition: "all 0.2s",
    boxShadow: isActive ? "0 2px 8px rgba(255, 107, 53, 0.3)" : "none"
  });

  const inputStyle = {
    width: "100%",
    padding: "12px 16px",
    border: "2px solid #e0e0e0",
    borderRadius: 8,
    fontSize: 15,
    marginTop: 8,
    transition: "border-color 0.2s",
    boxSizing: "border-box" as const
  };

  return (
    <div style={{ maxWidth: 460, margin: "40px auto" }}>
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <h2 style={{ fontSize: 32, fontWeight: 700, margin: "0 0 8px 0", color: "#333" }}>
          {mode === "login" ? "Welcome Back" : "Create Account"}
        </h2>
        <p style={{ margin: 0, fontSize: 15, color: "#666" }}>
          {mode === "login" ? "Sign in to continue" : "Sign up to get started"}
        </p>
      </div>

      <div style={{ display: "flex", gap: 12, marginBottom: 24 }}>
        <button 
          disabled={mode === "login"} 
          onClick={() => setMode("login")}
          style={buttonStyle(mode === "login")}
        >
          Login
        </button>
        <button 
          disabled={mode === "register"} 
          onClick={() => setMode("register")}
          style={buttonStyle(mode === "register")}
        >
          Register
        </button>
      </div>

      <div style={{ display: "grid", gap: 20 }}>
        <label style={{ display: "block" }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: "#333" }}>Email Address</span>
          <input 
            style={inputStyle}
            type="email"
            placeholder="you@example.com"
            value={email} 
            onChange={(e) => setEmail(e.target.value)}
            onFocus={(e) => e.currentTarget.style.borderColor = "#1a1a1a"}
            onBlur={(e) => e.currentTarget.style.borderColor = "#e0e0e0"}
          />
        </label>
        <label style={{ display: "block" }}>
          <span style={{ fontSize: 14, fontWeight: 600, color: "#333" }}>Password</span>
          <input 
            style={inputStyle}
            type="password"
            placeholder="••••••••"
            value={password} 
            onChange={(e) => setPassword(e.target.value)}
            onFocus={(e) => e.currentTarget.style.borderColor = "#1a1a1a"}
            onBlur={(e) => e.currentTarget.style.borderColor = "#e0e0e0"}
          />
        </label>
        <button 
          onClick={submit} 
          disabled={busy}
          style={{
            padding: "14px 24px",
            background: busy ? "#ccc" : "#1a1a1a",
            border: "none",
            borderRadius: 8,
            color: "#fff",
            fontWeight: 700,
            cursor: busy ? "not-allowed" : "pointer",
            fontSize: 16,
            marginTop: 8,
            boxShadow: busy ? "none" : "0 2px 8px rgba(255, 107, 53, 0.3)",
            transition: "all 0.2s"
          }}
          onMouseOver={(e) => {
            if (!busy) {
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow = "0 4px 12px rgba(255, 107, 53, 0.4)";
            }
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.boxShadow = busy ? "none" : "0 2px 8px rgba(255, 107, 53, 0.3)";
          }}
        >
          {busy ? "⏳ Working..." : mode === "register" ? "🚀 Create Account" : "🔐 Sign In"}
        </button>
        {err && (
          <div style={{ 
            color: "#dc3545", 
            background: "#ffe6e6",
            padding: "12px 16px",
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 500,
            border: "1px solid"
          }}>
            {err}
          </div>
        )}
      </div>
    </div>
  );
}
