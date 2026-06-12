export type Profile = {
  uid?: string;
  email?: string;
  name?: string;
  picture?: string;
  degree?: string;
  cgpa?: string;
  year?: string;
  skills?: string;
  experience?: string;
  location?: string;
  github?: string;
  linkedin?: string;
  leetcode?: string;
  resume_link?: string;
  cv_filename?: string;
  certificates?: string;
  role_target?: string;
  notice_period?: string;
  expected_ctc?: string;
};

export type Startup = {
  name: string;
  sector?: string;
  round_type?: string;
  amount_inr?: number;
  score?: number;
  confidence?: string;
  source?: string;
  summary_what?: string;
  summary_why?: string;
  role_match?: string;
  url?: string;
  date?: string;
  location?: string;
  cv_verdict?: string;
  cv_missing_skills?: string[];
};

export type Application = {
  id?: string;
  startup_name?: string;
  company?: string;
  profile_used?: string;
  email_subject?: string;
  notes?: string;
  status?: string;
  created_at?: string;
  applied_at?: string;
  applied_date?: string;
};

export type AppStatus = {
  running: boolean;
  last_run: string | null;
  last_count: number;
  message: string;
  logs?: Array<{ time: string; message: string }>;
};

const API_BASE = import.meta.env.VITE_API_BASE_URL || "";

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: {
      ...(options.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...options.headers,
    },
    ...options,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || data.message || `Request failed: ${response.status}`);
  }
  return data as T;
}

export const api = {
  login: (email: string, password: string) =>
    request<{ user: Profile; profile: Profile }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  signup: (name: string, email: string, password: string) =>
    request<{ user: Profile; profile: Profile }>("/api/auth/signup", {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
    }),
  logout: () => request<{ ok: boolean }>("/api/auth/logout", { method: "POST" }),
  demoLogin: () => request<{ user: Profile; profile: Profile }>("/api/auth/demo", { method: "POST" }),
  getProfile: () => request<Profile>("/api/profile"),
  updateProfile: (profile: Profile) =>
    request<{ ok: boolean }>("/api/profile", { method: "PUT", body: JSON.stringify(profile) }),
  uploadCv: (file: File) => {
    const formData = new FormData();
    formData.append("cv", file);
    return request<{ ok: boolean; cv_filename: string; resume_link: string }>("/api/profile/cv", {
      method: "POST",
      body: formData,
    });
  },
  getStartups: () =>
    request<{ startups: Startup[]; threshold: number; status: AppStatus }>("/api/startups"),
  analyzeCv: () => request<{ ok: boolean; result: any }>("/api/cv-score", { method: "POST" }),
  askCopilot: (query: string) => request<{ ok: boolean; response: string }>("/api/copilot/ask", {
    method: "POST",
    body: JSON.stringify({ query }),
  }),
  ttsStartup: async (text: string): Promise<Blob | null> => {
    const res = await fetch(`${API_BASE}/api/tts/startup`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) return null;
    return res.blob();
  },
  sttTranscribe: async (audioBlob: Blob): Promise<string> => {
    const formData = new FormData();
    formData.append("audio", audioBlob, "recording.webm");
    const res = await fetch(`${API_BASE}/api/stt/transcribe`, {
      method: "POST",
      credentials: "include",
      body: formData,
    });
    const data = await res.json();
    return data.transcript || "";
  },
  getHealth: () => request<Record<string, any>>("/api/health"),
  runPipeline: () => request<{ ok: boolean; message: string }>("/api/run", { method: "POST" }),
  getStatus: () => request<AppStatus>("/api/status"),
  draftEmail: (name: string) =>
    request<{ ok: boolean; subject: string; body: string; ai: boolean }>("/api/apply", {
      method: "POST",
      body: JSON.stringify({ name }),
    }),
  markApplied: (name: string, subject: string) =>
    request<{ ok: boolean }>("/api/mark-applied", {
      method: "POST",
      body: JSON.stringify({ name, subject }),
    }),
  getApplications: () => request<{ applications: Application[] }>("/api/applications"),
  getHistory: () =>
    request<{
      applications: Application[];
      cv_summary: {
        latest_score?: number;
        latest_grade?: string;
        latest_verdict?: string;
        avg_score: number;
        scored_count: number;
        latest_missing_skills?: string[];
      };
    }>("/api/history"),
};

export function formatInr(amount?: number) {
  if (!amount) return "Funding undisclosed";
  const crore = amount / 10_000_000;
  return `Rs.${crore.toFixed(crore >= 100 ? 0 : 1)}Cr`;
}
