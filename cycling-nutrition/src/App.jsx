import { useState, useEffect, createContext, useContext } from "react";
import {
  generateWeekPlan,
  BOTTLE_SPECS,
} from "./generatePlanRulesBased";

// ─── Constants ────────────────────────────────────────────────────────────────

const DAYS       = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"];
const RIDE_TYPES = ["Rest","Easy Ride","Moderate Ride","Hard / Intervals","Velodrome","Crit Race","Road Race","Gran Fondo"];
const CARBS_PER_SCOOP = 30; // C30 = 30 g per scoop

const PRODUCTS = [
  { id:"prefuel",  name:"ESN Pre-Fuel KOM",           sub:"Non-caffeinated pre-ride",        color:"#3B82F6" },
  { id:"c30",      name:"Neversecond C30",             sub:"Citrus · 30g carbs/scoop",        color:"#22C55E" },
  { id:"gel",      name:"Carbs Fuel 50g Energy Gel",  sub:"Fast-absorbing · 50g carbs each", color:"#A855F7" },
  { id:"suprabar", name:"Supra Performance Bar",       sub:"Plant-based · 35g carbs/bar",     color:"#EF4444" },
  { id:"refuel",   name:"ESN Re-Fuel NICA",            sub:"Chocolate recovery",              color:"#F97316" },
];

const RIDE_COLORS = {
  "Rest":"#6B7280","Easy Ride":"#22C55E","Moderate Ride":"#3B82F6",
  "Hard / Intervals":"#EF4444","Velodrome":"#EF4444",
  "Crit Race":"#F97316","Road Race":"#F97316","Gran Fondo":"#A855F7",
};

// Sensible default scoops by ride type
const DEFAULT_SCOOPS = {
  "Rest":0, "Easy Ride":0, "Moderate Ride":1,
  "Hard / Intervals":2, "Velodrome":2,
  "Crit Race":2, "Road Race":2, "Gran Fondo":2,
};

const DEFAULT_WEEK = DAYS.map((day, i) => {
  const type = i===0?"Rest":i===1?"Hard / Intervals":i===2?"Easy Ride":i===4?"Easy Ride":i>=5?"Crit Race":"Moderate Ride";
  return {
    day, type,
    duration: i===0?0:i===1?90:i===2?60:i>=5?50:75,
    notes:    i===1?"Velodrome or fast group ride":i===5?"2-3 back-to-back crits":"",
    races:    i>=5?2:0,
    scoops:   DEFAULT_SCOOPS[type] ?? 1,
  };
});

const STORAGE_KEY = "cyclenutri_v7";
function loadSaved() {
  try { const r = localStorage.getItem(STORAGE_KEY); return r ? JSON.parse(r) : null; } catch { return null; }
}

// ─── Themes ───────────────────────────────────────────────────────────────────

const DARK = {
  bg:"#111113", surface:"rgba(255,255,255,0.04)", border:"rgba(255,255,255,0.08)",
  borderHover:"rgba(255,255,255,0.22)", text:"#F9FAFB", sub:"#D1D5DB",
  muted:"#9CA3AF", dim:"#6B7280", dimmer:"#4B5563",
  input:"rgba(255,255,255,0.06)", inputBorder:"rgba(255,255,255,0.1)",
  headerBg:"rgba(17,17,19,0.85)", headerBorder:"rgba(255,255,255,0.07)",
  toggleOff:"rgba(255,255,255,0.12)", divider:"rgba(255,255,255,0.06)",
  selectBg:"rgba(255,255,255,0.06)", btnFaint:"rgba(255,255,255,0.04)",
};
const LIGHT = {
  bg:"#F0F2F5", surface:"#FFFFFF", border:"#E5E7EB",
  borderHover:"#9CA3AF", text:"#111827", sub:"#374151",
  muted:"#6B7280", dim:"#9CA3AF", dimmer:"#D1D5DB",
  input:"#F3F4F6", inputBorder:"#D1D5DB",
  headerBg:"rgba(255,255,255,0.92)", headerBorder:"#E5E7EB",
  toggleOff:"#D1D5DB", divider:"#F3F4F6",
  selectBg:"#F3F4F6", btnFaint:"#F3F4F6",
};

const ThemeCtx = createContext(DARK);
const useT = () => useContext(ThemeCtx);

// ─── Responsive hook ─────────────────────────────────────────────────────────

