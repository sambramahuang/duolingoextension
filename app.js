// ===== Duolingo Creator Studio — App Logic =====
// Calls the real Flask backend at /api/analyze.
// If backend is unavailable, no rating is shown.

const API_URL = (() => {
  if (window.__API_URL__) return String(window.__API_URL__);
  if (window.location.hostname === "localhost" && window.location.port === "3000") {
    return "http://localhost:5001/api/analyze";
  }
  return `${window.location.origin}/api/analyze`;
})();

const SIDEBAR_STORAGE_KEY = 'duo_sidebar_collapsed';

function applySidebarCollapsedState(collapsed) {
  document.body.classList.toggle('sidebar-collapsed', collapsed);
  const toggleBtn = document.getElementById('sidebar-toggle');
  if (!toggleBtn) return;
  toggleBtn.setAttribute('aria-expanded', String(!collapsed));
  toggleBtn.setAttribute('aria-label', collapsed ? 'Expand sidebar' : 'Collapse sidebar');
}

function getSavedSidebarCollapsedState() {
  try {
    return window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === '1';
  } catch (_err) {
    return false;
  }
}

function saveSidebarCollapsedState(collapsed) {
  try {
    window.localStorage.setItem(SIDEBAR_STORAGE_KEY, collapsed ? '1' : '0');
  } catch (_err) {
    // Ignore storage errors (private mode or blocked storage).
  }
}

const sidebarToggleButton = document.getElementById('sidebar-toggle');
if (sidebarToggleButton) {
  const initialCollapsed = window.innerWidth > 960 && getSavedSidebarCollapsedState();
  applySidebarCollapsedState(initialCollapsed);

  sidebarToggleButton.addEventListener('click', () => {
    const nextCollapsed = !document.body.classList.contains('sidebar-collapsed');
    applySidebarCollapsedState(nextCollapsed);
    saveSidebarCollapsedState(nextCollapsed);
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth <= 960) {
      applySidebarCollapsedState(false);
      return;
    }
    applySidebarCollapsedState(getSavedSidebarCollapsedState());
  });
}

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
const phoneVideoPreview = document.getElementById('phone-video-preview');
const phoneVideoPlaceholder = document.getElementById('phone-video-placeholder');
let currentPreviewUrl = null;

