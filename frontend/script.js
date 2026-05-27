/**
 * script.js — HIFZ TRACKER 2.0
 *
 * RESPONSIBILITIES (frontend ONLY):
 *   - Populate dropdowns (Juz 1–30, Batch Years, Surah list)
 *   - Communicate with FastAPI backend via fetch()
 *   - Render batch-year columns and student cards from API data
 *   - Handle Create Student modal + form submission
 *   - Handle inline Update Progress form per card
 *   - Handle real-time search filtering (no backend restart, no reload)
 *
 * STRICTLY FORBIDDEN in this file:
 *   - Any in-memory student arrays used as the source of truth
 *   - Fake/mock student data
 *   - Any database or SQLite logic
 *   - Hardcoded student cards
 *
 * Data flow: fetch() → FastAPI → SQLite → JSON response → render
 */

'use strict';

// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURATION
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Base URL of the FastAPI backend.
 * We use 8080 because ports 8000/8001 are occupied or blocked.
 */
const API_BASE = 'http://127.0.0.1:8081';

/**
 * Complete ordered list of Quran Surahs.
 * Source: standard Arabic Quran ordering.
 */
const SURAH_LIST = [
  "Al-Fatihah","Al-Baqarah","Al-Imran","An-Nisa","Al-Ma'idah",
  "Al-An'am","Al-A'raf","Al-Anfal","At-Tawbah","Yunus",
  "Hud","Yusuf","Ar-Ra'd","Ibrahim","Al-Hijr",
  "An-Nahl","Al-Isra","Al-Kahf","Maryam","Ta-Ha",
  "Al-Anbiya","Al-Hajj","Al-Mu'minun","An-Nur","Al-Furqan",
  "Ash-Shu'ara","An-Naml","Al-Qasas","Al-Ankabut","Ar-Rum",
  "Luqman","As-Sajdah","Al-Ahzab","Saba","Fatir",
  "Ya-Sin","As-Saffat","Sad","Az-Zumar","Ghafir",
  "Fussilat","Ash-Shura","Az-Zukhruf","Ad-Dukhan","Al-Jathiyah",
  "Al-Ahqaf","Muhammad","Al-Fath","Al-Hujurat","Qaf",
  "Adh-Dhariyat","At-Tur","An-Najm","Al-Qamar","Ar-Rahman",
  "Al-Waqi'ah","Al-Hadid","Al-Mujadila","Al-Hashr","Al-Mumtahanah",
  "As-Saf","Al-Jumu'ah","Al-Munafiqun","At-Taghabun","At-Talaq",
  "At-Tahrim","Al-Mulk","Al-Qalam","Al-Haqqah","Al-Ma'arij",
  "Nuh","Al-Jinn","Al-Muzzammil","Al-Muddaththir","Al-Qiyamah",
  "Al-Insan","Al-Mursalat","An-Naba","An-Nazi'at","Abasa",
  "At-Takwir","Al-Infitar","Al-Mutaffifin","Al-Inshiqaq","Al-Buruj",
  "At-Tariq","Al-A'la","Al-Ghashiyah","Al-Fajr","Al-Balad",
  "Ash-Shams","Al-Layl","Ad-Duha","Ash-Sharh","At-Tin",
  "Al-Alaq","Al-Qadr","Al-Bayyinah","Az-Zalzalah","Al-Adiyat",
  "Al-Qari'ah","At-Takathur","Al-Asr","Al-Humazah","Al-Fil",
  "Quraysh","Al-Ma'un","Al-Kawthar","Al-Kafirun","An-Nasr",
  "Al-Masad","Al-Ikhlas","Al-Falaq","An-Nas"
];

/** Batch year range shown in the create form. */
const BATCH_YEAR_START = 2020;
const BATCH_YEAR_END   = 2035;

/**
 * Maps each Juz number (1–30) to the Surah names that appear within it.
 * A Surah is listed in a Juz if any of its ayahs fall inside that Juz.
 */
