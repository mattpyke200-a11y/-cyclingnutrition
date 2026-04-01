// ─────────────────────────────────────────────────────────────────────────────
// CycleNutrition — Rules-based weekly plan generator
// ─────────────────────────────────────────────────────────────────────────────

export type RideType =
  | "Rest"
  | "Easy Ride"
  | "Moderate Ride"
  | "Hard / Intervals"
  | "Velodrome"
  | "Crit Race"
  | "Road Race"
  | "Gran Fondo";

export interface DayInput {
  day: string;
  type: RideType | string;
  duration: number;   // minutes
  notes: string;
  races: number;      // 0 for non-race days
}

export interface BottleInfo {
  count: number;          // always Math.ceil — never a fraction
  sizeml: number;
  carbsPerBottle: number;
  totalCarbs: number;
  ratePerHour: number;
  note: string;
}

export interface PlanItem {
  product: string;
  instruction: string;
}

export interface PlanSection {
  timing: "Pre-ride" | "During" | "Post-ride" | "Note";
  items: PlanItem[];
}

export interface DayPlan {
  day: string;
  rideType: string;
  products: string[];       // "prefuel" | "c30" | "refuel"
  bottles: BottleInfo | null;
  sections: PlanSection[];
  proTip: string;
  calories: number;
  hydration: number;        // total ml needed (C30 counts toward this)
}

export interface ShoppingItem {
  product: string;
  color: string;
  scoops: number;
  unit: string;
  detail: string;
}

export interface WeekPlan {
  weekSummary: string;
  days: DayPlan[];
  shopping: ShoppingItem[];
  totalBottles: number;
}

// ─── Intensity tables ─────────────────────────────────────────────────────────

function carbRatePerHour(type: string): number {
  const map: Record<string, number> = {
    "Easy Ride":         0,
    "Moderate Ride":     40,
    "Hard / Intervals":  60,
    "Velodrome":         60,
    "Crit Race":         60,
    "Road Race":         60,
    "Gran Fondo":        50,
  };
  return map[type] ?? 0;
}

function calPerKgPerHour(type: string): number {
  const map: Record<string, number> = {
    "Easy Ride":         4,
    "Moderate Ride":     6,
    "Hard / Intervals":  9,
    "Velodrome":         10,
    "Crit Race":         11,
    "Road Race":         9,
    "Gran Fondo":        7,
  };
  return map[type] ?? 0;
}

const isRaceType  = (t: string) => t === "Crit Race" || t === "Road Race";
const isHardType  = (t: string) => ["Hard / Intervals", "Velodrome", "Crit Race", "Road Race"].includes(t);
const needsPreFuel = (t: string) => isHardType(t) || t === "Gran Fondo" || t === "Moderate Ride";

const BOTTLE_ML       = 500;
const CARBS_PER_SCOOP = 30;

// ─── Bottle calculator ────────────────────────────────────────────────────────

function calcBottles(day: DayInput): BottleInfo | null {
  const rate = carbRatePerHour(day.type);
  if (rate === 0 || day.type === "Rest") return null;

  let totalCarbs: number;
  let note: string;

  if (isRaceType(day.type) && day.races > 0) {
    const warmupMins = 20;
    const raceMins   = day.duration * day.races;
    const gapMins    = (day.races - 1) * 15;
    const totalMins  = warmupMins + raceMins + gapMins;
    totalCarbs = Math.round((totalMins / 60) * rate);
    const count = Math.ceil(totalCarbs / CARBS_PER_SCOOP);
    note = `${count} bottles total: 1 for warm-up + 1 per ${day.duration}-min race. Sip the remaining half-bottle in each gap between races.`;
    return { count, sizeml: BOTTLE_ML, carbsPerBottle: CARBS_PER_SCOOP, totalCarbs, ratePerHour: rate, note };
  }

  totalCarbs       = Math.round((day.duration / 60) * rate);
  const count      = Math.ceil(totalCarbs / CARBS_PER_SCOOP);
  const bph        = rate / CARBS_PER_SCOOP;
  note = `${Number.isInteger(bph) ? bph : bph.toFixed(1)} bottle${bph !== 1 ? "s" : ""}/hr · 1 scoop per 500ml · sip every 10–15 min.`;
  return { count, sizeml: BOTTLE_ML, carbsPerBottle: CARBS_PER_SCOOP, totalCarbs, ratePerHour: rate, note };
}

// ─── Hydration (ml) — C30 counts toward this target ──────────────────────────

function calcHydration(day: DayInput, kg: number, hot: boolean): number {
  if (day.type === "Rest" || day.duration === 0) return 0;
  const mlPerKgPerHour = hot ? 9 : 7;
  return Math.round((day.duration / 60) * kg * mlPerKgPerHour);
}

// ─── Calories burned ──────────────────────────────────────────────────────────