dropZone.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('dragover'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
dropZone.addEventListener('drop', e => {
  e.preventDefault();
  dropZone.classList.remove('dragover');
  if (e.dataTransfer.files.length) {
    const droppedFile = e.dataTransfer.files[0];
    syncFileInputFromFile(droppedFile);
    handleFile(droppedFile);
  }
});

fileInput.addEventListener('change', () => {
  if (fileInput.files.length) handleFile(fileInput.files[0]);
});

document.getElementById('btn-change-file').addEventListener('click', () => {
  fileInput.value = '';
  fileSelected.classList.add('hidden');
  dropZone.style.display = '';
  resetVideoPreviews();
});

function syncFileInputFromFile(file) {
  try {
    const dataTransfer = new DataTransfer();
    dataTransfer.items.add(file);
    fileInput.files = dataTransfer.files;
  } catch (_err) {
    // Ignore browsers that do not allow programmatic file assignment.
  }
}

function revokePreviewUrl() {
  if (!currentPreviewUrl) return;
  URL.revokeObjectURL(currentPreviewUrl);
  currentPreviewUrl = null;
}

function resetVideoPreviews() {
  videoPreview.pause();
  videoPreview.removeAttribute('src');
  videoPreview.load();

  phoneVideoPreview.pause();
  phoneVideoPreview.removeAttribute('src');
  phoneVideoPreview.load();
  phoneVideoPreview.classList.add('hidden');
  phoneVideoPlaceholder.classList.remove('hidden');

  revokePreviewUrl();
}

function setVideoPreviewsFromFile(file) {
  revokePreviewUrl();
  currentPreviewUrl = URL.createObjectURL(file);

  videoPreview.src = currentPreviewUrl;
  videoPreview.load();

  phoneVideoPreview.src = currentPreviewUrl;
  phoneVideoPreview.classList.remove('hidden');
  phoneVideoPlaceholder.classList.add('hidden');
  phoneVideoPreview.load();
  phoneVideoPreview.play().catch(() => {});
}

window.addEventListener('beforeunload', revokePreviewUrl);

function handleFile(file) {
  if (!file.type.startsWith('video/')) {
    alert('Please upload a video file.');
    return;
  }
  document.getElementById('selected-file-name').textContent = file.name;
  document.getElementById('selected-file-size').textContent = (file.size / (1024 * 1024)).toFixed(1) + ' MB';

  setVideoPreviewsFromFile(file);

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
const descInput = document.getElementById('video-desc');
const langSelect = document.getElementById('video-language');
const levelSelect = document.getElementById('video-level');
const categorySelect = document.getElementById('video-category');
const hasSubtitlesCheckbox = document.getElementById('has-subtitles');
const nativeSpeakerCheckbox = document.getElementById('native-speaker');
const slowSpeechCheckbox = document.getElementById('slow-speech');
const DEFAULT_LANGUAGE_CODE = 'es';

function getSelectedLanguageName() {
  const selectedOption = langSelect.options[langSelect.selectedIndex];
  return selectedOption ? selectedOption.text : 'Unknown';
}

function populateLanguageSelect() {
  const allLanguages = Array.isArray(window.ALL_LANGUAGES) ? window.ALL_LANGUAGES : [];
  if (!allLanguages.length) {
    return;
  }

  const previousValue = langSelect.value;
  langSelect.innerHTML = '';

  allLanguages.forEach(({ code, name }) => {
    const option = document.createElement('option');
    option.value = code;
    option.textContent = name;
    langSelect.appendChild(option);
  });

  if (allLanguages.some(item => item.code === previousValue)) {
    langSelect.value = previousValue;
  } else if (allLanguages.some(item => item.code === DEFAULT_LANGUAGE_CODE)) {
    langSelect.value = DEFAULT_LANGUAGE_CODE;
  } else if (allLanguages.length > 0) {
    langSelect.value = allLanguages[0].code;
  }

  document.getElementById('preview-lang').textContent = getSelectedLanguageName();
}

populateLanguageSelect();

titleInput.addEventListener('input', () => {
  document.getElementById('preview-title').textContent = titleInput.value || 'Your video title appears here';
});

langSelect.addEventListener('change', () => {
  document.getElementById('preview-lang').textContent = getSelectedLanguageName();
});

levelSelect.addEventListener('change', () => {
  document.getElementById('preview-level').textContent = levelSelect.value;
});

// ===== Form Submit =====
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

  const metadata = {
    title,
    description: descInput.value.trim(),
    targetLanguageCode: langSelect.value,
    targetLanguageName: getSelectedLanguageName(),
    learnerLevel: levelSelect.value,
    category: categorySelect.value,
    topics: selectedTags,
    hasSubtitles: hasSubtitlesCheckbox.checked,
    nativeSpeaker: nativeSpeakerCheckbox.checked,
    slowSpeech: slowSpeechCheckbox.checked,
  };

  runAnalysis(title, fileInput.files[0], metadata);
});

// ===== Analysis Pipeline =====
async function runAnalysis(title, file, metadata) {
  const btn = document.getElementById('btn-publish');
  btn.textContent = 'Analyzing...';
  btn.disabled = true;

  // Hide any previous results/errors
  document.getElementById('score-result').classList.add('hidden');
  removeErrorBanner();

  // Show loading state
  const loading = document.getElementById('analysis-loading');
  loading.classList.remove('hidden');
  loading.scrollIntoView({ behavior: 'smooth', block: 'start' });

  // Animate loading steps
  setStep('step-extract', 'active');

  try {
    const result = await callBackendAPI(file, metadata);
    displayBackendResult(result, title);
  } catch (err) {
    console.error('Backend analysis failed:', err.message);
    document.getElementById('score-result').classList.add('hidden');
    document.getElementById('transcript-section').classList.add('hidden');
    document.getElementById('translation-section').classList.add('hidden');
    showErrorBanner(
      'Rating unavailable: backend is not running or failed. Start the API server and try again.'
    );
  }

  loading.classList.add('hidden');
  resetSteps();
  btn.textContent = 'Upload & Score My Video';
  btn.disabled = false;
}