function useWindowWidth() {
  const [w, setW] = useState(typeof window !== "undefined" ? window.innerWidth : 768);
  useEffect(() => {
    const h = () => setW(window.innerWidth);
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  return w;
}

// ─── Toggle ───────────────────────────────────────────────────────────────────

function Toggle({ label, checked, onChange, color = "#22C55E" }) {
  const th = useT();
  return (
    <label style={{ display:"flex", alignItems:"center", gap:10, cursor:"pointer", userSelect:"none" }}>
      <div onClick={onChange}
        style={{ width:40, height:22, borderRadius:11,
          background: checked ? color : th.toggleOff,
          position:"relative", transition:"background 0.2s", flexShrink:0, cursor:"pointer" }}>
        <div style={{ position:"absolute", top:3, left: checked ? 21 : 3,
          width:16, height:16, borderRadius:"50%", background:"#fff",
          transition:"left 0.2s", boxShadow:"0 1px 3px rgba(0,0,0,0.3)" }} />
      </div>
      <span style={{ fontSize:13, color:th.sub }}>{label}</span>
    </label>
  );
}

// ─── DayCard ─────────────────────────────────────────────────────────────────

function DayCard({ entry, onChange }) {
  const th     = useT();
  const color  = RIDE_COLORS[entry.type] || "#6B7280";
  const isRace = entry.type.includes("Race");
  const isRest = entry.type === "Rest";

  return (
    <div
      style={{ background:th.surface, border:`1px solid ${th.border}`, borderRadius:12,
        padding:16, position:"relative", overflow:"hidden", transition:"border-color 0.2s" }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = th.borderHover)}
      onMouseLeave={e => (e.currentTarget.style.borderColor = th.border)}
    >
      <div style={{ position:"absolute", top:0, left:0, width:3, height:"100%",
        background:color, borderRadius:"12px 0 0 12px" }} />

      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:12 }}>
        <div>
          <div style={{ fontSize:11, fontWeight:700, letterSpacing:"0.1em",
            color:th.muted, textTransform:"uppercase", marginBottom:2 }}>{entry.day}</div>
          <div style={{ display:"flex", alignItems:"center", gap:6 }}>
            <div style={{ width:8, height:8, borderRadius:"50%", background:color }} />
            <span style={{ fontSize:13, color, fontWeight:600 }}>{entry.type}</span>
          </div>
        </div>
        {!isRest && (
          <div style={{ background:th.input, borderRadius:6, padding:"4px 10px",
            fontSize:12, color:th.sub, display:"flex", alignItems:"center", gap:6 }}>
            <input type="number" min={0} max={360} value={entry.duration}
              onChange={e => onChange({ ...entry, duration: parseInt(e.target.value) || 0 })}
              style={{ background:"none", border:"none", outline:"none", color:"#E8F44A",
                width:36, fontSize:13, fontWeight:700, textAlign:"right", fontFamily:"inherit" }}
            />
            <span>min</span>
          </div>
        )}
      </div>

      <select value={entry.type}
        onChange={e => {
          const newType = e.target.value;
          onChange({ ...entry, type:newType,
            races: newType.includes("Race") ? Math.max(entry.races || 1, 1) : 0,
            scoops: DEFAULT_SCOOPS[newType] ?? 1,
          });
        }}
        style={{ width:"100%", background:th.selectBg, border:`1px solid ${th.inputBorder}`,
          borderRadius:8, color:th.text, fontSize:13, padding:"7px 10px", marginBottom:10,
          outline:"none", cursor:"pointer", fontFamily:"inherit", appearance:"none" }}
      >
        {RIDE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
      </select>

      {!isRest && (
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
          <span style={{ fontSize:11, color:th.muted, flexShrink:0 }}>C30 scoops:</span>
          {[1, 2, 3].map(n => (
            <button key={n} onClick={() => onChange({ ...entry, scoops:n })}
              style={{ width:26, height:26, borderRadius:6, border:"none", cursor:"pointer",
                background: (entry.scoops||1) === n ? "#22C55E" : th.input,
                color:      (entry.scoops||1) === n ? "#fff"    : th.muted,
                fontSize:12, fontWeight:700, transition:"all 0.15s", flexShrink:0 }}
            >{n}</button>
          ))}
          <span style={{ fontSize:10, color:th.dim }}>
            {(entry.scoops||1) * CARBS_PER_SCOOP * 2}g liquid carbs
          </span>
        </div>
      )}

      {isRace && (
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:8 }}>
          <span style={{ fontSize:12, color:th.muted }}>Races:</span>
          {[1,2,3].map(n => (
            <button key={n} onClick={() => onChange({ ...entry, races:n })}
              style={{ width:28, height:28, borderRadius:6, border:"none", cursor:"pointer",
                background: entry.races === n ? "#F97316" : th.input,
                color: entry.races === n ? "#fff" : th.muted,
                fontSize:13, fontWeight:700, transition:"all 0.15s" }}
            >{n}</button>
          ))}
        </div>
      )}

      <input placeholder="Notes (optional)" value={entry.notes}
        onChange={e => onChange({ ...entry, notes:e.target.value })}
        style={{ width:"100%", background:th.btnFaint, border:`1px solid ${th.border}`,
          borderRadius:8, color:th.sub, fontSize:12, padding:"6px 10px",
          outline:"none", fontFamily:"inherit", boxSizing:"border-box" }}
      />
    </div>
  );
}