function calcCalories(day: DayInput, kg: number): number {
  if (day.type === "Rest" || day.duration === 0) return 0;
  return Math.round((day.duration / 60) * kg * calPerKgPerHour(day.type));
}

// ─── Section builders ─────────────────────────────────────────────────────────

function buildPreRide(day: DayInput): PlanSection | null {
  if (!needsPreFuel(day.type)) return null;
  let instruction = "";
  if (day.type === "Moderate Ride")
    instruction = "Mix 1 scoop in 300ml water · take 30–45 min before. Skip if the session is purely Z2 pace.";
  else if (day.type === "Gran Fondo")
    instruction = "Mix 1 scoop in 400ml water · take 45 min before the start. Supports sustained energy and electrolytes over a long effort.";
  else if (isRaceType(day.type))
    instruction = "Mix 1 scoop in 350ml water · take 45–60 min before warm-up. Times the beta-alanine and electrolyte peak to your race start.";
  else
    instruction = "Mix 1 scoop in 350ml water · take 40–50 min before the session. Beta-alanine helps buffer lactate during repeated hard efforts.";
  return { timing: "Pre-ride", items: [{ product: "ESN Pre-Fuel KOM (non-caffeinated)", instruction }] };
}

function buildDuring(day: DayInput, bottles: BottleInfo | null, hydration: number): PlanSection | null {
  if (day.type === "Rest") return null;

  if (day.type === "Easy Ride") {
    const waterBottles = Math.ceil(hydration / 500);
    return {
      timing: "During",
      items: [{ product: "Water", instruction: `Bring ${waterBottles} × 500ml plain water. No C30 needed on easy rides — save it for hard and race days.` }],
    };
  }

  if (!bottles) return null;

  let instruction = "";
  if (isRaceType(day.type) && day.races > 0) {
    instruction = `Prepare ${bottles.count} × 500ml bottles (1 scoop C30 = 30g carbs each). Drink 1 during warm-up, 1 per ${day.duration}-min race. Between races: finish any remaining before the next start. Target ${bottles.ratePerHour}g carbs/hr.`;
  } else if (day.type === "Gran Fondo") {
    instruction = `Prepare ${bottles.count} × 500ml bottles (1 scoop C30 each). Drink 1 every ~30 min. For rides over 3 hours add solid food (banana, rice cake) at the midpoint alongside C30.`;
  } else {
    instruction = `Prepare ${bottles.count} × 500ml bottle${bottles.count !== 1 ? "s" : ""} (1 scoop C30 = 30g carbs each). Sip consistently at ${(bottles.ratePerHour / CARBS_PER_SCOOP).toFixed(1)} bottles/hr. Total: ${bottles.totalCarbs}g carbs over ${day.duration} min.`;
  }

  return { timing: "During", items: [{ product: `Neversecond C30 Citrus — ${bottles.count} × 500ml`, instruction }] };
}

function buildPostRide(day: DayInput): PlanSection | null {
  if (day.type === "Rest" || day.type === "Easy Ride") return null;
  const base = "Mix 1 scoop in 300–400ml cold water or milk";
  let instruction = "";
  if (isRaceType(day.type) && day.races >= 2)
    instruction = `${base} · within 20 min of your last race. After ${day.races} races back-to-back, this recovery window is critical.`;
  else if (day.type === "Gran Fondo")
    instruction = `${base} · within 30 min. Follow with a full carb + protein meal within 2 hours.`;
  else if (isHardType(day.type))
    instruction = `${base} · within 30 min. Take it before you cool down or shower — the 30-min window matters.`;
  else
    instruction = `${base} · within 45 min. Recommended after any effort over 60 min.`;
  return { timing: "Post-ride", items: [{ product: "ESN Re-Fuel NICA (Chocolate)", instruction }] };
}

// ─── Pro tips ─────────────────────────────────────────────────────────────────

function buildProTip(day: DayInput, bottles: BottleInfo | null): string {
  switch (day.type) {
    case "Rest":            return "Use rest days to pre-mix tomorrow's C30 bottles and check your kit. Adaptation happens during recovery, not during training.";
    case "Easy Ride":       return "Riding with minimal fueling on easy days trains fat oxidation — but only if the pace stays truly easy (you can hold a full conversation).";
    case "Velodrome":       return "Beta-alanine in Pre-Fuel targets repeated sprint recovery. Benefits accumulate over 4+ weeks of daily use — take it on non-race days too.";
    case "Hard / Intervals":return `Pre-mix your ${bottles?.count ?? 2} C30 bottles the night before and refrigerate. Cold drinks absorb faster and feel better at high intensity.`;
    case "Crit Race":       return `Bring ${(bottles?.count ?? 3) + 1} bottles to the venue — one extra in case a race runs long or starts late. Pre-label them so you grab the right one mid-event.`;
    case "Road Race":       return "In a road race you may not always reach your bottle. Front-load your carb intake in the first half when the pace allows and your bottles are accessible.";
    case "Gran Fondo":      return "Alternate C30 and plain water every other bottle past 2 hours to avoid flavour fatigue. Add real food (banana, rice cake) at the 90-min mark.";
    case "Moderate Ride":   return "Moderate days are ideal for rehearsing race nutrition — same products, same timing. Race day should never be the first time you test your fueling.";
    default:                return "Consistent fueling builds the same adaptations as consistent training. Fuel every session appropriately.";
  }
}

