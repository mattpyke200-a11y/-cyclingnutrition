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
    strength: null,  // { type: "Upper"|"Lower"|"Full Body"|"Core", duration: number }
  };
});

const STORAGE_KEY = "cyclenutri_v9";
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
          outline:"none", fontFamily:"inherit", boxSizing:"border-box", marginBottom:8 }}
      />

      {/* Strength training */}
      <div style={{ borderTop:`1px solid ${th.divider}`, paddingTop:8 }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
          marginBottom: entry.strength ? 8 : 0 }}>
          <span style={{ fontSize:11, color:th.muted }}>💪 Strength session</span>
          <button
            onClick={() => onChange({ ...entry,
              strength: entry.strength ? null : { type:"Full Body", duration:45 } })}
            style={{ fontSize:11, fontWeight:700, padding:"3px 10px", borderRadius:6,
              border:"none", cursor:"pointer", fontFamily:"inherit", transition:"all 0.15s",
              background: entry.strength ? "#F97316" : th.input,
              color:       entry.strength ? "#fff"    : th.muted }}>
            {entry.strength ? "On" : "Add"}
          </button>
        </div>
        {entry.strength && (
          <div style={{ display:"flex", gap:6, flexWrap:"wrap", alignItems:"center" }}>
            {["Upper","Lower","Full Body","Core"].map(t => (
              <button key={t} onClick={() => onChange({
                ...entry, strength: { ...entry.strength, type:t } })}
                style={{ padding:"4px 10px", borderRadius:6, border:"none",
                  cursor:"pointer", fontFamily:"inherit", fontSize:11, fontWeight:700,
                  transition:"all 0.15s",
                  background: entry.strength.type === t ? "#F97316" : th.input,
                  color:      entry.strength.type === t ? "#fff"    : th.muted }}>
                {t}
              </button>
            ))}
            <div style={{ display:"flex", alignItems:"center", gap:4,
              background:th.input, borderRadius:6, padding:"3px 8px", marginLeft:"auto" }}>
              <input type="number" min={15} max={120}
                value={entry.strength.duration}
                onChange={e => onChange({ ...entry,
                  strength: { ...entry.strength, duration: parseInt(e.target.value)||45 } })}
                style={{ background:"none", border:"none", outline:"none",
                  color:"#F97316", width:30, fontSize:12, fontWeight:700,
                  textAlign:"right", fontFamily:"inherit" }}
              />
              <span style={{ fontSize:11, color:th.muted }}>min</span>
            </div>
          </div>
        )}
      </div>
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


// ─── Rules-based Meal Plan Engine ────────────────────────────────────────────

