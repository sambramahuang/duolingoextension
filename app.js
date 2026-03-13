// ===== Duolingo Creator Studio — App Logic =====

// ===== Navigation =====
document.querySelectorAll('.nav-item').forEach(link => {
  link.addEventListener('click', e => {
    e.preventDefault();
    const page = link.dataset.page;
    document.querySelectorAll('.nav-item').forEach(l => l.classList.remove('active'));
    link.classList.add('active');
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById(`page-${page}`).classList.add('active');
  });
});

// ===== Drop Zone =====
const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('video-file');
const fileSelected = document.getElementById('file-selected');
const videoPreview = document.getElementById('video-preview');

dropZone.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('dragover'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
});

fileInput.addEventListener('change', () => {
  if (fileInput.files.length) handleFile(fileInput.files[0]);
});

document.getElementById('btn-change-file').addEventListener('click', () => {
  fileInput.value = '';
  fileSelected.classList.add('hidden');
  dropZone.style.display = '';
  videoPreview.src = '';
});

function handleFile(file) {
  if (!file.type.startsWith('video/')) {
    alert('Please upload a video file.');
    return;
  }
  document.getElementById('selected-file-name').textContent = file.name;
  document.getElementById('selected-file-size').textContent = (file.size / (1024 * 1024)).toFixed(1) + ' MB';

  const url = URL.createObjectURL(file);
  videoPreview.src = url;

  dropZone.style.display = 'none';
  fileSelected.classList.remove('hidden');
}

// ===== Tags =====
const tags = document.querySelectorAll('.tag');
let selectedTags = [];

tags.forEach(tag => {
  tag.addEventListener('click', () => {
    const val = tag.dataset.tag;
    if (tag.classList.contains('selected')) {
      tag.classList.remove('selected');
      selectedTags = selectedTags.filter(t => t !== val);
    } else if (selectedTags.length < 3) {
      tag.classList.add('selected');
      selectedTags.push(val);
    }
  });
});

// ===== Live Preview Updates =====
const titleInput = document.getElementById('video-title');
const langSelect = document.getElementById('video-language');
const levelSelect = document.getElementById('video-level');

titleInput.addEventListener('input', () => {
  document.getElementById('preview-title').textContent = titleInput.value || 'Your video title appears here';
});

langSelect.addEventListener('change', () => {
  document.getElementById('preview-lang').textContent = langSelect.options[langSelect.selectedIndex].text;
});

levelSelect.addEventListener('change', () => {
  document.getElementById('preview-level').textContent = levelSelect.value;
});

// ===== Form Submit — Mock Analysis =====
document.getElementById('video-details-form').addEventListener('submit', e => {
  e.preventDefault();

  const title = titleInput.value.trim();
  const hasFile = fileInput.files.length > 0;

  if (!title) {
    alert('Please add a title for your video.');
    return;
  }

  if (!hasFile) {
    alert('Please upload a video file.');
    return;
  }

  runMockAnalysis(title);
});

function runMockAnalysis(title) {
  const btn = document.getElementById('btn-publish');
  btn.textContent = 'Analyzing...';
  btn.disabled = true;

  setTimeout(() => {
    const result = generateScore(title);
    displayScore(result);
    btn.textContent = 'Upload & Score My Video';
    btn.disabled = false;
  }, 1500 + Math.random() * 1000);
}

function generateScore(title) {
  const seed = hashStr(title);
  const clarity = clamp(60 + seeded(seed, 1) * 38, 0, 100);
  const subtitles = document.getElementById('has-subtitles').checked ? clamp(70 + seeded(seed, 2) * 28, 0, 100) : clamp(30 + seeded(seed, 2) * 30, 0, 100);
  const vocab = clamp(55 + seeded(seed, 3) * 40, 0, 100);
  const speed = document.getElementById('slow-speech').checked ? clamp(75 + seeded(seed, 4) * 20, 0, 100) : clamp(50 + seeded(seed, 4) * 40, 0, 100);
  const repetition = clamp(40 + seeded(seed, 5) * 50, 0, 100);
  const slang = clamp(seeded(seed, 6) * 30, 0, 100);

  const total = Math.round(
    clarity * 0.30 + subtitles * 0.20 + vocab * 0.20 + speed * 0.15 + repetition * 0.10 - slang * 0.05
  );
  const score = clamp(total, 0, 100);

  let label, tier;
  if (score >= 85) { label = 'Excellent — Ready to publish'; tier = 'excellent'; }
  else if (score >= 70) { label = 'Good — Minor improvements possible'; tier = 'good'; }
  else if (score >= 50) { label = 'Needs Work — See suggestions below'; tier = 'okay'; }
  else { label = 'Low Score — Consider re-recording'; tier = 'poor'; }

  // Pick strengths & suggestions
  const strengths = pickRandom(STRENGTH_POOL, 3, seed);
  const suggestions = pickRandom(SUGGESTION_POOL, 3, seed + 99);

  const lang = langSelect.options[langSelect.selectedIndex].text;
  const level = levelSelect.value;
  const estimatedReach = Math.round(2000 + score * 150 + seeded(seed, 7) * 5000);

  return { score, label, tier, clarity, subtitles, vocab, speed, repetition, slang, strengths, suggestions, lang, level, estimatedReach, title };
}