const JUZ_SURAHS = {
   1: ["Al-Fatihah", "Al-Baqarah"],
   2: ["Al-Baqarah"],
   3: ["Al-Baqarah", "Al-Imran"],
   4: ["Al-Imran", "An-Nisa"],
   5: ["An-Nisa"],
   6: ["An-Nisa", "Al-Ma'idah"],
   7: ["Al-Ma'idah", "Al-An'am"],
   8: ["Al-An'am", "Al-A'raf"],
   9: ["Al-A'raf", "Al-Anfal"],
  10: ["Al-Anfal", "At-Tawbah"],
  11: ["At-Tawbah", "Yunus", "Hud"],
  12: ["Hud", "Yusuf"],
  13: ["Yusuf", "Ar-Ra'd", "Ibrahim"],
  14: ["Al-Hijr", "An-Nahl"],
  15: ["Al-Isra", "Al-Kahf"],
  16: ["Al-Kahf", "Maryam", "Ta-Ha"],
  17: ["Al-Anbiya", "Al-Hajj"],
  18: ["Al-Mu'minun", "An-Nur", "Al-Furqan"],
  19: ["Al-Furqan", "Ash-Shu'ara", "An-Naml"],
  20: ["An-Naml", "Al-Qasas", "Al-Ankabut"],
  21: ["Al-Ankabut", "Ar-Rum", "Luqman", "As-Sajdah", "Al-Ahzab"],
  22: ["Al-Ahzab", "Saba", "Fatir", "Ya-Sin"],
  23: ["Ya-Sin", "As-Saffat", "Sad", "Az-Zumar"],
  24: ["Az-Zumar", "Ghafir", "Fussilat"],
  25: ["Fussilat", "Ash-Shura", "Az-Zukhruf", "Ad-Dukhan", "Al-Jathiyah"],
  26: ["Al-Ahqaf", "Muhammad", "Al-Fath", "Al-Hujurat", "Qaf", "Adh-Dhariyat"],
  27: ["Adh-Dhariyat", "At-Tur", "An-Najm", "Al-Qamar", "Ar-Rahman", "Al-Waqi'ah", "Al-Hadid"],
  28: ["Al-Mujadila", "Al-Hashr", "Al-Mumtahanah", "As-Saf", "Al-Jumu'ah", "Al-Munafiqun", "At-Taghabun", "At-Talaq", "At-Tahrim"],
  29: ["Al-Mulk", "Al-Qalam", "Al-Haqqah", "Al-Ma'arij", "Nuh", "Al-Jinn", "Al-Muzzammil", "Al-Muddaththir", "Al-Qiyamah", "Al-Insan", "Al-Mursalat"],
  30: ["An-Naba", "An-Nazi'at", "Abasa", "At-Takwir", "Al-Infitar", "Al-Mutaffifin", "Al-Inshiqaq", "Al-Buruj", "At-Tariq", "Al-A'la", "Al-Ghashiyah", "Al-Fajr", "Al-Balad", "Ash-Shams", "Al-Layl", "Ad-Duha", "Ash-Sharh", "At-Tin", "Al-Alaq", "Al-Qadr", "Al-Bayyinah", "Az-Zalzalah", "Al-Adiyat", "Al-Qari'ah", "At-Takathur", "Al-Asr", "Al-Humazah", "Al-Fil", "Quraysh", "Al-Ma'un", "Al-Kawthar", "Al-Kafirun", "An-Nasr", "Al-Masad", "Al-Ikhlas", "Al-Falaq", "An-Nas"],
};

/**
 * Maps each Surah name to its exact total ayah count.
 * Source: standard Hafs 'an 'Asim recitation.
 */
