export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST gerekli" });

  const { question } = req.body || {};
  if (!question) return res.status(400).json({ error: "question eksik" });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "ANTHROPIC_API_KEY eksik." });

  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 600,
        system: "Türkiye GTİP ve gümrük uzmanısın. Kısa, net, Türkçe. Markdown kullanma.",
        messages: [{ role: "user", content: question }],
      }),
    });
    const data = await r.json();
    if (data.error) return res.status(500).json({ error: data.error.message });
    return res.status(200).json({ answer: data.content[0].text });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
