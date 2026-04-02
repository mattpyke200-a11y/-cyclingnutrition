// ─────────────────────────────────────────────────────────────────────────────
// CycleNutrition — Rules-based weekly plan generator
//
// Bottle rule: max 2 × C30 on the bike (22oz or 26oz)
// Carb gap filled by:
//   • Carbs Fuel 50g Energy Gel  — fast-absorbing, suits high-intensity / race efforts
//   • Supra Performance Bar (35g) — slower release, suits longer steady efforts
//
// Allocation logic:
//   Crit Race / Velodrome   → gels only (quick, easy to consume mid-effort)
//   Hard / Intervals         → gels first, bars for remainder
//   Road Race                → 50/50 gels + bars
//   Gran Fondo               → bars primary, 1–2 gels for the final push
//   Moderate                 → bars only
// ─────────────────────────────────────────────────────────────────────────────

export type RideType =
  | "Rest" | "Easy Ride" | "Moderate Ride" | "Hard / Intervals"
  | "Velodrome" | "Crit Race" | "Road Race" | "Gran Fondo";

export type BottleSizeOz = 22 | 26;

export interface DayInput {
  day: string;
  type: RideType | string;
  duration: number;
  notes: string;
  races: number;
}

// ── Product specs (exported so UI can reference them) ─────────────────────────

export const BOTTLE_SPECS: Record<BottleSizeOz, { ml: number; label: string }> = {
  22: { ml: 651, label: "22oz (651ml)" },
  26: { ml: 769, label: "26oz (769ml)" },
};

export const C30_CARBS_PER_BOTTLE   = 30;   // g — 1 scoop per bottle regardless of size
export const GEL_CARBS              = 50;   // g — Carbs Fuel 50g Energy Gel
export const BAR_CARBS              = 35;   // g — Supra Performance Bar
export const MAX_BOTTLES            = 2;

// ── Interfaces ────────────────────────────────────────────────────────────────

export interface BottleLoad {
  count: number;           // always 2 (or 1 for very short)
  sizeOz: BottleSizeOz;
  sizeMl: number;
  carbsFromBottles: number;
  refillsNeeded: number;
  note: string;
}

export interface PocketLoad {
  gels: number;
  bars: number;
  carbsFromGels: number;
  carbsFromBars: number;
  totalCarbs: number;
  gelTiming: string;
  barTiming: string;
}

export interface FuelingPlan {
  totalCarbsNeeded: number;
  bottles: BottleLoad | null;
  pocket: PocketLoad | null;
  carbsFromLiquid: number;
  carbsFromSolid: number;
}

export interface PlanItem   { product: string; instruction: string; }
export interface PlanSection { timing: "Pre-ride" | "During" | "Post-ride" | "Note"; items: PlanItem[]; }

export interface DayPlan {
  day: string;
  rideType: string;
  products: string[];
  fueling: FuelingPlan | null;
  sections: PlanSection[];
  proTip: string;
  calories: number;
  hydration: number;
}

export interface ShoppingItem { product: string; color: string; qty: number; unit: string; detail: string; }

export interface WeekPlan {
  weekSummary: string;
  days: DayPlan[];
  shopping: ShoppingItem[];
  weekTotals: { c30Scoops: number; gels: number; bars: number; preFuel: number; reFuel: number; };
}

// ── Intensity tables ──────────────────────────────────────────────────────────

function carbRatePerHour(type: string): number {
  return ({ "Easy Ride":0,"Moderate Ride":40,"Hard / Intervals":60,"Velodrome":60,"Crit Race":60,"Road Race":60,"Gran Fondo":50 } as Record<string,number>)[type] ?? 0;
}

function calPerKgPerHour(type: string): number {
  return ({ "Easy Ride":4,"Moderate Ride":6,"Hard / Intervals":9,"Velodrome":10,"Crit Race":11,"Road Race":9,"Gran Fondo":7 } as Record<string,number>)[type] ?? 0;
}

const isRace      = (t: string) => t === "Crit Race" || t === "Road Race";
const isHard      = (t: string) => ["Hard / Intervals","Velodrome","Crit Race","Road Race"].includes(t);
const needsPre    = (t: string) => isHard(t) || t === "Gran Fondo" || t === "Moderate Ride";

// ── Pocket allocation ─────────────────────────────────────────────────────────
// Decides how many gels vs bars to fill the carb gap.

type GelBarSplit = { gelFraction: number }; // 0–1; rest goes to bars

