import { useState, useEffect } from 'react';
import { generateNutritionPlan, UserInputs, NutritionPlan } from './generatePlanRulesBased';

// ─── Constants ────────────────────────────────────────────────────────────────

const CARBS_PER_SCOOP = 30;
const GEL_CARBS       = 50;

// Reference durations the rules engine was calibrated against.
// Actual results are scaled proportionally to the user's chosen duration.
const REFERENCE_DURATIONS: Record<string, number> = {
  casual:    60,
  endurance: 120,
  intense:   90,
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface ExtendedPlan extends NutritionPlan {
  carbsFromBottles: number;
  gelsNeeded:       number;
  barsNeeded:       number;
}

// ─── Theme ────────────────────────────────────────────────────────────────────

const DARK = {
  bg:          '#111113',
  surface:     '#1A1A1E',
  border:      'rgba(255,255,255,0.08)',
  text:        '#F9FAFB',
  sub:         '#D1D5DB',
  muted:       '#9CA3AF',
  dim:         '#6B7280',
  inputBg:     'rgba(255,255,255,0.06)',
  inputBorder: 'rgba(255,255,255,0.12)',
  btnSecBg:    'rgba(255,255,255,0.06)',
  btnSecColor: '#9CA3AF',
};
const LIGHT = {
  bg:          '#F0F2F5',
  surface:     '#FFFFFF',
  border:      '#E5E7EB',
  text:        '#111827',
  sub:         '#374151',
  muted:       '#6B7280',
  dim:         '#9CA3AF',
  inputBg:     '#F9FAFB',
  inputBorder: '#D1D5DB',
  btnSecBg:    '#F3F4F6',
  btnSecColor: '#6B7280',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function useWindowWidth() {
  const [w, setW] = useState(typeof window !== 'undefined' ? window.innerWidth : 768);
  useEffect(() => {
    const h = () => setW(window.innerWidth);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);
  return w;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function GeneratePlan() {
  const w        = useWindowWidth();
  const isMobile = w < 600;

  const [dark, setDark] = useState<boolean>(() =>
    typeof window !== 'undefined'
      ? window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? true
      : true
  );

  const [scoops, setScoops] = useState(2);

  const [inputs, setInputs] = useState<UserInputs>({
    rideType:     'casual',
    rideDuration: 60,
    bodyWeight:   75,
    goals:        'maintenance',
  });

  const [plan,    setPlan]    = useState<ExtendedPlan | null>(null);
  const [loading, setLoading] = useState(false);

  const th = dark ? DARK : LIGHT;

  const handleGeneratePlan = async () => {
    setLoading(true);
    try {
      await new Promise(resolve => setTimeout(resolve, 500));
      const rawPlan = generateNutritionPlan(inputs);

      // Fix: scale outputs proportionally to the actual ride duration,
      // since the rules engine produces the same result regardless of duration.
      const refDuration = REFERENCE_DURATIONS[inputs.rideType] ?? 90;
      const scale       = inputs.rideDuration / refDuration;

      const scaledCalories  = Math.round(rawPlan.calories  * scale);
      const scaledCarbs     = Math.round(rawPlan.carbs     * scale);
      const scaledHydration = Math.round(rawPlan.hydration * scale);
      // Protein & fat scale less aggressively (base requirement + performance portion)
      const scaledProtein   = Math.round(rawPlan.protein * (0.6 + 0.4 * scale));
      const scaledFat       = Math.round(rawPlan.fat     * (0.7 + 0.3 * scale));

      // Break down carbs into bottle scoops vs pocket items
      const carbsFromBottles = scoops * CARBS_PER_SCOOP * 2;  // 2 bottles
      const solidCarbsNeeded = Math.max(0, scaledCarbs - carbsFromBottles);
      const gelsNeeded       = Math.round(solidCarbsNeeded / GEL_CARBS);
      const barsNeeded       = 0; // gels preferred for single-ride view

      setPlan({
        ...rawPlan,
        calories:  scaledCalories,
        carbs:     scaledCarbs,
        protein:   scaledProtein,
        fat:       scaledFat,
        hydration: scaledHydration,
        carbsFromBottles,
        gelsNeeded,
        barsNeeded,
      });
    } finally {
      setLoading(false);
    }
  };

  // ── Styles helpers ──
  const card = (extra?: React.CSSProperties): React.CSSProperties => ({
    background:   th.surface,
    border:       `1px solid ${th.border}`,
    borderRadius: 12,
    ...extra,
  });

  const inputStyle: React.CSSProperties = {
    width:        '100%',
    padding:      '9px 12px',
    background:   th.inputBg,
    border:       `1px solid ${th.inputBorder}`,
    borderRadius: 8,
    color:        th.text,
    fontSize:     14,
    outline:      'none',
    fontFamily:   'inherit',
    appearance:   'none' as any,
  };

  const labelStyle: React.CSSProperties = {
    display:      'block',
    fontSize:     12,
    fontWeight:   600,
    color:        th.muted,
    marginBottom: 6,
    letterSpacing:'0.03em',
    textTransform:'uppercase' as const,
  };

  return (
    <div style={{ minHeight: '100vh', background: th.bg, color: th.text,
      fontFamily: "'DM Sans','Helvetica Neue',sans-serif",
      transition: 'background 0.25s, color 0.25s' }}>

      {/* Header */}
      <div style={{ borderBottom: `1px solid ${th.border}`,
        padding: isMobile ? '10px 14px' : '14px 20px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: dark ? 'rgba(17,17,19,0.85)' : 'rgba(255,255,255,0.92)',
        backdropFilter: 'blur(12px)', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 30, height: 30, background: '#E8F44A', borderRadius: 8,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>⚡</div>
          <div>
            <div style={{ fontSize: 14, fontWeight: 700, color: th.text }}>CycleNutrition</div>
            {!isMobile && (
              <div style={{ fontSize: 10, color: th.dim, letterSpacing: '0.05em' }}>
                SINGLE RIDE PLANNER
              </div>
            )}
          </div>
        </div>
        <button onClick={() => setDark(d => !d)}
          style={{ width: 32, height: 32, borderRadius: 8,
            border: `1px solid ${th.border}`, background: th.inputBg,
            cursor: 'pointer', fontSize: 15, display: 'flex',
            alignItems: 'center', justifyContent: 'center' }}>
          {dark ? '☀️' : '🌙'}
        </button>
      </div>

      <div style={{ maxWidth: 640, margin: '0 auto',
        padding: isMobile ? '16px 12px' : '24px 16px' }}>

        <h1 style={{ fontSize: isMobile ? 22 : 28, fontWeight: 700,
          marginBottom: 6, color: th.text }}>
          Generate Cycling Nutrition Plan
        </h1>
        <p style={{ fontSize: 13, color: th.muted, marginBottom: 24, marginTop: 0 }}>
          Fill in your ride details and get a personalised fuelling plan.
        </p>

        {/* ── Form ── */}
        <div style={card({ padding: isMobile ? 16 : 24, marginBottom: 20 })}>
          <h2 style={{ fontSize: 16, fontWeight: 700, marginBottom: 18,
            marginTop: 0, color: th.text }}>Your Details</h2>

          <div style={{ display: 'grid',
            gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
            gap: 16 }}>

            {/* Ride type */}
            <div style={{ gridColumn: isMobile ? 'auto' : '1 / -1' }}>
              <label style={labelStyle}>Ride Type</label>
              <select value={inputs.rideType}
                onChange={e => setInputs({ ...inputs, rideType: e.target.value as any })}
                style={{ ...inputStyle, cursor: 'pointer' }}>
                <option value="casual">Casual (easy pace)</option>
                <option value="endurance">Endurance (long ride)</option>
                <option value="intense">Intense (hard effort)</option>
              </select>
            </div>

            {/* Duration */}
            <div>
              <label style={labelStyle}>Ride Duration (minutes)</label>
              <input type="number" value={inputs.rideDuration} min="10" max="300"
                onChange={e => setInputs({ ...inputs, rideDuration: parseInt(e.target.value) })}
                style={inputStyle} />
            </div>

            {/* Body weight */}
            <div>
              <label style={labelStyle}>Body Weight (kg)</label>
              <input type="number" value={inputs.bodyWeight} min="40" max="150"
                onChange={e => setInputs({ ...inputs, bodyWeight: parseFloat(e.target.value) })}
                style={inputStyle} />
            </div>

            {/* Goals */}
            <div>
              <label style={labelStyle}>Goal</label>
              <select value={inputs.goals}
                onChange={e => setInputs({ ...inputs, goals: e.target.value as any })}
                style={{ ...inputStyle, cursor: 'pointer' }}>
                <option value="weight-loss">Weight Loss (10–15% deficit)</option>
                <option value="maintenance">Maintenance</option>
                <option value="performance">Performance (10–15% surplus)</option>
              </select>
            </div>

            {/* C30 scoops per bottle — NEW */}
            <div>
              <label style={labelStyle}>C30 Scoops / Bottle</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {[1, 2, 3].map(n => (
                  <button key={n} onClick={() => setScoops(n)}
                    style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: 'none',
                      cursor: 'pointer', fontFamily: 'inherit', fontSize: 14, fontWeight: 700,
                      transition: 'all 0.15s',
                      background: scoops === n ? '#22C55E' : th.inputBg,
                      color:      scoops === n ? '#fff'    : th.muted }}>
                    {n}
                  </button>
                ))}
              </div>
              <div style={{ fontSize: 11, color: th.dim, marginTop: 5 }}>
                {scoops * CARBS_PER_SCOOP}g carbs/bottle · {scoops * CARBS_PER_SCOOP * 2}g from 2 bottles
              </div>
            </div>
          </div>

          <button onClick={handleGeneratePlan} disabled={loading}
            style={{ width: '100%', marginTop: 20, padding: '13px 0',
              borderRadius: 10, border: 'none',
              background: loading ? '#6B7280' : '#E8F44A',
              color: '#111113', fontSize: 15, fontWeight: 700,
              cursor: loading ? 'default' : 'pointer',
              letterSpacing: '0.02em', fontFamily: 'inherit',
              transition: 'background 0.15s' }}>
            {loading ? 'Generating…' : '⚡ Generate Plan'}
          </button>
        </div>

        {/* ── Results ── */}
        {plan && (
          <div>
            {/* Macro summary row */}
            <div style={{ display: 'grid',
              gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)',
              gap: 10, marginBottom: 16 }}>
              {[
                { label: 'Calories',   value: `${plan.calories}`,    unit: 'kcal', color: '#22C55E' },
                { label: 'Hydration',  value: `${plan.hydration}`,   unit: 'ml',   color: '#3B82F6' },
                { label: 'Carbs',      value: `${plan.carbs}g`,      unit: '~40%', color: '#E8F44A' },
                { label: 'Protein',    value: `${plan.protein}g`,    unit: '~20%', color: '#F97316' },
              ].map(s => (
                <div key={s.label} style={card({ padding: '12px 14px',
                  borderLeft: `3px solid ${s.color}` })}>
                  <div style={{ fontSize: 11, color: th.muted, marginBottom: 4 }}>{s.label}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: s.color,
                    fontFamily: "'DM Mono',monospace" }}>{s.value}</div>
                  <div style={{ fontSize: 10, color: th.dim, marginTop: 2 }}>{s.unit}</div>
                </div>
              ))}
            </div>

            {/* Bottle breakdown — NEW */}
            <div style={card({ padding: '14px 16px', marginBottom: 14,
              borderLeft: '3px solid #22C55E' })}>
              <div style={{ fontSize: 11, fontWeight: 700, color: th.muted,
                letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
                🍶 Bottle Strategy ({scoops} scoop{scoops > 1 ? 's' : ''} / bottle)
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {[1, 2].map(b => (
                  <div key={b} style={{ flex: '1 1 100px',
                    background: 'rgba(34,197,94,0.07)',
                    border: '1px solid rgba(34,197,94,0.2)',
                    borderRadius: 10, padding: '10px 12px' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#22C55E',
                      letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom:4 }}>
                      Bottle {b}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: th.text }}>C30 Citrus</div>
                    <div style={{ fontSize: 11, color: th.dim, marginTop: 2 }}>
                      {scoops} scoop{scoops > 1 ? 's' : ''}
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#22C55E', marginTop: 4 }}>
                      +{scoops * CARBS_PER_SCOOP}g carbs
                    </div>
                  </div>
                ))}
                {plan.gelsNeeded > 0 && (
                  <div style={{ flex: '1 1 100px',
                    background: 'rgba(168,85,247,0.07)',
                    border: '1px solid rgba(168,85,247,0.2)',
                    borderRadius: 10, padding: '10px 12px' }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#A855F7',
                      letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 4 }}>
                      Jersey pocket
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: th.text }}>
                      {plan.gelsNeeded}× Energy Gel
                    </div>
                    <div style={{ fontSize: 11, color: th.dim, marginTop: 2 }}>
                      {plan.gelsNeeded * GEL_CARBS}g carbs
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Macros + timing */}
            <div style={{ display: 'grid',
              gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
              gap: 14, marginBottom: 14 }}>

              <div style={card({ padding: '14px 16px', borderLeft: '3px solid #E8F44A' })}>
                <div style={{ fontSize: 11, fontWeight: 700, color: th.muted,
                  letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
                  Macronutrients
                </div>
                {[
                  { icon: '🥗', label: 'Carbs',   value: `${plan.carbs}g`,   note: '~40% energy' },
                  { icon: '🍗', label: 'Protein',  value: `${plan.protein}g`, note: '~20% energy' },
                  { icon: '🥑', label: 'Fat',      value: `${plan.fat}g`,     note: '~30% energy' },
                ].map(m => (
                  <div key={m.label} style={{ display: 'flex', justifyContent: 'space-between',
                    alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 13, color: th.sub }}>
                      {m.icon} <strong>{m.label}</strong>
                    </span>
                    <span style={{ fontSize: 13, fontWeight: 700, color: th.text }}>{m.value}</span>
                  </div>
                ))}
              </div>

              <div style={card({ padding: '14px 16px', borderLeft: '3px solid #A855F7' })}>
                <div style={{ fontSize: 11, fontWeight: 700, color: th.muted,
                  letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
                  ⏱ Timing
                </div>
                <p style={{ fontSize: 13, color: th.sub, lineHeight: 1.6, margin: 0 }}>
                  {plan.timing}
                </p>
              </div>
            </div>

            {/* Recommended foods */}
            <div style={card({ padding: '14px 16px', borderLeft: '3px solid #F97316' })}>
              <div style={{ fontSize: 11, fontWeight: 700, color: th.muted,
                letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
                🍽 Recommended Foods
              </div>
              <div style={{ display: 'grid',
                gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr',
                gap: 6 }}>
                {plan.foods.map((food, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8,
                    padding: '8px 10px', background: th.inputBg,
                    borderRadius: 8, fontSize: 13, color: th.sub }}>
                    <span style={{ color: '#22C55E', fontWeight: 700 }}>✓</span>
                    {food}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
