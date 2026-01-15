import React, { useEffect, useState } from "react";
import { api } from "../api/client";
import { getErrorMessage } from "../utils/errorHandler";

type Job = {
  id: number;
  status: string;
  total_rows: number;
  valid_rows: number;
  invalid_rows: number;
  conflict_count: number;
  error_message?: string | null;
  original_filename?: string | null;
};

export default function Jobs({ onOpenJob }: { onOpenJob: (jobId: number) => void }) {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function refresh() {
    try {
      setJobs(await api.listJobs());
    } catch (e: any) {
      setErr(getErrorMessage(e, "Failed to load jobs"));
    }
  }

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 3000);
    return () => clearInterval(t);
  }, []);

  async function upload(file: File) {
    setBusy(true);
    setErr(null);
    try {
      const job = await api.uploadCsv(file);
      await refresh();
      onOpenJob(job.id);
    } catch (e: any) {
      setErr(getErrorMessage(e, "Upload failed"));
    } finally {
      setBusy(false);
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "COMPLETED": return "#28a745";
      case "PROCESSING": return "#ffc107";
      case "PENDING": return "#17a2b8";
      case "FAILED": return "#dc3545";
      default: return "#6c757d";
    }
  };

  const getStatusBadge = (status: string) => ({
    display: "inline-block",
    padding: "4px 12px",
    borderRadius: 12,
    fontSize: 12,
    fontWeight: 600,
    background: getStatusColor(status),
    color: "#fff"
  });

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24, flexWrap: "wrap" }}>
        <label style={{ 
          background: "#1a1a1a",
          padding: "12px 24px",
          borderRadius: 8,
          cursor: busy ? "not-allowed" : "pointer",
          color: "#fff",
          fontWeight: 600,
          fontSize: 15,
          boxShadow: "0 2px 8px rgba(255, 107, 53, 0.3)",
          transition: "all 0.2s",
          opacity: busy ? 0.6 : 1
        }}>
          {busy ? "⏳ Uploading..." : "📤 Upload CSV"}
          <input
            type="file"
            accept=".csv"
            style={{ display: "none" }}
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) upload(f);
              e.currentTarget.value = "";
            }}
          />
        </label>
        <button 
          onClick={refresh}
          style={{
            padding: "12px 24px",
            background: "#fff",
            border: "2px solid #1a1a1a",
            borderRadius: 8,
            color: "#1a1a1a",
            fontWeight: 600,
            cursor: "pointer",
            fontSize: 15,
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
          Refresh
        </button>
        {err && (
          <div style={{ 
            color: "#dc3545",
            background: "#ffe6e6",
            padding: "12px 16px",
            borderRadius: 8,
            fontSize: 14,
            fontWeight: 500,
            border: "1px solid #ffcccc",
            flex: 1,
            minWidth: 200
          }}>
            {err}
          </div>
        )}
      </div>

      {jobs.length === 0 ? (
        <div style={{
          textAlign: "center",
          padding: "60px 20px",
          color: "#666"
        }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
          <h3 style={{ margin: "0 0 8px 0", fontSize: 20, color: "#333" }}>No jobs yet</h3>
          <p style={{ margin: 0, fontSize: 15 }}>Upload a CSV file to get started</p>
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
            <thead>
              <tr style={{ background: "#f8f9fa" }}>
                <th style={{ padding: "16px", textAlign: "left", fontWeight: 600, color: "#495057", fontSize: 14, borderBottom: "2px solid #dee2e6" }}>Job ID</th>
                <th style={{ padding: "16px", textAlign: "left", fontWeight: 600, color: "#495057", fontSize: 14, borderBottom: "2px solid #dee2e6" }}>File Name</th>
                <th style={{ padding: "16px", textAlign: "left", fontWeight: 600, color: "#495057", fontSize: 14, borderBottom: "2px solid #dee2e6" }}>Status</th>
                <th style={{ padding: "16px", textAlign: "right", fontWeight: 600, color: "#495057", fontSize: 14, borderBottom: "2px solid #dee2e6" }}>Total Rows</th>
                <th style={{ padding: "16px", textAlign: "right", fontWeight: 600, color: "#495057", fontSize: 14, borderBottom: "2px solid #dee2e6" }}>Valid</th>
                <th style={{ padding: "16px", textAlign: "right", fontWeight: 600, color: "#495057", fontSize: 14, borderBottom: "2px solid #dee2e6" }}>Invalid</th>
                <th style={{ padding: "16px", textAlign: "right", fontWeight: 600, color: "#495057", fontSize: 14, borderBottom: "2px solid #dee2e6" }}>Conflicts</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((j) => (
                <tr 
                  key={j.id} 
                  style={{ 
                    borderBottom: "1px solid #e9ecef",
                    cursor: "pointer",
                    transition: "background 0.2s"
                  }}
                  onClick={() => onOpenJob(j.id)}
                  onMouseOver={(e) => e.currentTarget.style.background = "#f8f9fa"}
                  onMouseOut={(e) => e.currentTarget.style.background = "transparent"}
                >
                  <td style={{ padding: "16px", fontWeight: 600, color: "#1a1a1a" }}>#{j.id}</td>
                  <td style={{ padding: "16px", color: "#495057", fontWeight: 500 }}>
                    {j.original_filename ? (
                      <span style={{ 
                        display: "inline-flex", 
                        alignItems: "center", 
                        gap: 6 
                      }}>
                        {j.original_filename}
                      </span>
                    ) : (
                      <span style={{ color: "#adb5bd", fontStyle: "italic" }}>No filename</span>
                    )}
                  </td>
                  <td style={{ padding: "16px" }}>
                    <span style={getStatusBadge(j.status)}>{j.status}</span>
                  </td>
                  <td style={{ padding: "16px", textAlign: "right", fontWeight: 500 }}>{j.total_rows.toLocaleString()}</td>
                  <td style={{ padding: "16px", textAlign: "right", color: "#28a745", fontWeight: 500 }}>{j.valid_rows.toLocaleString()}</td>
                  <td style={{ padding: "16px", textAlign: "right", color: "#dc3545", fontWeight: 500 }}>{j.invalid_rows.toLocaleString()}</td>
                  <td style={{ padding: "16px", textAlign: "right", color: j.conflict_count > 0 ? "#ffc107" : "#6c757d", fontWeight: 600 }}>
                    {j.conflict_count.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
