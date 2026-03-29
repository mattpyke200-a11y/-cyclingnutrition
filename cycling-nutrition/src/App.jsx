import { useState } from "react";
import { generateNutritionPlan } from './generatePlanRulesBased';

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const RIDE_TYPES = ["Rest", "Easy Ride", "Moderate Ride", "Hard / Intervals", "Velodrome", "Crit Race", "Road Race", "Gran Fondo"];
const PRODUCTS = [
  { id: "prefuel", name: "ESN Pre-Fuel KOM", sub: "Non-caffeinated pre-ride", color: "#3B82F6" },
  { id: "c30",     name: "Neversecond C30",  sub: "Citrus sports drink mix",  color: "#22C55E" },
  { id: "refuel",  name: "ESN Re-Fuel NICA", sub: "Chocolate recovery",       color: "#F97316" },
];

const RIDE_COLORS = {
  "Rest":             "#6B7280",
  "Easy Ride":        "#22C55E",
  "Moderate Ride":    "#3B82F6",
  "Hard / Intervals": "#EF4444",
  "Velodrome":        "#EF4444",
  "Crit Race":        "#F97316",
  "Road Race":        "#F97316",
  "Gran Fondo":       "#A855F7",
};

const defaultWeek = DAYS.map((day, i) => ({
  day,
  type:     i === 0 ? "Rest" : i === 1 ? "Hard / Intervals" : i === 2 ? "Easy Ride" : i === 4 ? "Easy Ride" : i >= 5 ? "Crit Race" : "Moderate Ride",
  duration: i === 0 ? 0 : i === 1 ? 90 : i === 2 ? 60 : i >= 5 ? 50 : 75,
  notes:    i === 1 ? "Velodrome or fast group ride" : i === 5 ? "2-3 back-to-back crits" : "",
  races:    i >= 5 ? 2 : 0,
}));

/* ─── Sub-components ─── */

function DayCard({ entry, onChange }) {
  const color   = RIDE_COLORS[entry.type] || "#6B7280";
  const isRace  = entry.type.includes("Race");
  const isRest  = entry.type === "Rest";

  return (
    <div
      style={{
        background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 12, padding: 16, position: "relative", overflow: "hidden", transition: "border-color 0.2s",
      }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.18)")}
      onMouseLeave={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)")}
    >
      {/* left accent */}
      <div style={{ position: "absolute", top: 0, left: 0, width: 3, height: "100%", background: color, borderRadius: "12px 0 0 12px" }} />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color: "#9CA3AF", textTransform: "uppercase", marginBottom: 2 }}>{entry.day}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: color }} />
            <span style={{ fontSize: 13, color, fontWeight: 600 }}>{entry.type}</span>
          </div>
        </div>
        {!isRest && (
          <div style={{ background: "rgba(255,255,255,0.06)", borderRadius: 6, padding: "4px 10px", fontSize: 12, color: "#D1D5DB", display: "flex", alignItems: "center", gap: 6 }}>
            <input
              type="number" min={0} max={360} value={entry.duration}
              onChange={e => onChange({ ...entry, duration: parseInt(e.target.value) || 0 })}
              style={{ background: "none", border: "none", outline: "none", color: "#E8F44A", width: 36, fontSize: 13, fontWeight: 700, textAlign: "right", fontFamily: "inherit" }}
            />
            <span>min</span>
          </div>
        )}
      </div>

      <select
        value={entry.type}
        onChange={e => onChange({ ...entry, type: e.target.value, races: e.target.value.includes("Race") ? Math.max(entry.races || 1, 1) : 0 })}
        style={{
          width: "100%", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 8, color: "#F9FAFB", fontSize: 13, padding: "7px 10px", marginBottom: 10,
          outline: "none", cursor: "pointer", fontFamily: "inherit", appearance: "none",
        }}
      >
        {RIDE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
      </select>

      {isRace && (
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
          <span style={{ fontSize: 12, color: "#9CA3AF" }}>Races:</span>
          {[1, 2, 3].map(n => (
            <button
              key={n} onClick={() => onChange({ ...entry, races: n })}
              style={{
                width: 28, height: 28, borderRadius: 6, border: "none", cursor: "pointer",
                background: entry.races === n ? "#F97316" : "rgba(255,255,255,0.08)",
                color: entry.races === n ? "#fff" : "#9CA3AF", fontSize: 13, fontWeight: 700, transition: "all 0.15s",
              }}
            >{n}</button>
          ))}
        </div>
      )}

      <input
        placeholder="Notes (optional)"
        value={entry.notes}
        onChange={e => onChange({ ...entry, notes: e.target.value })}
        style={{
          width: "100%", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 8, color: "#D1D5DB", fontSize: 12, padding: "6px 10px",
          outline: "none", fontFamily: "inherit",
        }}
      />
    </div>
  );
}