function pocketSplit(type: string): GelBarSplit {
  switch (type) {
    case "Crit Race":         return { gelFraction: 1.0  }; // gels only — quick and pocketable mid-race
    case "Velodrome":         return { gelFraction: 1.0  }; // same — grab & go between efforts
    case "Hard / Intervals":  return { gelFraction: 0.6  }; // gels first, bars for longer sets
    case "Road Race":         return { gelFraction: 0.5  }; // 50/50 — gels early, bars mid-race
    case "Gran Fondo":        return { gelFraction: 0.25 }; // bars primary, few gels for the final push
    case "Moderate Ride":     return { gelFraction: 0.0  }; // bars only — steady effort
    default:                  return { gelFraction: 0.5  };
  }
}

// ── Fueling calculator ────────────────────────────────────────────────────────

function buildFueling(day: DayInput, sizeOz: BottleSizeOz): FuelingPlan | null {
  const rate = carbRatePerHour(day.type);
  if (rate === 0 || day.type === "Rest" || day.type === "Easy Ride") return null;

  const sizeMl = BOTTLE_SPECS[sizeOz].ml;

  // ── Total minutes (race days include warm-up + gaps) ──────────────────────
  let totalMins: number;
  let refillsNeeded = 0;

  if (isRace(day.type) && day.races > 0) {
    const warmup = 20;
    const racing = day.duration * day.races;
    const gaps   = (day.races - 1) * 15;
    totalMins    = warmup + racing + gaps;
    // Rider can refill between races at the venue
    refillsNeeded = Math.max(0, day.races - 1);
  } else {
    totalMins = day.duration;
    // Feed-zone/café refill every 90 min for longer rides
    refillsNeeded = Math.max(0, Math.floor(day.duration / 90) - 1);
  }

  const totalCarbsNeeded = Math.round((totalMins / 60) * rate);

  // ── Bottles (always 2 × C30) ──────────────────────────────────────────────
  const fills            = 1 + refillsNeeded;
  const carbsFromBottles = MAX_BOTTLES * C30_CARBS_PER_BOTTLE * fills;

  let bottleNote = "";
  if (isRace(day.type) && day.races > 0) {
    bottleNote = `2 × C30 (${C30_CARBS_PER_BOTTLE}g each) in both ${BOTTLE_SPECS[sizeOz].label} bottles. ${refillsNeeded > 0 ? `Refill at the venue between races (${refillsNeeded} refill${refillsNeeded > 1 ? "s" : ""}).` : "Start each race with full bottles."}`;
  } else if (refillsNeeded > 0) {
    bottleNote = `2 × ${BOTTLE_SPECS[sizeOz].label} C30 bottles — refill both ${refillsNeeded}× during the ride (feed zone or café stop). Each fill = ${MAX_BOTTLES * C30_CARBS_PER_BOTTLE}g carbs.`;
  } else {
    bottleNote = `2 × ${BOTTLE_SPECS[sizeOz].label} bottles, 1 scoop C30 each = ${carbsFromBottles}g carbs total. Sip consistently every 10–15 min.`;
  }

  const bottleLoad: BottleLoad = {
    count: MAX_BOTTLES,
    sizeOz,
    sizeMl,
    carbsFromBottles,
    refillsNeeded,
    note: bottleNote,
  };

  // ── Pocket (gels + bars to fill remaining gap) ────────────────────────────
  const carbsGap = Math.max(0, totalCarbsNeeded - carbsFromBottles);

  let pocketLoad: PocketLoad | null = null;

  if (carbsGap > 0) {
    const { gelFraction } = pocketSplit(day.type);
    const carbsForGels = Math.round(carbsGap * gelFraction);
    const carbsForBars = carbsGap - carbsForGels;

    const gels = Math.ceil(carbsForGels / GEL_CARBS);
    const bars = Math.ceil(carbsForBars / BAR_CARBS);

    // ── Timing strings ────────────────────────────────────────────────────────
    let gelTiming = "";
    let barTiming = "";

    if (gels > 0) {
      if (isRace(day.type)) {
        gelTiming = `1 gel between each race — keep them accessible in your back pocket. Take it within the first 5 min of each gap, not right before the next start.`;
      } else if (day.type === "Velodrome") {
        gelTiming = `1 gel between efforts / sets at the rail. Takes ~5 min to absorb — time it for the next hard block, not mid-sprint.`;
      } else {
        const interval = Math.round(totalMins / (gels + 1));
        gelTiming = `1 gel every ~${interval} min. Chase each gel with a few sips of C30 — never take gels dry.`;
      }
    }

    if (bars > 0) {
      if (day.type === "Gran Fondo") {
        const interval = Math.round(day.duration / (bars + 1));
        barTiming = `1 bar every ~${interval} min. Start eating at 30–40 min in — don't wait for hunger. Bars take 20+ min to fully digest.`;
      } else if (day.type === "Road Race") {
        barTiming = `Eat ${bars} bar${bars > 1 ? "s" : ""} in the first half of the race when the pace is manageable. Solid food is harder to chew in the finale.`;
      } else {
        const interval = Math.round(totalMins / (bars + 1));
        barTiming = `1 bar every ~${interval} min. Eat with liquid — never dry. Start early, not when you're already hungry.`;
      }
    }

    pocketLoad = {
      gels,
      bars,
      carbsFromGels: gels * GEL_CARBS,
      carbsFromBars:  bars * BAR_CARBS,
      totalCarbs:    (gels * GEL_CARBS) + (bars * BAR_CARBS),
      gelTiming,
      barTiming,
    };
  }

  return {
    totalCarbsNeeded,
    bottles: bottleLoad,
    pocket:  pocketLoad,
    carbsFromLiquid: carbsFromBottles,
    carbsFromSolid:  pocketLoad ? pocketLoad.totalCarbs : 0,
  };
}

