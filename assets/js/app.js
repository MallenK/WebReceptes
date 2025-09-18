// ===== Config =====
const VERSION = '1.0.0'; // súbelo si cambias recetas.json para forzar recarga
const API_URL = "https://web-receptes.vercel.app/api/add-recipe";

// ===== Fallback por si el fetch falla en local o sin conexión =====
const FALLBACK_DEFAULTS = [
  {
    id: 'fallback-carbonara',
    title: 'Pasta carbonara con nata',
    image: 'https://via.placeholder.com/800x500?text=Receta',
    category: 'Pastas', difficulty: 'Fácil', time: 20,
    tags: ['rápido'], ingredients: ['pasta','bacon','nata','yema','queso'], steps: ['Cuece','Salsa','Mezcla']
  }
];

// ===== Estado =====
const $ = s => document.querySelector(s);
const LS_KEYS = { user: 'sg_recipes_user', fav: 'sg_recipes_favs' };

const state = {
  recipes: [],
  favs: new Set(JSON.parse(localStorage.getItem(LS_KEYS.fav) || '[]')),
  q: '', cat: '', diff: '', onlyFav: false
};

// ===== Utilidades de datos =====
async function fetchDefaults() {
  try {
    const url = `assets/data/recetas.json?v=${encodeURIComponent(VERSION)}`;
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error(res.status + ' ' + res.statusText);
    const json = await res.json();
    if (!Array.isArray(json)) throw new Error('JSON raíz no es array');
    return json;
  } catch (e) {
    console.warn('Usando fallback por error cargando recetas.json:', e.message);
    return FALLBACK_DEFAULTS;
  }
}

function loadRecipes(defaults) {
  const user = JSON.parse(localStorage.getItem(LS_KEYS.user) || '[]');
  // merge por id, prioriza usuario
  const map = new Map((defaults || []).map(r => [r.id, r]));
  for (const r of user) {
    map.set(r.id || crypto.randomUUID(), { ...r, id: r.id || crypto.randomUUID() });
  }
  state.recipes = [...map.values()];
}
function saveUserRecipes(list) {
  localStorage.setItem(LS_KEYS.user, JSON.stringify(list));
}
function persistFavs() {
  localStorage.setItem(LS_KEYS.fav, JSON.stringify([...state.favs]));
}

// ===== Render =====
const grid = $('#grid');
function render() {
  const q = state.q.toLowerCase();
  const filtered = state.recipes.filter(r => {
    const matchQ = !q || r.title.toLowerCase().includes(q) || (r.ingredients||[]).some(i => i.toLowerCase().includes(q));
    const matchCat = !state.cat || r.category === state.cat;
    const matchDiff = !state.diff || r.difficulty === state.diff;
    const matchFav = !state.onlyFav || state.favs.has(r.id);
    return matchQ && matchCat && matchDiff && matchFav;
  });

  if (!filtered.length) {
    grid.innerHTML = '<div class="muted">Sin resultados. Prueba otros filtros.</div>';
    return;
  }

  grid.innerHTML = filtered.map(r => `
    <article class="card" aria-label="Receta ${r.title}">
      <img class="thumb"
           src="${r.image || 'https://via.placeholder.com/800x500?text=Receta'}"
           alt="${r.title}"
           loading="lazy"
           decoding="async"
           sizes="(max-width: 600px) 100vw, (max-width: 1024px) 50vw, 33vw">
      <div class="card-body">
        <h3 class="title-sm">${r.title}</h3>
        <div class="row">
          <span class="pill">🍽️ ${r.category || '—'}</span>
          <span class="pill">🧩 ${r.difficulty || '—'}</span>
          <span class="pill">⏱️ ${r.time ?? '—'} min</span>
        </div>
        <div class="tags">${(r.tags || []).map(t => `<span class="tag">#${t}</span>`).join('')}</div>
      </div>
      <div class="card-footer">
        <button class="btn" onclick='openModal(${JSON.stringify(r).replace(/'/g, "&#39;")})'>Ver</button>
        <div class="fav ${state.favs.has(r.id) ? 'active' : ''}" onclick="toggleFav('${r.id}', this)">❤</div>
      </div>
    </article>`).join('');
}

// ===== Modal =====
const modal = $('#recipeModal');
function openModal(r) {
  $('#mTitle').textContent = r.title;
  $('#mImg').src = r.image || 'https://via.placeholder.com/1200x750?text=Receta';
  $('#mImg').loading = 'lazy';
  $('#mImg').decoding = 'async';
  $('#mImg').alt = r.title;
  $('#mCat').textContent = '🍽️ ' + (r.category || '—');
  $('#mDiff').textContent = '🧩 ' + (r.difficulty || '—');
  $('#mTime').textContent = '⏱️ ' + (r.time ?? '—') + ' min';
  $('#mTags').innerHTML = (r.tags || []).map(t => `<span class="tag">#${t}</span>`).join('');
  $('#mIngs').innerHTML = (r.ingredients || []).map(i => `<li>${i}</li>`).join('');
  $('#mSteps').innerHTML = (r.steps || []).map(s => `<li>${s}</li>`).join('');
  modal.showModal();
}