function PlanSection({ section }) {
  const icons  = { "Pre-ride": "◎", "During": "◉", "Post-ride": "●", "Note": "→" };
  const colors = { "Pre-ride": "#3B82F6", "During": "#22C55E", "Post-ride": "#F97316", "Note": "#9CA3AF" };

  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", color: "#9CA3AF", textTransform: "uppercase", marginBottom: 10 }}>
        {icons[section.timing] || "→"} {section.timing}
      </div>
      {section.items.map((item, i) => (
        <div key={i} style={{
          display: "flex", gap: 12, padding: "10px 14px", borderRadius: 10,
          background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", marginBottom: 6,
        }}>
          <div style={{ width: 3, borderRadius: 4, background: colors[section.timing] || "#9CA3AF", flexShrink: 0 }} />
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: "#F9FAFB", marginBottom: 3 }}>{item.product}</div>
            <div style={{ fontSize: 12, color: "#9CA3AF", lineHeight: 1.5 }}>{item.instruction}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function PlanCard({ plan }) {
  const [open, setOpen] = useState(false);
  const color = RIDE_COLORS[plan.rideType] || "#6B7280";

  return (
    <div style={{
      background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 14, overflow: "hidden", marginBottom: 10,
    }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{ width: "100%", display: "flex", alignItems: "center", gap: 14, padding: "16px 20px", background: "none", border: "none", cursor: "pointer", textAlign: "left" }}
      >
        <div style={{ width: 4, height: 36, borderRadius: 4, background: color, flexShrink: 0 }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.1em", color: "#9CA3AF", textTransform: "uppercase" }}>{plan.day}</div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#F9FAFB", marginTop: 2 }}>{plan.rideType}</div>
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          {plan.products?.map(p => {
            const prod = PRODUCTS.find(x => x.id === p);
            return prod ? <div key={p} style={{ width: 8, height: 8, borderRadius: "50%", background: prod.color }} /> : null;
          })}
          <span style={{ color: "#9CA3AF", fontSize: 18, marginLeft: 6, transform: open ? "rotate(90deg)" : "none", transition: "transform 0.2s", display: "inline-block" }}>›</span>
        </div>
      </button>

      {open && (
        <div style={{ padding: "4px 20px 20px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          {plan.sections?.map((s, i) => <PlanSection key={i} section={s} />)}
          {plan.proTip && (
            <div style={{
              background: "rgba(232,244,74,0.06)", border: "1px solid rgba(232,244,74,0.15)",
              borderRadius: 10, padding: "10px 14px", marginTop: 4,
            }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#E8F44A", letterSpacing: "0.08em" }}>PRO TIP  </span>
              <span style={{ fontSize: 12, color: "#D1D5DB", lineHeight: 1.5 }}>{plan.proTip}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Main App ─── */

export default function App() {
  const [week,    setWeek]    = useState(defaultWeek);
  const [plan,    setPlan]    = useState(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState(null);
  const [view,    setView]    = useState("input");

  async function generatePlan() {
    setLoading(true);
    setError(null);
    setPlan(null);
    setView("plan");

    try {
      // Use rule-based generator instead of API
      const rideType = week.reduce((s, d) => s + (d.duration || 0), 0) > 300 ? 'endurance' : 'moderate';
      const totalDuration = week.reduce((s, d) => s + (d.duration || 0), 0);
      const hasHardDays = week.some(d => ["Hard / Intervals", "Velodrome", "Crit Race"].includes(d.type));
      
      const inputs = {
        rideType: hasHardDays ? 'intense' : rideType,
        rideDuration: totalDuration,
        bodyWeight: 75, // default, could be user input
        goals: 'maintenance', // default, could be user input
      };

      const generatedPlan = generateNutritionPlan(inputs);

      // Format the plan to match your UI structure
      const formattedPlan = {
        weekSummary: week.map(d =>
          `${d.day}: ${d.type}${d.duration > 0 ? `, ${d.duration} min` : ""}${d.races > 0 ? `, ${d.races} race(s)` : ""}${d.notes ? ` (${d.notes})` : ""}`
        ).join("\n"),
        days: week.map((d, i) => ({
          day: d.day,
          rideType: d.type,
          sections: [
            {
              timing: "Pre-ride",
              items: [
                { product: "Pre-Fuel", instruction: generatedPlan.timing }
              ]
            },
            {
              timing: "During",
              items: [
                { product: "Sports Drink", instruction: `${Math.round(generatedPlan.hydration / 7)}ml every 30 mins` }
              ]
            },
            {
              timing: "Post-ride",
              items: [
                { product: "Recovery", instruction: `${generatedPlan.carbs}g carbs + ${generatedPlan.protein}g protein within 30 mins` }
              ]
            }
          ],
          proTip: `Total: ${generatedPlan.calories} kcal - Carbs: ${generatedPlan.carbs}g | Protein: ${generatedPlan.protein}g | Fat: ${generatedPlan.fat}g`
        }))
      };

      setPlan(formattedPlan);
    } catch (e) {
      setError(e.message || "Failed to generate plan. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const totalHours = week.reduce((s, d) => s + (d.duration || 0), 0) / 60;
  const raceDays   = week.filter(d => d.type.includes("Race")).length;
  const hardDays   = week.filter(d => ["Hard / Intervals", "Velodrome", "Crit Race", "Road Race"].includes(d.type)).length;

  return (
    <div style={{ minHeight: "100vh", background: "#111113", color: "#F9FAFB", fontFamily: "'DM Sans', 'Helvetica Neue', sans-serif" }}>
      {/* Header */}
      <div style={{
        borderBottom: "1px solid rgba(255,255,255,0.07)", padding: "18px 24px",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        background: "rgba(255,255,255,0.02)", position: "sticky", top: 0, zIndex: 10, backdropFilter: "blur(12px)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 32, height: 32, background: "#E8F44A", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>⚡</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#F9FAFB", letterSpacing: "-0.01em" }}>CycleNutrition</div>
            <div style={{ fontSize: 11, color: "#6B7280", letterSpacing: "0.05em" }}>WEEKLY FUEL PLANNER</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 4 }}>
          {["input", "plan"].map(v => (
            <button
              key={v}
              onClick={() => (v === "plan" && !plan) ? null : setView(v)}
              style={{
                padding: "6px 14px", borderRadius: 8, border: "none",
                cursor: plan || v === "input" ? "pointer" : "default",
                background: view === v ? "rgba(232,244,74,0.15)" : "transparent",
                color: view === v ? "#E8F44A" : plan || v === "input" ? "#6B7280" : "#3B3B3F",
                fontSize: 12, fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase",
                transition: "all 0.15s", fontFamily: "inherit",
              }}
            >
              {v === "input" ? "Schedule" : "Plan"}
            </button>
          ))}
        </div>
      </div>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "24px 20px" }}>

        {/* ── SCHEDULE VIEW ── */}
        {view === "input" && (
          <div style={{ animation: "fadeUp 0.3s ease" }}>
            {/* Stats */}
            <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
              {[
                { label: "Total hours", value: totalHours.toFixed(1), color: "#E8F44A" },
                { label: "Hard days",   value: hardDays,              color: "#EF4444" },
                { label: "Race days",   value: raceDays,              color: "#F97316" },
              ].map(s => (
                <div key={s.label} style={{ flex: 1, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, padding: "14px 16px" }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: s.color, fontFamily: "'DM Mono', monospace" }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: "#6B7280", letterSpacing: "0.06em", textTransform: "uppercase", marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>

            {/* Product legend */}
            <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
              {PRODUCTS.map(p => (
                <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 10px", background: "rgba(255,255,255,0.04)", borderRadius: 20, border: "1px solid rgba(255,255,255,0.08)" }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", background: p.color }} />
                  <span style={{ fontSize: 11, color: "#D1D5DB", fontWeight: 500 }}>{p.name}</span>
                </div>
              ))}
            </div>

            {/* Day cards */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 24 }}>
              {week.map((entry, i) => (
                <DayCard
                  key={entry.day}
                  entry={entry}
                  onChange={updated => setWeek(w => w.map((d, j) => j === i ? updated : d))}
                />
              ))}
            </div>

            <button
              onClick={generatePlan}
              disabled={loading}
              style={{
                width: "100%", padding: 16, borderRadius: 12, border: "none",
                background: "#E8F44A", color: "#111113", fontSize: 15, fontWeight: 700,
                cursor: "pointer", letterSpacing: "0.02em", transition: "opacity 0.2s", fontFamily: "inherit",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
              }}
            >
              ⚡ Generate Nutrition Plan
            </button>
          </div>
        )}

        {/* ── PLAN VIEW ── */}
        {view === "plan" && loading && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20, padding: "80px 0" }}>
            <div style={{ width: 48, height: 48, border: "3px solid rgba(255,255,255,0.1)", borderTopColor: "#E8F44A", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
            <p style={{ color: "#9CA3AF", fontSize: 14, letterSpacing: "0.05em" }}>GENERATING YOUR PLAN…</p>
          </div>
        )}

        {view === "plan" && !loading && error && (
          <div>
            <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 10, padding: "12px 16px", color: "#FCA5A5", fontSize: 13, marginBottom: 16 }}>
              {error}
            </div>
            <button onClick={() => setView("input")} style={{ padding: "10px 20px", background: "rgba(255,255,255,0.08)", border: "none", borderRadius: 8, color: "#F9FAFB", cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}>
              ← Back to Schedule
            </button>
          </div>
        )}

        {view === "plan" && !loading && plan && (
          <div style={{ animation: "fadeUp 0.3s ease" }}>
            <div style={{ background: "linear-gradient(135deg, rgba(232,244,74,0.08), rgba(232,244,74,0.03))", border: "1px solid rgba(232,244,74,0.2)", borderRadius: 14, padding: "18px 20px", marginBottom: 20 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#E8F44A", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 8 }}>WEEKLY OVERVIEW</div>
              <p style={{ fontSize: 14, color: "#D1D5DB", lineHeight: 1.6, margin: 0 }}>{plan.weekSummary}</p>
            </div>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#9CA3AF", letterSpacing: "0.08em", textTransform: "uppercase" }}>Daily Plans</div>
              <button
                onClick={() => setView("input")}
                style={{ padding: "6px 12px", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#9CA3AF", fontSize: 12, cursor: "pointer", fontFamily: "inherit", fontWeight: 600 }}
              >
                ← Edit Schedule
              </button>
            </div>

            {plan.days?.map((d, i) => <PlanCard key={i} plan={d} />)}

            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "16px 18px", marginTop: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "#9CA3AF", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 12 }}>Your Products</div>
              {PRODUCTS.map(p => (
                <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <div style={{ width: 10, height: 10, borderRadius: "50%", background: p.color, flexShrink: 0 }} />
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#F9FAFB" }}>{p.name}</span>
                  <span style={{ fontSize: 12, color: "#6B7280" }}>{p.sub}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}