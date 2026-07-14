import { useState, useEffect, useCallback } from "react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

const BACKEND_URL = "http://localhost:3001";

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: "#fff", border: "0.5px solid #e0dfd7", borderRadius: 8, padding: "8px 12px", fontSize: 12, boxShadow: "0 2px 8px rgba(0,0,0,0.08)" }}>
      <div style={{ fontWeight: 600, marginBottom: 4 }}>{label}</div>
      <div style={{ color: "#185FA5" }}>{payload[0].value.toFixed(1)}°C</div>
    </div>
  );
}

const VIEW_ENDPOINTS = {
  live: "recent?limit=60",   // raw readings, no averaging
  today: "today",
  daily: "daily",
  weekly: "weekly",
};

export default function TemperatureHistory() {
  const [view, setView] = useState("live"); // "live" | "today" | "daily" | "weekly"
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = useCallback(async (which, { silent = false } = {}) => {
    if (!silent) setLoading(true);
    setError(false);
    try {
      const res = await fetch(`${BACKEND_URL}/api/history/${VIEW_ENDPOINTS[which]}`, {
        signal: AbortSignal.timeout(5000),
      });
      if (!res.ok) throw new Error("Bad response");
      const rows = await res.json();
      setData(rows);
    } catch {
      if (!silent) setError(true); // don't blank out a working chart over one missed background refresh
      if (!silent) setData([]);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(view);
    // Only auto-refresh on Live — it's the one view where new points show
    // up every minute (the backend poll interval). The other views are
    // averages that barely change minute to minute, so there's no point
    // hammering the backend for them.
    if (view === "live") {
      const id = setInterval(() => load(view, { silent: true }), 15_000);
      return () => clearInterval(id);
    }
  }, [view, load]);

  return (
    <div style={{ background: "#fff", border: "0.5px solid #e0dfd7", borderRadius: 12, padding: "1rem 1.25rem", marginTop: "1.25rem" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
        <h2 style={{ margin: 0, fontSize: 15, fontWeight: 600 }}>Temperature History</h2>
        <div style={{ display: "flex", gap: 4, background: "#F1EFE8", borderRadius: 8, padding: 3 }}>
          {[
            { id: "live", label: "Live (1m)" },
            { id: "today", label: "Today" },
            { id: "daily", label: "Daily (7d)" },
            { id: "weekly", label: "Weekly (4w)" },
          ].map((v) => (
            <button
              key={v.id}
              onClick={() => setView(v.id)}
              style={{
                padding: "5px 12px", fontSize: 12,
                fontWeight: view === v.id ? 600 : 400,
                borderRadius: 6, border: "none",
                background: view === v.id ? "#fff" : "transparent",
                color: view === v.id ? "#185FA5" : "#888780",
                cursor: "pointer",
                boxShadow: view === v.id ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
              }}
            >
              {v.label}
            </button>
          ))}
        </div>
      </div>
      <p style={{ margin: "0 0 12px", fontSize: 12, color: "#888780" }}>
        {view === "live" && "Last 60 raw readings, refreshing every 15s"}
        {view === "today" && "Average temperature per hour, today"}
        {view === "daily" && "Average temperature per day, last 7 days"}
        {view === "weekly" && "Average temperature per week, last 4 weeks"}
      </p>

      <div style={{ height: 220 }}>
        {loading ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#B4B2A9", fontSize: 12 }}>
            Loading history…
          </div>
        ) : error ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#A32D2D", fontSize: 12, textAlign: "center" }}>
            Can't reach the backend at {BACKEND_URL}.<br />Is the server running? (npm start in /backend)
          </div>
        ) : data.length === 0 ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "#B4B2A9", fontSize: 12 }}>
            No data yet — the backend needs a bit of time to collect readings.
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 8, right: 12, left: -12, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#F1EFE8" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#888780" }} axisLine={{ stroke: "#e0dfd7" }} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#888780" }} axisLine={false} tickLine={false} width={32} />
              <Tooltip content={<CustomTooltip />} />
              <Line
                type="monotone"
                dataKey="temperature"
                stroke="#185FA5"
                strokeWidth={2}
                dot={{ r: 3, fill: "#185FA5", strokeWidth: 0 }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}