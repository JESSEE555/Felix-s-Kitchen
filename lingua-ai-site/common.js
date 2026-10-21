/* ===================== THEME ===================== */
// Theme preference is stored in localStorage so it's remembered between pages
// when this site is actually hosted/opened as files. (Falls back silently to
// an in-memory default if storage is unavailable, e.g. in a sandboxed preview.)
function getStoredTheme(){
  try { return localStorage.getItem('lingua-theme'); } catch(e){ return null; }
}
function storeTheme(value){
  try { localStorage.setItem('lingua-theme', value); } catch(e){ /* ignore */ }
}

function applyTheme(theme){
  document.documentElement.setAttribute('data-theme', theme);
  document.querySelectorAll('.theme-toggle .icon').forEach(el => {
    el.textContent = theme === 'dark' ? '☀️' : '🌙';
  });
}

function initTheme(){
  const saved = getStoredTheme();
  const theme = saved || 'light';
  applyTheme(theme);
}

function toggleTheme(){
  const current = document.documentElement.getAttribute('data-theme') === 'dark' ? 'dark' : 'light';
  const next = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  storeTheme(next);
}

/* ===================== STARFIELD ===================== */
function buildStarfield(){
  const host = document.getElementById('bg-stars');
  if(!host || host.childElementCount) return;
  const count = 70;
  const frag = document.createDocumentFragment();
  for(let i = 0; i < count; i++){
    const star = document.createElement('div');
    star.className = 'star';
    const size = (Math.random() * 2 + 1).toFixed(1);
    star.style.width = size + 'px';
    star.style.height = size + 'px';
    star.style.top = (Math.random() * 100).toFixed(2) + '%';
    star.style.left = (Math.random() * 100).toFixed(2) + '%';
    star.style.setProperty('--min-op', (Math.random() * 0.25 + 0.1).toFixed(2));
    star.style.setProperty('--max-op', (Math.random() * 0.4 + 0.6).toFixed(2));
    star.style.animationDuration = (Math.random() * 3 + 2.5).toFixed(2) + 's';
    star.style.animationDelay = (Math.random() * 4).toFixed(2) + 's';
    frag.appendChild(star);
  }
  host.appendChild(frag);
}

/* ===================== NAVBAR SCROLL STATE ===================== */
function initNavbarScroll(){
  const navbar = document.getElementById('navbar');
  if(!navbar) return;
  window.addEventListener('scroll', () => {
    navbar.classList.toggle('scrolled', window.scrollY > 20);
  }, {passive:true});
}

/* ===================== REVEAL ON SCROLL ===================== */
function initRevealOnScroll(){
  const revealEls = document.querySelectorAll('[data-reveal]');
  if(!revealEls.length) return;
  const revealObs = new IntersectionObserver((entries) => {
    entries.forEach(e => {
      if(e.isIntersecting){
        e.target.classList.add('in');
        revealObs.unobserve(e.target);
      }
    });
  }, {threshold:0.15});
  revealEls.forEach(el => revealObs.observe(el));
}

/* ===================== LEARNING JOURNEY ROAD FILL ===================== */
function initJourneyRoads(){
  document.querySelectorAll('.road').forEach(road => {
    const obs = new IntersectionObserver((entries) => {
      entries.forEach(e => { if(e.isIntersecting){ e.target.classList.add('in'); obs.unobserve(e.target); } });
    }, {threshold:0.3});
    obs.observe(road);
  });
}

/* ===================== ANIMATED COUNTERS ===================== */
function animateCount(el){
  const target = parseFloat(el.dataset.count || el.dataset.decimal);
  const isDecimal = el.dataset.decimal !== undefined;
  const suffix = el.dataset.suffix || '';
  const duration = 1600;
  const start = performance.now();
  function tick(now){
    const p = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - p, 3);
    const val = target * eased;
    el.textContent = (isDecimal ? val.toFixed(1) : Math.floor(val).toLocaleString()) + suffix;
    if(p < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}
function initCounters(){
  const counters = document.querySelectorAll('[data-count], [data-decimal]');
  if(!counters.length) return;
  const countObs = new IntersectionObserver((entries) => {
    entries.forEach(e => { if(e.isIntersecting){ animateCount(e.target); countObs.unobserve(e.target); } });
  }, {threshold:0.4});
  counters.forEach(c => countObs.observe(c));
}

/* ===================== SCROLLSPY (nav highlighting) ===================== */
function initScrollspy(){
  const links = Array.from(document.querySelectorAll('.nav-links a[href^="#"]'));
  if(!links.length) return;
  const sections = links
    .map(link => document.getElementById(link.getAttribute('href').slice(1)))
    .filter(Boolean);
  if(!sections.length) return;

  function setActive(id){
    links.forEach(link => link.classList.toggle('active', link.getAttribute('href') === '#' + id));
  }

  // Picks whichever section's top has most recently scrolled past a fixed
  // line near the top of the viewport (just under the floating navbar) —
  // simpler and more deterministic than observer-entry ordering.
  function updateActive(){
    const triggerLine = 140;
    let current = sections[0];
    for(const section of sections){
      if(section.getBoundingClientRect().top <= triggerLine) current = section;
    }
    setActive(current.id);
  }

  window.addEventListener('scroll', updateActive, { passive: true });
  updateActive();
}

/* ===================== INIT ===================== */
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  buildStarfield();
  initNavbarScroll();
  initRevealOnScroll();
  initJourneyRoads();
  initCounters();
  initScrollspy();
  document.querySelectorAll('.theme-toggle').forEach(btn => {
    btn.addEventListener('click', toggleTheme);
  });
});