function buildMealPlan({ rideType, rideCals, rideCarbs, rideDuration, weight, age, fueling, hasStrength, strengthType, strengthDuration }) {
  const isRest   = rideType === "Rest";
  const isEasy   = rideType === "Easy Ride";
  const isHard   = ["Hard / Intervals","Velodrome"].includes(rideType);
  const isRace   = rideType.includes("Race");
  const isGF     = rideType === "Gran Fondo";
  const isMod    = rideType === "Moderate Ride";
  const senior   = age >= 35;                    // tighter protein timing from 35+
  const hStr     = hasStrength && strengthType;
  const sDur     = strengthDuration || 45;
  const strengthCals = hStr ? Math.round(sDur * 7.5) : 0;  // ~7.5 kcal/min resistance

  // ── Daily targets ──────────────────────────────────────────────────────────
  // BMR (Mifflin-St Jeor, male default, 175cm estimate)
  const bmr = Math.round(10 * weight + 6.25 * 175 - 5 * age + 5);
  // Activity factor for NEAT (non-exercise movement)
  const neat = Math.round(weight * (isRest ? 28 : isEasy ? 30 : isMod ? 32 : 34));
  // Total daily energy: BMR + NEAT + ride + strength - calories already consumed from ride products
  const rideProductCals = Math.round(rideCarbs * 4 * 0.85); // ~85% absorbed carbs from bottles/gels/bars
  const totalDayCals = bmr + neat + rideCals + strengthCals - rideProductCals;

  // Carb periodisation (g/kg)
  const carbPerKg = isRest ? 3.5 : isEasy ? 4.5 : isMod ? 5.5 : (isHard || isGF) ? 7.5 : isRace ? 8.0 : 5.0;
  // Subtract ride carbs (already fuelled on bike) from total food carbs
  const dailyCarbsFood = Math.max(Math.round(carbPerKg * weight - rideCarbs * 0.6), Math.round(carbPerKg * weight * 0.4));

  // Protein: base + age bump + hard/race + strength
  const protBase = senior ? 2.1 : 1.8;
  const protExtra = (isHard || isRace || isGF ? 0.2 : 0) + (hStr ? 0.3 : 0);
  const dailyProt = Math.round((protBase + protExtra) * weight);

  // Fat: remainder
  const carbFoodCals = dailyCarbsFood * 4;
  const protCals     = dailyProt * 4;
  const fatCals      = Math.max(totalDayCals - carbFoodCals - protCals, weight * 1.0 * 9);
  const dailyFat     = Math.round(fatCals / 9);
  const actualCals   = Math.round(carbFoodCals + protCals + dailyFat * 9);

  // ── OptygenHP timing ───────────────────────────────────────────────────────
  const dose1 = isRest
    ? "06:30 — with breakfast, take 2 capsules alongside a full meal for optimal absorption of rhodiola and CoQ10 stack"
    : "06:00 — 2 capsules with pre-ride breakfast, 45–60 min before the session; rhodiola peaks at ~1h post-ingestion";
  const dose2 = "19:30 — 2 capsules with dinner, 6h+ after dose 1; supports overnight adaptation from the acetyl-L-carnitine and VO2 stack";

  // ── Meal builder helpers ───────────────────────────────────────────────────
  const W = weight;
  const earlyStart = !isRace; // races assumed afternoon

  // Protein anchor foods (no fish)
  const proteinSources = {
    breakfast: ["3 whole eggs scrambled", "200g Greek yogurt (2% fat)"],
    postRide:  senior ? ["30g whey protein in 300ml oat milk", "200g Greek yogurt with 20g walnuts"] :
                        ["200g Greek yogurt with 20g walnuts", "1 banana"],
    lunch:     ["150g grilled chicken breast", "2 eggs hard-boiled"],
    dinner:    ["180g chicken thigh (roasted)", "150g turkey breast"],
    strength:  ["30g whey or pea protein shake post-lift"],
  };

  // Omega-3 sources (no fish — flaxseed, chia, walnuts, hemp)
  const omega3 = ["15g ground flaxseed", "20g walnuts", "10g chia seeds", "15g hemp seeds"];

  // ── Build meals ────────────────────────────────────────────────────────────
  const meals = [];

  // 1. Pre-ride breakfast
  if (!isRest) {
    const bTime     = earlyStart ? "06:00" : "10:00";
    const bCarbsHi  = isHard || isRace || isGF;
    const bCarbs    = bCarbsHi ? 90 : isEasy ? 40 : 60;
    const bProt     = 20;
    const bFat      = 12;
    const bKcal     = bCarbs * 4 + bProt * 4 + bFat * 9;
    meals.push({
      time: bTime,
      label: "Pre-ride breakfast",
      foods: bCarbsHi ? [
        "80g oats (dry weight) cooked with 300ml oat milk",
        "1 ripe banana, sliced in",
        "15g honey",
        "10g chia seeds",
        "1 sourdough slice, toasted, with 10g honey",
        "Black coffee or espresso",
      ] : isEasy ? [
        "2 eggs scrambled",
        "1 sourdough slice toasted with 5g butter",
        "1 small banana",
        "Black coffee",
      ] : [
        "60g oats cooked with 250ml oat milk",
        "1 banana",
        "1 sourdough slice with 15g almond butter",
        "Black coffee",
      ],
      macros: { kcal: bKcal, carbsG: bCarbs, proteinG: bProt, fatG: bFat },
      coachNote: bCarbsHi
        ? `High-GI carbohydrates prime glycogen stores 90 min pre-effort. Chia seeds provide plant omega-3 and slow gastric emptying just enough to sustain glucose release. Avoid raw fibre in the 3h window — this template is validated gut-trainable for competition.`
        : `Moderate carb load on an easy day preserves fat-oxidation capacity. Lower carbohydrate availability signals the body to oxidise fat — the physiological goal of easy aerobic work.`,
    });
  }

  // 2. Post-ride meal (within 20–30 min for senior, 30–45 for younger)
  if (!isRest && !isEasy) {
    const window    = senior ? "20 min" : "30–45 min";
    const pTime     = earlyStart ? "09:30" : "15:00";
    const pCarbs    = isHard || isRace || isGF ? 60 : 40;
    const pProt     = senior ? 35 : 28;
    const pFat      = 8;
    const pKcal     = pCarbs * 4 + pProt * 4 + pFat * 9;
    meals.push({
      time: pTime,
      label: `Post-ride recovery (within ${window})`,
      foods: [
        "200g Greek yogurt (full-fat)",
        "30g walnuts",
        "150g mixed berries (fresh or frozen)",
        "1 tbsp honey",
        ...(isHard || isRace ? ["1 banana"] : []),
        ...(senior ? ["5g leucine powder stirred in (or extra whey)"] : []),
      ],
      macros: { kcal: pKcal, carbsG: pCarbs, proteinG: pProt, fatG: pFat },
      coachNote: senior
        ? `At ${age}+, the anabolic window is compressed — muscle protein synthesis response to leucine requires ~3g leucine within 20 min post-ride. Greek yogurt + walnut combo delivers this alongside anti-inflammatory polyphenols from berries. Walnuts are your primary ALA omega-3 source.`
        : `mTOR activation window is 30–45 min. Greek yogurt provides fast-digesting casein + whey blend. Berries deliver anthocyanins that reduce post-exercise oxidative stress and accelerate glycogen resynthesis.`,
    });
  }

  // 3. Lunch
  const lTime  = isRest ? "12:30" : earlyStart ? "12:30" : "17:30";
  const lCarbs = isRest ? Math.round(dailyCarbsFood * 0.25) : isEasy ? Math.round(dailyCarbsFood * 0.3) : Math.round(dailyCarbsFood * 0.28);
  const lProt  = Math.round(dailyProt * 0.3);
  const lFat   = Math.round(dailyFat * 0.28);
  const lKcal  = lCarbs * 4 + lProt * 4 + lFat * 9;

  if (isRest || isEasy) {
    meals.push({
      time: lTime, label: "Lunch",
      foods: [
        "120g quinoa (cooked weight)",
        "2 eggs (poached or soft-boiled)",
        "1/2 avocado (75g)",
        "Large handful spinach, rocket, cucumber",
        "20g walnuts",
        "1 tbsp extra virgin olive oil + lemon dressing",
        "10g ground flaxseed sprinkled on top",
        ...(isRest ? ["1 sourdough slice"] : []),
      ],
      macros: { kcal: lKcal, carbsG: lCarbs, proteinG: lProt, fatG: lFat },
      coachNote: isRest
        ? `Rest day nutrition prioritises micronutrient density and anti-inflammatory loading. Quinoa is a complete protein with all 9 essential amino acids — critical for tissue repair. Avocado and olive oil drive omega-9 anti-inflammatory fats. Flaxseed delivers ALA omega-3 in the absence of fish.`
        : `Easy day fat adaptation requires low insulin stimulus. Quinoa provides slow-releasing carbs without spiking insulin, preserving the fat-oxidation environment. EVOO polyphenols (oleocanthal) have ibuprofen-equivalent anti-inflammatory potency.`,
    });
  } else {
    meals.push({
      time: lTime, label: "Lunch",
      foods: [
        `${Math.round(130 + W * 0.5)}g chicken breast (grilled or baked)`,
        "2 sourdough slices",
        "1/2 avocado",
        "Tomato, cucumber, spinach",
        "10g hemp seeds",
        "1 tsp Dijon mustard",
      ],
      macros: { kcal: lKcal, carbsG: lCarbs, proteinG: lProt, fatG: lFat },
      coachNote: `Sourdough fermentation lowers glycaemic index by ~20% vs standard bread and increases mineral bioavailability (zinc, iron) through phytate reduction. Hemp seeds provide complete protein + GLA (anti-inflammatory omega-6) with favourable 3:1 omega-6:omega-3 ratio.`,
    });
  }

  // 4. Afternoon snack (hard/race/GF or strength days)
  if (isHard || isRace || isGF || hStr) {
    const sTime  = earlyStart ? "15:30" : "19:00";
    const sCarbs = hStr ? 40 : 30;
    const sProt  = hStr ? 20 : 10;
    const sFat   = 8;
    const sKcal  = sCarbs * 4 + sProt * 4 + sFat * 9;
    const sLabel = hStr ? `Pre-${strengthType || "strength"} snack` : "Afternoon snack";
    meals.push({
      time: sTime, label: sLabel,
      foods: hStr ? [
        "2 rice cakes with 20g almond butter",
        "1 banana",
        "200ml oat milk",
        ...(strengthType === "Upper" || strengthType === "Full Body" ? ["20g walnuts"] : []),
      ] : [
        "2 rice cakes with 15g almond butter",
        "1 small apple",
        "10g chia seeds in 150ml water (let sit 5 min)",
      ],
      macros: { kcal: sKcal, carbsG: sCarbs, proteinG: sProt, fatG: sFat },
      coachNote: hStr
        ? `Pre-strength carbohydrate primes muscle glycogen for resistance work. Almond butter provides arginine which supports nitric oxide production — improved blood flow to working muscles. Time this 60–75 min before lifting.`
        : `Bridge meal to maintain blood glucose stability and prevent cortisol-driven catabolism in the afternoon dip. Chia gel slows absorption and provides hydration alongside ALA omega-3.`,
    });
  }

  // 5. Post-strength snack (if strength session)
  if (hStr) {
    const psTime  = "18:00";
    const psCarbs = 25;
    const psProt  = senior ? 35 : 28;
    const psFat   = 5;
    const psKcal  = psCarbs * 4 + psProt * 4 + psFat * 9;
    meals.push({
      time: psTime, label: `Post-${strengthType || "strength"} recovery`,
      foods: [
        "30g whey or pea protein in 300ml oat milk",
        "1 banana",
        ...(senior ? ["5g creatine monohydrate (if using)"] : []),
        "200ml water",
      ],
      macros: { kcal: psKcal, carbsG: psCarbs, proteinG: psProt, fatG: psFat },
      coachNote: senior
        ? `Resistance training mTOR response is blunted by ~40% in athletes 35+. Hitting 35g+ protein immediately post-lift counteracts this. Banana provides fast carbs to spike insulin and shuttle amino acids into muscle. Creatine phosphocreatine resynthesis supports repeat sprint and hard interval quality.`
        : `Fast-absorbing protein within 30 min maximises myofibrillar protein synthesis. Banana's fructose drives liver glycogen replenishment, preserving muscle glycogen for tomorrow's ride.`,
    });
  }

  // 6. Dinner
  const dTime  = "19:30";
  const dCarbs = Math.round(dailyCarbsFood * (isHard || isRace || isGF ? 0.30 : isRest ? 0.20 : 0.28));
  const dProt  = Math.round(dailyProt * (hStr ? 0.28 : 0.32));
  const dFat   = Math.round(dailyFat * 0.35);
  const dKcal  = dCarbs * 4 + dProt * 4 + dFat * 9;

  const dinnerBase = isHard || isRace || isGF ? [
    `${Math.round(100 + W * 0.8)}g ${W > 70 ? "chicken thigh" : "chicken breast"} (oven-roasted)`,
    `${Math.round(60 + W * 0.6)}g basmati or jasmine rice (dry weight)`,
    "Roasted broccoli, courgette, red pepper (200g total)",
    "2 tbsp extra virgin olive oil",
    "15g ground flaxseed in cooking",
  ] : isRest ? [
    "150g turkey breast or chicken breast",
    "Large sweet potato (200g), baked",
    "Steamed green beans, peas, kale",
    "1 tbsp extra virgin olive oil",
    "20g walnuts",
  ] : [
    "150g chicken or turkey breast",
    "100g quinoa (dry)",
    "Mixed roasted vegetables",
    "1 tbsp olive oil",
    "15g hemp seeds",
  ];

  meals.push({
    time: dTime, label: "Dinner",
    foods: [...dinnerBase],
    macros: { kcal: dKcal, carbsG: dCarbs, proteinG: dProt, fatG: dFat },
    coachNote: isHard || isRace || isGF
      ? `Evening carbohydrate restoration replenishes glycogen for tomorrow. Rice is low-residue — critical for gut comfort on consecutive hard days. Olive oil's oleic acid drives overnight anti-inflammatory signalling. Flaxseed provides ALA omega-3 to counteract the pro-inflammatory state from intense exercise.`
      : isRest
      ? `Sweet potato's beta-carotene and vitamin C support immune resilience — critical during heavy training blocks. Turkey provides tryptophan for serotonin and melatonin synthesis — better sleep quality and overnight GH secretion.`
      : `Balanced evening meal supports next-day readiness. Quinoa's complete amino acid profile drives overnight muscle remodelling. Olive oil polyphenols work synergistically with sleep to reduce CRP and IL-6 inflammatory markers.`,
  });

  // 7. Pre-bed snack (hard days, senior athletes always)
  if (isHard || isRace || isGF || (hStr && senior) || senior) {
    const pbCarbs = 15;
    const pbProt  = senior ? 25 : 18;
    const pbFat   = 8;
    const pbKcal  = pbCarbs * 4 + pbProt * 4 + pbFat * 9;
    meals.push({
      time: "21:30", label: "Pre-sleep recovery",
      foods: [
        "200g cottage cheese (or 150g Greek yogurt)",
        "10g walnuts",
        "1 tsp honey",
        ...(isHard || isRace ? ["1 small sourdough slice (optional if still hungry)"] : []),
      ],
      macros: { kcal: pbKcal, carbsG: pbCarbs, proteinG: pbProt, fatG: pbFat },
      coachNote: senior
        ? `Casein protein (cottage cheese) digests over 5–7 hours — delivering a sustained amino acid drip through the night when GH secretion peaks. At ${age}+, overnight MPS rate is lower; this pre-sleep bolus is non-negotiable on hard training days. Walnut melatonin content further improves sleep architecture.`
        : `Overnight MPS window: casein's slow-release amino acids fuel the repair of muscle microtears from today's session. GH peaks in first 90 min of deep sleep — arriving at sleep with adequate amino acid availability is the difference between super-compensation and stagnation.`,
    });
  }

  // ── Key principles ─────────────────────────────────────────────────────────
  const principles = [];

  if (isRest) {
    principles.push(
      "Rest days are not optional — they are when adaptation happens. Maintain total protein intake but reduce carbs by 40% to signal metabolic flexibility.",
      "Anti-inflammatory nutrition (olive oil, walnuts, berries, turmeric) accelerates repair faster than additional training ever will.",
      "OptygenHP's rhodiola rosea works cumulatively — consistent twice-daily dosing 6h apart maximises HIF-1α pathway adaptation and EPO response."
    );
  } else if (isEasy) {
    principles.push(
      "Defending fat oxidation: eating high-carb on easy days blunts mitochondrial adaptations. Low-carb availability + easy intensity trains the engine to burn fat at higher watts.",
      "Polyphenol loading (berries, olive oil, walnuts) on easy days primes the antioxidant enzyme system for the oxidative stress of tomorrow's hard session.",
      "Hydration target off the bike: " + Math.round(weight * 35) + "ml today. Urine should be pale straw — dark urine on an easy day signals a glycogen problem, not just dehydration."
    );
  } else if (isHard || isRace) {
    principles.push(
      "Carbohydrate periodisation: today's " + Math.round(carbPerKg * weight) + "g carb target matches glycolytic demand. Under-fuelling hard sessions degrades neuromuscular quality and signals catabolism.",
      senior
        ? `Post-exercise protein window at ${age}+: you have 20 min, not 45. The mTOR sensitivity dip is steeper with age — this meal is the most performance-critical moment of your day.`
        : "mTOR activation requires ~2.5–3g leucine in the post-exercise window. Greek yogurt (2g leucine/200g) + walnuts covers this without fish.",
      "OptygenHP's CoQ10 supports mitochondrial electron transport under maximal VO2 stress. Take dose 1 exactly 45 min pre-ride — this is the peak window for acute ATP production support."
    );
  } else if (isGF) {
    principles.push(
      "Ultra-endurance demands shift fat oxidation to 50–60% of energy. Keep pre-ride carbs high but gut-safe — oat porridge + banana is a WorldTour breakfast staple for a reason.",
      "Protein synthesis is suppressed during exercise over 3h by elevated cortisol. Prioritise recovery within 20 min post-ride to reverse this cortisol-mediated catabolic state.",
      "Flaxseed and chia seeds carry your omega-3 load today. 15g ground flaxseed = ~1.5g ALA. Combine with vitamin C-rich foods at the same meal to maximise conversion to EPA/DHA."
    );
  } else {
    principles.push(
      "Moderate training days are underrated nutrition opportunities — consistent fuelling on these days prevents the cumulative energy deficit that derails training blocks.",
      "Sourdough fermentation (24–48h slow-proved) produces short-chain fatty acids that feed the gut microbiome, improving gut-barrier integrity for high-intensity race days.",
      "Walnuts at 20g/day provide 2.5g ALA omega-3 — the minimum effective dose for reducing exercise-induced inflammation markers (CRP, IL-6) over a 4-week block."
    );
  }

  if (hStr) {
    principles[2] = `Concurrent training (cycling + ${strengthType || "strength"}) requires protein distribution across 4–5 meals to maintain anabolic signalling throughout the day. Never go more than 4h without protein.`;
  }

  return {
    dayTheme: isRest ? "Recovery & anti-inflammatory loading"
      : isEasy ? "Fat adaptation + micronutrient density"
      : isHard ? `High-carb prime: ${Math.round(carbPerKg * weight)}g carbs to fuel ${rideDuration}min intervals${hStr ? ` + ${strengthType || "strength"} session` : ""}`
      : isRace ? `Race-day precision: gut-safe, familiar, optimal${hStr ? " + post-race strength" : ""}`
      : isGF   ? `Endurance nutrition: sustain ${rideDuration}min effort + rebuild`
      : `Training day nutrition${hStr ? ` + ${strengthType || "strength"} session` : ""}`,
    totalMacros: { kcal: actualCals, carbsG: dailyCarbsFood, proteinG: dailyProt, fatG: dailyFat },
    optygenHP: { dose1, dose2 },
    meals,
    keyPrinciples: principles,
  };
}