// ─── Shopping list ────────────────────────────────────────────────────────────

function buildShopping(days: DayPlan[]): ShoppingItem[] {
  const c30     = days.reduce((s, d) => s + (d.bottles?.count ?? 0), 0);
  const preFuel = days.filter(d => d.products.includes("prefuel")).length;
  const reFuel  = days.filter(d => d.products.includes("refuel")).length;
  const items: ShoppingItem[] = [];
  if (c30 > 0)     items.push({ product: "Neversecond C30 Citrus", color: "#22C55E", scoops: c30,     unit: "scoops",   detail: `${c30} × 500ml bottles · ${c30 * 30}g total carbs this week` });
  if (preFuel > 0) items.push({ product: "ESN Pre-Fuel KOM",       color: "#3B82F6", scoops: preFuel, unit: "servings", detail: `1 serving on each of your ${preFuel} training day${preFuel !== 1 ? "s" : ""}` });
  if (reFuel > 0)  items.push({ product: "ESN Re-Fuel NICA",       color: "#F97316", scoops: reFuel,  unit: "servings", detail: `1 serving post-ride on each of your ${reFuel} active day${reFuel !== 1 ? "s" : ""}` });
  return items;
}

// ─── Week summary text ────────────────────────────────────────────────────────

function buildWeekSummary(inputs: DayInput[], days: DayPlan[]): string {
  const totalHours   = inputs.reduce((s, d) => s + d.duration, 0) / 60;
  const raceDays     = inputs.filter(d => isRaceType(d.type));
  const hardDays     = inputs.filter(d => isHardType(d.type));
  const totalBottles = days.reduce((s, d) => s + (d.bottles?.count ?? 0), 0);
  let s = `${totalHours.toFixed(1)}-hour training week`;
  if (raceDays.length > 0) {
    const totalRaces = raceDays.reduce((sum, d) => sum + Math.max(d.races, 1), 0);
    s += ` with ${totalRaces} race${totalRaces !== 1 ? "s" : ""} across ${raceDays.length} day${raceDays.length !== 1 ? "s" : ""}`;
  } else if (hardDays.length > 0) {
    s += ` with ${hardDays.length} hard session${hardDays.length !== 1 ? "s" : ""}`;
  }
  s += `. Prepare ${totalBottles} × 500ml C30 bottle${totalBottles !== 1 ? "s" : ""} across the week.`;
  return s;
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function generateWeekPlan(
  inputs: DayInput[],
  bodyWeightKg = 75,
  hotWeather = false
): WeekPlan {
  const days         = inputs.map(d => buildDayPlan(d, bodyWeightKg, hotWeather));
  const shopping     = buildShopping(days);
  const totalBottles = days.reduce((s, d) => s + (d.bottles?.count ?? 0), 0);
  return { weekSummary: buildWeekSummary(inputs, days), days, shopping, totalBottles };
}

function buildDayPlan(day: DayInput, kg: number, hot: boolean): DayPlan {
  const bottles   = calcBottles(day);
  const hydration = calcHydration(day, kg, hot);
  const calories  = calcCalories(day, kg);
  const sections: PlanSection[] = [];

  if (day.type === "Rest") {
    sections.push({ timing: "Note", items: [{ product: "Rest day — no products needed", instruction: "Focus on whole foods, adequate protein (1.6–2g/kg body weight), and hydration. Re-Fuel NICA can double as a protein-rich snack if following a hard multi-day block." }] });
  } else {
    if (day.type === "Easy Ride" && day.duration <= 60)
      sections.push({ timing: "Note", items: [{ product: "Short easy ride — minimal fueling", instruction: "Water only for rides under 60 min at easy pace. Save Pre-Fuel and C30 for harder sessions." }] });
    const pre = buildPreRide(day);
    if (pre) sections.push(pre);
    const during = buildDuring(day, bottles, hydration);
    if (during) sections.push(during);
    const post = buildPostRide(day);
    if (post) sections.push(post);
  }

  const products: string[] = [];
  if (sections.some(s => s.timing === "Pre-ride"))  products.push("prefuel");
  if (bottles)                                       products.push("c30");
  if (sections.some(s => s.timing === "Post-ride")) products.push("refuel");

  return { day: day.day, rideType: day.type, products, bottles, sections, proTip: buildProTip(day, bottles), calories, hydration };
}
