// Data persistence prefix to avoid cache issues
const DB_NAME = 'lattice_v8_final';

let projects = JSON.parse(localStorage.getItem(DB_NAME)) || [
];

const grid = document.getElementById('project-grid');
const modal = document.getElementById('modal');
const form = document.getElementById('project-form');
const themeBtn = document.getElementById('theme-toggle');

// 1. Theme Logic
function initTheme() {
    const saved = localStorage.getItem('theme_pref') || 'light-theme';
    document.body.className = saved;
}

themeBtn.onclick = () => {
    const isDark = document.body.classList.contains('dark-theme');
    const next = isDark ? 'light-theme' : 'dark-theme';
    document.body.className = next;
    localStorage.setItem('theme_pref', next);
};

// 2. Rendering
function render() {
    const filter = document.querySelector('.pill.active').dataset.filter;
    const query = document.getElementById('search-input').value.toLowerCase();
    
    grid.innerHTML = '';
    
    const filtered = projects.filter(p => {
        const matchesCat = filter === 'all' || p.category === filter;
        const matchesSearch = p.title.toLowerCase().includes(query);
        return matchesCat && matchesSearch;
    });

    filtered.forEach(p => {
        const card = document.createElement('div');
        card.className = 'card';
        card.onclick = () => openDetail(p.id);
        card.innerHTML = `
            <div class="img-frame">
                <img src="${p.img || ''}" class="card-img" onerror="this.src='https://via.placeholder.com/800x600?text=No+Preview'">
            </div>
            <div class="card-info">
                <span class="badge">${p.category}</span>
                <h3>${p.title}</h3>
                <div style="display:flex; gap:12px">
                    <button onclick="event.stopPropagation(); editProj(${p.id})" class="btn-ghost" style="padding:8px 16px; font-size:12px">Edit</button>
                    <button onclick="event.stopPropagation(); deleteProj(${p.id})" class="btn-ghost" style="padding:8px 16px; font-size:12px; color:#ff4444; border-color:transparent">Delete</button>
                </div>
            </div>
        `;
        grid.appendChild(card);
    });
}

// 3. Navigation
function openDetail(id) {
    const p = projects.find(x => x.id === id);
    if(!p) return;
    document.getElementById('detail-img').src = p.img || '';
    document.getElementById('detail-title').innerText = p.title;
    document.getElementById('detail-tag').innerText = p.category;
    document.getElementById('detail-desc').innerText = p.desc || "No description provided.";
    document.getElementById('detail-link').href = p.link;
    document.getElementById('detail-overlay').classList.add('active');
    document.body.style.overflow = 'hidden';
}

function closeDetail() {
    document.getElementById('detail-overlay').classList.remove('active');
    document.body.style.overflow = 'auto';
}

// 4. CRUD logic
window.editProj = (id) => {
    const p = projects.find(x => x.id === id);
    document.getElementById('edit-id').value = p.id;
    document.getElementById('proj-title').value = p.title;
    document.getElementById('proj-img').value = p.img;
    document.getElementById('proj-link').value = p.link;
    document.getElementById('proj-desc').value = p.desc;
    document.getElementById('proj-category').value = p.category;
    modal.classList.add('active');
};

form.onsubmit = (e) => {
    e.preventDefault();
    const id = document.getElementById('edit-id').value;
    const data = {
        id: id ? parseInt(id) : Date.now(),
        title: document.getElementById('proj-title').value,
        img: document.getElementById('proj-img').value,
        link: document.getElementById('proj-link').value,
        desc: document.getElementById('proj-desc').value,
        category: document.getElementById('proj-category').value
    };

    if(id) projects = projects.map(p => p.id === parseInt(id) ? data : p);
    else projects.push(data);

    localStorage.setItem(DB_NAME, JSON.stringify(projects));
    modal.classList.remove('active');
    render();
};

window.deleteProj = (id) => {
    if(confirm("Permanently remove this project from archive?")) {
        projects = projects.filter(p => p.id !== id);
        localStorage.setItem(DB_NAME, JSON.stringify(projects));
        render();
    }
};

// 5. Global Listeners
document.getElementById('search-input').oninput = render;
document.querySelectorAll('.pill').forEach(btn => btn.onclick = () => {
    document.querySelector('.pill.active').classList.remove('active');
    btn.classList.add('active');
    render();
});

document.getElementById('open-modal').onclick = () => {
    form.reset();
    document.getElementById('edit-id').value = '';
    modal.classList.add('active');
};
document.getElementById('close-modal').onclick = () => modal.classList.remove('active');

// Init
initTheme();
render();