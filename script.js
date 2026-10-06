// Project Hub — presentation redesign.
// Existing localStorage keys, project fields, CRUD operations, search, filters and detail navigation are preserved.

const DB_NAME = 'lattice_v8_final';
const THEME_KEY = 'theme_pref';
const LAST_UPDATED_FALLBACK = '06 Oct 2026';

let projects = [];
let lastFocusedElement = null;

const grid = document.getElementById('project-grid');
const modal = document.getElementById('modal');
const form = document.getElementById('project-form');
const themeBtn = document.getElementById('theme-toggle');
const detailOverlay = document.getElementById('detail-overlay');
const searchInput = document.getElementById('search-input');
const loadingScreen = document.getElementById('loading-screen');
const emptyState = document.getElementById('empty-state');
const errorState = document.getElementById('error-state');
const errorMessage = document.getElementById('error-message');
const toastRegion = document.getElementById('toast-region');

const PLACEHOLDER_SVG = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#6366f1"/><stop offset="1" stop-color="#c084fc"/></linearGradient></defs>
  <rect width="1200" height="800" fill="#111118"/>
  <circle cx="940" cy="120" r="300" fill="url(#g)" opacity=".22"/>
  <rect x="80" y="90" width="1040" height="620" rx="34" fill="#fff" opacity=".06"/>
  <text x="100" y="610" fill="#fff" font-family="Arial, sans-serif" font-size="54" font-weight="700">No Preview</text>
  <text x="100" y="660" fill="#a1a1aa" font-family="Arial, sans-serif" font-size="24">Add an image path to this project</text>
</svg>` )}`;

function safeStorageGet(key, fallback = null) {
    try {
        return localStorage.getItem(key) ?? fallback;
    } catch (error) {
        showToast('Browser storage is unavailable. Changes may not persist.', 'error');
        return fallback;
    }
}

function safeStorageSet(key, value) {
    try {
        localStorage.setItem(key, value);
        return true;
    } catch (error) {
        showToast('Could not save changes in browser storage.', 'error');
        return false;
    }
}

function loadProjects() {
    try {
        const raw = safeStorageGet(DB_NAME, '[]');
        const parsed = JSON.parse(raw || '[]');
        if (!Array.isArray(parsed)) throw new Error('Project data is not an array.');
        projects = parsed.filter(p => p && typeof p === 'object');
        return true;
    } catch (error) {
        projects = [];
        showFatalError('The saved project data could not be read. Your existing data was not overwritten.');
        return false;
    }
}

// 1. Theme logic — existing theme preference is preserved.
function initTheme() {
    const saved = safeStorageGet(THEME_KEY, null);
    const systemDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    const next = saved || (systemDark ? 'dark-theme' : 'light-theme');

    document.body.classList.remove('light-theme', 'dark-theme');
    document.body.classList.add(next);
    themeBtn.setAttribute('aria-pressed', next === 'dark-theme');
    themeBtn.title = next === 'dark-theme' ? 'Switch to light theme' : 'Switch to dark theme';
    document.documentElement.style.colorScheme = next === 'dark-theme' ? 'dark' : 'light';
}

themeBtn.addEventListener('click', () => {
    const isDark = document.body.classList.contains('dark-theme');
    const next = isDark ? 'light-theme' : 'dark-theme';

    document.body.classList.remove('light-theme', 'dark-theme');
    document.body.classList.add(next);
    themeBtn.setAttribute('aria-pressed', next === 'dark-theme');
    themeBtn.title = next === 'dark-theme' ? 'Switch to light theme' : 'Switch to dark theme';
    document.documentElement.style.colorScheme = next === 'dark-theme' ? 'dark' : 'light';
    safeStorageSet(THEME_KEY, next);
});

