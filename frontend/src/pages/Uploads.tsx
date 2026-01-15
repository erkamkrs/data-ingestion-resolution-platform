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

export default function Uploads({ onOpenUpload }: { onOpenUpload: (uploadId: number) => void }) {
  const [uploads, setUploads] = useState<Upload[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  async function refresh() {
    try {
      setUploads(await api.listJobs());
    } catch (e: any) {
      setErr(getErrorMessage(e, "Failed to load uploads"));
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
      const uploadResult = await api.uploadCsv(file);
      await refresh();
      onOpenUpload(uploadResult.id);
    } catch (e: any) {
      setErr(getErrorMessage(e, "Upload failed"));
    } finally {
      setBusy(false);
    }
  }

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      if (file.name.endsWith('.csv')) {
        upload(file);
      } else {
        setErr("Please upload a CSV file");
      }
    }
  };

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

      {uploads.length === 0 ? (
        <div 
          style={{
            textAlign: "center",
            padding: "80px 40px",
            color: "#666",
            border: `3px dashed ${dragActive ? "#ff6b35" : "#ddd"}`,
            borderRadius: 16,
            background: dragActive ? "#fff5f0" : "#fafafa",
            transition: "all 0.3s",
            cursor: "pointer"
          }}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <div style={{ 
            fontSize: 64, 
            marginBottom: 20,
            opacity: 0.5,
            fontWeight: 700
          }}>
            ↓
          </div>
          <h3 style={{ margin: "0 0 12px 0", fontSize: 24, color: "#333", fontWeight: 700 }}>
            {dragActive ? "Drop your CSV file here" : "Drop CSV file here"}
          </h3>
          <p style={{ margin: "0 0 24px 0", fontSize: 16, color: "#666" }}>
            or
          </p>
          <label style={{ 
            display: "inline-block",
            background: "#1a1a1a",
            padding: "14px 32px",
            borderRadius: 8,
            cursor: busy ? "not-allowed" : "pointer",
            color: "#fff",
            fontWeight: 600,
            fontSize: 16,
            boxShadow: "0 2px 8px rgba(255, 107, 53, 0.3)",
            transition: "all 0.2s",
            opacity: busy ? 0.6 : 1
          }}
          onMouseOver={(e) => {
            if (!busy) {
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow = "0 4px 12px rgba(255, 107, 53, 0.4)";
            }
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.transform = "translateY(0)";
            e.currentTarget.style.boxShadow = "0 2px 8px rgba(255, 107, 53, 0.3)";
          }}
          >
            {busy ? "Uploading..." : "Browse Files"}
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
        </div>
      ) : (
        <div>
          <div 
            style={{
              padding: "40px",
              marginBottom: 24,
              textAlign: "center",
              border: `3px dashed ${dragActive ? "#ff6b35" : "#ddd"}`,
              borderRadius: 16,
              background: dragActive ? "#fff5f0" : "#fafafa",
              transition: "all 0.3s",
              cursor: "pointer"
            }}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
          >
            <div style={{ fontSize: 48, marginBottom: 12, opacity: 0.5, fontWeight: 700 }}>↓</div>
            <p style={{ margin: "0 0 16px 0", fontSize: 18, color: "#333", fontWeight: 600 }}>
              {dragActive ? "Drop your CSV file here" : "Drop CSV file to upload"}
            </p>
            <label style={{ 
              display: "inline-block",
              background: "#1a1a1a",
              padding: "10px 24px",
              borderRadius: 8,
              cursor: busy ? "not-allowed" : "pointer",
              color: "#fff",
              fontWeight: 600,
              fontSize: 14,
              boxShadow: "0 2px 8px rgba(255, 107, 53, 0.3)",
              transition: "all 0.2s",
              opacity: busy ? 0.6 : 1
            }}
            onMouseOver={(e) => {
              if (!busy) {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow = "0 4px 12px rgba(255, 107, 53, 0.4)";
              }
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "0 2px 8px rgba(255, 107, 53, 0.3)";
            }}
            >
              {busy ? "Uploading..." : "Browse Files"}
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
          </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "separate", borderSpacing: 0 }}>
            <thead>
              <tr style={{ background: "#f8f9fa" }}>
                <th style={{ padding: "16px", textAlign: "left", fontWeight: 600, color: "#495057", fontSize: 14, borderBottom: "2px solid #dee2e6" }}>Upload ID</th>
                <th style={{ padding: "16px", textAlign: "left", fontWeight: 600, color: "#495057", fontSize: 14, borderBottom: "2px solid #dee2e6" }}>File Name</th>
                <th style={{ padding: "16px", textAlign: "left", fontWeight: 600, color: "#495057", fontSize: 14, borderBottom: "2px solid #dee2e6" }}>Status</th>
                <th style={{ padding: "16px", textAlign: "right", fontWeight: 600, color: "#495057", fontSize: 14, borderBottom: "2px solid #dee2e6" }}>Total Rows</th>
                <th style={{ padding: "16px", textAlign: "right", fontWeight: 600, color: "#495057", fontSize: 14, borderBottom: "2px solid #dee2e6" }}>Valid</th>
                <th style={{ padding: "16px", textAlign: "right", fontWeight: 600, color: "#495057", fontSize: 14, borderBottom: "2px solid #dee2e6" }}>Invalid</th>
                <th style={{ padding: "16px", textAlign: "right", fontWeight: 600, color: "#495057", fontSize: 14, borderBottom: "2px solid #dee2e6" }}>Issues</th>
              </tr>
            </thead>
            <tbody>
              {uploads.map((upload) => (
                <tr 
                  key={upload.id} 
                  style={{ 
                    borderBottom: "1px solid #e9ecef",
                    cursor: "pointer",
                    transition: "background 0.2s"
                  }}
                  onClick={() => onOpenUpload(upload.id)}
                  onMouseOver={(e) => e.currentTarget.style.background = "#f8f9fa"}
                  onMouseOut={(e) => e.currentTarget.style.background = "transparent"}
                >
                  <td style={{ padding: "16px", fontWeight: 600, color: "#1a1a1a" }}>#{upload.id}</td>
                  <td style={{ padding: "16px", color: "#495057", fontWeight: 500 }}>
                    {upload.original_filename ? (
                      <span style={{ 
                        display: "inline-flex", 
                        alignItems: "center", 
                        gap: 6 
                      }}>
                        {upload.original_filename}
                      </span>
                    ) : (
                      <span style={{ color: "#adb5bd", fontStyle: "italic" }}>No filename</span>
                    )}
                  </td>
                  <td style={{ padding: "16px" }}>
                    <span style={getStatusBadge(upload.status)}>{upload.status}</span>
                  </td>
                  <td style={{ padding: "16px", textAlign: "right", fontWeight: 500 }}>{upload.total_rows.toLocaleString()}</td>
                  <td style={{ padding: "16px", textAlign: "right", color: "#28a745", fontWeight: 500 }}>{upload.valid_rows.toLocaleString()}</td>
                  <td style={{ padding: "16px", textAlign: "right", color: "#dc3545", fontWeight: 500 }}>{upload.invalid_rows.toLocaleString()}</td>
                  <td style={{ padding: "16px", textAlign: "right", color: upload.conflict_count > 0 ? "#ffc107" : "#6c757d", fontWeight: 600 }}>
                    {upload.conflict_count.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </div>
      )}
    </div>
  );
}
