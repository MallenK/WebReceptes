
// ===== Recetas de ejemplo =====
const defaultRecipes = [
  {
    id: 'carbonara-nata',
    title: 'Pasta carbonara con nata',
    image: 'https://images.unsplash.com/photo-1523986371872-9d3ba2e2f642?q=80&w=1280&auto=format&fit=crop',
    category: 'Pastas', difficulty: 'Fácil', time: 20,
    tags: ['rápido','sartén'],
    ingredients: [
      '200 g de pasta', '120 g de bacon', '200 ml de nata', '1 yema',
      'Queso rallado', 'Sal y pimienta'
    ],
    steps: [
      'Cuece la pasta al dente.',
      'Dora el bacon. Añade nata y pimienta. Aparta del fuego.',
      'Mezcla con la pasta y liga con la yema. Añade queso.'
    ]
  },
  {
    id: 'pollo-curry',
    title: 'Pollo al curry fácil',
    image: 'https://images.unsplash.com/photo-1617195737492-7e0b9f37f1b7?q=80&w=1280&auto=format&fit=crop',
    category: 'Carnes', difficulty: 'Media', time: 35,
    tags: ['arroz','salsa'],
    ingredients: [
      '400 g de pechuga de pollo', '1 cebolla', '200 ml de leche de coco',
      '1 cda curry', 'Aceite', 'Sal'
    ],
    steps: [
      'Sofríe cebolla picada.',
      'Añade pollo en dados y dora.',
      'Agrega curry y leche de coco. Cocina 15 min.'
    ]
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

// ===== Carga y guardado =====
function loadRecipes() {
  const user = JSON.parse(localStorage.getItem(LS_KEYS.user) || '[]');
  const map = new Map(defaultRecipes.map(r => [r.id, r]));
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
    const matchQ = !q || r.title.toLowerCase().includes(q) || r.ingredients.some(i => i.toLowerCase().includes(q));
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
      <img class="thumb" src="${r.image || 'https://via.placeholder.com/400x250?text=Sin+imagen'}" alt="${r.title}">
      <div class="card-body">
        <h3 class="title-sm">${r.title}</h3>
        <div class="row">
          <span class="pill">🍽️ ${r.category}</span>
          <span class="pill">🧩 ${r.difficulty}</span>
          <span class="pill">⏱️ ${r.time} min</span>
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
  $('#mImg').src = r.image || 'https://via.placeholder.com/400x250?text=Sin+imagen';
  $('#mImg').alt = r.title;
  $('#mCat').textContent = '🍽️ ' + r.category;
  $('#mDiff').textContent = '🧩 ' + r.difficulty;
  $('#mTime').textContent = '⏱️ ' + r.time + ' min';
  $('#mTags').innerHTML = (r.tags || []).map(t => `<span class="tag">#${t}</span>`).join('');
  $('#mIngs').innerHTML = r.ingredients.map(i => `<li>${i}</li>`).join('');
  $('#mSteps').innerHTML = r.steps.map(s => `<li>${s}</li>`).join('');
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
addForm.addEventListener('submit', e => {
  e.preventDefault();
  const fd = new FormData(addForm);
  const rec = {
    id: crypto.randomUUID(),
    title: fd.get('title').trim(),
    image: fd.get('image').trim(),
    category: fd.get('category').trim() || 'Sin categoría',
    difficulty: fd.get('difficulty'),
    time: Number(fd.get('time') || 0) || 0,
    tags: (fd.get('tags') || '').split(',').map(s => s.trim()).filter(Boolean),
    ingredients: (fd.get('ingredients') || '').split('\n').map(s => s.trim()).filter(Boolean),
    steps: (fd.get('steps') || '').split('\n').map(s => s.trim()).filter(Boolean)
  };
  const user = JSON.parse(localStorage.getItem(LS_KEYS.user) || '[]');
  user.push(rec);
  saveUserRecipes(user);
  loadRecipes();
  render();
  addForm.reset();
  alert('Receta guardada en este navegador.');
});

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
      saveUserRecipes(arr); loadRecipes(); render(); alert('Datos importados');
    } catch (err) { alert('Error al importar: ' + err.message); }
  };
  reader.readAsText(file);
};
document.getElementById('resetBtn').onclick = () => {
  if (confirm('Esto borrará tus recetas añadidas (no las de ejemplo). ¿Continuar?')) {
    localStorage.removeItem(LS_KEYS.user); loadRecipes(); render();
  }
};

// ===== Controles de filtro =====
$('#q').addEventListener('input', () => { state.q = q.value; render(); });
$('#cat').onchange = () => { state.cat = cat.value; render(); };
$('#diff').onchange = () => { state.diff = diff.value; render(); };
$('#onlyFav').onchange = () => { state.onlyFav = onlyFav.checked; render(); };

document.getElementById('ghHint').onclick = e => {
  e.preventDefault();
  alert('Sube este archivo como index.html a un repo público y activa Settings → Pages → Deploy from branch.');
};

// ===== Init =====
loadRecipes();
render();