// 2. Rendering
function render() {
    try {
        errorState.hidden = true;

        const activePill = document.querySelector('.pill.active');
        const filter = activePill ? activePill.dataset.filter : 'all';
        const query = (searchInput.value || '').trim().toLowerCase();

        grid.innerHTML = '';

        const filtered = projects.filter(p => {
            const title = String(p.title || '').toLowerCase();
            const description = String(p.desc || '').toLowerCase();
            const category = String(p.category || '');
            const matchesCat = filter === 'all' || category === filter;
            const matchesSearch = !query || title.includes(query) || description.includes(query);
            return matchesCat && matchesSearch;
        });

        updateStats();
        updateResultStatus(filtered.length, query, filter);
        updatePillCounts();

        if (!filtered.length) {
            emptyState.hidden = false;
            return;
        }

        emptyState.hidden = true;

        const fragment = document.createDocumentFragment();

        filtered.forEach((p, index) => {
            const card = document.createElement('article');
            card.className = 'card reveal';
            card.style.setProperty('--delay', `${Math.min(index * 60, 420)}ms`);
            card.tabIndex = 0;
            card.setAttribute('role', 'button');
            card.setAttribute('aria-label', `Open ${p.title || 'project'} details`);

            const imgFrame = document.createElement('div');
            imgFrame.className = 'img-frame';

            const image = document.createElement('img');
            image.src = p.img || PLACEHOLDER_SVG;
            image.alt = `${p.title || 'Project'} preview`;
            image.className = 'card-img';
            image.loading = 'lazy';
            image.decoding = 'async';
            image.addEventListener('error', () => {
                if (image.src !== PLACEHOLDER_SVG) {
                    image.src = PLACEHOLDER_SVG;
                    showToast(`Preview unavailable for “${p.title || 'project'}”.`, 'error');
                }
            }, { once: true });

            const imageOverlay = document.createElement('div');
            imageOverlay.className = 'image-overlay';
            imageOverlay.innerHTML = '<span>View project <b>↗</b></span>';

            imgFrame.append(image, imageOverlay);

            const info = document.createElement('div');
            info.className = 'card-info';

            const topLine = document.createElement('div');
            topLine.className = 'card-topline';

            const badge = document.createElement('span');
            badge.className = 'badge';
            badge.textContent = p.category || 'Project';

            const arrow = document.createElement('span');
            arrow.className = 'card-arrow';
            arrow.textContent = '↗';
            arrow.setAttribute('aria-hidden', 'true');

            topLine.append(badge, arrow);

            const title = document.createElement('h3');
            title.textContent = p.title || 'Untitled project';

            const desc = document.createElement('p');
            desc.className = 'card-desc';
            desc.textContent = p.desc || 'No description provided.';

            const actions = document.createElement('div');
            actions.className = 'card-actions';

            const editBtn = document.createElement('button');
            editBtn.className = 'btn-ghost btn-small';
            editBtn.type = 'button';
            editBtn.textContent = 'Edit';
            editBtn.addEventListener('click', event => {
                event.stopPropagation();
                editProj(p.id);
            });

            const deleteBtn = document.createElement('button');
            deleteBtn.className = 'btn-delete';
            deleteBtn.type = 'button';
            deleteBtn.textContent = 'Delete';
            deleteBtn.addEventListener('click', event => {
                event.stopPropagation();
                deleteProj(p.id);
            });

            actions.append(editBtn, deleteBtn);
            info.append(topLine, title, desc, actions);
            card.append(imgFrame, info);

            card.addEventListener('click', () => openDetail(p.id));
            card.addEventListener('keydown', event => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    openDetail(p.id);
                }
            });

            fragment.appendChild(card);
        });

        grid.appendChild(fragment);
    } catch (error) {
        console.error(error);
        showFatalError('The project list could not be rendered. Please try again.');
    }
}

function updateStats() {
    document.getElementById('project-count').textContent = projects.length;
    document.getElementById('category-count').textContent = new Set(projects.map(p => p.category).filter(Boolean)).size;
}

function updatePillCounts() {
    const counts = {
        all: projects.length,
        Web: projects.filter(p => p.category === 'Web').length,
        Apps: projects.filter(p => p.category === 'Apps').length
    };

    document.querySelectorAll('.pill-count').forEach(el => {
        el.textContent = counts[el.dataset.count] ?? 0;
    });
}

function updateResultStatus(count, query, filter) {
    const status = document.getElementById('results-status');
    if (!query && filter === 'all') {
        status.textContent = `${count} ${count === 1 ? 'project' : 'projects'} in the archive`;
        return;
    }

    const bits = [`${count} result${count === 1 ? '' : 's'}`];
    if (filter !== 'all') bits.push(filter);
    if (query) bits.push(`matching “${query}”`);
    status.textContent = bits.join(' · ');
}

