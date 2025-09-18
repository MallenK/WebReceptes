// api/add-recipe.js
const OWNER = process.env.OWNER;               // ej. "sergimallen"
const REPO  = process.env.REPO;                // ej. "recetas-sergi-gina"
const PATH  = process.env.FILE_PATH || "assets/data/recetas.json";
const ORIG  = process.env.ALLOW_ORIGIN || "*";
const TOKEN = process.env.GITHUB_TOKEN;        // PAT con Contents: Read/Write
const ALLOW = (process.env.ALLOW_ORIGIN || "").split(",").map(s=>s.trim());

export default async function handler(req, res) {
  const origin = req.headers.origin || "";
  if (ALLOW.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
  }
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (!ALLOW.includes(origin)) return res.status(403).json({ error: "Origin not allowed" });
  
  // CORS
  res.setHeader("Access-Control-Allow-Origin", ORIG);
  res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!TOKEN || !OWNER || !REPO) return res.status(500).json({ error: "Missing env vars" });

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const recipe = normalizeRecipe(body);

    // Lee recetas.json actual
    const url = `https://api.github.com/repos/${OWNER}/${REPO}/contents/${PATH}`;
    const ghHeaders = { Authorization: `token ${TOKEN}`, Accept: "application/vnd.github+json" };
    const getResp = await fetch(url, { headers: ghHeaders });
    if (!getResp.ok) throw new Error(`GET ${PATH} ${getResp.status}`);
    const file = await getResp.json();
    const current = JSON.parse(Buffer.from(file.content, "base64").toString("utf8"));
    if (!Array.isArray(current)) throw new Error("El JSON raíz no es un array");

    // Merge por id
    const map = new Map(current.map(r => [r.id, r]));
    map.set(recipe.id, { ...map.get(recipe.id), ...recipe });
    const updated = [...map.values()];

    // Commit
    const newContent = Buffer.from(JSON.stringify(updated, null, 2), "utf8").toString("base64");
    const putBody = {
      message: `feat(recetas): add/update ${recipe.id}`,
      content: newContent,
      sha: file.sha,
    };

    const putResp = await fetch(url, {
      method: "PUT",
      headers: { ...ghHeaders, "Content-Type": "application/json" },
      body: JSON.stringify(putBody),
    });

    // Si hay conflicto de SHA, reintenta una vez
    if (putResp.status === 409) {
      const refetch = await fetch(url, { headers: ghHeaders });
      const refFile = await refetch.json();
      const retry = await fetch(url, {
        method: "PUT",
        headers: { ...ghHeaders, "Content-Type": "application/json" },
        body: JSON.stringify({ ...putBody, sha: refFile.sha }),
      });
      if (!retry.ok) throw new Error(`PUT retry ${retry.status} ${await retry.text()}`);
      return res.status(200).json({ ok: true, id: recipe.id });
    }

    if (!putResp.ok) throw new Error(`PUT ${putResp.status} ${await putResp.text()}`);
    return res.status(200).json({ ok: true, id: recipe.id });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

function normalizeRecipe(input = {}) {
  const nowId = Date.now().toString(36);
  const title = String(input.title ?? "").trim();
  return {
    id: String(input.id ?? "").trim() || slugify(title || `receta-${nowId}`),
    title: title || "Sin título",
    image: String(input.image ?? "").trim(),
    category: String(input.category ?? "Sin categoría").trim(),
    difficulty: String(input.difficulty ?? "Fácil").trim(),
    time: Number(input.time) || 0,
    tags: toArray(input.tags),
    ingredients: toLines(input.ingredients),
    steps: toLines(input.steps),
  };
}
function toArray(v){ if (Array.isArray(v)) return v.map(s=>String(s).trim()).filter(Boolean); return String(v??"").split(",").map(s=>s.trim()).filter(Boolean); }
function toLines(v){ if (Array.isArray(v)) return v.map(s=>String(s).trim()).filter(Boolean); return String(v??"").split("\n").map(s=>s.trim()).filter(Boolean); }
function slugify(s){ return s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g,"").replace(/[^a-z0-9]+/g,"-").replace(/(^-|-$)/g,""); }
