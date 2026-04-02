export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "POST gerekli" });

  const { code, desc } = req.body || {};
  if (!code) return res.status(400).json({ error: "code eksik" });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "ANTHROPIC_API_KEY eksik." });

  const prompt = `GTİP: ${code} / Urun: ${desc}

YALNIZCA asagidaki JSON formatini doldur, baska hicbir sey yazma, markdown kullanma:

{
  "vergi_ab": "ornek: %0",
  "vergi_diger": "ornek: %10",
  "kdv": "ornek: %18",
  "ek_vergi": "",
  "ihracat_ulkeler": [
    {"ulke": "Almanya", "pay": 18, "hacim_milyon_usd": 245, "turkiye_gumruk": "%0"},
    {"ulke": "ABD", "pay": 14, "hacim_milyon_usd": 190, "turkiye_gumruk": "%2.5"}
  ],
  "musteriler": [
    {"firma": "Firma Adi", "ulke": "Almanya", "sektor": "Sektor", "aciklama": "Aciklama"},
    {"firma": "Firma Adi", "ulke": "ABD", "sektor": "Sektor", "aciklama": "Aciklama"}
  ]
}

Kurallar:
- ihracat_ulkeler: Turkiye nin bu GTIPten en cok IHRAC ETTIGI 10 ulke. pay toplami ~100 olsun. hacim_milyon_usd gercekci olsun. turkiye_gumruk o ulkenin Turkiye menseili urune uygulattigi vergi orani.
- musteriler: Bu urunu Turkiye den alabilecek 10 GERCEK yabanci firma. ITC Trademap ve sektor rehberlerine gore sec. aciklama kisaca neden potansiyel alici oldugunu belirt.
- Bayrak emoji kullan ulke isimlerinin basina.
- Sadece JSON, hicbir aciklama ekleme.`;

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
        max_tokens: 1500,
        system: "Sen Turkiye dis ticaret ve GTİP uzmanisın. SADECE gecerli JSON dondur, baska hicbir sey yazma, markdown yok, kod blogu yok.",
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const data = await r.json();
    if (data.error) return res.status(500).json({ error: data.error.message });
    const txt = data.content[0].text.replace(/```json|```/g, "").trim();
    const m = txt.match(/\{[\s\S]*\}/);
    if (!m) return res.status(500).json({ error: "JSON bulunamadi: " + txt.slice(0, 100) });
    return res.status(200).json(JSON.parse(m[0]));
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