// ─── Rules-based meal plan engine ────────────────────────────────────────────
// No API calls — all knowledge encoded as deterministic rules.
// Athlete profile baked in: OptygenHP, sourdough only, no fish, omega-3 via
// plant sources. Periodised carbs, leucine-first protein, age-adjusted timing.

const STRENGTH_TYPES = ["Upper","Lower","Full Body","Core"];

// Protein target g/kg — escalates with intensity, age, and strength work
function proteinTarget(rideType, age, hasStrength) {
  const base = {
    "Rest":0, "Easy Ride":1.6, "Moderate Ride":1.8,
    "Hard / Intervals":2.0, "Velodrome":2.0,
    "Crit Race":2.0, "Road Race":2.0, "Gran Fondo":1.9,
  }[rideType] ?? 1.8;
  const ageBonus      = age >= 35 ? 0.2 : 0;
  const strengthBonus = hasStrength ? 0.25 : 0;
  return Math.min(base + ageBonus + strengthBonus, 2.4);
}

// Daily carb target g/kg from food (on top of in-ride carbs)
function carbTarget(rideType, hasStrength) {
  const base = {
    "Rest":3.5, "Easy Ride":4.5, "Moderate Ride":5.5,
    "Hard / Intervals":7.0, "Velodrome":7.0,
    "Crit Race":8.0, "Road Race":7.5, "Gran Fondo":8.5,
  }[rideType] ?? 5.0;
  return base + (hasStrength ? 0.5 : 0);
}

