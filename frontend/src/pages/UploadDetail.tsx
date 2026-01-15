import React, { useEffect, useState } from "react";
import { api } from "../api/client";
import { getErrorMessage } from "../utils/errorHandler";

type Upload = {
  id: number;
  status: string;
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  conflict_count: number;
  error_message?: string | null;
  original_filename?: string | null;
};

type Candidate = {
  raw_row_id: number;
  row_number: number;
  data: { email: string; first_name?: string; last_name?: string; company?: string };
};

type Issue = {
  id: number;
  type: string;
  status: "OPEN" | "RESOLVED";
  key: string;
  payload: 
    | { email: string; candidates: Candidate[] }  // For DUPLICATE_EMAIL
    | { row_id: number; row_number: number; data: any; reason: string };  // For single-row issues
  resolution?: { chosen_row_id: number } | null;
};

export default function UploadDetail({ uploadId, onBack }: { uploadId: number; onBack: () => void }) {
  const [upload, setUpload] = useState<Upload | null>(null);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function load() {
    setErr(null);
    const d = await api.jobDetail(uploadId);
    setUpload(d.job);
    const iss = await api.listIssues(uploadId);
    setIssues(iss);
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [uploadId]);

  async function resolve(issueId: number, chosenRowId: number) {
    setBusy(true);
    setErr(null);
    try {
      await api.resolveIssue(issueId, chosenRowId);
      await load();
    } catch (e: any) {
      setErr(getErrorMessage(e, "Resolve failed"));
    } finally {
      setBusy(false);
    }
  }

  async function finalize() {
    setBusy(true);
    setErr(null);
    try {
      await api.finalize(uploadId);
      await load();
    } catch (e: any) {
      setErr(getErrorMessage(e, "Finalize failed"));
    } finally {
      setBusy(false);
    }
  }

  const openIssues = issues.filter((i) => i.status === "OPEN").length;

  const getStatusColor = (status: string) => {
    switch (status) {
      case "COMPLETED": return "#28a745";
      case "PROCESSING": return "#ffc107";
      case "PENDING": return "#17a2b8";
      case "FAILED": return "#dc3545";
      default: return "#6c757d";
    }
  };

  const buttonStyle = {
    padding: "10px 20px",
    background: "#fff",
    border: "2px solid #1a1a1a",
    borderRadius: 8,
    color: "#1a1a1a",
    fontWeight: 600,
    cursor: "pointer",
    fontSize: 14,
    transition: "all 0.2s"
  };

  return (
    <div>
      <button 
        onClick={onBack} 
        style={{ 
          ...buttonStyle,
          marginBottom: 20,
          display: "inline-flex",
          alignItems: "center",
          gap: 8
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
        ← Back to Uploads
      </button>

      {upload && (
        <div style={{ display: "flex", gap: 16, marginBottom: 24, flexWrap: "wrap" }}>
          <div style={{ 
            flex: "1 1 400px",
            background: "#1a1a1a",
            borderRadius: 12,
            padding: 24,
            color: "#fff",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.2)",
            borderTop: "4px solid #1a1a1a"
          }}>
            <div style={{ fontSize: 32, fontWeight: 700, marginBottom: 16 }}>Upload #{upload.id}</div>
            {upload.original_filename && (
              <div style={{ 
                fontSize: 14, 
                opacity: 0.95, 
                marginBottom: 16,
                paddingBottom: 16,
                borderBottom: "1px solid rgba(255, 255, 255, 0.2)"
              }}>
                {upload.original_filename}
              </div>
            )}
            <div style={{ display: "grid", gap: 12, fontSize: 15 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ opacity: 0.9 }}>Status:</span>
                <span style={{ 
                  background: "rgba(255, 255, 255, 0.2)",
                  padding: "4px 12px",
                  borderRadius: 8,
                  fontWeight: 600
                }}>
                  {upload.status}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 12, borderTop: "1px solid rgba(255, 255, 255, 0.2)" }}>
                <span>Total Rows:</span>
                <span style={{ fontWeight: 700 }}>{upload.total_rows.toLocaleString()}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Valid:</span>
                <span style={{ fontWeight: 700 }}>{upload.valid_rows.toLocaleString()}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Invalid:</span>
                <span style={{ fontWeight: 700 }}>{upload.invalid_rows.toLocaleString()}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Issues:</span>
                <span style={{ fontWeight: 700 }}>{upload.conflict_count.toLocaleString()}</span>
              </div>
            </div>
            {upload.error_message && (
              <div style={{ 
                marginTop: 16,
                padding: 12,
                background: "rgba(220, 53, 69, 0.2)",
                borderRadius: 8,
                border: "1px solid rgba(220, 53, 69, 0.3)"
              }}>
                {upload.error_message}
              </div>
            )}
          </div>

          <div style={{ display: "grid", gap: 12, alignContent: "start", minWidth: 200 }}>
            <button 
              onClick={load} 
              disabled={busy}
              style={{
                ...buttonStyle,
                opacity: busy ? 0.6 : 1,
                cursor: busy ? "not-allowed" : "pointer"
              }}
              onMouseOver={(e) => {
                if (!busy) {
                  e.currentTarget.style.background = "#1a1a1a";
                  e.currentTarget.style.color = "#fff";
                }
              }}
              onMouseOut={(e) => {
                if (!busy) {
                  e.currentTarget.style.background = "#fff";
                  e.currentTarget.style.color = "#1a1a1a";
                }
              }}
            >
              Refresh
            </button>
            <button 
              onClick={finalize} 
              disabled={busy || openIssues > 0 || upload.status === "COMPLETED"}
              style={{
                padding: "10px 20px",
                background: (busy || openIssues > 0 || upload.status === "COMPLETED") 
                  ? "#ccc" 
                  : "#1a1a1a",
                border: "none",
                borderRadius: 8,
                color: "#fff",
                fontWeight: 600,
                cursor: (busy || openIssues > 0 || upload.status === "COMPLETED") ? "not-allowed" : "pointer",
                fontSize: 14,
                boxShadow: (busy || openIssues > 0 || upload.status === "COMPLETED") 
                  ? "none" 
                  : "0 2px 8px rgba(255, 107, 53, 0.3)"
              }}
            >
              ✓ Finalize {openIssues > 0 ? `(${openIssues} issues)` : ""}
            </button>
            {err && (
              <div style={{ 
                color: "#dc3545",
                background: "#ffe6e6",
                padding: "12px",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 500,
                border: "1px solid #ffcccc"
              }}>
                {err}
              </div>
            )}
          </div>
        </div>
      )}

      <h3 style={{ fontSize: 22, fontWeight: 700, marginBottom: 16, color: "#333" }}>
         Issues {openIssues > 0 && `(${openIssues} open)`}
      </h3>
      
      {issues.length === 0 ? (
        <div style={{
          textAlign: "center",
          padding: "40px 20px",
          background: "#f8f9fa",
          borderRadius: 12,
          color: "#666"
        }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}></div>
          <p style={{ margin: 0, fontSize: 16 }}>No issues found - looking good!</p>
        </div>
      ) : (
        issues.map((issue) => {
          const chosenId = issue.resolution?.chosen_row_id;
          const isOpen = issue.status === "OPEN";
          
          // Check if this is a duplicate issue (has candidates) or single-row issue
          const isDuplicateIssue = issue.type === "DUPLICATE_EMAIL";
          const payload: any = issue.payload;
          const candidates = isDuplicateIssue ? payload.candidates : [{ 
            raw_row_id: payload.row_id, 
            row_number: payload.row_number, 
            data: payload.data 
          }];

          return (
            <div 
              key={issue.id} 
              style={{ 
                border: `2px solid ${isOpen ? "#1a1a1a" : "#28a745"}`,
                borderRadius: 12,
                padding: 20,
                marginBottom: 16,
                background: isOpen ? "#fff5f0" : "#f0f9f4"
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div>
                  <span style={{ 
                    fontSize: 18,
                    fontWeight: 700,
                    color: "#333"
                  }}>
                    {issue.type.replace(/_/g, ' ')}
                  </span>
                  {!isDuplicateIssue && payload.reason && (
                    <div style={{
                      marginTop: 8,
                      fontSize: 14,
                      color: "#666"
                    }}>
                      {payload.reason}
                    </div>
                  )}
                  {isDuplicateIssue && (
                    <span style={{ 
                      marginLeft: 12,
                      fontSize: 14,
                      color: "#666",
                      fontFamily: "monospace",
                      background: "rgba(0, 0, 0, 0.05)",
                      padding: "4px 8px",
                      borderRadius: 4
                    }}>
                      {issue.key}
                    </span>
                  )}
                </div>
                <span style={{
                  padding: "6px 14px",
                  borderRadius: 12,
                  fontSize: 13,
                  fontWeight: 600,
                  background: isOpen ? "#1a1a1a" : "#28a745",
                  color: "#fff"
                }}>
                  {issue.status}
                </span>
              </div>

              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0, background: "#fff", borderRadius: 8, overflow: "hidden" }}>
                  <thead>
                    <tr style={{ background: "#f8f9fa" }}>
                      <th style={{ padding: "12px", textAlign: "left", fontWeight: 600, color: "#495057", fontSize: 13 }}>Action</th>
                      <th style={{ padding: "12px", textAlign: "left", fontWeight: 600, color: "#495057", fontSize: 13 }}>Row #</th>
                      <th style={{ padding: "12px", textAlign: "left", fontWeight: 600, color: "#495057", fontSize: 13 }}>Email</th>
                      <th style={{ padding: "12px", textAlign: "left", fontWeight: 600, color: "#495057", fontSize: 13 }}>First Name</th>
                      <th style={{ padding: "12px", textAlign: "left", fontWeight: 600, color: "#495057", fontSize: 13 }}>Last Name</th>
                      <th style={{ padding: "12px", textAlign: "left", fontWeight: 600, color: "#495057", fontSize: 13 }}>Company</th>
                    </tr>
                  </thead>
                  <tbody>
                    {candidates.map((c: any, idx: number) => {
                      const isChosen = chosenId && c.raw_row_id === chosenId;
                      return (
                        <tr 
                          key={c.raw_row_id} 
                          style={{ 
                            borderTop: idx > 0 ? "1px solid #e9ecef" : "none",
                            background: isChosen ? "#e7f3ff" : "transparent",
                            fontWeight: isChosen ? 600 : "normal"
                          }}
                        >
                          <td style={{ padding: "12px" }}>
                            {issue.status === "OPEN" ? (
                              <button 
                                disabled={busy} 
                                onClick={() => resolve(issue.id, c.raw_row_id)}
                                style={{
                                  padding: "6px 16px",
                                  background: busy ? "#ccc" : "#1a1a1a",
                                  border: "none",
                                  borderRadius: 6,
                                  color: "#fff",
                                  fontWeight: 600,
                                  cursor: busy ? "not-allowed" : "pointer",
                                  fontSize: 13,
                                  boxShadow: busy ? "none" : "0 2px 6px rgba(255, 107, 53, 0.3)"
                                }}
                              >
                                Choose
                              </button>
                            ) : (
                              isChosen && <span style={{ color: "#28a745", fontWeight: 700 }}>✓ Chosen</span>
                            )}
                          </td>
                          <td style={{ padding: "12px", color: "#495057" }}>{c.row_number}</td>
                          <td style={{ padding: "12px", fontFamily: "monospace", fontSize: 13, color: "#212529" }}>{c.data.email}</td>
                          <td style={{ padding: "12px", color: "#495057" }}>{c.data.first_name || "—"}</td>
                          <td style={{ padding: "12px", color: "#495057" }}>{c.data.last_name || "—"}</td>
                          <td style={{ padding: "12px", color: "#495057" }}>{c.data.company || "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