// ── Hydration / Calories ──────────────────────────────────────────────────────

function calcHydration(day: DayInput, kg: number, hot: boolean): number {
  if (day.type === "Rest" || day.duration === 0) return 0;
  return Math.round((day.duration / 60) * kg * (hot ? 9 : 7));
}

function calcCalories(day: DayInput, kg: number): number {
  if (day.type === "Rest" || day.duration === 0) return 0;
  return Math.round((day.duration / 60) * kg * calPerKgPerHour(day.type));
}

// ── Section builders ──────────────────────────────────────────────────────────

function buildPreRide(day: DayInput): PlanSection | null {
  if (!needsPre(day.type)) return null;
  let instruction = "";
  if (day.type === "Moderate Ride")
    instruction = "Mix 1 scoop in 300ml water · take 30–45 min before. Skip if the session is purely Z2 pace.";
  else if (day.type === "Gran Fondo")
    instruction = "Mix 1 scoop in 400ml water · take 45 min before the start. Supports sustained energy and electrolytes over a long effort.";
  else if (isRace(day.type))
    instruction = "Mix 1 scoop in 350ml water · take 45–60 min before warm-up. Times the beta-alanine and electrolyte peak to your race start.";
  else
    instruction = "Mix 1 scoop in 350ml water · take 40–50 min before. Beta-alanine helps buffer lactate during repeated hard efforts.";
  return { timing: "Pre-ride", items: [{ product: "ESN Pre-Fuel KOM (non-caffeinated)", instruction }] };
}

function buildDuring(day: DayInput, fueling: FuelingPlan | null, hydration: number, sizeOz: BottleSizeOz): PlanSection | null {
  if (day.type === "Rest") return null;

  if (day.type === "Easy Ride") {
    const waterCount = Math.ceil(hydration / BOTTLE_SPECS[sizeOz].ml);
    return {
      timing: "During",
      items: [{ product: "Water", instruction: `${waterCount} × ${BOTTLE_SPECS[sizeOz].label} plain water. No carb products on easy rides — save C30, gels, and bars for hard sessions.` }],
    };
  }

  if (!fueling?.bottles) return null;

  const items: PlanItem[] = [];

  // Bottles
  items.push({
    product: `2 × C30 Citrus · ${BOTTLE_SPECS[sizeOz].label}`,
    instruction: fueling.bottles.note,
  });

  // Gels
  if (fueling.pocket?.gels) {
    items.push({
      product: `Carbs Fuel Gel${fueling.pocket.gels > 1 ? "s" : ""} — ${fueling.pocket.gels}× (${fueling.pocket.carbsFromGels}g carbs)`,
      instruction: fueling.pocket.gelTiming,
    });
  }

  // Bars
  if (fueling.pocket?.bars) {
    items.push({
      product: `Supra Performance Bar${fueling.pocket.bars > 1 ? "s" : ""} — ${fueling.pocket.bars}× (${fueling.pocket.carbsFromBars}g carbs)`,
      instruction: fueling.pocket.barTiming,
    });
  }

  return { timing: "During", items };
}