const SURAH_AYAHS = {
  "Al-Fatihah": 7,    "Al-Baqarah": 286,  "Al-Imran": 200,    "An-Nisa": 176,
  "Al-Ma'idah": 120,  "Al-An'am": 165,    "Al-A'raf": 206,    "Al-Anfal": 75,
  "At-Tawbah": 129,   "Yunus": 109,       "Hud": 123,         "Yusuf": 111,
  "Ar-Ra'd": 43,      "Ibrahim": 52,      "Al-Hijr": 99,      "An-Nahl": 128,
  "Al-Isra": 111,     "Al-Kahf": 110,     "Maryam": 98,       "Ta-Ha": 135,
  "Al-Anbiya": 112,   "Al-Hajj": 78,      "Al-Mu'minun": 118, "An-Nur": 64,
  "Al-Furqan": 77,    "Ash-Shu'ara": 227, "An-Naml": 93,      "Al-Qasas": 88,
  "Al-Ankabut": 69,   "Ar-Rum": 60,       "Luqman": 34,       "As-Sajdah": 30,
  "Al-Ahzab": 73,     "Saba": 54,         "Fatir": 45,        "Ya-Sin": 83,
  "As-Saffat": 182,   "Sad": 88,          "Az-Zumar": 75,     "Ghafir": 85,
  "Fussilat": 54,     "Ash-Shura": 53,    "Az-Zukhruf": 89,   "Ad-Dukhan": 59,
  "Al-Jathiyah": 37,  "Al-Ahqaf": 35,     "Muhammad": 38,     "Al-Fath": 29,
  "Al-Hujurat": 18,   "Qaf": 45,          "Adh-Dhariyat": 60, "At-Tur": 49,
  "An-Najm": 62,      "Al-Qamar": 55,     "Ar-Rahman": 78,    "Al-Waqi'ah": 96,
  "Al-Hadid": 29,     "Al-Mujadila": 22,  "Al-Hashr": 24,     "Al-Mumtahanah": 13,
  "As-Saf": 14,       "Al-Jumu'ah": 11,   "Al-Munafiqun": 11, "At-Taghabun": 18,
  "At-Talaq": 12,     "At-Tahrim": 12,    "Al-Mulk": 30,      "Al-Qalam": 52,
  "Al-Haqqah": 52,    "Al-Ma'arij": 44,   "Nuh": 28,          "Al-Jinn": 28,
  "Al-Muzzammil": 20, "Al-Muddaththir": 56, "Al-Qiyamah": 40, "Al-Insan": 31,
  "Al-Mursalat": 50,  "An-Naba": 40,      "An-Nazi'at": 46,   "Abasa": 42,
  "At-Takwir": 29,    "Al-Infitar": 19,   "Al-Mutaffifin": 36,"Al-Inshiqaq": 25,
  "Al-Buruj": 22,     "At-Tariq": 17,     "Al-A'la": 19,      "Al-Ghashiyah": 26,
  "Al-Fajr": 30,      "Al-Balad": 20,     "Ash-Shams": 15,    "Al-Layl": 21,
  "Ad-Duha": 11,      "Ash-Sharh": 8,     "At-Tin": 8,        "Al-Alaq": 19,
  "Al-Qadr": 5,       "Al-Bayyinah": 8,   "Az-Zalzalah": 8,   "Al-Adiyat": 11,
  "Al-Qari'ah": 11,   "At-Takathur": 8,   "Al-Asr": 3,        "Al-Humazah": 9,
  "Al-Fil": 5,        "Quraysh": 4,       "Al-Ma'un": 7,      "Al-Kawthar": 3,
  "Al-Kafirun": 6,    "An-Nasr": 3,       "Al-Masad": 5,      "Al-Ikhlas": 4,
  "Al-Falaq": 5,      "An-Nas": 6,
};

// ─────────────────────────────────────────────────────────────────────────────
// DOM REFERENCES
// ─────────────────────────────────────────────────────────────────────────────

const board              = document.getElementById('board');
const loadingState       = document.getElementById('loading-state');
const searchInput        = document.getElementById('search-input');

const modalCreate        = document.getElementById('modal-create');
const btnOpenCreateModal = document.getElementById('btn-open-create-modal');
const btnCloseModal      = document.getElementById('btn-close-create-modal');
const formCreate         = document.getElementById('form-create-student');
const createError        = document.getElementById('create-error');

const selCreateBatch     = document.getElementById('create-batch-year');

// History modal
const modalHistory           = document.getElementById('modal-history');
const historyModalTitle      = document.getElementById('history-modal-title');
const historyModalSubtitle   = document.getElementById('history-modal-subtitle');
const historyModalBadge      = document.getElementById('history-modal-badge');
const historyModalBody       = document.getElementById('history-modal-body');
const btnCloseHistoryModal   = document.getElementById('btn-close-history-modal');

function openHistoryModal(studentName) {
  historyModalTitle.textContent    = 'Progress Record';
  historyModalSubtitle.textContent = studentName;
  historyModalBadge.textContent    = 'Loading…';
  historyModalBody.innerHTML       = `
    <div class="history-loading">
      <div class="history-spinner"></div>
      Loading records…
    </div>`;
  modalHistory.removeAttribute('hidden');
  document.body.style.overflow = 'hidden';
}