function displayScore(r) {
  const section = document.getElementById('score-result');
  section.classList.remove('hidden');
  section.scrollIntoView({ behavior: 'smooth', block: 'start' });

  // Score orb
  const orb = document.getElementById('score-orb');
  orb.className = 'score-orb';
  if (r.tier === 'good') orb.classList.add('good');
  else if (r.tier === 'okay') orb.classList.add('okay');
  else if (r.tier === 'poor') orb.classList.add('poor');

  animateNumber(document.getElementById('score-num'), 0, r.score, 1200);
  document.getElementById('score-title').textContent = r.label;
  document.getElementById('score-subtitle').textContent = `${r.lang} · ${r.level} Level · ${r.title}`;

  // Metrics
  const metrics = [
    { label: 'Speech Clarity', value: r.clarity },
    { label: 'Subtitle Quality', value: r.subtitles },
    { label: 'Vocabulary Fit', value: r.vocab },
    { label: 'Speaking Speed', value: r.speed },
    { label: 'Repetition', value: r.repetition },
  ];

  document.getElementById('score-metrics').innerHTML = metrics.map(m => `
    <div class="score-metric-card">
      <div class="metric-label">${m.label}</div>
      <div class="metric-value">${Math.round(m.value)}%</div>
      <div class="metric-bar-bg">
        <div class="metric-bar-fill" style="width: 0%"></div>
      </div>
    </div>
  `).join('');

  // Animate bars
  requestAnimationFrame(() => {
    document.querySelectorAll('.metric-bar-fill').forEach((bar, i) => {
      bar.style.width = Math.round(metrics[i].value) + '%';
    });
  });

  // Strengths & suggestions
  document.getElementById('score-strengths').innerHTML = r.strengths.map(s => `<li>${s}</li>`).join('');
  document.getElementById('score-suggestions').innerHTML = r.suggestions.map(s => `<li>${s}</li>`).join('');

  // Reach estimate
  document.getElementById('score-reach').innerHTML = `
    Based on this score, your video could reach an estimated <strong>${r.estimatedReach.toLocaleString()}</strong>
    ${r.lang} learners at the ${r.level} level.
    ${r.score >= 85 ? 'This video qualifies for the Featured Creators playlist.' :
      r.score >= 70 ? 'Improve subtitle quality or add slow-speech to unlock Featured placement.' :
      'Focus on the suggestions above to increase your reach.'}
  `;
}

// ===== Confirm Publish =====
document.getElementById('btn-confirm-publish').addEventListener('click', () => {
  alert('Video published to Duolingo! (This is a demo — no real upload occurred.)');
});

document.getElementById('btn-edit-resubmit').addEventListener('click', () => {
  document.getElementById('score-result').classList.add('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
});

// ===== My Videos Page =====
function renderMyVideos() {
  const list = document.getElementById('my-video-list');
  list.innerHTML = MOCK_MY_VIDEOS.map(v => {
    const color = scoreColor(v.score);
    return `
      <div class="video-row">
        <div class="video-row-score" style="background:${color}">${v.score ?? '—'}</div>
        <div class="video-row-info">
          <h4>${esc(v.title)}</h4>
          <p>${v.language} · ${v.level} · ${v.category} · ${v.date}</p>
        </div>
        <div class="video-row-stats">
          <div class="video-row-stat">
            <strong>${formatNum(v.views)}</strong>
            <small>Views</small>
          </div>
          <div class="video-row-stat">
            <strong>${formatNum(v.studyActions)}</strong>
            <small>Study Actions</small>
          </div>
        </div>
        <span class="status-pill status-${v.status}">${v.status}</span>
      </div>
    `;
  }).join('');
}

// ===== Analytics Page =====
function renderChart() {
  const chart = document.getElementById('mock-chart');
  const maxViews = Math.max(...MOCK_CHART_DATA.map(d => d.views));

  chart.innerHTML = MOCK_CHART_DATA.map(d => `
    <div class="chart-bar-group">
      <div class="chart-bar views" style="height: ${(d.views / maxViews * 140)}px"></div>
      <div class="chart-bar actions" style="height: ${(d.actions / maxViews * 140)}px"></div>
      <span class="chart-label">${d.day.split(' ')[1]}</span>
    </div>
  `).join('');
}

function renderTopVideos() {
  const list = document.getElementById('top-videos-list');
  list.innerHTML = MOCK_TOP_VIDEOS.map((v, i) => `
    <div class="top-video-row">
      <span class="rank">${i + 1}</span>
      <span class="tv-title">${esc(v.title)}</span>
      <div class="tv-stat"><strong>${formatNum(v.views)}</strong><small>Views</small></div>
      <div class="tv-stat"><strong>${formatNum(v.studyActions)}</strong><small>Study</small></div>
      <div class="tv-stat"><strong>${v.score}</strong><small>Score</small></div>
      <div class="tv-stat"><strong>${v.retention}</strong><small>Retention</small></div>
    </div>
  `).join('');
}

// ===== Utilities =====
function hashStr(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h) + s.charCodeAt(i);
    h |= 0;
  }
  return Math.abs(h);
}

function seeded(seed, offset) {
  const x = Math.sin(seed + offset * 127.1) * 43758.5453;
  return x - Math.floor(x);
}

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

function esc(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

function formatNum(n) {
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return n.toString();
}

function scoreColor(score) {
  if (score === null) return '#a3a3a3';
  if (score >= 85) return '#58cc02';
  if (score >= 70) return '#1cb0f6';
  if (score >= 50) return '#ff9600';
  return '#ff4b4b';
}

function pickRandom(arr, count, seed) {
  const shuffled = [...arr].sort((a, b) => seeded(seed, arr.indexOf(a)) - seeded(seed, arr.indexOf(b)));
  return shuffled.slice(0, count);
}

function animateNumber(el, from, to, duration) {
  const start = performance.now();
  function update(now) {
    const p = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(from + (to - from) * eased);
    if (p < 1) requestAnimationFrame(update);
  }
  requestAnimationFrame(update);
}

// ===== Init =====
renderMyVideos();
renderChart();
renderTopVideos();