// ===== Favoritos =====
function toggleFav(id, node) {
  if (state.favs.has(id)) state.favs.delete(id); else state.favs.add(id);
  node.classList.toggle('active');
  persistFavs();
}

// ===== Formulario añadir =====
const addForm = document.getElementById('addForm');

// En el submit del formulario
addForm.addEventListener('submit', async e => {
  e.preventDefault();
  const fd = new FormData(addForm);
  const payload = {
    title: fd.get('title'),
    image: fd.get('image'),
    category: fd.get('category'),
    difficulty: fd.get('difficulty'),
    time: fd.get('time'),
    tags: fd.get('tags'),
    ingredients: fd.get('ingredients'),
    steps: fd.get('steps')
  };

  try {
    const resp = await fetch(API_URL, {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify(payload)
    });
    const data = await resp.json();
    if (!resp.ok) throw new Error(data?.error || 'Error guardando');
    await refreshFromJson();           // vuelve a leer assets/data/recetas.json
    addForm.reset();
    window.reload();
  } catch (err) {
    alert(err);
    // fallback localStorage si falla el backend (ya lo tienes)
  }
});


// Recarga el JSON remoto y re-renderiza
async function refreshFromJson() {
  const res = await fetch(`assets/data/recetas.json?cache=${Date.now()}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('No se pudo leer recetas.json');
  const defaults = await res.json();
  window.__defaults__ = defaults;   // cache en memoria
  loadRecipes(defaults);
  render();
}



// ===== Exportar / Importar / Resetear =====
document.getElementById('exportBtn').onclick = () => {
  const user = localStorage.getItem(LS_KEYS.user) || '[]';
  const blob = new Blob([user], { type: 'application/json' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: 'recetas_sg.json' });
  document.body.appendChild(a); a.click(); a.remove();
};
document.getElementById('importFile').onchange = e => {
  const file = e.target.files?.[0]; if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const arr = JSON.parse(ev.target.result);
      if (!Array.isArray(arr)) throw new Error('Formato no válido');
      saveUserRecipes(arr); loadRecipes(window.__defaults__ || []); render(); alert('Datos importados');
    } catch (err) { alert('Error al importar: ' + err.message); }
  };
  reader.readAsText(file);
};
document.getElementById('resetBtn').onclick = () => {
  if (confirm('Esto borrará tus recetas añadidas (no las de ejemplo). ¿Continuar?')) {
    localStorage.removeItem(LS_KEYS.user); loadRecipes(window.__defaults__ || []); render();
  }
};

// ===== Controles de filtro =====
const qEl = document.getElementById('q');
const catEl = document.getElementById('cat');
const diffEl = document.getElementById('diff');
const onlyFavEl = document.getElementById('onlyFav');

qEl.addEventListener('input', () => { state.q = qEl.value; render(); });
catEl.onchange = () => { state.cat = catEl.value; render(); };
diffEl.onchange = () => { state.diff = diffEl.value; render(); };
onlyFavEl.onchange = () => { state.onlyFav = onlyFavEl.checked; render(); };

// ===== Toggle menú móvil (si existe) =====
const menuToggle = document.getElementById('menuToggle');
const mainNav = document.getElementById('mainNav');
if (menuToggle && mainNav) {
  menuToggle.addEventListener('click', () => {
    const isOpen = menuToggle.getAttribute('aria-expanded') === 'true';
    menuToggle.setAttribute('aria-expanded', String(!isOpen));
    mainNav.hidden = isOpen;
  });
}

// ===== Init =====
(async function init(){
  const defaults = await fetchDefaults();
  window.__defaults__ = defaults;       // cache en memoria para merges posteriores
  loadRecipes(defaults);
  render();
})();
