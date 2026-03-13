// ===== Navigation =====
document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        const page = link.dataset.page;

        document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
        link.classList.add('active');

        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.getElementById(`page-${page}`).classList.add('active');
    });
});

// ===== Upload Area =====
const uploadArea = document.getElementById('upload-area');
const fileInput = document.getElementById('file-input');

uploadArea.addEventListener('click', () => fileInput.click());

uploadArea.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadArea.classList.add('dragover');
});

uploadArea.addEventListener('dragleave', () => {
    uploadArea.classList.remove('dragover');
});

uploadArea.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadArea.classList.remove('dragover');
    if (e.dataTransfer.files.length) {
        handleFileUpload(e.dataTransfer.files[0]);
    }
});

fileInput.addEventListener('change', () => {
    if (fileInput.files.length) {
        handleFileUpload(fileInput.files[0]);
    }
});

function handleFileUpload(file) {
    if (!file.type.startsWith('video/')) {
        alert('Please upload a video file (MP4, MOV, WebM).');
        return;
    }
    runAnalysis(file.name);
}

// ===== Analyze Button =====
document.getElementById('btn-analyze').addEventListener('click', () => {
    const url = document.getElementById('video-url').value.trim();
    if (!url) {
        alert('Please paste a video URL.');
        return;
    }
    if (!isValidVideoUrl(url)) {
        alert('Please paste a valid TikTok, YouTube, or Instagram URL.');
        return;
    }
    runAnalysis(url);
});

document.getElementById('video-url').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        document.getElementById('btn-analyze').click();
    }
});

function isValidVideoUrl(url) {
    const patterns = [
        /tiktok\.com/i,
        /youtube\.com/i,
        /youtu\.be/i,
        /instagram\.com/i,
        /reels/i,
        /shorts/i,
    ];
    return patterns.some(p => p.test(url));
}

// ===== Reset =====
document.getElementById('btn-reset').addEventListener('click', () => {
    document.getElementById('results').classList.add('hidden');
    document.querySelector('.input-section').style.display = '';
    document.getElementById('video-url').value = '';
    fileInput.value = '';
});

// ===== Mock Analysis Engine =====
function runAnalysis(source) {
    const lang = document.getElementById('target-lang');
    const level = document.getElementById('learner-level');
    const langName = lang.options[lang.selectedIndex].text;
    const levelValue = level.value;

    // Hide input, show loading
    document.querySelector('.input-section').style.display = 'none';
    document.getElementById('loading').classList.remove('hidden');
    document.getElementById('results').classList.add('hidden');

    // Simulate analysis delay
    const delay = 1500 + Math.random() * 2000;
    setTimeout(() => {
        const result = generateMockResult(source, langName, levelValue);
        displayResult(result);
        saveToHistory(source, result);
        document.getElementById('loading').classList.add('hidden');
        document.getElementById('results').classList.remove('hidden');
    }, delay);
}

function generateMockResult(source, langName, levelValue) {
    // Deterministic-ish scoring seeded by the source string
    const seed = hashString(source);

    const clarity = clamp(55 + seededRandom(seed, 1) * 45, 0, 100);
    const subtitles = clamp(40 + seededRandom(seed, 2) * 55, 0, 100);
    const vocab = clamp(50 + seededRandom(seed, 3) * 50, 0, 100);
    const speed = clamp(45 + seededRandom(seed, 4) * 50, 0, 100);
    const repetition = clamp(30 + seededRandom(seed, 5) * 60, 0, 100);
    const slang = clamp(seededRandom(seed, 6) * 40, 0, 100);

    // Weighted score
    const total = Math.round(
        clarity * 0.30 +
        subtitles * 0.20 +
        vocab * 0.20 +
        speed * 0.15 +
        repetition * 0.10 -
        slang * 0.05
    );

    const score = clamp(total, 0, 100);

    let label, tier;
    if (score >= 80) { label = 'Excellent for Learning'; tier = 'excellent'; }
    else if (score >= 60) { label = 'Good for Learning'; tier = 'good'; }
    else if (score >= 40) { label = 'Okay — Some Value'; tier = 'okay'; }
    else { label = 'Not Great for Learning'; tier = 'poor'; }

    const recommendation = buildRecommendation(score, langName, levelValue, { clarity, subtitles, vocab, speed, repetition, slang });

    return { score, label, tier, langName, levelValue, clarity, subtitles, vocab, speed, repetition, slang, recommendation };
}