async function callBackendAPI(file, metadata) {
  // Step 1: extracting
  setStep('step-extract', 'active');

  const formData = new FormData();
  formData.append('video', file);
  formData.append('title', metadata.title || '');
  formData.append('description', metadata.description || '');
  formData.append('target_language_code', metadata.targetLanguageCode || '');
  formData.append('target_language_name', metadata.targetLanguageName || '');
  formData.append('target_language', metadata.targetLanguageName || '');
  formData.append('learner_level', metadata.learnerLevel || '');
  formData.append('category', metadata.category || '');
  formData.append('topics', JSON.stringify(metadata.topics || []));
  formData.append('has_subtitles', String(Boolean(metadata.hasSubtitles)));
  formData.append('native_speaker', String(Boolean(metadata.nativeSpeaker)));
  formData.append('slow_speech', String(Boolean(metadata.slowSpeech)));

  // Step 2: transcribing — set early since server does it
  setTimeout(() => {
    setStep('step-extract', 'done');
    setStep('step-transcribe', 'active');
  }, 1500);

  setTimeout(() => {
    setStep('step-transcribe', 'done');
    setStep('step-frames', 'active');
  }, 4000);

  setTimeout(() => {
    setStep('step-frames', 'done');
    setStep('step-score', 'active');
  }, 7000);

  const response = await fetch(API_URL, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    throw new Error(errData.error || `Server error: ${response.status}`);
  }

  const data = await response.json();
  if (!data || typeof data !== 'object' || !('overall_score' in data)) {
    throw new Error('Invalid combined schema returned by backend');
  }

  // Mark all steps done
  ['step-extract', 'step-transcribe', 'step-frames', 'step-score'].forEach(id => setStep(id, 'done'));

  return data;
}

function toPercentFrom10(score) {
  const value = Number(score);
  if (!Number.isFinite(value)) return 0;
  return clamp(Math.round(value * 10), 0, 100);
}

function videoQualityBand(videoScore10) {
  if (videoScore10 >= 8) return 'High';
  if (videoScore10 >= 6) return 'Medium';
  return 'Needs Improvement';
}

function renderMetricCards(containerId, metrics) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = metrics.map(met => {
    const display = met.display !== undefined ? String(met.display) : `${Math.round(met.value)}%`;
    const hasBar = !met.noBar;
    const target = Math.round(clamp(Number(met.value || 0), 0, 100));
    return `
      <div class="score-metric-card ${hasBar ? '' : 'no-bar'}">
        <div class="metric-label">${esc(met.label)}</div>
        <div class="metric-value">${esc(display)}</div>
        ${hasBar ? `<div class="metric-bar-bg"><div class="metric-bar-fill" data-target="${target}" style="width: 0%"></div></div>` : ''}
      </div>
    `;
  }).join('');

  requestAnimationFrame(() => {
    container.querySelectorAll('.metric-bar-fill').forEach((bar) => {
      bar.style.width = `${bar.dataset.target || 0}%`;
    });
  });
}