// Fat stays moderate-high on all days (anti-inflammatory priority)
function fatTarget(weight) { return Math.round(weight * 1.2); }

function round5(n) { return Math.round(n / 5) * 5; }

// ── Food building blocks ──────────────────────────────────────────────────────
// Each food: [description, kcal, carbsG, proteinG, fatG]
const FOODS = {
  sourdough1:     ["1 slice sourdough toast",                        90,  17, 3.5, 1.0],
  sourdough2:     ["2 slices sourdough toast",                      180,  34, 7.0, 2.0],
  porridge:       ["80g rolled oats (cooked)",                      310,  56, 10,  6.0],
  banana:         ["1 medium banana",                                89,  23, 1.1, 0.3],
  banana_sm:      ["1 small banana",                                 72,  19, 0.9, 0.2],
  honey:          ["1 tbsp raw honey",                               64,  17, 0.1, 0.0],
  jam:            ["1 tsp jam",                                       18,   4, 0.1, 0.0],
  pb:             ["1.5 tbsp natural peanut butter",                 143,   5, 6.0,12.0],
  almond_butter:  ["1 tbsp almond butter",                           98,   3, 2.5, 9.0],
  greek_yogurt:   ["200g full-fat Greek yogurt",                    196,   8,20.0,10.0],
  greek_yogurt_sm:["150g full-fat Greek yogurt",                    147,   6,15.0, 7.5],
  cottage_cheese: ["150g cottage cheese",                           129,   4,17.0, 5.5],
  eggs2:          ["2 whole eggs (scrambled/poached)",               156,   1,13.0,11.0],
  eggs3:          ["3 whole eggs (scrambled)",                       234,   1,19.5,16.5],
  chicken:        ["150g grilled chicken breast",                    248,   0,47.0, 5.0],
  chicken_sm:     ["120g grilled chicken breast",                    198,   0,37.5, 4.0],
  turkey_mince:   ["150g lean turkey mince",                        225,   0,35.0, 8.5],
  beef_mince:     ["130g lean beef mince (90%)",                    234,   0,31.0,12.0],
  lamb:           ["150g lean lamb (loin)",                         270,   0,34.0,14.0],
  rice200:        ["200g cooked white rice",                        260,  57, 5.0, 0.4],
  rice150:        ["150g cooked white rice",                        195,  43, 3.8, 0.3],
  sweet_potato:   ["200g baked sweet potato",                       172,  40, 3.2, 0.2],
  pasta200:       ["200g cooked pasta (al dente)",                  264,  52, 9.0, 1.2],
  quinoa:         ["150g cooked quinoa",                            222,  39, 8.0, 3.5],
  avocado_half:   ["½ avocado",                                     120,   6, 1.5,11.0],
  walnuts:        ["30g walnuts (omega-3 source)",                  196,   4, 4.5,19.5],
  chia:           ["2 tsp chia seeds (omega-3)",                     58,   5, 2.0, 3.5],
  flax:           ["1 tbsp ground flaxseed (omega-3)",               37,   2, 1.3, 2.9],
  berries:        ["100g mixed berries",                             43,  10, 0.7, 0.3],
  spinach:        ["100g baby spinach + olive oil drizzle",          60,   2, 2.9, 4.5],
  mixed_veg:      ["200g roasted mixed vegetables",                  80,  14, 3.0, 2.0],
  broccoli:       ["150g steamed broccoli",                          51,   7, 5.0, 0.6],
  olive_oil:      ["1 tbsp extra virgin olive oil",                 119,   0, 0.0,13.5],
  milk:           ["250ml whole milk",                              152,  12, 8.0, 8.5],
  choc_milk:      ["300ml chocolate milk (recovery)",               257,  38,10.0, 8.0],
  espresso:       ["Double espresso (black)",                          5,   1, 0.3, 0.1],
  rice_cake_jam:  ["2 rice cakes + jam",                             97,  22, 1.5, 0.3],
  dark_choc:      ["20g dark chocolate (85%)",                      120,   7, 2.0, 9.0],
  hummus:         ["80g hummus",                                     189,  17, 7.0,11.5],
  lentil_soup:    ["300ml lentil soup (homemade)",                   210,  30,12.0, 4.0],
  tuna_sub:       null, // never used — no fish
  optygenhp:      ["OptygenHP — 2 capsules (with food)",               5,   0, 0.5, 0.2],
};

// Sum an array of food keys into { kcal, carbsG, proteinG, fatG }
function sumFoods(keys) {
  return keys.reduce((acc, k) => {
    const f = FOODS[k];
    if (!f) return acc;
    return { kcal: acc.kcal+f[1], carbsG: acc.carbsG+f[2], proteinG: acc.proteinG+f[3], fatG: acc.fatG+f[4] };
  }, { kcal:0, carbsG:0, proteinG:0, fatG:0 });
}
function roundMacros(m) {
  return { kcal: Math.round(m.kcal), carbsG: Math.round(m.carbsG),
           proteinG: Math.round(m.proteinG), fatG: Math.round(m.fatG) };
}
function foodNames(keys) { return keys.map(k => FOODS[k]?.[0]).filter(Boolean); }

// ── Main engine ───────────────────────────────────────────────────────────────