function buildPostRide(day: DayInput): PlanSection | null {
  if (day.type === "Rest" || day.type === "Easy Ride") return null;
  const base = "Mix 1 scoop in 300–400ml cold water or milk";
  let instruction = "";
  if (isRace(day.type) && day.races >= 2)
    instruction = `${base} · within 20 min of your last race. After ${day.races} races back-to-back this window is critical.`;
  else if (day.type === "Gran Fondo")
    instruction = `${base} · within 30 min. Follow with a full carb + protein meal within 2 hours.`;
  else if (isHard(day.type))
    instruction = `${base} · within 30 min. Take it before you cool down or shower.`;
  else
    instruction = `${base} · within 45 min. Recommended after any effort over 60 min.`;
  return { timing: "Post-ride", items: [{ product: "ESN Re-Fuel NICA (Chocolate)", instruction }] };
}

// ── Pro tips ──────────────────────────────────────────────────────────────────

function buildProTip(day: DayInput, fueling: FuelingPlan | null): string {
  const sz = fueling?.bottles ? BOTTLE_SPECS[fueling.bottles.sizeOz].label : "";
  switch (day.type) {
    case "Rest":
      return "Use rest days to stock your gel supply and prep your bars. Check jersey pocket space — know exactly what goes where before race morning.";
    case "Easy Ride":
      return "Easy-day fat adaptation only works if the pace stays truly conversational. If you're breathing hard, it's not easy.";
    case "Velodrome":
      return "Stage your gels at the rail, not in your pocket — reaching into a skinsuit pocket at the velodrome is awkward. Unwrap them before you roll onto the track.";
    case "Hard / Intervals":
      return `Pre-mix your ${sz} C30 bottles the night before and refrigerate. Take gels at the midpoint of each interval block, not during the rest.`;
    case "Crit Race":
      return `Gels only in the pocket for crits — bars are too slow to eat and too bulky. Pre-tear the top off each gel wrapper before pinning your number.`;
    case "Road Race":
      return "Eat your first bar in the neutral zone before racing starts. Once the pace is on, solid food becomes much harder to manage.";
    case "Gran Fondo":
      return "Bars are your base fuel for the fondo. Start eating at 30 min regardless of hunger — once you're behind on carbs in a 3+ hour effort, you can't catch up.";
    case "Moderate Ride":
      return "Moderate days are perfect to rehearse your race nutrition routine. Eat the bars at exactly the same intervals you'd use on race day.";
    default:
      return "Consistent fueling builds the same adaptations as consistent training. Never skip in-ride nutrition on hard days.";
  }
}

// ── Shopping list ─────────────────────────────────────────────────────────────

function buildShopping(days: DayPlan[]): { items: ShoppingItem[]; totals: WeekPlan["weekTotals"] } {
  const totals = {
    c30Scoops: days.reduce((s, d) => s + (d.fueling?.bottles ? d.fueling.bottles.count * (1 + d.fueling.bottles.refillsNeeded) : 0), 0),
    gels:      days.reduce((s, d) => s + (d.fueling?.pocket?.gels ?? 0), 0),
    bars:      days.reduce((s, d) => s + (d.fueling?.pocket?.bars ?? 0), 0),
    preFuel:   days.filter(d => d.products.includes("prefuel")).length,
    reFuel:    days.filter(d => d.products.includes("refuel")).length,
  };

  const items: ShoppingItem[] = [];
  if (totals.c30Scoops > 0)
    items.push({ product:"Neversecond C30 Citrus", color:"#22C55E", qty:totals.c30Scoops, unit:"scoops",   detail:`${totals.c30Scoops} bottle fills · ${totals.c30Scoops * C30_CARBS_PER_BOTTLE}g carbs from liquid` });
  if (totals.gels > 0)
    items.push({ product:"Carbs Fuel 50g Energy Gel", color:"#A855F7", qty:totals.gels,  unit:"gels",     detail:`${totals.gels} gels · ${totals.gels * GEL_CARBS}g carbs — fast absorption` });
  if (totals.bars > 0)
    items.push({ product:"Supra Performance Bar",  color:"#EF4444", qty:totals.bars,     unit:"bars",     detail:`${totals.bars} bars · ${totals.bars * BAR_CARBS}g carbs — steady release` });
  if (totals.preFuel > 0)
    items.push({ product:"ESN Pre-Fuel KOM",       color:"#3B82F6", qty:totals.preFuel,  unit:"servings", detail:`1 serving on each of your ${totals.preFuel} training days` });
  if (totals.reFuel > 0)
    items.push({ product:"ESN Re-Fuel NICA",       color:"#F97316", qty:totals.reFuel,   unit:"servings", detail:`1 serving post-ride on each of your ${totals.reFuel} active days` });

  return { items, totals };
}