function closeHistoryModal() {
  modalHistory.setAttribute('hidden', '');
  document.body.style.overflow = '';
}

btnCloseHistoryModal.addEventListener('click', closeHistoryModal);

// Close on backdrop click
modalHistory.addEventListener('click', (e) => {
  if (e.target === modalHistory) closeHistoryModal();
});

// ─────────────────────────────────────────────────────────────────────────────
// UPDATE MODAL
// ─────────────────────────────────────────────────────────────────────────────
const modalUpdate           = document.getElementById('modal-update');
const updateModalSubtitle   = document.getElementById('modal-update-subtitle');
const btnCloseUpdateModal   = document.getElementById('btn-close-update-modal');
const formUpdate            = document.getElementById('form-update-student');
const updateJuzGroup        = document.getElementById('update-juz-group');
const updateSurahGroup      = document.getElementById('update-surah-group');
const updateAyahInput       = document.getElementById('update-ayah');
const updateDateInput       = document.getElementById('update-date');
const updateError           = document.getElementById('update-error');
const btnUpdateSubmit       = document.getElementById('btn-update-submit');
const btnDeleteStudent      = document.getElementById('btn-delete-student');

let currentUpdateStudent = null;

function closeUpdateModal() {
  modalUpdate.setAttribute('hidden', '');
  document.body.style.overflow = '';
  currentUpdateStudent = null;
}

btnCloseUpdateModal.addEventListener('click', closeUpdateModal);

modalUpdate.addEventListener('click', (e) => {
  if (e.target === modalUpdate) closeUpdateModal();
});

function openUpdateModal(student) {
  currentUpdateStudent = student;
  updateModalSubtitle.textContent = student.full_name;
  updateError.hidden = true;
  btnUpdateSubmit.disabled = false;
  btnUpdateSubmit.textContent = 'Save Update';
  btnDeleteStudent.disabled = false;
  btnDeleteStudent.textContent = 'Delete';

  // Build selects
  updateJuzGroup.innerHTML = '';
  const juzLabel = document.createElement('label');
  juzLabel.className = 'form-label';
  juzLabel.htmlFor = 'modal-update-juz';
  juzLabel.textContent = 'Juz';
  const juzSel = buildJuzSelect(student.current_juz);
  juzSel.id   = 'modal-update-juz';
  juzSel.name = 'current_juz';
  updateJuzGroup.appendChild(juzLabel);
  updateJuzGroup.appendChild(juzSel);

  updateSurahGroup.innerHTML = '';
  const surahLabel = document.createElement('label');
  surahLabel.className = 'form-label';
  surahLabel.htmlFor = 'modal-update-surah';
  surahLabel.textContent = 'Surah';
  const surahSel = buildSurahSelect(student.current_surah);
  surahSel.id   = 'modal-update-surah';
  surahSel.name = 'current_surah';
  updateSurahGroup.appendChild(surahLabel);
  updateSurahGroup.appendChild(surahSel);

  // Set ayah & date
  updateAyahInput.value = student.current_ayah;
  updateDateInput.value = new Date().toISOString().split('T')[0];

  // Logic
  filterSurahsByJuz(student.current_juz, surahSel, student.current_surah);
  limitAyahBySurah(student.current_surah, updateAyahInput);

  juzSel.addEventListener('change', () => {
    filterSurahsByJuz(parseInt(juzSel.value, 10), surahSel);
    limitAyahBySurah(surahSel.value, updateAyahInput);
  });

  surahSel.addEventListener('change', () => {
    limitAyahBySurah(surahSel.value, updateAyahInput);
  });

  modalUpdate.removeAttribute('hidden');
  document.body.style.overflow = 'hidden';
}