function buildMealPlan(rideType, rideDurationMins, rideCalories, weight, age, hasStrength, strengthType) {
  const isRest   = rideType === "Rest";
  const isEasy   = rideType === "Easy Ride";
  const isRace   = rideType === "Crit Race" || rideType === "Road Race";
  const isHard   = ["Hard / Intervals","Velodrome","Crit Race","Road Race"].includes(rideType);
  const isFondo  = rideType === "Gran Fondo";
  const isMod    = rideType === "Moderate Ride";
  const older    = age >= 35;

  const protG    = Math.round(proteinTarget(rideType, age, hasStrength) * weight);
  const carbG    = Math.round(carbTarget(rideType, hasStrength) * weight);
  const fatG     = fatTarget(weight);
  const totalKcal= Math.round(carbG * 4 + protG * 4 + fatG * 9 + (isRest ? 0 : rideCalories * 0.3));

  // ── OptygenHP schedule ─────────────────────────────────────────────────────
  const optDose1 = isRest
    ? "06:30 — 2 capsules with breakfast. No training today; morning dosing supports baseline VO2 adaptation and recovery."
    : isRace
    ? "06:00 — 2 capsules with pre-race breakfast, 90 min before warm-up. Rhodiola peaks ~2h post-ingestion — timed for race start."
    : "06:00 — 2 capsules with pre-ride breakfast, 45–60 min before ride start. Aligns rhodiola rosea peak with training window.";
  const optDose2 = "19:00 — 2 capsules with dinner, ≥6h after dose 1. CoQ10 and acetyl-L-carnitine support mitochondrial recovery overnight.";

  // ── Meals ──────────────────────────────────────────────────────────────────
  const meals = [];

  // ── REST DAY ───────────────────────────────────────────────────────────────
  if (isRest) {
    meals.push({
      time: "07:30", label: "Recovery Breakfast",
      keys: ["porridge","berries","chia","walnuts","honey"],
      coachNote: "Moderate carbs re-prime glycogen without excess. Walnuts + chia = plant omega-3 to dampen residual inflammation from previous training block.",
    });
    meals.push({
      time: "10:30", label: "Mid-Morning Snack",
      keys: ["greek_yogurt_sm","berries","flax"],
      coachNote: "Casein-dominant protein (Greek yogurt) sustains amino acid delivery across the late morning. Flaxseed adds lignans for hormonal balance.",
    });
    meals.push({
      time: "13:00", label: "Lunch — Anti-Inflammatory Focus",
      keys: ["quinoa","chicken_sm","spinach","avocado_half","olive_oil"],
      coachNote: "Quinoa delivers all essential amino acids. Olive oil + avocado = oleocanthal and oleic acid — measurable COX inhibition equivalent to low-dose ibuprofen.",
    });
    meals.push({
      time: "16:00", label: "Afternoon Snack",
      keys: ["sourdough1","pb","banana_sm"],
      coachNote: "Sourdough's partial fermentation lowers GI and improves mineral bio-availability. Pre-loads glycogen for tomorrow's session without insulin spike.",
    });
    meals.push({
      time: "19:00", label: "Dinner — Protein + Recovery",
      keys: ["sweet_potato","turkey_mince","broccoli","olive_oil","walnuts"],
      coachNote: "Leucine-rich turkey (~3g/serving) triggers mTOR even on rest days — critical for athletes 35+ who have blunted anabolic sensitivity. Broccoli sulforaphane activates Nrf2 antioxidant pathway.",
    });
    if (older || hasStrength) {
      meals.push({
        time: "21:30", label: "Night Recovery Snack",
        keys: ["cottage_cheese","flax","dark_choc"],
        coachNote: "Cottage cheese is ~80% casein — slow-digesting protein maintains positive nitrogen balance for 7–8h overnight. Shown to increase MPS by 22% vs no pre-sleep protein.",
      });
    }
  }

  // ── EASY RIDE ──────────────────────────────────────────────────────────────
  else if (isEasy) {
    meals.push({
      time: "06:00", label: "Pre-Ride (fasted-adjacent)",
      keys: ["espresso","banana_sm"],
      coachNote: "Minimal carbs preserve fat-oxidation training stimulus. Caffeine from espresso enhances fat mobilisation — peak benefit at ~1mg/kg, 45 min pre-exercise.",
    });
    meals.push({
      time: "09:00", label: "Post-Ride Breakfast",
      keys: ["eggs2","sourdough2","avocado_half","berries","chia"],
      coachNote: "Eggs provide ~3g leucine — meets threshold for mTOR activation post-exercise. Avocado delivers monounsaturated fats that aid fat-soluble vitamin absorption.",
    });
    meals.push({
      time: "13:00", label: "Lunch — Micronutrient Focus",
      keys: ["lentil_soup","sourdough1","spinach","olive_oil"],
      coachNote: "Lentils = iron + folate + slow carbs. Sourdough fermentation reduces phytate content, improving iron absorption vs conventional bread. Spinach polyphenols support eNOS activity.",
    });
    meals.push({
      time: "16:30", label: "Afternoon Snack",
      keys: ["greek_yogurt_sm","walnuts","berries"],
      coachNote: "Walnuts = only tree nut with significant ALA omega-3 (2.5g/30g). Daily ALA intake targets 2–3g for EPA/DHA conversion support.",
    });
    meals.push({
      time: "19:00", label: "Dinner",
      keys: ["chicken","rice150","mixed_veg","olive_oil"],
      coachNote: "Moderate carb dinner maintains glycogen without excess on a low-day. White rice is low-residue — gentle on gut microbiome after an adaptation day.",
    });
  }

  // ── MODERATE RIDE ─────────────────────────────────────────────────────────
  else if (isMod) {
    meals.push({
      time: "06:00", label: "Pre-Ride Breakfast",
      keys: ["porridge","banana","honey","chia"],
      coachNote: "Oats at 60–90 min pre-exercise = sustained glucose release during aerobic work. Honey provides rapid fructose + glucose for immediate liver glycogen priming.",
    });
    meals.push({
      time: "09:30", label: "Post-Ride Recovery",
      keys: ["choc_milk","sourdough1","pb"],
      coachNote: "Chocolate milk: ~4:1 carb:protein — matches the gold-standard post-exercise recovery ratio in meta-analyses. Consumed within 30 min to maximise GLUT-4 translocation.",
    });
    meals.push({
      time: "13:00", label: "Lunch",
      keys: ["pasta200","chicken_sm","spinach","olive_oil"],
      coachNote: "Pasta at al-dente has lower GI (~45) vs fully cooked (~65). Chicken provides ~37g protein to support synthesis during the post-exercise anabolic window.",
    });
    meals.push({
      time: "16:30", label: "Afternoon Snack",
      keys: ["sourdough1","hummus","berries"],
      coachNote: "Hummus = chickpeas, sesame tahini — slow carb + plant protein hit mid-afternoon. Keeps blood glucose stable without caffeine dependence.",
    });
    meals.push({
      time: "19:00", label: "Dinner",
      keys: ["sweet_potato","beef_mince","broccoli","olive_oil","walnuts"],
      coachNote: "Sweet potato > white potato on a moderate day: higher beta-carotene and potassium (critical for muscle contraction). Beef provides haem iron + zinc + creatine.",
    });
    if (older) {
      meals.push({
        time: "21:30", label: "Night Recovery",
        keys: ["cottage_cheese","flax"],
        coachNote: "Athletes 35+ have ~20% lower overnight MPS without pre-sleep protein. 30–40g casein before bed is the most evidence-backed intervention to close that gap.",
      });
    }
  }

  // ── HARD / INTERVALS / VELODROME ──────────────────────────────────────────
  else if (isHard && !isRace && !isFondo) {
    meals.push({
      time: "05:45", label: "Pre-Ride Breakfast",
      keys: ["sourdough2","honey","banana","espresso"],
      coachNote: "High-GI simple carbs 90 min pre-session top liver glycogen rapidly. Sourdough avoids the gut fermentation risk of high-fibre breads before hard efforts. Caffeine: 3mg/kg target for RPE reduction.",
    });
    meals.push({
      time: "09:30", label: "Immediate Recovery Window",
      keys: ["choc_milk","greek_yogurt_sm"],
      coachNote: older
        ? "For athletes 35+: the post-exercise anabolic window narrows to 20–30 min. Greek yogurt stacks fast whey-like proteins onto chocolate milk's casein — maximises leucine flux."
        : "4:1 carb:protein within 30 min. Glycogen resynthesis rate is 150% faster in the first 30 min post-exercise vs 2h later.",
    });
    meals.push({
      time: "12:30", label: "Lunch — Rebuild",
      keys: ["rice200","chicken","spinach","avocado_half","olive_oil"],
      coachNote: "200g rice restores ~57g carbs lost in the interval session. Avocado raises the meal's fat content to moderate — slows gastric emptying and sustains satiety into afternoon training.",
    });
    meals.push({
      time: "16:00", label: "Pre-Strength Snack",
      keys: ["sourdough1","pb","banana_sm"],
      coachNote: hasStrength
        ? `Fuel for ${strengthType} strength session. 30–45 min pre-lift carb intake improves power output by ~5–8% in compound movements.`
        : "Keeps blood glucose stable mid-afternoon. Prevents late-day cortisol spike from under-fuelling.",
    });
    meals.push({
      time: "19:00", label: "Dinner — Protein + Load",
      keys: ["pasta200","turkey_mince","broccoli","olive_oil","walnuts"],
      coachNote: "Pasta + turkey = complete carb + leucine combo. Walnuts add ALA omega-3 and ellagitannins — shown to reduce DOMS by ~18% in high-intensity trained athletes.",
    });
    meals.push({
      time: "21:30", label: "Night Recovery",
      keys: ["cottage_cheese","dark_choc","flax"],
      coachNote: "Pre-sleep casein is mandatory on hard days regardless of age. 40g cottage cheese protein = ~3.5g leucine — triggers overnight MPS. Dark chocolate polyphenols blunt cortisol.",
    });
  }

  // ── CRIT RACE / ROAD RACE ─────────────────────────────────────────────────
  else if (isRace) {
    meals.push({
      time: "06:00", label: "Race Day Breakfast",
      keys: ["sourdough2","honey","banana","jam","espresso"],
      coachNote: "Race day = no experiments. These exact foods should have been gut-trained in the preceding weeks. 3–4h pre-race for full gastric clearance. No fibre, no fat.",
    });
    meals.push({
      time: "09:00", label: "Pre-Warm-Up Top-Up",
      keys: ["rice_cake_jam","banana_sm"],
      coachNote: "Small carb bolus 45–60 min before warm-up primes blood glucose without GI risk. Rice cakes are near-zero fibre — used by WorldTour pros on race morning.",
    });
    meals.push({
      time: "13:30", label: "Post-Race Recovery",
      keys: ["choc_milk","greek_yogurt","sourdough1","berries"],
      coachNote: older
        ? "Within 20 min — non-negotiable at age 35+. After multiple races, anabolic sensitivity is elevated but the window is narrow. Hit protein AND carbs simultaneously."
        : "Within 30 min of last race. The crit demands repeated max efforts — glycogen depletion is near-total. Speed of recovery here determines next-day readiness.",
    });
    meals.push({
      time: "16:00", label: "Afternoon Snack",
      keys: ["sourdough1","pb","milk"],
      coachNote: "Steady protein + carb mid-afternoon continues glycogen reload. Milk's calcium + phosphate supports bone stress recovery from repeated hard sprinting.",
    });
    meals.push({
      time: "19:00", label: "Dinner — Full Recovery",
      keys: ["rice200","chicken","sweet_potato","spinach","olive_oil","walnuts"],
      coachNote: "High-carb dinner on race day — glycogen restoration is the priority. Chicken + rice is the most proven WorldTour race-day evening meal for a reason.",
    });
    meals.push({
      time: "21:30", label: "Night Recovery",
      keys: ["cottage_cheese","flax","dark_choc"],
      coachNote: "Casein essential after race stress. Cortisol spikes from competition suppress MPS for hours — pre-sleep protein counters this. Dark chocolate's flavonoids support vascular recovery.",
    });
  }

  // ── GRAN FONDO ────────────────────────────────────────────────────────────
  else if (isFondo) {
    meals.push({
      time: "05:30", label: "Pre-Fondo Breakfast — Carb Load Continuation",
      keys: ["porridge","banana","honey","sourdough1","jam","espresso"],
      coachNote: "Last top-up of a 48h carb-load protocol. Target: 10g/kg over 24–48h pre-event. Keep fibre minimal — sourdough + oats are low-residue for a long-duration gut.",
    });
    meals.push({
      time: "12:00", label: "Mid-Ride (jersey pocket already planned)",
      keys: [],
      coachNote: "Bars + gels already in the fueling plan above. At 3–4h mark, begin thinking about post-ride recovery timing. If a café stop is possible, banana + rice cake preferred over solid food.",
      noFoods: true,
    });
    meals.push({
      time: "14:30", label: "Immediate Post-Fondo Recovery",
      keys: ["choc_milk","greek_yogurt","banana","sourdough1","pb"],
      coachNote: older
        ? "After 3–5 hours of endurance stress at 35+, muscle damage is significant. Protein within 20 min is not optional — leucine threshold must be exceeded to reverse net catabolism."
        : "4:1 carb:protein ratio within 30 min. Long efforts create deep glycogen depletion — first 30 min sees 50% faster glycogen resynthesis. Don't delay.",
    });
    meals.push({
      time: "18:00", label: "Dinner — Deep Reload",
      keys: ["pasta200","chicken","sweet_potato","spinach","olive_oil","walnuts","berries"],
      coachNote: "Largest meal of the day. 500–600 kcal minimum. Pasta + sweet potato = dual-carb source. Berries + walnuts provide anthocyanins and ellagitannins — both reduce post-exercise oxidative stress markers within 24h.",
    });
    meals.push({
      time: "21:30", label: "Night Recovery",
      keys: ["cottage_cheese","flax","dark_choc"],
      coachNote: "Mandatory after a gran fondo. Cortisol remains elevated 4–6h post long-effort. Pre-sleep casein suppresses net protein breakdown and supports GH-driven repair during slow-wave sleep.",
    });
  }

  // ── Strength addition ──────────────────────────────────────────────────────
  // If strength training is on the same day, inject a post-strength snack
  // between the existing meals if not already present.
  if (hasStrength && !isRest) {
    const strengthSnack = {
      time: "17:30", label: `Post-${strengthType} Strength Snack`,
      keys: ["greek_yogurt","berries","chia","walnuts"],
      coachNote: `Post-strength protein within 30 min. ${strengthType} work demands ~20–40g protein for hypertrophy/maintenance. Greek yogurt's fast-acting whey fraction spikes leucine immediately; chia + walnuts provide anti-inflammatory ALA to counter eccentric-induced DOMS.`,
    };
    // Insert after the afternoon snack (index 3 typically) or at end
    const insertAt = meals.length >= 4 ? 4 : meals.length;
    meals.splice(insertAt, 0, strengthSnack);
  }

  // ── Build final output ─────────────────────────────────────────────────────
  const mealObjects = meals.map(m => {
    if (m.noFoods) return {
      time: m.time, label: m.label,
      foods: ["(In-ride fueling — see fueling plan above)"],
      macros: { kcal:0, carbsG:0, proteinG:0, fatG:0 },
      coachNote: m.coachNote,
    };
    const macros = roundMacros(sumFoods(m.keys));
    return { time: m.time, label: m.label, foods: foodNames(m.keys), macros, coachNote: m.coachNote };
  });

  const totalMacros = roundMacros(
    mealObjects.reduce((acc, m) => ({
      kcal: acc.kcal + m.macros.kcal, carbsG: acc.carbsG + m.macros.carbsG,
      proteinG: acc.proteinG + m.macros.proteinG, fatG: acc.fatG + m.macros.fatG,
    }), { kcal:0, carbsG:0, proteinG:0, fatG:0 })
  );

  const DAY_THEMES = {
    "Rest":               "Active recovery — anti-inflammatory foods, micronutrient density, sleep quality",
    "Easy Ride":          "Fat-adaptation day — minimal carb interference, high micronutrient quality",
    "Moderate Ride":      "Aerobic development — balanced load, gut training, glycogen maintenance",
    "Hard / Intervals":   "High-intensity fuel — glycogen max, rapid recovery, mTOR activation",
    "Velodrome":          "Speed-power prime — explosive fuel, fast recovery, neuromuscular support",
    "Crit Race":          "Race execution — proven foods only, gut settled, peak glycogen",
    "Road Race":          "Race day — carb max, zero gut risk, rapid post-race reload",
    "Gran Fondo":         "Endurance load — sustained energy, deep glycogen, full-day recovery protocol",
  };

  const PRINCIPLES = {
    "Rest": [
      "Rest days are where adaptation happens — nutrition is as important as the training stimulus itself.",
      `Target ${round5(protG)}g protein today spread across 5 meals — prevents muscle catabolism and primes anabolism for the next hard session.`,
      "Prioritise anti-inflammatory foods (olive oil, walnuts, berries, broccoli) — these reduce systemic IL-6 and TNF-α, accelerating tissue repair.",
    ],
    "Easy Ride": [
      "Training low (minimal pre-ride carbs) on easy days enhances fat oxidation enzyme expression — this is a key physiological edge for endurance.",
      `OptygenHP's rhodiola rosea is particularly effective on easy days — lower sympathetic load allows better HRV response and VO2 adaptation.`,
      "Sourdough fermentation increases short-chain fatty acid production in the gut — supports microbiome diversity critical for immune function in hard training.",
    ],
    "Moderate Ride": [
      `Post-ride chocolate milk within 30 min provides the proven 4:1 carb:protein ratio — glycogen resynthesis is 150% faster in this first window.`,
      "Gut-training on moderate days is critical — practice eating the same foods at the same timing you'll use on race day.",
      `At ${weight}kg, target ${round5(protG)}g protein and ${round5(carbG)}g carbs today to balance recovery and tomorrow's training readiness.`,
    ],
    "Hard / Intervals": [
      `Hard interval sessions deplete muscle glycogen by 50–80% — the ${round5(carbG)}g carb target today is not excessive; it is necessary.`,
      older
        ? "At 35+, post-exercise anabolic sensitivity peaks in the first 20–30 min. Missing this window can cost 30% of the potential MPS response — don't let recovery meals slide."
        : "The 30-min post-exercise protein window is your highest-ROI nutrition intervention of the day — it costs nothing and adds measurable adaptation.",
      "Pre-sleep casein (cottage cheese) on hard days is the single most evidence-supported sleep nutrition strategy — it raises overnight MPS by 22% in trained athletes.",
    ],
    "Velodrome": [
      "Velodrome efforts are near-maximal repeated sprints — phosphocreatine resynthesis between efforts needs carbohydrates to be sustained throughout the session.",
      `Caffeine (3mg/kg = ${Math.round(weight * 3)}mg) via espresso is a legal performance enhancer — reduces perceived effort by 10–15% on high-intensity work.`,
      "Walnuts at dinner are your primary ALA source — 30g delivers 2.5g ALA, supporting the EPA/DHA conversion needed to reduce track sprint-induced inflammation.",
    ],
    "Crit Race": [
      "Race day is not the day to experiment — every food on today's plan should have been practiced in training. Your gut is as trainable as your legs.",
      "OptygenHP rhodiola peaks ~2h after ingestion — 06:00 dosing aligns the peak with your race start window. This timing has been pre-built into the plan.",
      `Post-race recovery within ${older ? "20" : "30"} min is the second most important performance intervention of the day (after the race itself). Do not miss it.`,
    ],
    "Road Race": [
      "Road races create unique glycogen demands — the pack's variable pace means you burn more carbs per km than pacing alone would suggest. Eat early, eat often.",
      "Pre-race gut settling: the 3h before warm-up is a no-fibre, no-fat zone. Sourdough and banana are the only tested options in this plan.",
      `At ${weight}kg targeting ${round5(protG)}g protein and ${round5(carbG)}g carbs post-race — this aggressive reload determines whether you can race again in <48h.`,
    ],
    "Gran Fondo": [
      "Gran fondos require a 48h carb-loading protocol before the event — tonight's dinner and this morning's breakfast are the last two stages of that load.",
      "Gut training for long events is different from short races — you need to practice eating 60–90g carbs/hour while riding. Your jersey-pocket bars and gels are part of that.",
      `Post-fondo recovery is a full-day project, not a single meal. The ${round5(carbG)}g daily carb target plus pre-sleep casein are both required to be ready within 72h.`,
    ],
  };

  return {
    dayTheme:     DAY_THEMES[rideType] || "Performance nutrition — precision fuelling",
    totalMacros,
    targetMacros: { proteinG: round5(protG), carbsG: round5(carbG), fatG: round5(fatG) },
    optygenHP:    { dose1: optDose1, dose2: optDose2 },
    meals:        mealObjects,
    keyPrinciples: PRINCIPLES[rideType] || [
      `Protein target: ${round5(protG)}g (${(proteinTarget(rideType, age, hasStrength)).toFixed(1)}g/kg) — distributed across all meals.`,
      `Carb target: ${round5(carbG)}g from food + on-bike fueling as planned.`,
      "Sourdough bread ensures lower GI and better mineral absorption vs commercial alternatives.",
    ],
  };
}