// ===== Display Backend Result =====
function displayBackendResult(data, title) {
  const section = document.getElementById('score-result');
  section.classList.remove('hidden');
  section.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const overallScore10 = Number(data.overall_score) || 0;
  const learningScore10 = Number(data.learning_score) || 0;
  const videoScore10 = Number(data.video_score) || 0;
  const score = toPercentFrom10(overallScore10);
  const learningScorePercent = toPercentFrom10(learningScore10);
  const videoScorePercent = toPercentFrom10(videoScore10);

  let label, tier;
  if (score >= 85) { label = 'Excellent — Ready to publish'; tier = 'excellent'; }
  else if (score >= 70) { label = 'Good — Minor improvements possible'; tier = 'good'; }
  else if (score >= 50) { label = 'Needs Work — See suggestions below'; tier = 'okay'; }
  else { label = 'Low Score — Consider re-recording'; tier = 'poor'; }

  // Score orb
  const orb = document.getElementById('score-orb');
  orb.className = 'score-orb';
  if (tier === 'good') orb.classList.add('good');
  else if (tier === 'okay') orb.classList.add('okay');
  else if (tier === 'poor') orb.classList.add('poor');

  animateNumber(document.getElementById('score-num'), 0, score, 1200);
  document.getElementById('score-title').textContent = label;

  const lang = data.language || getSelectedLanguageName();
  const difficulty = String(data.difficulty || '').toUpperCase() || 'B1';
  document.getElementById('score-subtitle').textContent = `${lang} · ${difficulty} · ${title}`;
  const proficiencyPanel = document.getElementById('proficiency-panel');
  const proficiencyCodeEl = document.getElementById('proficiency-code');
  const proficiencyNoteEl = document.getElementById('proficiency-note');
  const proficiencyBand = difficulty.charAt(0);

  proficiencyPanel.className = 'proficiency-panel';
  if (proficiencyBand === 'A') proficiencyPanel.classList.add('level-a');
  else if (proficiencyBand === 'B') proficiencyPanel.classList.add('level-b');
  else if (proficiencyBand === 'C') proficiencyPanel.classList.add('level-c');

  proficiencyCodeEl.textContent = difficulty;
  proficiencyNoteEl.textContent = `Classifier output for this uploaded video: ${difficulty}.`;

  const transcript = String(data.transcript || '').trim();
  const translations = Array.isArray(data.english_translation) ? data.english_translation : [];

  // Language proficiency analytics first
  renderMetricCards('language-metrics', [
    { label: 'Learning Score', value: learningScorePercent, display: `${learningScore10}/10` },
    { label: 'Proficiency Level', value: 0, display: difficulty, noBar: true },
    { label: 'Good for Learning', value: data.good_for_learning ? 100 : 0, display: data.good_for_learning ? 'Yes' : 'No', noBar: true },
    { label: 'Transcript Length', value: 0, display: transcript ? `${transcript.length} chars` : 'N/A', noBar: true },
    { label: 'Teachable Phrases', value: 0, display: String(translations.length), noBar: true },
  ]);

  // Video quality analytics second
  renderMetricCards('video-metrics', [
    { label: 'Video Score', value: videoScorePercent, display: `${videoScore10}/10` },
    { label: 'Overall Score', value: score, display: `${overallScore10}/10` },
    { label: 'Quality Band', value: 0, display: videoQualityBand(videoScore10), noBar: true },
  ]);

  // Transcript (full text from combined schema)
  if (transcript) {
    const ts = document.getElementById('transcript-section');
    ts.classList.remove('hidden');
    document.getElementById('transcript-box').textContent = transcript;
    document.getElementById('transcript-meta').innerHTML = `
      <span class="meta-tag">Language: ${esc(lang)}</span>
      <span class="meta-tag">Proficiency: ${esc(difficulty)}</span>
      <span class="meta-tag">${transcript.length} chars</span>
    `;
  } else {
    document.getElementById('transcript-section').classList.add('hidden');
    document.getElementById('transcript-box').textContent = '';
    document.getElementById('transcript-meta').innerHTML = '';
  }

  // Translations
  if (translations.length > 0) {
    const tl = document.getElementById('translation-section');
    tl.classList.remove('hidden');
    document.getElementById('translation-cards').innerHTML = translations.map(t => `
      <div class="translation-card">
        <div class="phrase">${esc(t.phrase)}</div>
        <div class="phrase-lang">${esc(t.language || data.language)}</div>
        <div class="phrase-arrow">&#8595;</div>
        <div class="translation">${esc(t.english_translation)}</div>
      </div>
    `).join('');
  } else {
    document.getElementById('translation-section').classList.add('hidden');
  }

  // Strengths from combined schema only
  const strengths = [];
  if (data.good_for_learning) strengths.push('AI confirms this video is good for language learning');
  if (learningScore10 >= 7) strengths.push('Learning quality score is strong for this upload');
  if (videoScore10 >= 7) strengths.push('Video quality score is strong for this upload');
  if (difficulty) strengths.push(`Classifier detected proficiency level ${difficulty}`);
  if (translations.length >= 2) strengths.push(`${translations.length} teachable phrases identified`);
  if (strengths.length === 0) strengths.push('The video provides some language exposure');

  document.getElementById('score-strengths').innerHTML = strengths.slice(0, 4).map(s => `<li>${s}</li>`).join('');

  const suggestions = Array.isArray(data.recommendations) ? data.recommendations : [];
  const uniqueSuggestions = [...new Set(suggestions)].slice(0, 4);
  if (uniqueSuggestions.length === 0) uniqueSuggestions.push('No major issues found');
  document.getElementById('score-suggestions').innerHTML = uniqueSuggestions.map(s => `<li>${esc(s)}</li>`).join('');

  // Reach estimate
  const estimatedReach = Math.round(2000 + score * 150 + Math.random() * 5000);
  document.getElementById('score-reach').innerHTML = `
    Based on the combined classifier output, your video scored <strong>${overallScore10}/10</strong> overall
    (<strong>${learningScore10}/10</strong> learning · <strong>${videoScore10}/10</strong> video quality),
    and is classified at <strong>${difficulty}</strong>.
    Estimated reach: <strong>${estimatedReach.toLocaleString()}</strong> ${lang} learners.
    ${score >= 85 ? 'This video qualifies for the Featured Creators playlist.' :
      score >= 70 ? 'Improve a few areas to unlock Featured placement.' :
      'Focus on the suggestions above to increase your reach.'}
  `;
}