// 3. Navigation / detail view
function openDetail(id) {
    const p = projects.find(x => x.id === id);
    if (!p) {
        showToast('That project could not be found.', 'error');
        return;
    }

    lastFocusedElement = document.activeElement;

    const detailImg = document.getElementById('detail-img');
    detailImg.src = p.img || PLACEHOLDER_SVG;
    detailImg.alt = `${p.title || 'Project'} preview`;
    detailImg.onerror = () => {
        detailImg.src = PLACEHOLDER_SVG;
    };

    document.getElementById('detail-title').textContent = p.title || 'Untitled project';
    document.getElementById('detail-tag').textContent = p.category || 'Project';
    document.getElementById('detail-desc').textContent = p.desc || 'No description provided.';

    const link = document.getElementById('detail-link');
    link.href = p.link || '#';
    link.setAttribute('aria-disabled', p.link ? 'false' : 'true');

    detailOverlay.classList.add('active');
    detailOverlay.setAttribute('aria-hidden', 'false');
    document.body.classList.add('no-scroll');

    requestAnimationFrame(() => document.querySelector('.close-detail')?.focus());
}

function closeDetail() {
    detailOverlay.classList.remove('active');
    detailOverlay.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('no-scroll');
    lastFocusedElement?.focus?.();
}

// 4. CRUD logic — data shape and localStorage key remain unchanged.
window.editProj = (id) => {
    const p = projects.find(x => x.id === id);
    if (!p) {
        showToast('Project not found.', 'error');
        return;
    }

    document.getElementById('edit-id').value = p.id;
    document.getElementById('proj-title').value = p.title || '';
    document.getElementById('proj-img').value = p.img || '';
    document.getElementById('proj-link').value = p.link || '';
    document.getElementById('proj-desc').value = p.desc || '';
    document.getElementById('proj-category').value = p.category || 'Web';
    document.getElementById('modal-title').textContent = 'Edit project';
    clearFormError();
    openModal();
};

form.addEventListener('submit', (e) => {
    e.preventDefault();
    clearFormError();

    const title = document.getElementById('proj-title').value.trim();
    const link = document.getElementById('proj-link').value.trim();

    if (!title || !link) {
        showFormError('Project name and target URL are required.');
        return;
    }

    try {
        const id = document.getElementById('edit-id').value;
        const data = {
            id: id ? parseInt(id, 10) : Date.now(),
            title,
            img: document.getElementById('proj-img').value.trim(),
            link,
            desc: document.getElementById('proj-desc').value.trim(),
            category: document.getElementById('proj-category').value
        };

        if (id) projects = projects.map(p => p.id === parseInt(id, 10) ? data : p);
        else projects.push(data);

        if (!safeStorageSet(DB_NAME, JSON.stringify(projects))) {
            throw new Error('Storage write failed.');
        }

        closeModal();
        render();
        showToast(id ? 'Project updated successfully.' : 'Project added successfully.', 'success');
    } catch (error) {
        console.error(error);
        showFormError('The project could not be saved. Please try again.');
    }
});

window.deleteProj = (id) => {
    const project = projects.find(p => p.id === id);
    if (!project) return;

    if (confirm(`Permanently remove “${project.title || 'this project'}” from the archive?`)) {
        projects = projects.filter(p => p.id !== id);
        if (safeStorageSet(DB_NAME, JSON.stringify(projects))) {
            render();
            showToast('Project removed from the archive.', 'success');
        }
    }
};

// 5. Modal logic
function openModal() {
    modal.classList.add('active');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('no-scroll');
    setTimeout(() => document.getElementById('proj-title').focus(), 50);
}

function closeModal() {
    modal.classList.remove('active');
    modal.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('no-scroll');
    document.getElementById('modal-title').textContent = 'Add a project';
    clearFormError();
}

// Hidden project-creation command. Change this word if you want a different secret shortcut.
const SECRET_COMMAND = 'addproject';
let commandBuffer = '';
let commandTimer = null;

function openAddProjectModal() {
    form.reset();
    document.getElementById('edit-id').value = '';
    document.getElementById('modal-title').textContent = 'Add a project';
    clearFormError();
    openModal();
}

