import { useState, useEffect, useRef, useCallback } from "react";
import TemperatureHistory from "./TemperatureHistory";

const ESP32_BASE_URL = "http://192.168.4.1";

const TEMP_THRESHOLDS = [
  { below: 25, speed: 0,   label: "Off",    range: "< 25°C"   },
  { below: 30, speed: 25,  label: "Low",    range: "25–29°C"  },
  { below: 35, speed: 50,  label: "Medium", range: "30–34°C"  },
  { below: 40, speed: 75,  label: "High",   range: "35–39°C"  },
  { below: Infinity, speed: 100, label: "Max", range: "40°C+" },
];

function getAutoSpeed(temp) {
  for (const t of TEMP_THRESHOLDS) {
    if (temp < t.below) return t.speed;
  }
  return 100;
}

function getSpeedLabel(speed) {
  if (speed === 0)   return "Off";
  if (speed <= 25)   return "Low";
  if (speed <= 50)   return "Medium";
  if (speed <= 75)   return "High";
  return "Max";
}

function getSpeedColor(speed) {
  if (speed === 0)   return "#888780";
  if (speed <= 25)   return "#1D9E75";
  if (speed <= 50)   return "#BA7517";
  if (speed <= 75)   return "#D85A30";
  return "#E24B4A";
}

function getTempColor(temp) {
  if (temp < 25) return "#1D9E75";
  if (temp < 30) return "#1D9E75";
  if (temp < 35) return "#BA7517";
  if (temp < 40) return "#D85A30";
  return "#E24B4A";
}