function buildRecommendation(score, lang, level, m) {
    let parts = [];

    if (score >= 80) {
        parts.push(`<strong>Great pick!</strong> This video is highly useful for ${lang} learners at the ${level} level.`);
    } else if (score >= 60) {
        parts.push(`<strong>Solid choice.</strong> This video has good learning value for ${lang} at ${level}.`);
    } else if (score >= 40) {
        parts.push(`<strong>Decent, but not ideal.</strong> This video has some learning value for ${lang} ${level} learners, but there are better options.`);
    } else {
        parts.push(`<strong>Not recommended.</strong> This video isn't great for structured ${lang} learning at ${level}.`);
    }

    if (m.clarity >= 75) parts.push('Speech is clear and easy to follow.');
    else if (m.clarity < 50) parts.push('Speech clarity is low — hard to pick out words.');

    if (m.subtitles >= 70) parts.push('Subtitles are present and accurate, which helps comprehension.');
    else if (m.subtitles < 40) parts.push('No reliable subtitles detected — you\'ll need strong listening skills.');

    if (m.speed >= 70) parts.push('Speaking pace is comfortable for your level.');
    else if (m.speed < 40) parts.push('Speaking is very fast — may be challenging to follow.');

    if (m.vocab >= 75) parts.push('Vocabulary matches your level well.');
    else if (m.vocab < 45) parts.push('Vocabulary may be too advanced or too simple for your level.');

    if (m.slang > 25) parts.push('Contains noticeable slang or informal language.');

    if (m.repetition >= 60) parts.push('Good repetition of key phrases — great for memorization.');

    return parts.join(' ');
}

function displayResult(r) {
    const card = document.querySelector('.score-card');
    card.className = `score-card score-${r.tier}`;

    // Animate score number
    const scoreNum = document.getElementById('score-number');
    animateNumber(scoreNum, 0, r.score, 1200);

    // Animate ring
    const ring = document.getElementById('score-ring');
    const circumference = 339.292;
    const offset = circumference - (r.score / 100) * circumference;
    ring.style.strokeDashoffset = circumference;
    requestAnimationFrame(() => {
        ring.style.strokeDashoffset = offset;
    });

    document.getElementById('score-label').textContent = r.label;
    document.getElementById('score-level').textContent = `${r.langName} — ${r.levelValue} Level`;

    // Metrics
    setMetric('clarity', r.clarity);
    setMetric('subtitles', r.subtitles);
    setMetric('vocab', r.vocab);
    setMetric('speed', r.speed);
    setMetric('repetition', r.repetition);
    setMetric('slang', r.slang);

    document.getElementById('recommendation').innerHTML = r.recommendation;
}

function setMetric(name, value) {
    document.getElementById(`m-${name}`).textContent = Math.round(value) + '%';
    const bar = document.getElementById(`bar-${name}`);
    bar.style.width = '0%';
    requestAnimationFrame(() => {
        bar.style.width = Math.round(value) + '%';
    });
}

function animateNumber(el, from, to, duration) {
    const start = performance.now();
    function update(now) {
        const progress = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        el.textContent = Math.round(from + (to - from) * eased);
        if (progress < 1) requestAnimationFrame(update);
    }
    requestAnimationFrame(update);
}

// ===== History =====
function getHistory() {
    try {
        return JSON.parse(localStorage.getItem('duo_video_history') || '[]');
    } catch {
        return [];
    }
}

function saveToHistory(source, result) {
    const history = getHistory();
    history.unshift({
        source: source.length > 60 ? source.substring(0, 60) + '...' : source,
        score: result.score,
        tier: result.tier,
        lang: result.langName,
        level: result.levelValue,
        date: new Date().toLocaleDateString(),
    });
    // Keep max 50
    if (history.length > 50) history.pop();
    localStorage.setItem('duo_video_history', JSON.stringify(history));
    renderHistory();
}

