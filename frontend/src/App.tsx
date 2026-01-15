import React, { useEffect, useState } from "react";
import { clearToken, getToken, setToken, api } from "./api/client";
import Login from "./pages/Login";
import Uploads from "./pages/Uploads";
import UploadDetail from "./pages/UploadDetail";

type View =
  | { name: "login" }
  | { name: "uploads" }
  | { name: "upload"; uploadId: number };

export default function App() {
  const [view, setView] = useState<View>({ name: "login" });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Validate token on mount
    async function validateAuth() {
      const token = getToken();
      if (token) {
        try {
          // Try to fetch jobs to validate token
          await api.listJobs();
          setView({ name: "uploads" });
        } catch (error) {
          // Token is invalid or expired, clear it
          clearToken();
          setView({ name: "login" });
        }
      }
      setLoading(false);
    }
    validateAuth();
  }, []);

  function onAuth(token: string) {
    setToken(token);
    setView({ name: "uploads" });
  }

  function logout() {
    clearToken();
    setView({ name: "login" });
  }

  if (loading) {
    return (
      <div style={{ 
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        minHeight: "100vh",
        background: "#f5f5f5",
        display: "flex",
        alignItems: "center",
        justifyContent: "center"
      }}>
        <div style={{ textAlign: "center" }}>
          <div style={{ 
            fontSize: 48, 
            fontWeight: 700, 
            color: "#1a1a1a",
            marginBottom: 16
          }}>
            Loading...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ 
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      minHeight: "100vh",
      background: "#f5f5f5",
      padding: "20px"
    }}>
      <div style={{ maxWidth: 1200, margin: "0 auto" }}>
        <header style={{ 
          display: "flex", 
          alignItems: "center", 
          gap: 16, 
          marginBottom: 32,
          background: "#fff",
          padding: "20px 24px",
          borderRadius: 12,
          boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
          borderTop: "4px solid #1a1a1a"
        }}>
          <div style={{ flex: 1 }}>
            <h1 style={{ 
              margin: 0, 
              fontSize: 28, 
              fontWeight: 700,
              color: "#1a1a1a"
            }}>
              Data Ingestion Tool
            </h1>
            <p style={{ margin: "4px 0 0 0", fontSize: 14, color: "#666" }}>
              Manage your data imports and resolve conflicts
            </p>
          </div>
          {getToken() && (
            <button 
              onClick={logout}
              style={{
                padding: "10px 20px",
                background: "#fff",
                border: "2px solid #1a1a1a",
                borderRadius: 8,
                color: "#1a1a1a",
                fontWeight: 600,
                cursor: "pointer",
                fontSize: 14,
                transition: "all 0.2s"
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = "#1a1a1a";
                e.currentTarget.style.color = "#fff";
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = "#fff";
                e.currentTarget.style.color = "#1a1a1a";
              }}
            >
               Logout
            </button>
          )}
        </header>

        <div style={{
          background: "#fff",
          borderRadius: 12,
          padding: 24,
          boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
          minHeight: "400px"
        }}>
          {view.name === "login" && <Login onAuth={onAuth} />}

          {view.name === "uploads" && (
            <Uploads onOpenUpload={(uploadId) => setView({ name: "upload", uploadId })} />
          )}

          {view.name === "upload" && (
            <UploadDetail uploadId={view.uploadId} onBack={() => setView({ name: "uploads" })} />
          )}
        </div>
      </div>
    </div>
  );
}