// ─── MealPlanSection ──────────────────────────────────────────────────────────

function MealPlanSection({ dayPlan, weight, age }) {
  const th = useT();
  const [open, setOpen] = useState(false);

  const rideType   = dayPlan.rideType;
  const calories   = dayPlan.calories || 0;
  const hasS       = !!(dayPlan.strength);
  const sType      = dayPlan.strength?.type || "Full Body";

  const meal = open ? buildMealPlan(
    rideType, dayPlan.duration || 0, calories, weight, age, hasS, sType
  ) : null;

  const macroChip = (label, val, unit, color) => (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center",
      background: color + "12", border:`1px solid ${color}30`,
      borderRadius:8, padding:"6px 10px", minWidth:52 }}>
      <span style={{ fontSize:15, fontWeight:700, color, fontFamily:"'DM Mono',monospace" }}>{val}</span>
      <span style={{ fontSize:9, color:th.muted, textTransform:"uppercase", letterSpacing:"0.06em", marginTop:1 }}>{label}</span>
      {unit && <span style={{ fontSize:9, color:th.dim }}>{unit}</span>}
    </div>
  );

  return (
    <div style={{ marginTop:12 }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ width:"100%", padding:"10px 14px",
          background: open
            ? "linear-gradient(135deg,rgba(168,85,247,0.14),rgba(59,130,246,0.12))"
            : "linear-gradient(135deg,rgba(168,85,247,0.07),rgba(59,130,246,0.06))",
          border:"1px solid rgba(168,85,247,0.22)", borderRadius:10,
          color:"#A855F7", fontSize:12, fontWeight:700, cursor:"pointer",
          fontFamily:"inherit", display:"flex", alignItems:"center",
          justifyContent:"space-between", gap:8,
          letterSpacing:"0.04em", textTransform:"uppercase", transition:"all 0.15s" }}>
        <span>🍽️ {open ? "Hide" : "Show"} Daily Meal Plan</span>
        <span style={{ transform: open ? "rotate(90deg)" : "none",
          transition:"transform 0.2s", fontSize:16 }}>›</span>
      </button>

      {open && meal && (
        <div style={{ marginTop:10, animation:"fadeUp 0.25s ease" }}>

          {/* Header */}
          <div style={{ background:"linear-gradient(135deg,rgba(168,85,247,0.08),rgba(59,130,246,0.05))",
            border:"1px solid rgba(168,85,247,0.2)", borderRadius:12,
            padding:"12px 14px", marginBottom:10 }}>
            <div style={{ fontSize:13, fontWeight:700, color:th.text, marginBottom:10 }}>
              {meal.dayTheme}
            </div>
            <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:8 }}>
              {macroChip("kcal",    meal.totalMacros.kcal,    "",  "#E8F44A")}
              {macroChip("carbs",   meal.totalMacros.carbsG,  "g", "#22C55E")}
              {macroChip("protein", meal.totalMacros.proteinG,"g", "#F97316")}
              {macroChip("fat",     meal.totalMacros.fatG,    "g", "#3B82F6")}
            </div>
            <div style={{ fontSize:10, color:th.dim }}>
              Targets: {meal.targetMacros.proteinG}g protein · {meal.targetMacros.carbsG}g carbs · {meal.targetMacros.fatG}g fat
            </div>
          </div>

          {/* OptygenHP */}
          <div style={{ display:"flex", gap:6, marginBottom:10, flexWrap:"wrap" }}>
            {[
              { label:"OptygenHP — Dose 1", val:meal.optygenHP.dose1 },
              { label:"OptygenHP — Dose 2", val:meal.optygenHP.dose2 },
            ].map((d,i) => (
              <div key={i} style={{ flex:"1 1 180px", background:"rgba(34,197,94,0.06)",
                border:"1px solid rgba(34,197,94,0.18)", borderRadius:10, padding:"8px 12px" }}>
                <div style={{ fontSize:9, fontWeight:700, color:"#22C55E",
                  letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:3 }}>💊 {d.label}</div>
                <div style={{ fontSize:11, color:th.sub, lineHeight:1.5 }}>{d.val}</div>
              </div>
            ))}
          </div>

          {/* Timeline */}
          {meal.meals.map((m, i) => (
            <div key={i} style={{ display:"flex", gap:10, marginBottom:8 }}>
              <div style={{ width:40, flexShrink:0, paddingTop:3, textAlign:"right" }}>
                <div style={{ fontSize:11, fontWeight:700, color:"#A855F7",
                  fontFamily:"'DM Mono',monospace", whiteSpace:"nowrap" }}>{m.time}</div>
              </div>
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center",
                marginTop:4, marginRight:2 }}>
                <div style={{ width:8, height:8, borderRadius:"50%",
                  background:"#A855F7", flexShrink:0 }} />
                {i < meal.meals.length - 1 && (
                  <div style={{ width:1, flex:1, background:th.border, marginTop:3 }} />
                )}
              </div>
              <div style={{ flex:1, background:th.input, border:`1px solid ${th.border}`,
                borderRadius:10, padding:"10px 12px", minWidth:0 }}>
                <div style={{ display:"flex", justifyContent:"space-between",
                  alignItems:"flex-start", marginBottom:6, flexWrap:"wrap", gap:4 }}>
                  <span style={{ fontSize:12, fontWeight:700, color:th.text }}>{m.label}</span>
                  {m.macros.kcal > 0 && (
                    <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
                      {[
                        { v:m.macros.kcal,     l:"kcal", c:"#E8F44A" },
                        { v:m.macros.carbsG,   l:"C",    c:"#22C55E" },
                        { v:m.macros.proteinG, l:"P",    c:"#F97316" },
                        { v:m.macros.fatG,     l:"F",    c:"#3B82F6" },
                      ].map(x => (
                        <span key={x.l} style={{ fontSize:10, fontWeight:700, color:x.c,
                          background: x.c + "14", borderRadius:5, padding:"2px 5px",
                          fontFamily:"'DM Mono',monospace" }}>
                          {x.v}{x.l !== "kcal" ? x.l : ""}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                {m.foods.length > 0 && (
                  <ul style={{ margin:"0 0 6px 0", paddingLeft:14 }}>
                    {m.foods.map((f,j) => (
                      <li key={j} style={{ fontSize:12, color:th.sub, marginBottom:2, lineHeight:1.5 }}>{f}</li>
                    ))}
                  </ul>
                )}
                {m.coachNote && (
                  <div style={{ fontSize:11, color:th.muted, fontStyle:"italic",
                    borderTop:`1px solid ${th.divider}`, paddingTop:5, marginTop:4, lineHeight:1.5 }}>
                    💡 {m.coachNote}
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Key principles */}
          <div style={{ background:"rgba(232,244,74,0.05)",
            border:"1px solid rgba(232,244,74,0.12)",
            borderRadius:10, padding:"12px 14px", marginTop:4 }}>
            <div style={{ fontSize:10, fontWeight:700, color:"#E8F44A",
              letterSpacing:"0.1em", textTransform:"uppercase", marginBottom:8 }}>
              ⚡ COACHING PRINCIPLES
            </div>
            {meal.keyPrinciples.map((p, i) => (
              <div key={i} style={{ display:"flex", gap:8,
                marginBottom: i < meal.keyPrinciples.length - 1 ? 6 : 0 }}>
                <span style={{ color:"#E8F44A", fontSize:11, flexShrink:0 }}>
                  {["①","②","③"][i]}
                </span>
                <span style={{ fontSize:12, color:th.sub, lineHeight:1.5 }}>{p}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}


// ─── PlanCard ─────────────────────────────────────────────────────────────────

function PlanCard({ plan, bottleSizeOz, weight, age, dayEntry }) {
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
          {plan.strength?.type && (
            <div style={{ display:"flex", alignItems:"center", gap:3,
              background:"rgba(251,146,60,0.1)", border:"1px solid rgba(251,146,60,0.25)",
              borderRadius:20, padding:"3px 7px" }}>
              <span style={{ fontSize:10 }}>💪</span>
              <span style={{ fontSize:11, fontWeight:700, color:"#FB923C" }}>
                {plan.strength.type}
              </span>
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
          <MealPlanSection dayPlan={{ ...plan, strength: dayEntry?.strength }} weight={weight} age={age} />
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
  const [age,            setAge]            = useState(saved?.age             ?? 30);
  const [hotWeather,     setHotWeather]     = useState(saved?.hotWeather     ?? false);
  const [bottleSize,     setBottleSize]     = useState(saved?.bottleSize     ?? 22);
  const [plan,           setPlan]           = useState(null);
  const [view,           setView]           = useState("input");

  const th = dark ? DARK : LIGHT;

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY,
        JSON.stringify({ dark, week, weight, age, hotWeather, bottleSize }));
    } catch {}
  }, [dark, week, weight, age, hotWeather, bottleSize]);

  function generatePlan() {
    const p = generateWeekPlan(week, weight, hotWeather, bottleSize);
    // Attach per-day extras (strength) that live in the UI but not the engine
    p.days = p.days.map((d, i) => ({ ...d, strength: week[i].strength || null }));
    setPlan(p);
    setView("plan");
  }

  function applyRaceWeek() {
    setWeek(w => w.map((d, i) => {
      if (i === 4) return { ...d, type:"Easy Ride",  duration:45, notes:"Pre-race spin", races:0, scoops:1, strength: null };
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

                  {/* Age */}
                  <div style={{ minWidth:100 }}>
                    <div style={{ fontSize:11, color:th.dim, marginBottom:6 }}>Age</div>
                    <div style={{ display:"flex", alignItems:"center", gap:6,
                      background:th.input, borderRadius:8, padding:"6px 10px" }}>
                      <input type="number" min={16} max={70} value={age}
                        onChange={e => setAge(parseInt(e.target.value) || 30)}
                        style={{ background:"none", border:"none", outline:"none", color:"#E8F44A",
                          width:36, fontSize:14, fontWeight:700, textAlign:"right", fontFamily:"inherit" }}
                      />
                      <span style={{ fontSize:12, color:th.muted }}>yrs</span>
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
                <PlanCard key={i} plan={d} bottleSizeOz={bottleSize} weight={weight} age={age} dayEntry={week[i]} />
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