document.addEventListener('keydown', event => {
    // Do not intercept normal typing inside form fields or editable elements.
    const tag = document.activeElement?.tagName;
    const isTyping = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || document.activeElement?.isContentEditable;
    if (isTyping || event.ctrlKey || event.metaKey || event.altKey) return;
    if (event.key.length !== 1) return;

    commandBuffer += event.key.toLowerCase();
    if (commandBuffer.length > SECRET_COMMAND.length) {
        commandBuffer = commandBuffer.slice(-SECRET_COMMAND.length);
    }

    clearTimeout(commandTimer);
    commandTimer = setTimeout(() => { commandBuffer = ''; }, 1400);

    if (commandBuffer === SECRET_COMMAND) {
        commandBuffer = '';
        clearTimeout(commandTimer);
        openAddProjectModal();
    }
});

document.getElementById('close-modal').addEventListener('click', closeModal);
document.getElementById('modal-close-icon').addEventListener('click', closeModal);

modal.addEventListener('click', event => {
    if (event.target === modal) closeModal();
});

detailOverlay.addEventListener('click', event => {
    if (event.target === detailOverlay) closeDetail();
});

function showFormError(message) {
    const el = document.getElementById('form-error');
    el.textContent = message;
    el.hidden = false;
}

function clearFormError() {
    const el = document.getElementById('form-error');
    el.textContent = '';
    el.hidden = true;
}

// 6. Search / filters
searchInput.addEventListener('input', render);

document.querySelectorAll('.pill').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelector('.pill.active')?.classList.remove('active');
        btn.classList.add('active');
        render();
    });
});

document.getElementById('clear-search').addEventListener('click', () => {
    searchInput.value = '';
    document.querySelector('.pill.active')?.classList.remove('active');
    document.querySelector('.pill[data-filter="all"]').classList.add('active');
    render();
    searchInput.focus();
});

document.getElementById('retry-render').addEventListener('click', () => {
    errorState.hidden = true;
    loadProjects();
    render();
});

document.addEventListener('keydown', event => {
    if (event.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        event.preventDefault();
        searchInput.focus();
    }

    if (event.key === 'Escape') {
        if (modal.classList.contains('active')) closeModal();
        else if (detailOverlay.classList.contains('active')) closeDetail();
        closeMobileMenu();
    }
});

// 7. Mobile menu
const mobileMenuToggle = document.getElementById('mobile-menu-toggle');
const mobileMenu = document.getElementById('mobile-menu');

function closeMobileMenu() {
    mobileMenu.classList.remove('active');
    mobileMenu.setAttribute('aria-hidden', 'true');
    mobileMenuToggle.setAttribute('aria-expanded', 'false');
    mobileMenuToggle.setAttribute('aria-label', 'Open menu');
}

mobileMenuToggle.addEventListener('click', () => {
    const open = mobileMenu.classList.toggle('active');
    mobileMenu.setAttribute('aria-hidden', String(!open));
    mobileMenuToggle.setAttribute('aria-expanded', String(open));
    mobileMenuToggle.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
});

mobileMenu.querySelectorAll('a').forEach(link => link.addEventListener('click', closeMobileMenu));

// 8. Toasts / errors
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.innerHTML = `<span class="toast-icon">${type === 'error' ? '!' : '✓'}</span><span></span>`;
    toast.querySelector('span:last-child').textContent = message;
    toastRegion.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add('show'));
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, 3600);
}

function showFatalError(message) {
    errorMessage.textContent = message;
    errorState.hidden = false;
}

// 9. Footer date
function initFooterMeta() {
    document.getElementById('current-year').textContent = new Date().getFullYear();

    const parsed = new Date(document.lastModified);
    if (!Number.isNaN(parsed.getTime()) && parsed.getFullYear() > 2000) {
        document.getElementById('last-updated').textContent = parsed.toLocaleDateString(undefined, {
            day: '2-digit',
            month: 'short',
            year: 'numeric'
        });
    } else {
        document.getElementById('last-updated').textContent = LAST_UPDATED_FALLBACK;
    }
}

// 10. Init
(function init() {
    initTheme();
    initFooterMeta();

    setTimeout(() => {
        loadProjects();
        render();
        loadingScreen.classList.add('loaded');
        setTimeout(() => loadingScreen.remove(), 500);
    }, 220);
})();