// ── Week summary ──────────────────────────────────────────────────────────────

function buildWeekSummary(inputs: DayInput[], days: DayPlan[], sizeOz: BottleSizeOz): string {
  const totalHours = inputs.reduce((s, d) => s + d.duration, 0) / 60;
  const raceDays   = inputs.filter(d => isRace(d.type));
  const hardDays   = inputs.filter(d => isHard(d.type));
  const totalGels  = days.reduce((s, d) => s + (d.fueling?.pocket?.gels ?? 0), 0);
  const totalBars  = days.reduce((s, d) => s + (d.fueling?.pocket?.bars ?? 0), 0);

  let s = `${totalHours.toFixed(1)}-hour week`;
  if (raceDays.length > 0) {
    const nr = raceDays.reduce((a, d) => a + Math.max(d.races, 1), 0);
    s += ` with ${nr} race${nr !== 1 ? "s" : ""} across ${raceDays.length} day${raceDays.length !== 1 ? "s" : ""}`;
  } else if (hardDays.length > 0) {
    s += ` with ${hardDays.length} hard session${hardDays.length !== 1 ? "s" : ""}`;
  }
  s += `. Running 2 × ${BOTTLE_SPECS[sizeOz].label} C30 bottles on the bike`;
  if (totalGels > 0 || totalBars > 0) {
    const extras: string[] = [];
    if (totalGels > 0) extras.push(`${totalGels} gel${totalGels !== 1 ? "s" : ""}`);
    if (totalBars > 0) extras.push(`${totalBars} bar${totalBars !== 1 ? "s" : ""}`);
    s += `, with ${extras.join(" and ")} in the jersey pocket`;
  }
  s += ".";
  return s;
}

// ── Day plan ──────────────────────────────────────────────────────────────────

function buildDayPlan(day: DayInput, kg: number, hot: boolean, sizeOz: BottleSizeOz): DayPlan {
  const fueling   = buildFueling(day, sizeOz);
  const hydration = calcHydration(day, kg, hot);
  const calories  = calcCalories(day, kg);
  const sections: PlanSection[] = [];

  if (day.type === "Rest") {
    sections.push({ timing: "Note", items: [{ product: "Rest day — no products needed", instruction: "Focus on whole foods, adequate protein (1.6–2g/kg body weight), and hydration. Re-Fuel NICA can double as a protein snack if following a hard multi-day block." }] });
  } else {
    if (day.type === "Easy Ride" && day.duration <= 60)
      sections.push({ timing: "Note", items: [{ product: "Short easy ride — water only", instruction: "Under 60 min at easy pace needs nothing but water. Save C30, gels, and bars for hard and race days." }] });
    const pre = buildPreRide(day);
    if (pre) sections.push(pre);
    const during = buildDuring(day, fueling, hydration, sizeOz);
    if (during) sections.push(during);
    const post = buildPostRide(day);
    if (post) sections.push(post);
  }

  const products: string[] = [];
  if (sections.some(s => s.timing === "Pre-ride"))  products.push("prefuel");
  if (fueling?.bottles)                             products.push("c30");
  if (fueling?.pocket?.gels)                        products.push("gel");
  if (fueling?.pocket?.bars)                        products.push("suprabar");
  if (sections.some(s => s.timing === "Post-ride")) products.push("refuel");

  return { day: day.day, rideType: day.type, products, fueling, sections, proTip: buildProTip(day, fueling), calories, hydration };
}

// ── Main export ───────────────────────────────────────────────────────────────

export function generateWeekPlan(
  inputs: DayInput[],
  bodyWeightKg  = 75,
  hotWeather    = false,
  bottleSizeOz: BottleSizeOz = 22,
): WeekPlan {
  const days = inputs.map(d => buildDayPlan(d, bodyWeightKg, hotWeather, bottleSizeOz));
  const { items, totals } = buildShopping(days);
  return {
    weekSummary: buildWeekSummary(inputs, days, bottleSizeOz),
    days,
    shopping: items,
    weekTotals: totals,
  };
}