formUpdate.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!currentUpdateStudent) return;

  updateError.hidden = true;

  const juzSel = document.getElementById('modal-update-juz');
  const surahSel = document.getElementById('modal-update-surah');

  const juz   = parseInt(juzSel.value, 10);
  const surah = surahSel.value;
  const ayahStr = updateAyahInput.value.trim();
  const updateDate = updateDateInput.value;

  if (!surah || !ayahStr || !updateDate) {
    updateError.textContent = 'Please fill all fields correctly.';
    updateError.hidden = false;
    return;
  }

  let startAyah = 0;
  let endAyah = 0;
  if (/^\d+-\d+$/.test(ayahStr)) {
    const parts = ayahStr.split('-');
    startAyah = parseInt(parts[0], 10);
    endAyah = parseInt(parts[1], 10);
    if (startAyah > endAyah) {
      updateError.textContent = 'Invalid range. Start ayah cannot be greater than end ayah.';
      updateError.hidden = false;
      return;
    }
  } else {
    updateError.textContent = "Ayah must be a range (e.g. '2-7'). Single numbers are not allowed.";
    updateError.hidden = false;
    return;
  }

  const ayahMax = SURAH_AYAHS[surah] || 286;
  if (startAyah < 1 || endAyah > ayahMax) {
    updateError.textContent = `${surah} only has ${ayahMax} ayahs. Please enter a valid range within 1 and ${ayahMax}.`;
    updateError.hidden = false;
    return;
  }

  btnUpdateSubmit.disabled = true;
  btnUpdateSubmit.textContent = 'Saving…';

  try {
    await putUpdateStudent(currentUpdateStudent.id, {
      current_juz:   juz,
      current_surah: surah,
      current_ayah:  ayahStr,
      update_date:   updateDate,
    });
    closeUpdateModal();
    await loadAndRender();
  } catch (err) {
    updateError.textContent = err.message;
    updateError.hidden = false;
    btnUpdateSubmit.disabled = false;
    btnUpdateSubmit.textContent = 'Save Update';
  }
});

btnDeleteStudent.addEventListener('click', async () => {
  if (!currentUpdateStudent) return;

  const confirmed = confirm(`Are you sure you want to permanently delete "${currentUpdateStudent.full_name}"?`);
  if (!confirmed) return;

  btnDeleteStudent.disabled = true;
  btnDeleteStudent.textContent = 'Deleting…';

  try {
    await deleteStudent(currentUpdateStudent.id);
    closeUpdateModal();
    await loadAndRender();
  } catch (err) {
    updateError.textContent = err.message;
    updateError.hidden = false;
    btnDeleteStudent.disabled = false;
    btnDeleteStudent.textContent = 'Delete';
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// INITIALISE DROPDOWNS
// ─────────────────────────────────────────────────────────────────────────────

function initDropdowns() {
  // Batch years
  for (let yr = BATCH_YEAR_START; yr <= BATCH_YEAR_END; yr++) {
    const opt = document.createElement('option');
    opt.value = yr;
    opt.textContent = yr;
    selCreateBatch.appendChild(opt);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Format an ISO-8601 UTC date string into a human-readable local date.
 * e.g. "2025-06-15T08:30:00+00:00" → "15 Jun 2025"
 */
function formatDate(isoString) {
  if (!isoString) return '—';
  try {
    return new Date(isoString).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'short', year: 'numeric'
    });
  } catch {
    return isoString;
  }
}

/** Build a <select> element pre-populated with Juz options. */
function buildJuzSelect(selectedJuz, extraClass = '') {
  const sel = document.createElement('select');
  sel.className = `form-select form-select-sm ${extraClass}`.trim();
  sel.setAttribute('aria-label', 'Select Juz');
  for (let j = 1; j <= 30; j++) {
    const opt = document.createElement('option');
    opt.value = j;
    opt.textContent = `Juz ${j}`;
    if (j === selectedJuz) opt.selected = true;
    sel.appendChild(opt);
  }
  return sel;
}

/** Build a <select> element pre-populated with Surah options. */
function buildSurahSelect(selectedSurah, extraClass = '') {
  const sel = document.createElement('select');
  sel.className = `form-select form-select-sm ${extraClass}`.trim();
  sel.setAttribute('aria-label', 'Select Surah');
  SURAH_LIST.forEach((name) => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    if (name === selectedSurah) opt.selected = true;
    sel.appendChild(opt);
  });
  return sel;
}

/**
 * Repopulate a Surah <select> with only the surahs present in the given Juz.
 * Tries to preserve `keepValue` (or the select's current value) if it is still
 * valid for the new Juz; otherwise defaults to the first available Surah.
 *
 * @param {number} juzNum      - Juz number 1–30
 * @param {HTMLSelectElement} surahSel - The <select> to repopulate
 * @param {string} [keepValue] - Surah name to try to keep selected
 */
function filterSurahsByJuz(juzNum, surahSel, keepValue = '') {
  const allowed = JUZ_SURAHS[juzNum] || SURAH_LIST;
  const keep    = keepValue || surahSel.value;

  surahSel.innerHTML = '';
  allowed.forEach((name) => {
    const opt = document.createElement('option');
    opt.value       = name;
    opt.textContent = name;
    surahSel.appendChild(opt);
  });

  // Restore previous selection if still valid; else fall back to first option
  surahSel.value = allowed.includes(keep) ? keep : allowed[0];
}

/**
 * Set the `max` attribute of an Ayah <input> to the total ayah count of the
 * given Surah.  Clamps the current value if it exceeds the new maximum.
 *
 * @param {string}           surahName - Surah name (key in SURAH_AYAHS)
 * @param {HTMLInputElement} ayahInput - The number <input> to constrain
 */
function limitAyahBySurah(surahName, ayahInput) {
  const max = SURAH_AYAHS[surahName] || 286;
  ayahInput.placeholder = `1 – ${max}`;
  ayahInput.title       = `Ayah 1 to ${max} (e.g. 2-7)`;
}

// ─────────────────────────────────────────────────────────────────────────────
// API LAYER — all data MUST come from backend
// ─────────────────────────────────────────────────────────────────────────────

async function apiFetch(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options.headers },
    ...options,
  });
  if (response.status === 204) return null; // No Content
  const data = await response.json();
  if (!response.ok) {
    let msg = 'Request failed.';
    if (typeof data?.detail === 'string') {
      msg = data.detail;
    } else if (data?.detail?.error) {
      msg = data.detail.error;
    } else if (Array.isArray(data?.detail)) {
      msg = data.detail.map(e => e.msg || JSON.stringify(e)).join('; ');
    } else if (data?.error) {
      msg = data.error;
    }
    throw new Error(msg);
  }
  return data;
}

