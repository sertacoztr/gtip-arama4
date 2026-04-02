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

Sen Türkiye dış ticaret uzmanısın. ITC Trademap, TÜİK ve gümrük mevzuatı verilerini biliyorsun.

SADECE aşağıdaki JSON formatında yanıt ver, başka hiçbir şey yazma:
{
  "vergi_ab": "AB ülkelerinden Türkiye'ye ithalattaki gümrük vergisi (örn: %0)",
  "vergi_diger": "AB dışı ülkelerden Türkiye'ye ithalattaki genel gümrük vergisi (örn: %10)",
  "kdv": "Türkiye KDV oranı (örn: %18)",
  "ek_vergi": "Varsa ek mali yük (antidamping, fon vb.), yoksa boş string",
  "ihracat_ulkeler": [
    {
      "ulke": "🇩🇪 Almanya",
      "pay": 18,
      "hacim_milyon_usd": 245,
      "turkiye_gumruk": "Türkiye menşeli ürün için bu ülkedeki gümrük vergisi (örn: %0 AB-Türkiye GTB)"
    }
  ],
  "musteriler": [
    {
      "firma": "Gerçek firma adı",
      "ulke": "🇩🇪 Almanya",
      "sektor": "Sektör/faaliyet",
      "aciklama": "Bu firmayı neden potansiyel alıcı olarak öneriyorsun"
    }
  ]
}

ihracat_ulkeler: Türkiye'nin bu GTİP kodundaki ürünü en fazla İHRAÇ ETTİĞİ top 10 ülke.
  - pay: Türkiye'nin toplam ihracatındaki yüzde payı (toplam ~100)
  - hacim_milyon_usd: Tahmini yıllık ihracat değeri milyon USD olarak (gerçekçi rakamlar)
  - turkiye_gumruk: O ülkenin Türkiye menşeli bu ürüne uyguladığı gümrük vergisi (ticaret anlaşmaları dahil)

musteriler: Bu GTİP ürününü Türkiye'den satın alma potansiyeli olan 10 GERÇEK yabancı firma/şirket.
  - ITC Trademap, sektör rehberleri ve küresel tedarik zinciri bilgine dayanarak öner
  - Gerçek, bilinen firma isimleri kullan
  - Her firmanın neden bu ürünü Türkiye'den alabileceğini kısaca açıkla`;

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
        system: "Sen Türkiye dış ticareti, GTİP kodları ve küresel tedarik zincirleri konusunda uzman bir danışmansın. ITC Trademap, TÜİK ve gümrük verilerini iyi biliyorsun. SADECE geçerli JSON döndür, başka hiçbir şey yazma, markdown kullanma.",
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