// ===== Loading Step Helpers =====
function setStep(stepId, state) {
  const step = document.getElementById(stepId);
  if (!step) return;
  const icon = step.querySelector('.step-icon');
  step.className = `loading-step ${state}`;
  icon.className = `step-icon ${state}`;
  if (state === 'done') icon.textContent = '✓';
}

function resetSteps() {
  ['step-extract', 'step-transcribe', 'step-frames', 'step-score'].forEach(id => {
    const step = document.getElementById(id);
    if (!step) return;
    const icon = step.querySelector('.step-icon');
    step.className = 'loading-step';
    icon.className = 'step-icon pending';
    icon.textContent = id.replace('step-', '').charAt(0).toUpperCase();
  });
  // Reset step numbers
  document.querySelector('#step-extract .step-icon').textContent = '1';
  document.querySelector('#step-transcribe .step-icon').textContent = '2';
  document.querySelector('#step-frames .step-icon').textContent = '3';
  document.querySelector('#step-score .step-icon').textContent = '4';
}

function removeErrorBanner() {
  const existing = document.querySelector('.error-banner');
  if (existing) existing.remove();
}

function showErrorBanner(message) {
  removeErrorBanner();
  const loading = document.getElementById('analysis-loading');
  const banner = document.createElement('div');
  banner.className = 'error-banner';
  banner.textContent = message;
  loading.insertAdjacentElement('afterend', banner);
}

// ===== Mock Fallback =====
function simulateMockDelay() {
  return new Promise(resolve => {
    setTimeout(() => { setStep('step-extract', 'done'); setStep('step-transcribe', 'active'); }, 400);
    setTimeout(() => { setStep('step-transcribe', 'done'); setStep('step-frames', 'active'); }, 800);
    setTimeout(() => { setStep('step-frames', 'done'); setStep('step-score', 'active'); }, 1200);
    setTimeout(() => { setStep('step-score', 'done'); resolve(); }, 1600);
  });
}

