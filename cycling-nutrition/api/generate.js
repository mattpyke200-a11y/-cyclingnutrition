export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { weekSummary } = req.body;
  if (!weekSummary) {
    return res.status(400).json({ error: "weekSummary is required" });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "ANTHROPIC_API_KEY not configured" });
  }

  const prompt = `You are a cycling sports nutritionist. Based on the athlete's weekly training schedule below, create a detailed nutrition plan using ONLY these three products:
1. ESN Pre-Fuel KOM (non-caffeinated) — pre-ride formula with BCAAs, beta-alanine, electrolytes
2. Neversecond C30 Sports Drink Mix (Citrus) — ~30g carbs per serving, for during-ride fueling
3. ESN Re-Fuel NICA (Chocolate) — post-ride recovery with protein and carbs

WEEKLY SCHEDULE:
${weekSummary}

Return a JSON object with this exact structure (no markdown, no backticks, raw JSON only):
{
  "weekSummary": "1-2 sentence overview of the week and main nutritional focus",
  "days": [
    {
      "day": "Monday",
      "rideType": "Rest",
      "products": [],
      "sections": [
        {
          "timing": "Note",
          "items": [
            { "product": "Rest day protocol", "instruction": "brief instruction" }
          ]
        }
      ],
      "proTip": "one practical tip specific to this day"
    }
  ]
}

Rules:
- For sections[].timing use only: "Pre-ride", "During", "Post-ride", or "Note"
- products[] contains only IDs from: "prefuel", "c30", "refuel" — only those used that day
- Rest days: products is empty, sections has one "Note" entry
- Be specific: exact serving sizes, timing windows (e.g. "45 min before"), how many bottles to prepare
- For race days with multiple races, detail between-race fueling in the "During" section
- proTip must be genuinely useful and specific to the day's demands`;

  try {
    const upstream = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4000,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!upstream.ok) {
      const err = await upstream.text();
      console.error("Anthropic API error:", err);
      return res.status(502).json({ error: "Upstream API error" });
    }

    const data = await upstream.json();
    const text = data.content
      ?.map(c => c.text || "")
      .join("")
      .replace(/```json|```/g, "")
      .trim();

    const parsed = JSON.parse(text);
    return res.status(200).json(parsed);
  } catch (e) {
    console.error("Generate error:", e);
    return res.status(500).json({ error: "Failed to generate plan" });
  }
}
