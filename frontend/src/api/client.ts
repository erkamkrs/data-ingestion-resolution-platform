const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

export function getToken(): string | null {
  return localStorage.getItem("token");
}
export function setToken(token: string) {
  localStorage.setItem("token", token);
}
export function clearToken() {
  localStorage.removeItem("token");
}

async function request(path: string, options: RequestInit = {}) {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> | undefined),
  };

  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const text = await res.text();
  let data: any = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    // Extract error message from various formats
    let msg = "Request failed";
    
    if (typeof data === "string") {
      msg = data;
    } else if (data && typeof data === "object") {
      // FastAPI returns errors in "detail" field
      if (data.detail) {
        // Handle both string and object detail
        if (typeof data.detail === "string") {
          msg = data.detail;
        } else if (Array.isArray(data.detail)) {
          // Validation errors are arrays
          msg = data.detail.map((err: any) => err.msg || JSON.stringify(err)).join(", ");
        } else {
          msg = JSON.stringify(data.detail);
        }
      } else if (data.message) {
        msg = data.message;
      } else if (data.error) {
        msg = data.error;
      }
    }
    
    // Add status code for context if message is generic
    if (msg === "Request failed" || !msg) {
      msg = `Request failed with status ${res.status}`;
    }
    
    throw new Error(msg);
  }
  return data;
}

export const api = {
  register(email: string, password: string) {
    return request("/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
  },

  login(email: string, password: string) {
    // OAuth2PasswordRequestForm expects form data with "username" field
    const formData = new URLSearchParams();
    formData.append("username", email);  // API treats username as email
    formData.append("password", password);
    
    return request("/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formData.toString(),
    });
  },

  listJobs() {
    return request("/jobs");
  },

  uploadCsv(file: File) {
    const fd = new FormData();
    fd.append("file", file);
    return request("/jobs", { method: "POST", body: fd });
  },

  jobDetail(jobId: number) {
    return request(`/jobs/${jobId}`);
  },

  listIssues(jobId: number) {
    return request(`/jobs/${jobId}/issues`);
  },

  resolveIssue(issueId: number, chosen_row_id: number) {
    return request(`/issues/${issueId}/resolve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "choose", chosen_row_id }),
    });
  },

  finalize(jobId: number) {
    return request(`/jobs/${jobId}/finalize`, { method: "POST" });
  },
};