async function fetchAllStudents() {
  return apiFetch('/students');
}

async function postCreateStudent(payload) {
  return apiFetch('/students', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

async function putUpdateStudent(id, payload) {
  return apiFetch(`/students/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

async function deleteStudent(id) {
  return apiFetch(`/students/${id}`, { method: 'DELETE' });
}

// ─────────────────────────────────────────────────────────────────────────────
// RENDER — build DOM from API data (NO hardcoded data)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Main render function.
 * Receives the full student list from the backend and rebuilds the board.
 */
function renderBoard(students) {
  // Clear previous render
  board.innerHTML = '';

  if (!students || students.length === 0) {
    // ── Empty state: centred call-to-action ──────────────────────────────
    document.body.classList.add('is-empty-board');

    const empty = document.createElement('div');
    empty.className = 'empty-state';
    empty.innerHTML = `
      <div class="empty-state__icon" aria-hidden="true">📖</div>
      <h2 class="empty-state__title">No students yet</h2>
      <p class="empty-state__sub">
        Create your first student to start tracking Hifz progress.
      </p>
      <button
        id="btn-open-create-modal-empty"
        class="btn btn-primary btn-lg"
        aria-label="Create first student"
      >
        <span aria-hidden="true">+</span> Create Student
      </button>
    `;
    board.appendChild(empty);

    // Wire the centred button to the same modal as the header button
    document.getElementById('btn-open-create-modal-empty')
      .addEventListener('click', openCreateModal);

    return;
  }

  // ── Has students: restore normal header button layout ────────────────
  document.body.classList.remove('is-empty-board');

  // Group students by batch_year
  const byBatch = {};
  students.forEach((s) => {
    if (!byBatch[s.batch_year]) byBatch[s.batch_year] = [];
    byBatch[s.batch_year].push(s);
  });

  // Sort batch years ascending
  const sortedYears = Object.keys(byBatch).map(Number).sort((a, b) => a - b);

  sortedYears.forEach((year) => {
    const column = buildBatchColumn(year, byBatch[year]);
    board.appendChild(column);
  });
}

/** Build a single batch-year column element. */
function buildBatchColumn(year, students) {
  const col = document.createElement('div');
  col.className = 'batch-column';
  col.dataset.batchYear = year;

  const label = document.createElement('div');
  label.innerHTML = `
    <span class="batch-label">${year} BATCH</span>
    <span class="batch-count">${students.length} student${students.length !== 1 ? 's' : ''}</span>
  `;
  col.appendChild(label);

  students.forEach((student) => {
    col.appendChild(buildStudentCard(student));
  });

  return col;
}

/** Build a single student card element. */
function buildStudentCard(student) {
  const card = document.createElement('div');
  card.className = 'student-card';
  card.dataset.studentId   = student.id;
  card.dataset.studentName = student.full_name.toLowerCase();

  card.innerHTML = `
    <div class="card-name">${escapeHtml(student.full_name)}</div>

    <div class="card-meta">
      <div class="card-meta-row" style="flex-direction: column; align-items: flex-start; gap: 6px;">
        <span class="card-meta-label">Progress</span>
        <span class="card-meta-value" style="font-size: var(--font-size-md); display: flex; align-items: center; gap: 8px; flex-wrap: wrap; line-height: 1.4;">
          <span class="card-juz-badge" style="white-space: nowrap; flex-shrink: 0;">Juz ${student.current_juz}</span>
          <span>${escapeHtml(student.current_surah)} • <span style="white-space: nowrap;">Ayah ${escapeHtml(student.current_ayah)}</span></span>
        </span>
      </div>
    </div>

    <div class="card-divider"></div>

    <div class="card-updated">Updated: ${formatDate(student.last_updated)}</div>

    <div class="card-actions">
      <button
        class="btn btn-secondary btn-sm btn-update-toggle"
        data-id="${student.id}"
        aria-expanded="false"
        aria-controls="update-form-${student.id}"
      >
        Update Progress
      </button>
      <button
        class="btn btn-secondary btn-sm btn-history-toggle"
        data-id="${student.id}"
      >
        Record 🕒
      </button>
    </div>
  `;

  // Toggle update modal
  const toggleBtn = card.querySelector('.btn-update-toggle');
  toggleBtn.addEventListener('click', () => {
    openUpdateModal(student);
  });

  // History button — opens the shared history modal
  const historyBtn = card.querySelector('.btn-history-toggle');
  historyBtn.addEventListener('click', async () => {
    // Open modal immediately with loading state
    openHistoryModal(student.full_name);

    try {
      const history = await apiFetch(`/students/${student.id}/history`);

      const count = history.length;
      historyModalBadge.textContent = count === 0
        ? 'No entries'
        : `${count} ${count === 1 ? 'entry' : 'entries'}`;

      if (count === 0) {
        historyModalBody.innerHTML = `
          <div class="history-empty">
            <div class="history-empty-icon">📋</div>
            <div class="history-empty-text">No progress updates yet.<br>Use "Update Progress" to log the first entry.</div>
          </div>`;
        return;
      }

      // Build timeline
      const timelineHTML = history.map((h, i) => `
        <div class="history-entry">
          <div class="history-entry-dot"></div>
          <div class="history-entry-content">
            <div class="history-entry-date">
              ${escapeHtml(h.update_date)}
              ${i === 0 ? '<span class="latest-tag">Latest</span>' : ''}
            </div>
            <div class="history-entry-details">
              <span class="history-entry-juz">Juz ${h.juz}</span>
              <span class="history-entry-surah">${escapeHtml(h.surah)}</span>
              <span class="history-entry-ayah">Ayah ${escapeHtml(h.ayah)}</span>
            </div>
          </div>
        </div>
      `).join('');

      historyModalBody.innerHTML = `<div class="history-timeline">${timelineHTML}</div>`;

    } catch (err) {
      historyModalBadge.textContent = 'Error';
      historyModalBody.innerHTML = `
        <div class="history-empty">
          <div class="history-empty-icon">⚠️</div>
          <div class="history-empty-text">Failed to load records.<br>${escapeHtml(err.message)}</div>
        </div>`;
    }
  });

  return card;
}

/** Escape HTML to prevent XSS when inserting user data into innerHTML. */
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ─────────────────────────────────────────────────────────────────────────────
// LOAD & RENDER — fetch from backend and draw board
// ─────────────────────────────────────────────────────────────────────────────

async function loadAndRender() {
  // Show loading only on first load (board is empty)
  if (!board.querySelector('.batch-column')) {
    loadingState.style.display = 'block';
  }

  try {
    const students = await fetchAllStudents();
    renderBoard(students);
    // Re-apply any active search filter after render
    applySearch(searchInput.value.trim());
  } catch (err) {
    board.innerHTML = `
      <div class="state-message state-message--error">
        ⚠ Could not connect to backend.<br>
        <small>Make sure the FastAPI server is running on ${API_BASE}</small>
      </div>`;
  } finally {
    loadingState.style.display = 'none';
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// SEARCH — client-side filter; no backend restart, no reload
// ─────────────────────────────────────────────────────────────────────────────

function applySearch(query) {
  const q = query.toLowerCase().trim();

  const columns = board.querySelectorAll('.batch-column');
  columns.forEach((col) => {
    let visibleCards = 0;
    const cards = col.querySelectorAll('.student-card');
    cards.forEach((card) => {
      const name = card.dataset.studentName || '';
      const match = q === '' || name.includes(q);
      card.dataset.hidden = String(!match);
      if (match) visibleCards++;
    });
    // Hide entire column if no cards match
    col.dataset.hidden = String(visibleCards === 0);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// CREATE STUDENT MODAL
// ─────────────────────────────────────────────────────────────────────────────

function openCreateModal() {
  formCreate.reset();
  createError.hidden = true;
  modalCreate.removeAttribute('hidden');
  document.getElementById('create-full-name').focus();
}

function closeCreateModal() {
  modalCreate.setAttribute('hidden', '');
}

btnOpenCreateModal.addEventListener('click', openCreateModal);
btnCloseModal.addEventListener('click', closeCreateModal);

// Close modal on backdrop click
modalCreate.addEventListener('click', (e) => {
  if (e.target === modalCreate) closeCreateModal();
});

// Close modal on Escape key (unified)
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (!modalCreate.hasAttribute('hidden')) closeCreateModal();
    else if (!modalHistory.hasAttribute('hidden')) closeHistoryModal();
    else if (!modalUpdate.hasAttribute('hidden')) closeUpdateModal();
  }
});


formCreate.addEventListener('submit', async (e) => {
  e.preventDefault();
  createError.hidden = true;

  const fullName  = document.getElementById('create-full-name').value.trim();
  const batchYear = parseInt(selCreateBatch.value, 10);

  // Basic client-side guard before hitting the API
  if (!fullName) {
    createError.textContent = 'Full name is required.';
    createError.hidden = false;
    return;
  }

  if (isNaN(batchYear)) {
    createError.textContent = 'Please select a valid batch year.';
    createError.hidden = false;
    return;
  }

  const submitBtn = formCreate.querySelector('[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Creating…';

  try {
    await postCreateStudent({
      full_name:     fullName,
      batch_year:    batchYear,
      current_juz:   1,
      current_surah: "Al-Fatihah",
      current_ayah:  "1-1",
    });
    closeCreateModal();
    // Re-fetch from backend — single source of truth
    await loadAndRender();
  } catch (err) {
    createError.textContent = err.message;
    createError.hidden = false;
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = 'Create Student';
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// SEARCH EVENT
// ─────────────────────────────────────────────────────────────────────────────

searchInput.addEventListener('input', () => {
  applySearch(searchInput.value.trim());
});

// ─────────────────────────────────────────────────────────────────────────────
// SPLASH SCREEN — remove from DOM after CSS exit animation completes
// ─────────────────────────────────────────────────────────────────────────────

function initSplash() {
  const splash = document.getElementById('splash');
  if (!splash) return;

  // The CSS `splashExit` animation runs at 2.5s delay + 0.7s duration = 3.2s.
  // We listen for animationend on the splash element itself (not children).
  splash.addEventListener('animationend', (e) => {
    if (e.target === splash && e.animationName === 'splashExit') {
      splash.remove();
    }
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// BOOT
// ─────────────────────────────────────────────────────────────────────────────

(async function init() {
  initSplash();          // register splash removal listener first
  initDropdowns();
  await loadAndRender();
})();