function renderHistory() {
    const list = document.getElementById('history-list');
    const history = getHistory();

    if (history.length === 0) {
        list.innerHTML = '<div class="empty-state"><p>No videos scored yet. Go score your first video!</p></div>';
        return;
    }

    list.innerHTML = history.map(h => {
        const colors = { excellent: '#58cc02', good: '#1cb0f6', okay: '#ff9600', poor: '#ff4b4b' };
        return `
            <div class="history-item">
                <div class="history-info">
                    <h4>${escapeHtml(h.source)}</h4>
                    <p>${h.lang} · ${h.level} · ${h.date}</p>
                </div>
                <div class="history-score" style="background:${colors[h.tier] || '#afafaf'}">${h.score}</div>
            </div>
        `;
    }).join('');
}

// ===== Discover Page (Mock Data) =====
const discoverVideos = [
    { title: 'Ordering Coffee in Spanish', platform: 'TikTok', score: 92, lang: 'es', level: 'A2', emoji: '☕' },
    { title: 'Day in Tokyo — Vlog', platform: 'YouTube', score: 78, lang: 'ja', level: 'B1', emoji: '🗼' },
    { title: 'French Slang You Need', platform: 'Instagram', score: 65, lang: 'fr', level: 'B2', emoji: '🇫🇷' },
    { title: 'Korean Street Food Tour', platform: 'TikTok', score: 71, lang: 'ko', level: 'A2', emoji: '🍜' },
    { title: 'Spanish Listening Practice', platform: 'YouTube', score: 95, lang: 'es', level: 'A1', emoji: '🎧' },
    { title: '5 Minute German Convo', platform: 'TikTok', score: 88, lang: 'de', level: 'B1', emoji: '🇩🇪' },
    { title: 'Portuguese for Beginners', platform: 'YouTube', score: 90, lang: 'pt', level: 'A1', emoji: '🇧🇷' },
    { title: 'Japanese Anime Phrases', platform: 'TikTok', score: 55, lang: 'ja', level: 'A2', emoji: '🎌' },
    { title: 'Italian Restaurant Vocab', platform: 'Instagram', score: 84, lang: 'it', level: 'A2', emoji: '🍝' },
    { title: 'Fast French News Clip', platform: 'YouTube', score: 42, lang: 'fr', level: 'C1', emoji: '📰' },
    { title: 'K-Pop Lyrics Breakdown', platform: 'TikTok', score: 68, lang: 'ko', level: 'B1', emoji: '🎵' },
    { title: 'Travel Spanish: Airport', platform: 'Instagram', score: 87, lang: 'es', level: 'A1', emoji: '✈️' },
];

function renderDiscover() {
    const grid = document.getElementById('video-grid');
    const langFilter = document.getElementById('discover-lang').value;
    const levelFilter = document.getElementById('discover-level').value;
    const platformFilter = document.getElementById('discover-platform').value;

    const filtered = discoverVideos.filter(v => {
        if (v.lang !== langFilter) return false;
        if (platformFilter !== 'all' && v.platform.toLowerCase() !== platformFilter) return false;
        return true;
    });

    if (filtered.length === 0) {
        grid.innerHTML = '<div class="empty-state"><p>No videos found for these filters. Try adjusting your selection.</p></div>';
        return;
    }

    const tierColor = (score) => {
        if (score >= 80) return '#58cc02';
        if (score >= 60) return '#1cb0f6';
        if (score >= 40) return '#ff9600';
        return '#ff4b4b';
    };

    grid.innerHTML = filtered.map(v => `
        <div class="video-card">
            <div class="video-thumb">
                ${v.emoji}
                <span class="platform-badge">${v.platform}</span>
                <span class="score-badge" style="background:${tierColor(v.score)}">${v.score}</span>
            </div>
            <div class="video-card-body">
                <div class="video-card-title">${escapeHtml(v.title)}</div>
                <div class="video-card-meta">${v.level} Level</div>
            </div>
        </div>
    `).join('');
}

document.getElementById('discover-lang').addEventListener('change', renderDiscover);
document.getElementById('discover-level').addEventListener('change', renderDiscover);
document.getElementById('discover-platform').addEventListener('change', renderDiscover);

// ===== Utility =====
function hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0;
    }
    return Math.abs(hash);
}

function seededRandom(seed, offset) {
    const x = Math.sin(seed + offset * 127.1) * 43758.5453;
    return x - Math.floor(x);
}

function clamp(val, min, max) {
    return Math.max(min, Math.min(max, val));
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// ===== Init =====
renderHistory();
renderDiscover();
