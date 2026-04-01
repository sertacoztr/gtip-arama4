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

  const prompt = `GTİP kodu: ${code}
Ürün: ${desc}

SADECE aşağıdaki JSON formatında yanıt ver, başka hiçbir şey yazma:
{
  "vergi_ab": "AB ithalat vergisi oranı (örn: %0)",
  "vergi_diger": "Diğer ülkeler vergisi (örn: %10)",
  "kdv": "KDV oranı (örn: %18)",
  "ek_vergi": "Ek yük varsa kısa açıkla, yoksa boş string",
  "ulkeler": [
    ["🇩🇪 Almanya", 28, 4.2],
    ["🇨🇳 Çin", 15, 2.1]
  ],
  "alicilar": [
    {"firma": "Firma Adı", "ulke": "🇩🇪 Almanya", "sektor": "Otomotiv"},
    {"firma": "Firma Adı", "ulke": "🇺🇸 ABD", "sektor": "Teknoloji"}
  ]
}

ulkeler: Türkiye'nin bu GTİP'ten en fazla ithalat yaptığı 10 ülke.
  - Her kayıt: [bayrak+ülke adı, pazar payı yüzdesi, tahmini ithalat hacmi milyar USD]
  - Toplam yüzde ~100 olsun
  - Hacim değerleri gerçekçi olsun (örn küçük ürünler için 0.1, büyük sektörler için 5.0)

alicilar: Bu GTİP'e ait ürünü Türkiye'den veya küresel olarak satın alan 10 potansiyel yabancı alıcı firma/kuruluş.
  - Gerçek veya gerçeğe yakın firma isimleri kullan
  - Ülke bayrağı emoji + ülke adı yaz
  - Sektör/faaliyet alanını kısaca belirt`;

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
        max_tokens: 800,
        system: "Türkiye GTİP ve dış ticaret uzmanısın. SADECE geçerli JSON döndür, başka hiçbir şey yazma.",
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const data = await r.json();
    if (data.error) return res.status(500).json({ error: data.error.message });
    const txt = data.content[0].text.replace(/```json|```/g, "").trim();
    const m = txt.match(/\{[\s\S]*\}/);
    if (!m) return res.status(500).json({ error: "JSON parse hatası: " + txt.slice(0, 80) });
    return res.status(200).json(JSON.parse(m[0]));
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