function generateMockScore(title) {
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

  const strengths = pickRandom(STRENGTH_POOL, 3, seed);
  const suggestions = pickRandom(SUGGESTION_POOL, 3, seed + 99);
  const lang = getSelectedLanguageName();
  const level = levelSelect.value;
  const estimatedReach = Math.round(2000 + score * 150 + seeded(seed, 7) * 5000);

  return { score, label, tier, clarity, subtitles, vocab, speed, repetition, slang, strengths, suggestions, lang, level, estimatedReach, title, isMock: true };
}

function displayMockScore(r) {
  const section = document.getElementById('score-result');
  section.classList.remove('hidden');
  section.scrollIntoView({ behavior: 'smooth', block: 'start' });

  // Hide transcript/translation sections for mock results
  document.getElementById('transcript-section').classList.add('hidden');
  document.getElementById('translation-section').classList.add('hidden');

  const orb = document.getElementById('score-orb');
  orb.className = 'score-orb';
  if (r.tier === 'good') orb.classList.add('good');
  else if (r.tier === 'okay') orb.classList.add('okay');
  else if (r.tier === 'poor') orb.classList.add('poor');

  animateNumber(document.getElementById('score-num'), 0, r.score, 1200);
  document.getElementById('score-title').textContent = r.label;
  const mockLevel = String(r.level || 'B1').toUpperCase();
  document.getElementById('score-subtitle').textContent = `${r.lang} · ${mockLevel} · ${r.title} (Demo Mode)`;

  const proficiencyPanel = document.getElementById('proficiency-panel');
  const proficiencyCodeEl = document.getElementById('proficiency-code');
  const proficiencyNoteEl = document.getElementById('proficiency-note');
  proficiencyPanel.className = 'proficiency-panel';
  if (mockLevel.startsWith('A')) proficiencyPanel.classList.add('level-a');
  else if (mockLevel.startsWith('B')) proficiencyPanel.classList.add('level-b');
  else if (mockLevel.startsWith('C')) proficiencyPanel.classList.add('level-c');
  proficiencyCodeEl.textContent = mockLevel;
  proficiencyNoteEl.textContent = `Demo classifier output: ${mockLevel}.`;

  renderMetricCards('language-metrics', [
    { label: 'Learning Score', value: r.vocab, display: `${Math.round(r.vocab / 10)}/10` },
    { label: 'Proficiency Level', value: 0, display: mockLevel, noBar: true },
  ]);

  renderMetricCards('video-metrics', [
    { label: 'Video Score', value: Math.round((r.clarity + r.speed + r.repetition) / 3), display: `${Math.round(((r.clarity + r.speed + r.repetition) / 3) / 10)}/10` },
    { label: 'Overall Score', value: r.score, display: `${Math.round(r.score / 10)}/10` },
    { label: 'Quality Band', value: 0, display: videoQualityBand(Math.round(((r.clarity + r.speed + r.repetition) / 3) / 10)), noBar: true },
  ]);

  document.getElementById('score-strengths').innerHTML = r.strengths.map(s => `<li>${s}</li>`).join('');
  document.getElementById('score-suggestions').innerHTML = r.suggestions.map(s => `<li>${s}</li>`).join('');

  document.getElementById('score-reach').innerHTML = `
    <strong>Demo Mode</strong> — Backend server not running. Start it with <code>python server.py</code> for real AI analysis.
    <br><br>
    Mock score: <strong>${r.score}/100</strong>.
    Estimated reach: <strong>${r.estimatedReach.toLocaleString()}</strong> ${r.lang} learners at ${r.level} level.
  `;
}

// ===== Confirm Publish =====
document.getElementById('btn-confirm-publish').addEventListener('click', () => {
  alert('Video published to Duolingo! (This is a demo — no real upload occurred.)');
});

document.getElementById('btn-edit-resubmit').addEventListener('click', () => {
  document.getElementById('score-result').classList.add('hidden');
  document.getElementById('transcript-section').classList.add('hidden');
  document.getElementById('translation-section').classList.add('hidden');
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
  if (score === null) return '#607a95';
  if (score >= 85) return '#3ddc73';
  if (score >= 70) return '#58abff';
  if (score >= 50) return '#ffb75f';
  return '#ff6d79';
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