export default function FanControlDashboard() {
  const [mode, setMode] = useState("auto");
  const [manualSpeed, setManualSpeed] = useState(50);
  const [stabilizeTarget, setStabilizeTarget] = useState(28);
  const [sensorData, setSensorData] = useState({ celsius: null, fahrenheit: null });
  const [unit, setUnit] = useState("C");
  const [connected, setConnected] = useState(false);
  const [fanSpeed, setFanSpeed] = useState(0);
  const [lastUpdated, setLastUpdated] = useState(null);
  const pollRef = useRef(null);
  const fanSpeedRef = useRef(0);

  const sendFanSpeed = useCallback(async (speed) => {
    try {
      await fetch(`${ESP32_BASE_URL}/fan?speed=${Math.round(speed)}`, {
        signal: AbortSignal.timeout(3000),
      });
    } catch {
      // ESP32 unreachable
    }
  }, []);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`${ESP32_BASE_URL}/`, {
        signal: AbortSignal.timeout(3000),
      });
      if (!res.ok) throw new Error("Bad response");
      const data = await res.json();
      const celsius = parseFloat(data.celsius ?? data.temperature ?? data.temp);
      const fahrenheit = parseFloat(data.fahrenheit ?? data.tempF ?? (celsius * 9 / 5 + 32));
      setSensorData({ celsius, fahrenheit });
      setConnected(true);
      setLastUpdated(new Date());
      return celsius;
    } catch {
      setConnected(false);
      return null;
    }
  }, []);

  useEffect(() => {
    fanSpeedRef.current = fanSpeed;
  }, [fanSpeed]);

  useEffect(() => {
    const tick = async () => {
      const temp = await fetchData();
      if (mode === "auto" && temp !== null) {
        const speed = getAutoSpeed(temp);
        setFanSpeed(speed);
        fanSpeedRef.current = speed;
        await sendFanSpeed(speed);
      } else if (mode === "stabilize" && temp !== null) {
        const diff = temp - stabilizeTarget;
        const speed = Math.min(100, Math.max(0, 50 + diff * 10));
        const rounded = Math.round(speed);
        setFanSpeed(rounded);
        fanSpeedRef.current = rounded;
        await sendFanSpeed(rounded);
      }
    };

    tick();
    pollRef.current = setInterval(tick, 2000);
    return () => clearInterval(pollRef.current);
  }, [mode, stabilizeTarget, fetchData, sendFanSpeed]);

  const handleManualChange = async (val) => {
    setManualSpeed(val);
    setFanSpeed(val);
    await sendFanSpeed(val);
  };

  const displayTemp =
    sensorData.celsius !== null
      ? unit === "C"
        ? sensorData.celsius
        : sensorData.fahrenheit
      : null;

  const tempUnit = unit === "C" ? "°C" : "°F";

  return (
    <div style={{ fontFamily: "system-ui, sans-serif", maxWidth: 760, margin: "0 auto", padding: "1.5rem 1rem", color: "#1a1a1a" }}>

      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 38, height: 38, borderRadius: 10, background: "#E6F1FB", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#185FA5" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 12m-1 0a1 1 0 1 0 2 0a1 1 0 1 0 -2 0" />
              <path d="M12 7a5 3 0 1 0 3 5" />
              <path d="M12 17a5 3 0 1 0 -3 -5" />
              <path d="M7 12a3 5 0 1 0 5 3" />
              <path d="M17 12a3 5 0 1 0 -5 -3" />
            </svg>
          </div>
          <div>
            <h1 style={{ margin: 0, fontSize: 17, fontWeight: 600, letterSpacing: "-0.02em" }}>Intelligent</h1>
            <p style={{ margin: 0, fontSize: 12, color: "#888780" }}>DHT Sensor · ESP32 AP · {ESP32_BASE_URL}</p>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, background: connected ? "#E1F5EE" : "#FCEBEB", padding: "5px 12px", borderRadius: 20 }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: connected ? "#1D9E75" : "#E24B4A" }} />
          <span style={{ fontSize: 12, fontWeight: 500, color: connected ? "#0F6E56" : "#A32D2D" }}>
            {connected ? "Online" : "Offline"}
          </span>
        </div>
      </div>

      {/* Metric cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: "1.25rem" }}>

        {/* Temperature */}
        <div style={{ background: "#fff", border: "0.5px solid #e0dfd7", borderRadius: 12, padding: "1rem 1.25rem" }}>
          <div style={{ fontSize: 11, fontWeight: 500, color: "#888780", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Temperature</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
            <span style={{ fontSize: 30, fontWeight: 600, color: displayTemp !== null ? getTempColor(sensorData.celsius) : "#B4B2A9" }}>
              {displayTemp !== null ? displayTemp.toFixed(1) : "—"}
            </span>
            <span style={{ fontSize: 14, color: "#888780" }}>{tempUnit}</span>
          </div>
          <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
            {["C", "F"].map((u) => (
              <button
                key={u}
                onClick={() => setUnit(u)}
                style={{
                  padding: "2px 10px", fontSize: 11, borderRadius: 6,
                  border: "0.5px solid", borderColor: unit === u ? "#185FA5" : "#e0dfd7",
                  background: unit === u ? "#E6F1FB" : "transparent",
                  color: unit === u ? "#185FA5" : "#888780",
                  cursor: "pointer", fontWeight: unit === u ? 600 : 400,
                }}
              >°{u}</button>
            ))}
          </div>
        </div>

        {/* Fan Speed */}
        <div style={{ background: "#fff", border: "0.5px solid #e0dfd7", borderRadius: 12, padding: "1rem 1.25rem" }}>
          <div style={{ fontSize: 11, fontWeight: 500, color: "#888780", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Fan Speed</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 4 }}>
            <span style={{ fontSize: 30, fontWeight: 600, color: getSpeedColor(fanSpeed) }}>{fanSpeed}</span>
            <span style={{ fontSize: 14, color: "#888780" }}>%</span>
          </div>
          <div style={{ marginTop: 10, height: 5, background: "#F1EFE8", borderRadius: 3, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${fanSpeed}%`, background: getSpeedColor(fanSpeed), borderRadius: 3, transition: "width 0.4s ease" }} />
          </div>
          <div style={{ marginTop: 5, fontSize: 11, color: getSpeedColor(fanSpeed), fontWeight: 500 }}>{getSpeedLabel(fanSpeed)}</div>
        </div>

        {/* Active Mode */}
        <div style={{ background: "#fff", border: "0.5px solid #e0dfd7", borderRadius: 12, padding: "1rem 1.25rem" }}>
          <div style={{ fontSize: 11, fontWeight: 500, color: "#888780", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Active Mode</div>
          <div style={{ fontSize: 20, fontWeight: 600, textTransform: "capitalize", marginBottom: 4 }}>{mode}</div>
          <div style={{ fontSize: 12, color: "#888780", lineHeight: 1.5 }}>
            {mode === "manual" && "Direct PWM control"}
            {mode === "auto" && "Adjusts with temperature"}
            {mode === "stabilize" && `Target: ${stabilizeTarget}°C`}
          </div>
          {lastUpdated && (
            <div style={{ fontSize: 11, color: "#B4B2A9", marginTop: 6 }}>
              Updated {lastUpdated.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </div>
          )}
        </div>
      </div>

      {/* Mode panel */}
      <div style={{ background: "#fff", border: "0.5px solid #e0dfd7", borderRadius: 12, padding: "1rem 1.25rem" }}>

        {/* Tab bar */}
        <div style={{ display: "flex", gap: 4, background: "#F1EFE8", borderRadius: 8, padding: 3, marginBottom: "1.25rem" }}>
          {[
            { id: "manual", label: "Manual Mode" },
            { id: "auto", label: "Automatic Mode" },
            { id: "stabilize", label: "Stabilize Mode" },
          ].map((m) => (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              style={{
                flex: 1, padding: "7px 0", fontSize: 13,
                fontWeight: mode === m.id ? 600 : 400,
                borderRadius: 6, border: "none",
                background: mode === m.id ? "#fff" : "transparent",
                color: mode === m.id ? "#185FA5" : "#888780",
                cursor: "pointer",
                boxShadow: mode === m.id ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                transition: "all 0.15s ease",
              }}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Manual */}
        {mode === "manual" && (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#185FA5" }} />
              <span style={{ fontSize: 13, fontWeight: 500, color: "#185FA5" }}>Manual Control Active</span>
            </div>
            <p style={{ margin: "0 0 16px", fontSize: 12, color: "#888780" }}>Drag the slider to set fan speed. Command is sent to ESP32 immediately.</p>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <input
                type="range" min={0} max={100} step={1} value={manualSpeed}
                onChange={(e) => handleManualChange(+e.target.value)}
                style={{ flex: 1, accentColor: getSpeedColor(manualSpeed) }}
              />
              <span style={{ fontSize: 22, fontWeight: 600, minWidth: 56, textAlign: "right", color: getSpeedColor(manualSpeed) }}>
                {manualSpeed}%
              </span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#B4B2A9", marginTop: 2 }}>
              <span>Off</span><span>Low</span><span>Med</span><span>High</span><span>Max</span>
            </div>
          </div>
        )}

        {/* Auto */}
        {mode === "auto" && (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#1D9E75" }} />
              <span style={{ fontSize: 13, fontWeight: 500, color: "#1D9E75" }}>Automatic Mode Active</span>
            </div>
            <p style={{ margin: "0 0 16px", fontSize: 12, color: "#888780" }}>Fan speed adjusts automatically based on DHT sensor temperature.</p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 8 }}>
              {TEMP_THRESHOLDS.map((t) => {
                const isActive = sensorData.celsius !== null && getAutoSpeed(sensorData.celsius) === t.speed;
                return (
                  <div key={t.label} style={{
                    background: isActive ? "#E1F5EE" : "#F1EFE8",
                    border: isActive ? "1px solid #1D9E75" : "1px solid transparent",
                    borderRadius: 8, padding: "10px 6px", textAlign: "center",
                    transition: "all 0.3s ease",
                  }}>
                    <div style={{ fontSize: 10, color: "#888780", marginBottom: 4 }}>{t.range}</div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: getSpeedColor(t.speed) }}>{t.speed}%</div>
                    <div style={{ fontSize: 10, color: "#888780", marginBottom: 2 }}>{t.label}</div>
                    {isActive && <div style={{ fontSize: 10, color: "#1D9E75", fontWeight: 500 }}>● active</div>}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Stabilize */}
        {mode === "stabilize" && (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#BA7517" }} />
              <span style={{ fontSize: 13, fontWeight: 500, color: "#BA7517" }}>Stabilize Mode Active</span>
            </div>
            <p style={{ margin: "0 0 16px", fontSize: 12, color: "#888780" }}>Fan adjusts automatically to maintain your target temperature.</p>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <span style={{ fontSize: 12, color: "#888780", whiteSpace: "nowrap" }}>Target</span>
              <input
                type="range" min={18} max={40} step={0.5} value={stabilizeTarget}
                onChange={(e) => setStabilizeTarget(+e.target.value)}
                style={{ flex: 1, accentColor: "#BA7517" }}
              />
              <span style={{ fontSize: 22, fontWeight: 600, minWidth: 64, textAlign: "right", color: "#BA7517" }}>
                {stabilizeTarget.toFixed(1)}°C
              </span>
            </div>
            {sensorData.celsius !== null && (
              <div style={{ marginTop: 12, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                {[
                  { label: "Current", value: `${sensorData.celsius.toFixed(1)}°C`, color: getTempColor(sensorData.celsius) },
                  { label: "Target",  value: `${stabilizeTarget.toFixed(1)}°C`,    color: "#BA7517" },
                  { label: "Delta",   value: `${(sensorData.celsius - stabilizeTarget) > 0 ? "+" : ""}${(sensorData.celsius - stabilizeTarget).toFixed(1)}°C`, color: Math.abs(sensorData.celsius - stabilizeTarget) < 1 ? "#1D9E75" : "#E24B4A" },
                ].map((item) => (
                  <div key={item.label} style={{ background: "#F1EFE8", borderRadius: 8, padding: "8px 12px", textAlign: "center" }}>
                    <div style={{ fontSize: 11, color: "#888780", marginBottom: 3 }}>{item.label}</div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: item.color }}>{item.value}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
      <TemperatureHistory />
      {/* Footer */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11, color: "#B4B2A9", marginTop: "1rem" }}>
        <span>DHT Sensor · ESP32 AP · {ESP32_BASE_URL}</span>
        <span>Polling every 2s</span>
      </div>
    </div>
  );
}