// ─── FuelingVisual ────────────────────────────────────────────────────────────

function FuelingVisual({ fueling, sizeOz }) {
  const th = useT();
  if (!fueling?.bottles) return null;

  const sizeLabel      = BOTTLE_SPECS[sizeOz].label;
  const fills          = 1 + (fueling.bottles.c30Refills || 0) + (fueling.bottles.waterOnlyRefills || 0);
  // Derive scoops from what the engine actually computed
  const carbsPerBottle = Math.round(fueling.bottles.carbsFromBottles / (2 * fills));
  const scoopsPerBottle = Math.round(carbsPerBottle / CARBS_PER_SCOOP) || 1;
  const p              = fueling.pocket;
  const totalCarbs     = fueling.carbsFromLiquid + fueling.carbsFromSolid;

  return (
    <div style={{ marginBottom:16 }}>

      {/* Carb coverage bar */}
      <div style={{ marginBottom:10 }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:5, flexWrap:"wrap", gap:4 }}>
          <span style={{ fontSize:11, fontWeight:700, color:th.muted,
            letterSpacing:"0.08em", textTransform:"uppercase" }}>Carb target coverage</span>
          <span style={{ fontSize:12, color:th.muted }}>
            <span style={{ color:"#E8F44A", fontWeight:700 }}>{totalCarbs}g</span>
            {" "}/ {fueling.totalCarbsNeeded}g needed
          </span>
        </div>
        <div style={{ display:"flex", height:10, borderRadius:5, overflow:"hidden", gap:2 }}>
          {fueling.carbsFromLiquid > 0 && (
            <div style={{ flex:fueling.carbsFromLiquid, background:"#22C55E",
              borderRadius: fueling.carbsFromSolid === 0 ? "5px" : "5px 0 0 5px" }} />
          )}
          {p?.carbsFromGels > 0 && <div style={{ flex:p.carbsFromGels, background:"#A855F7" }} />}
          {p?.carbsFromBars > 0 && (
            <div style={{ flex:p.carbsFromBars, background:"#EF4444", borderRadius:"0 5px 5px 0" }} />
          )}
          {fueling.totalCarbsNeeded > totalCarbs && (
            <div style={{ flex: fueling.totalCarbsNeeded - totalCarbs,
              background: th.input, borderRadius:"0 5px 5px 0" }} />
          )}
        </div>
        <div style={{ display:"flex", gap:12, marginTop:5, flexWrap:"wrap" }}>
          <span style={{ fontSize:11, color:th.muted }}>
            <span style={{ color:"#22C55E" }}>●</span> {fueling.carbsFromLiquid}g bottles
          </span>
          {p?.carbsFromGels > 0 && (
            <span style={{ fontSize:11, color:th.muted }}>
              <span style={{ color:"#A855F7" }}>●</span> {p.carbsFromGels}g gels
            </span>
          )}
          {p?.carbsFromBars > 0 && (
            <span style={{ fontSize:11, color:th.muted }}>
              <span style={{ color:"#EF4444" }}>●</span> {p.carbsFromBars}g bars
            </span>
          )}
        </div>
      </div>

      {/* 3-slot layout: Bottle 1 | Bottle 2 | Pocket */}
      <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
        {[1, 2].map(b => {
          const rf = fueling.bottles.refillsNeeded;
          // c30Refills is on the fueling object when the engine sets it; fall back to rf
          const c30rf   = fueling.bottles.c30Refills   ?? (rf > 0 ? rf : 0);
          const waterrf = fueling.bottles.waterOnlyRefills ?? 0;
          return (
            <div key={b} style={{ flex:"1 1 80px", minWidth:80,
              background:"rgba(34,197,94,0.07)", border:"1px solid rgba(34,197,94,0.2)",
              borderRadius:10, padding:"10px 12px" }}>
              <div style={{ fontSize:10, fontWeight:700, color:"#22C55E",
                letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:4 }}>Bottle {b}</div>
              <div style={{ fontSize:13, fontWeight:600, color:th.text }}>C30 Citrus</div>
              <div style={{ fontSize:11, color:th.dim, marginTop:2 }}>
                {sizeLabel} · {scoopsPerBottle} scoop{scoopsPerBottle > 1 ? "s" : ""}
              </div>
              <div style={{ fontSize:12, fontWeight:700, color:"#22C55E", marginTop:4 }}>
                +{carbsPerBottle}g carbs
              </div>
              {c30rf > 0 && (
                <div style={{ fontSize:10, color:"#22C55E", marginTop:3 }}>
                  ↺ +C30 ×{c30rf}
                </div>
              )}
              {waterrf > 0 && (
                <div style={{ fontSize:10, color:"#3B82F6", marginTop:2 }}>
                  💧 water refill ×{waterrf}
                </div>
              )}
            </div>
          );
        })}

        {p && (p.gels > 0 || p.bars > 0) && (
          <div style={{ flex:"1 1 80px", minWidth:80, background:th.input,
            border:`1px solid ${th.border}`, borderRadius:10, padding:"10px 12px" }}>
            <div style={{ fontSize:10, fontWeight:700, color:th.muted,
              letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:4 }}>Jersey pocket</div>
            {p.gels > 0 && (
              <div style={{ display:"flex", alignItems:"center", gap:5, marginBottom:4 }}>
                <div style={{ width:6, height:6, borderRadius:"50%", background:"#A855F7", flexShrink:0 }} />
                <span style={{ fontSize:12, fontWeight:600, color:th.text }}>{p.gels}× gel</span>
                <span style={{ fontSize:11, color:th.dim }}>{p.carbsFromGels}g</span>
              </div>
            )}
            {p.bars > 0 && (
              <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                <div style={{ width:6, height:6, borderRadius:"50%", background:"#EF4444", flexShrink:0 }} />
                <span style={{ fontSize:12, fontWeight:600, color:th.text }}>{p.bars}× bar</span>
                <span style={{ fontSize:11, color:th.dim }}>{p.carbsFromBars}g</span>
              </div>
            )}
            <div style={{ fontSize:12, fontWeight:700, color:th.sub, marginTop:6 }}>
              +{p.totalCarbs}g carbs
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── PlanSection ──────────────────────────────────────────────────────────────

function PlanSection({ section }) {
  const th     = useT();
  const icons  = { "Pre-ride":"◎","During":"◉","Post-ride":"●","Note":"→" };
  const colors = { "Pre-ride":"#3B82F6","During":"#22C55E","Post-ride":"#F97316","Note":"#9CA3AF" };
  return (
    <div style={{ marginBottom:14 }}>
      <div style={{ fontSize:11, fontWeight:700, letterSpacing:"0.12em",
        color:th.muted, textTransform:"uppercase", marginBottom:8 }}>
        {icons[section.timing] || "→"} {section.timing}
      </div>
      {section.items.map((item, i) => (
        <div key={i} style={{ display:"flex", gap:12, padding:"10px 14px",
          borderRadius:10, background:th.input, border:`1px solid ${th.border}`,
          marginBottom:6 }}>
          <div style={{ width:3, borderRadius:4,
            background: colors[section.timing] || "#9CA3AF", flexShrink:0 }} />
          <div>
            <div style={{ fontSize:13, fontWeight:600, color:th.text, marginBottom:3 }}>
              {item.product}
            </div>
            <div style={{ fontSize:12, color:th.muted, lineHeight:1.5 }}>{item.instruction}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── PlanCard ─────────────────────────────────────────────────────────────────

function PlanCard({ plan, bottleSizeOz }) {
  const th    = useT();
  const w     = useWindowWidth();
  const [open, setOpen] = useState(false);
  const color = RIDE_COLORS[plan.rideType] || "#6B7280";
  const f     = plan.fueling;
  const p     = f?.pocket;

  return (
    <div style={{ background:th.surface, border:`1px solid ${th.border}`,
      borderRadius:14, overflow:"hidden", marginBottom:10 }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ width:"100%", display:"flex", alignItems:"center", gap:12,
          padding: w < 480 ? "12px 14px" : "16px 20px",
          background:"none", border:"none", cursor:"pointer", textAlign:"left" }}
      >
        <div style={{ width:4, height:36, borderRadius:4, background:color, flexShrink:0 }} />
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontSize:11, fontWeight:700, letterSpacing:"0.1em",
            color:th.muted, textTransform:"uppercase" }}>{plan.day}</div>
          <div style={{ fontSize:15, fontWeight:700, color:th.text, marginTop:2,
            whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{plan.rideType}</div>
        </div>
        <div style={{ display:"flex", gap:4, alignItems:"center", flexShrink:0, flexWrap:"wrap", justifyContent:"flex-end" }}>
          {f?.bottles && (
            <div style={{ display:"flex", alignItems:"center", gap:4,
              background:"rgba(34,197,94,0.1)", border:"1px solid rgba(34,197,94,0.25)",
              borderRadius:20, padding:"3px 8px" }}>
              <span style={{ fontSize:11 }}>🍶</span>
              <span style={{ fontSize:11, fontWeight:700, color:"#22C55E" }}>
                2×{BOTTLE_SPECS[bottleSizeOz].label.split(" ")[0]}
              </span>
            </div>
          )}
          {p?.gels > 0 && (
            <div style={{ display:"flex", alignItems:"center", gap:3,
              background:"rgba(168,85,247,0.1)", border:"1px solid rgba(168,85,247,0.25)",
              borderRadius:20, padding:"3px 7px" }}>
              <span style={{ fontSize:10 }}>💜</span>
              <span style={{ fontSize:11, fontWeight:700, color:"#A855F7" }}>{p.gels}g</span>
            </div>
          )}
          {p?.bars > 0 && (
            <div style={{ display:"flex", alignItems:"center", gap:3,
              background:"rgba(239,68,68,0.1)", border:"1px solid rgba(239,68,68,0.25)",
              borderRadius:20, padding:"3px 7px" }}>
              <span style={{ fontSize:10 }}>🔴</span>
              <span style={{ fontSize:11, fontWeight:700, color:"#EF4444" }}>{p.bars}b</span>
            </div>
          )}
          {plan.calories > 0 && (
            <div style={{ fontSize:11, color:th.dim, background:th.input,
              borderRadius:20, padding:"3px 7px", whiteSpace:"nowrap" }}>
              {plan.calories.toLocaleString()}kcal
            </div>
          )}
          <span style={{ color:th.muted, fontSize:18,
            transform: open ? "rotate(90deg)" : "none",
            transition:"transform 0.2s", display:"inline-block" }}>›</span>
        </div>
      </button>

      {open && (
        <div style={{ padding: w < 480 ? "4px 14px 16px" : "4px 20px 20px",
          borderTop:`1px solid ${th.divider}` }}>
          <FuelingVisual fueling={f} sizeOz={bottleSizeOz} />

          {plan.hydration > 0 && (
            <div style={{ display:"flex", alignItems:"center", gap:8,
              marginBottom:12, fontSize:12, color:th.dim }}>
              <span>💧</span>
              <span>Hydration target: <span style={{ color:"#3B82F6", fontWeight:700 }}>
                {plan.hydration}ml</span> — your 2 bottles cover this, keep sipping
              </span>
            </div>
          )}

          {plan.sections?.map((s, i) => <PlanSection key={i} section={s} />)}

          {plan.proTip && (
            <div style={{ background:"rgba(232,244,74,0.06)",
              border:"1px solid rgba(232,244,74,0.15)", borderRadius:10,
              padding:"10px 14px", marginTop:4 }}>
              <span style={{ fontSize:11, fontWeight:700, color:"#E8F44A",
                letterSpacing:"0.08em" }}>PRO TIP  </span>
              <span style={{ fontSize:12, color:th.sub, lineHeight:1.5 }}>{plan.proTip}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── ShoppingList ─────────────────────────────────────────────────────────────

function ShoppingList({ shopping }) {
  const th = useT();
  if (!shopping?.length) return null;
  return (
    <div style={{ background:th.surface, border:`1px solid ${th.border}`,
      borderRadius:12, padding:"16px 18px", marginTop:14 }}>
      <div style={{ fontSize:11, fontWeight:700, color:th.muted,
        letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:14 }}>
        🛒 Weekly Shopping List
      </div>
      {shopping.map((item, i) => (
        <div key={i} style={{ display:"flex", alignItems:"center", gap:12,
          paddingBottom: i < shopping.length - 1 ? 10 : 0,
          marginBottom:  i < shopping.length - 1 ? 10 : 0,
          borderBottom:  i < shopping.length - 1 ? `1px solid ${th.divider}` : "none" }}>
          <div style={{ width:44, height:44, borderRadius:10,
            background:`${item.color}15`, border:`1px solid ${item.color}30`,
            display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
            <span style={{ fontSize:18, fontWeight:700, color:item.color,
              fontFamily:"'DM Mono',monospace" }}>{item.qty}</span>
          </div>
          <div>
            <div style={{ fontSize:13, fontWeight:600, color:th.text }}>{item.product}</div>
            <div style={{ fontSize:12, color:th.dim }}>{item.qty} {item.unit} · {item.detail}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────

export default function App() {
  const saved = loadSaved();
  const w     = useWindowWidth();
  const isMobile = w < 600;

  const [dark,           setDark]           = useState(saved?.dark           ?? true);
  const [week,           setWeek]           = useState(saved?.week           ?? DEFAULT_WEEK);
  const [weight,         setWeight]         = useState(saved?.weight         ?? 75);
  const [hotWeather,     setHotWeather]     = useState(saved?.hotWeather     ?? false);
  const [bottleSize,     setBottleSize]     = useState(saved?.bottleSize     ?? 22);
  const [plan,           setPlan]           = useState(null);
  const [view,           setView]           = useState("input");

  const th = dark ? DARK : LIGHT;

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY,
        JSON.stringify({ dark, week, weight, hotWeather, bottleSize }));
    } catch {}
  }, [dark, week, weight, hotWeather, bottleSize]);

  function generatePlan() {
    // scoopsPerBottle is now handled inside the rules engine — no post-processing needed
    const p = generateWeekPlan(week, weight, hotWeather, bottleSize);
    setPlan(p);
    setView("plan");
  }

  function applyRaceWeek() {
    setWeek(w => w.map((d, i) => {
      if (i === 4) return { ...d, type:"Easy Ride",  duration:45, notes:"Pre-race spin", races:0, scoops:1 };
      if (i === 5) return { ...d, type:"Crit Race",  duration:50, notes:"Race day",      races:2, scoops:2 };
      if (i === 6) return { ...d, type:"Crit Race",  duration:50, notes:"Race day",      races:2, scoops:2 };
      return d;
    }));
  }

  function resetWeek() {
    if (confirm("Reset to default week?")) { setWeek(DEFAULT_WEEK); setPlan(null); }
  }

  const totalHours   = week.reduce((s, d) => s + (d.duration || 0), 0) / 60;
  const raceDays     = week.filter(d => d.type.includes("Race")).length;
  const hardDays     = week.filter(d =>
    ["Hard / Intervals","Velodrome","Crit Race","Road Race"].includes(d.type)).length;
  const weekCalories = plan?.days?.reduce((s, d) => s + (d.calories || 0), 0) ?? 0;

  const cardStyle = {
    background: th.surface,
    border: `1px solid ${th.border}`,
    borderRadius: 12,
  };

  return (
    <ThemeCtx.Provider value={th}>
      <style>{`
        @keyframes fadeUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:none; } }
        * { box-sizing: border-box; }
        input[type=number]::-webkit-inner-spin-button { opacity:0.4; }
        select option { background: ${dark ? "#1F2937" : "#FFFFFF"}; color: ${th.text}; }
      `}</style>

      <div style={{ minHeight:"100vh", background:th.bg, color:th.text,
        fontFamily:"'DM Sans','Helvetica Neue',sans-serif", transition:"background 0.25s, color 0.25s" }}>

        {/* ── Header ── */}
        <div style={{ borderBottom:`1px solid ${th.headerBorder}`,
          padding: isMobile ? "10px 14px" : "14px 20px",
          display:"flex", alignItems:"center", justifyContent:"space-between",
          background:th.headerBg, position:"sticky", top:0, zIndex:10,
          backdropFilter:"blur(12px)", flexWrap:"wrap", gap:8 }}>

          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ width:30, height:30, background:"#E8F44A", borderRadius:8,
              display:"flex", alignItems:"center", justifyContent:"center", fontSize:15, flexShrink:0 }}>⚡</div>
            <div>
              <div style={{ fontSize:14, fontWeight:700, color:th.text,
                letterSpacing:"-0.01em" }}>CycleNutrition</div>
              {!isMobile && (
                <div style={{ fontSize:10, color:th.dim, letterSpacing:"0.05em" }}>WEEKLY FUEL PLANNER</div>
              )}
            </div>
          </div>

          <div style={{ display:"flex", gap:4, alignItems:"center" }}>
            {/* Dark / light toggle */}
            <button onClick={() => setDark(d => !d)}
              title={dark ? "Switch to light mode" : "Switch to dark mode"}
              style={{ width:32, height:32, borderRadius:8, border:`1px solid ${th.border}`,
                background:th.btnFaint, cursor:"pointer", display:"flex",
                alignItems:"center", justifyContent:"center", fontSize:15,
                color:th.muted, transition:"all 0.15s" }}>
              {dark ? "☀️" : "🌙"}
            </button>

            {/* View tabs */}
            {["input","plan"].map(v => (
              <button key={v} onClick={() => (v === "plan" && !plan) ? null : setView(v)}
                style={{ padding: isMobile ? "5px 10px" : "5px 12px",
                  borderRadius:8, border:"none",
                  cursor: plan || v === "input" ? "pointer" : "default",
                  background: view === v ? "rgba(232,244,74,0.15)" : "transparent",
                  color: view === v ? "#E8F44A" : (plan || v === "input") ? th.muted : th.dimmer,
                  fontSize:11, fontWeight:600, letterSpacing:"0.06em",
                  textTransform:"uppercase", transition:"all 0.15s", fontFamily:"inherit" }}
              >{v === "input" ? "Schedule" : "Plan"}</button>
            ))}
          </div>
        </div>

        <div style={{ maxWidth:720, margin:"0 auto", padding: isMobile ? "14px 12px" : "20px 16px" }}>

          {/* ── SCHEDULE VIEW ── */}
          {view === "input" && (
            <div style={{ animation:"fadeUp 0.3s ease" }}>

              {/* Rider settings */}
              <div style={{ ...cardStyle, padding:"14px 16px", marginBottom:14 }}>
                <div style={{ fontSize:11, fontWeight:700, letterSpacing:"0.1em",
                  color:th.muted, textTransform:"uppercase", marginBottom:14 }}>Rider Settings</div>

                <div style={{ display:"flex", gap:16, flexWrap:"wrap", alignItems:"flex-start" }}>

                  {/* Weight */}
                  <div style={{ minWidth:100 }}>
                    <div style={{ fontSize:11, color:th.dim, marginBottom:6 }}>Body weight</div>
                    <div style={{ display:"flex", alignItems:"center", gap:6,
                      background:th.input, borderRadius:8, padding:"6px 10px" }}>
                      <input type="number" min={40} max={150} value={weight}
                        onChange={e => setWeight(parseFloat(e.target.value) || 75)}
                        style={{ background:"none", border:"none", outline:"none", color:"#E8F44A",
                          width:40, fontSize:14, fontWeight:700, textAlign:"right", fontFamily:"inherit" }}
                      />
                      <span style={{ fontSize:12, color:th.muted }}>kg</span>
                    </div>
                  </div>

                  {/* Bottle size */}
                  <div>
                    <div style={{ fontSize:11, color:th.dim, marginBottom:6 }}>
                      Bottle size <span style={{ color:th.dimmer }}>(max 2 on bike)</span>
                    </div>
                    <div style={{ display:"flex", gap:6 }}>
                      {[22, 26].map(oz => (
                        <button key={oz} onClick={() => setBottleSize(oz)}
                          style={{ padding:"6px 14px", borderRadius:8, border:"none",
                            cursor:"pointer", fontFamily:"inherit", fontSize:12, fontWeight:700,
                            transition:"all 0.15s",
                            background: bottleSize === oz ? "#E8F44A" : th.input,
                            color:      bottleSize === oz ? "#111113" : th.muted }}
                        >{BOTTLE_SPECS[oz].label}</button>
                      ))}
                    </div>
                  </div>

                  {/* Hot weather */}
                  <div style={{ paddingTop:isMobile ? 0 : 18 }}>
                    <Toggle
                      label={hotWeather ? "☀️ Hot weather (+hydration)" : "🌤 Normal weather"}
                      checked={hotWeather} onChange={() => setHotWeather(h => !h)} color="#F97316"
                    />
                  </div>
                </div>
              </div>

              {/* Quick actions */}
              <div style={{ display:"flex", gap:8, marginBottom:14 }}>
                <button onClick={applyRaceWeek}
                  style={{ flex:1, padding:"9px 14px",
                    background:"rgba(249,115,22,0.1)", border:"1px solid rgba(249,115,22,0.25)",
                    borderRadius:10, color:"#FB923C", fontSize:12, fontWeight:600,
                    cursor:"pointer", fontFamily:"inherit", transition:"all 0.15s" }}
                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(249,115,22,0.18)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "rgba(249,115,22,0.1)")}
                >🏁 Apply Race Weekend (Fri–Sun)</button>
                <button onClick={resetWeek}
                  style={{ padding:"9px 14px", background:th.btnFaint,
                    border:`1px solid ${th.border}`, borderRadius:10,
                    color:th.muted, fontSize:12, fontWeight:600,
                    cursor:"pointer", fontFamily:"inherit" }}
                >↺ Reset</button>
              </div>

              {/* Stats */}
              <div style={{ display:"flex", gap:10, marginBottom:16, flexWrap:"wrap" }}>
                {[
                  { label:"Total hours", value:totalHours.toFixed(1), color:"#E8F44A" },
                  { label:"Hard days",   value:hardDays,              color:"#EF4444"  },
                  { label:"Race days",   value:raceDays,              color:"#F97316"  },
                ].map(s => (
                  <div key={s.label} style={{ flex:"1 1 80px", ...cardStyle, padding:"12px 14px" }}>
                    <div style={{ fontSize:22, fontWeight:700, color:s.color,
                      fontFamily:"'DM Mono',monospace" }}>{s.value}</div>
                    <div style={{ fontSize:10, color:th.dim, letterSpacing:"0.06em",
                      textTransform:"uppercase", marginTop:2 }}>{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Products legend */}
              <div style={{ display:"flex", gap:6, marginBottom:16, flexWrap:"wrap" }}>
                {PRODUCTS.map(p => (
                  <div key={p.id} style={{ display:"flex", alignItems:"center", gap:5,
                    padding:"4px 9px", ...cardStyle, borderRadius:20 }}>
                    <div style={{ width:7, height:7, borderRadius:"50%", background:p.color }} />
                    <span style={{ fontSize:11, color:th.sub, fontWeight:500 }}>{p.name}</span>
                    {!isMobile && <span style={{ fontSize:10, color:th.dim }}>{p.sub}</span>}
                  </div>
                ))}
              </div>

              {/* Day cards grid */}
              <div style={{ display:"grid",
                gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill,minmax(280px,1fr))",
                gap:10, marginBottom:20 }}>
                {week.map((entry, i) => (
                  <DayCard key={entry.day} entry={entry}
                    onChange={updated => setWeek(w => w.map((d, j) => j === i ? updated : d))}
                  />
                ))}
              </div>

              <button onClick={generatePlan}
                style={{ width:"100%", padding:16, borderRadius:12, border:"none",
                  background:"#E8F44A", color:"#111113", fontSize:15, fontWeight:700,
                  cursor:"pointer", letterSpacing:"0.02em", fontFamily:"inherit",
                  display:"flex", alignItems:"center", justifyContent:"center", gap:10 }}>
                ⚡ Generate Nutrition Plan
              </button>
            </div>
          )}

          {/* ── PLAN VIEW ── */}
          {view === "plan" && plan && (
            <div style={{ animation:"fadeUp 0.3s ease" }}>

              {/* Overview */}
              <div style={{ background:"linear-gradient(135deg,rgba(232,244,74,0.08),rgba(232,244,74,0.03))",
                border:"1px solid rgba(232,244,74,0.2)", borderRadius:14,
                padding:"16px 18px", marginBottom:12 }}>
                <div style={{ fontSize:11, fontWeight:700, color:"#E8F44A",
                  letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:8 }}>WEEKLY OVERVIEW</div>
                <p style={{ fontSize:14, color:th.sub, lineHeight:1.6, margin:0 }}>
                  {plan.weekSummary}
                </p>
              </div>

              {/* Week totals */}
              <div style={{ display:"flex", gap:8, marginBottom:12, flexWrap:"wrap" }}>
                {[
                  { key:"c30Scoops", label:"C30 scoops",     color:"#22C55E" },
                  { key:"gels",      label:"Carbs Fuel gels", color:"#A855F7" },
                  { key:"bars",      label:"Supra bars",      color:"#EF4444" },
                ].map(s => plan.weekTotals[s.key] > 0 && (
                  <div key={s.key} style={{ flex:"1 1 80px",
                    background:`${s.color}0d`, border:`1px solid ${s.color}30`,
                    borderRadius:12, padding:"10px 12px" }}>
                    <div style={{ fontSize:20, fontWeight:700, color:s.color,
                      fontFamily:"'DM Mono',monospace" }}>{plan.weekTotals[s.key]}</div>
                    <div style={{ fontSize:11, color:th.dim, marginTop:1 }}>{s.label}</div>
                  </div>
                ))}
                {weekCalories > 0 && (
                  <div style={{ flex:"1 1 80px",
                    background:"rgba(249,115,22,0.06)", border:"1px solid rgba(249,115,22,0.2)",
                    borderRadius:12, padding:"10px 12px" }}>
                    <div style={{ fontSize:20, fontWeight:700, color:"#F97316",
                      fontFamily:"'DM Mono',monospace" }}>{weekCalories.toLocaleString()}</div>
                    <div style={{ fontSize:11, color:th.dim, marginTop:1 }}>kcal burned</div>
                  </div>
                )}
              </div>

              {/* Bottle constraint reminder */}
              <div style={{ display:"flex", alignItems:"center", gap:10,
                background:th.btnFaint, border:`1px solid ${th.border}`,
                borderRadius:10, padding:"10px 14px", marginBottom:14, flexWrap:"wrap" }}>
                <span style={{ fontSize:15 }}>🍶</span>
                <span style={{ fontSize:13, color:th.muted }}>
                  <span style={{ color:th.text, fontWeight:600 }}>
                    2 × {BOTTLE_SPECS[bottleSize].label} C30
                  </span> — scoops set per day ·
                  <span style={{ color:"#A855F7", fontWeight:600 }}> gels</span> and
                  <span style={{ color:"#EF4444", fontWeight:600 }}> bars</span> in the jersey pocket
                </span>
              </div>

              <div style={{ display:"flex", alignItems:"center",
                justifyContent:"space-between", marginBottom:12 }}>
                <div style={{ fontSize:12, fontWeight:700, color:th.muted,
                  letterSpacing:"0.08em", textTransform:"uppercase" }}>Daily Plans</div>
                <button onClick={() => setView("input")}
                  style={{ padding:"6px 12px", background:th.input,
                    border:`1px solid ${th.border}`, borderRadius:8,
                    color:th.muted, fontSize:12, cursor:"pointer",
                    fontFamily:"inherit", fontWeight:600 }}>← Edit Schedule</button>
              </div>

              {plan.days?.map((d, i) => (
                <PlanCard key={i} plan={d} bottleSizeOz={bottleSize} />
              ))}

              <ShoppingList shopping={plan.shopping} />

              {/* Products */}
              <div style={{ ...cardStyle, padding:"14px 16px", marginTop:14 }}>
                <div style={{ fontSize:11, fontWeight:700, color:th.muted,
                  letterSpacing:"0.08em", textTransform:"uppercase", marginBottom:12 }}>Your Products</div>
                {PRODUCTS.map(p => (
                  <div key={p.id} style={{ display:"flex", alignItems:"center",
                    gap:10, marginBottom:8, flexWrap:"wrap" }}>
                    <div style={{ width:10, height:10, borderRadius:"50%",
                      background:p.color, flexShrink:0 }} />
                    <span style={{ fontSize:13, fontWeight:600, color:th.text }}>{p.name}</span>
                    <span style={{ fontSize:12, color:th.dim }}>{p.sub}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </ThemeCtx.Provider>
  );
}
