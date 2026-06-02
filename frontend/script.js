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
const API_BASE = window.location.protocol + '//' + window.location.hostname + ':8081';

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
const selCreateStartJuz  = document.getElementById('create-start-juz');
const createHasPreviousJuz = document.getElementById('create-has-previous-juz');
const createPreviousJuzSection = document.getElementById('create-previous-juz-section');
const createJuzGrid      = document.getElementById('create-juz-grid');

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

// Daily Progress Tab References
const formDailyProgress     = document.getElementById('form-daily-progress');
const dpSabaqNotRecited     = document.getElementById('dp-sabaq-not-recited');
const dpSpNotRecited        = document.getElementById('dp-sp-not-recited');
const dpSabaqJuzGroup       = document.getElementById('dp-sabaq-juz-group');
const dpSabaqSurahGroup     = document.getElementById('dp-sabaq-surah-group');
const dpSpJuzInput          = document.getElementById('dp-sp-juz');
const dpSpSurahGroup        = document.getElementById('dp-sp-surah-group');
const paraEntriesContainer  = document.getElementById('para-entries-container');
const btnAddPara            = document.getElementById('btn-add-para');
const dpDateInput           = document.getElementById('dp-date');
const dpCommentInput        = document.getElementById('dp-comment');
const dpError               = document.getElementById('dp-error');
const btnDpSubmit           = document.getElementById('btn-dp-submit');

let currentUpdateStudent = null;
let currentMemorizedAyahsSet = {}; // Tracks exact Ayahs memorized per Surah for strict validation
let currentMemorizedJuz = [];

function closeUpdateModal() {
  modalUpdate.setAttribute('hidden', '');
  document.body.style.overflow = '';
  currentUpdateStudent = null;
  currentMemorizedJuz = [];
}

btnCloseUpdateModal.addEventListener('click', closeUpdateModal);

modalUpdate.addEventListener('click', (e) => {
  if (e.target === modalUpdate) closeUpdateModal();
});

async function openUpdateModal(student) {
  currentUpdateStudent = student;
  updateModalSubtitle.textContent = student.full_name;
  dpError.hidden = true;
  
  btnDpSubmit.disabled = false;
  btnDpSubmit.textContent = 'Submit Daily Progress';
  btnDeleteStudent.disabled = false;
  btnDeleteStudent.textContent = 'Delete';

  const todayDate = new Date().toISOString().split('T')[0];

  // --- DAILY PROGRESS FORM ---
  formDailyProgress.reset();
  dpDateInput.value = todayDate; // Re-set after reset()
  
  // Sabaq Dropdowns
  dpSabaqJuzGroup.innerHTML = '';
  const dpSabaqJuzLabel = document.createElement('label');
  dpSabaqJuzLabel.className = 'form-label';
  dpSabaqJuzLabel.textContent = 'Juz';
  const dpSabaqJuzSel = buildJuzSelect(student.current_juz);
  dpSabaqJuzSel.id = 'dp-sabaq-juz';
  dpSabaqJuzGroup.appendChild(dpSabaqJuzLabel);
  dpSabaqJuzGroup.appendChild(dpSabaqJuzSel);
  
  dpSabaqSurahGroup.innerHTML = '';
  const dpSabaqSurahLabel = document.createElement('label');
  dpSabaqSurahLabel.className = 'form-label';
  dpSabaqSurahLabel.textContent = 'Surah';
  const dpSabaqSurahSel = buildSurahSelect(student.current_surah);
  dpSabaqSurahSel.id = 'dp-sabaq-surah';
  dpSabaqSurahGroup.appendChild(dpSabaqSurahLabel);
  dpSabaqSurahGroup.appendChild(dpSabaqSurahSel);

  filterSurahsByJuz(student.current_juz, dpSabaqSurahSel, student.current_surah);
  dpSabaqJuzSel.addEventListener('change', () => filterSurahsByJuz(parseInt(dpSabaqJuzSel.value, 10), dpSabaqSurahSel));

  // Sabaq Para Dropdowns (Juz is locked)
  dpSpJuzInput.value = `Juz ${student.current_juz}`;
  dpSpJuzInput.dataset.val = student.current_juz;

  dpSpSurahGroup.innerHTML = '';
  const dpSpSurahLabel = document.createElement('label');
  dpSpSurahLabel.className = 'form-label';
  dpSpSurahLabel.textContent = 'Surah';
  const dpSpSurahSel = buildSurahSelect(student.current_surah);
  dpSpSurahSel.id = 'dp-sp-surah';
  dpSpSurahGroup.appendChild(dpSpSurahLabel);
  dpSpSurahGroup.appendChild(dpSpSurahSel);
  filterSurahsByJuz(student.current_juz, dpSpSurahSel, student.current_surah);

  // Fetch memorized juz for PARA dropdowns
  paraEntriesContainer.innerHTML = '<div style="color:var(--color-text-muted); font-size:12px;">Loading memorized juz...</div>';
  try {
    const [history, dailyProgress] = await Promise.all([
      apiFetch(`/students/${student.id}/history`),
      apiFetch(`/students/${student.id}/daily-progress`)
    ]);
    
    currentMemorizedAyahsSet = {};
    const addAyahsToSet = (surah, start, end) => {
        if (!currentMemorizedAyahsSet[surah]) {
            currentMemorizedAyahsSet[surah] = new Set();
        }
        for (let i = start; i <= end; i++) {
            currentMemorizedAyahsSet[surah].add(i);
        }
    };
    
    const juzSet = new Set();
    let hasCurrentJuzHistory = false;
    
    // Phase G: Add previous juz to the PARA dropdown
    if (student.previous_juz) {
        student.previous_juz.split(',').forEach(j => {
            const num = parseInt(j.trim(), 10);
            if (!isNaN(num) && num !== student.current_juz) {
                juzSet.add(num);
            }
        });
    }

    history.forEach(h => {
        if (h.juz === student.current_juz) {
            hasCurrentJuzHistory = true;
        } else if (h.juz) {
            juzSet.add(h.juz);
        }
        
        // Phase F.1: Map exact ayahs from legacy history
        if (h.surah && h.ayah) {
            const match = String(h.ayah).match(/(\d+)-(\d+)/);
            if (match) {
                let sA = parseInt(match[1], 10);
                let eA = parseInt(match[2], 10);
                if (!isNaN(sA) && !isNaN(eA)) addAyahsToSet(h.surah, sA, eA);
            } else {
                // If it's a single number, assume it's just that ayah or 1 to that ayah. We'll do 1 to that ayah to be safe for legacy.
                let eA = parseInt(h.ayah, 10);
                if (!isNaN(eA)) addAyahsToSet(h.surah, 1, eA);
            }
        }
    });
    
    dailyProgress.forEach(dp => {
        // We only care about SABAQ entries that were actually recited
        if (dp.type === 'SABAQ' && !dp.not_recited && dp.surah && dp.start_ayah && dp.end_ayah) {
            let sA = parseInt(dp.start_ayah, 10);
            let eA = parseInt(dp.end_ayah, 10);
            if (!isNaN(sA) && !isNaN(eA)) {
                addAyahsToSet(dp.surah, sA, eA);
            }
        }
    });

    currentMemorizedJuz = Array.from(juzSet).sort((a,b) => a - b);
    paraEntriesContainer.innerHTML = ''; // Clear loading

    // --- PHASE D: DYNAMIC LOCKING ---

    // 1. SABAQ PARA Locking (First Lesson Rule)
    const dpSpSection = document.getElementById('dp-sp-section');
    const existingSpOverlay = document.getElementById('sp-locked-overlay');
    if (existingSpOverlay) existingSpOverlay.remove();
    
    if (!hasCurrentJuzHistory) {
        dpSpSection.classList.add('locked');
        const overlay = document.createElement('div');
        overlay.id = 'sp-locked-overlay';
        overlay.className = 'locked-overlay';
        overlay.innerHTML = `<div class="locked-icon">🔒</div><div class="locked-text">FIRST LESSON IN JUZ ${student.current_juz}</div>`;
        dpSpSection.appendChild(overlay);
        
        // Force "Not Recited" to safely exclude from submission payload
        dpSpNotRecited.checked = true;
        dpSpNotRecited.dispatchEvent(new Event('change'));
    } else {
        dpSpSection.classList.remove('locked');
        
        // Reset Not Recited checkbox
        dpSpNotRecited.checked = false;
        dpSpNotRecited.dispatchEvent(new Event('change'));

        // --- SMART DEFAULT: Pre-fill Sabaq Para ayah range ---
        // Rule:
        //   Start Ayah = 1 (first ayah of the first surah of this Juz)
        //   End Ayah   = end_ayah from the most recent SABAQ PARA record
        //   Surah      = first surah of the current Juz (the para always starts there)

        // Find latest SABAQ PARA record (dailyProgress is already sorted latest-first by the API)
        const latestSpRecord = dailyProgress
            .filter(dp => dp.type === 'SABAQ PARA' && !dp.not_recited && dp.end_ayah)
            .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))[0];

        // Get the first surah in the current Juz from JUZ_SURAHS
        const juzSurahList = JUZ_SURAHS[student.current_juz] || [];
        const firstSurahOfJuz = juzSurahList.length > 0 ? juzSurahList[0] : student.current_surah;

        // Set the Sabaq Para surah dropdown to the first surah of the juz
        const dpSpSurahEl = document.getElementById('dp-sp-surah');
        if (dpSpSurahEl) {
            dpSpSurahEl.value = firstSurahOfJuz;
        }

        // Pre-fill start ayah = 1
        const dpSpStartEl = document.getElementById('dp-sp-start');
        if (dpSpStartEl) {
            dpSpStartEl.value = 1;
        }

        // Pre-fill end ayah = end_ayah from latest SABAQ PARA record (if one exists)
        // Cap it to the surah's actual total ayah count to avoid invalid defaults.
        const dpSpEndEl = document.getElementById('dp-sp-end');
        const surahMaxAyahs = SURAH_AYAHS[firstSurahOfJuz] || 999;
        if (dpSpEndEl && latestSpRecord && latestSpRecord.end_ayah) {
            dpSpEndEl.value = Math.min(latestSpRecord.end_ayah, surahMaxAyahs);
        } else if (dpSpEndEl) {
            dpSpEndEl.value = ''; // No previous record — leave blank for manual entry
        }
    }

    // 2. PARA Locking (Completed Juz Rule)
    const dpParaSection = document.getElementById('dp-para-section');
    const existingParaOverlay = document.getElementById('para-locked-overlay');
    if (existingParaOverlay) existingParaOverlay.remove();
    
    if (currentMemorizedJuz.length === 0) {
        dpParaSection.classList.add('locked');
        const overlay = document.createElement('div');
        overlay.id = 'para-locked-overlay';
        overlay.className = 'locked-overlay';
        overlay.innerHTML = `<div class="locked-icon">🔒</div><div class="locked-text">NO COMPLETED JUZ YET</div>`;
        dpParaSection.appendChild(overlay);
    } else {
        dpParaSection.classList.remove('locked');
    }
  } catch (err) {
    paraEntriesContainer.innerHTML = '<div class="form-error">Failed to load history</div>';
  }

  modalUpdate.removeAttribute('hidden');
  document.body.style.overflow = 'hidden';
}

// --- DAILY PROGRESS UI LOGIC ---

dpSabaqNotRecited.addEventListener('change', (e) => {
  const disabled = e.target.checked;
  const inputs = document.getElementById('dp-sabaq-fields').querySelectorAll('select, input');
  inputs.forEach(inp => {
    inp.disabled = disabled;
    if (disabled) inp.classList.add('disabled-input');
    else inp.classList.remove('disabled-input');
  });
});

dpSpNotRecited.addEventListener('change', (e) => {
  const disabled = e.target.checked;
  const fieldsContainer = document.getElementById('dp-sp-fields');
  const selects = fieldsContainer.querySelectorAll('select');
  const inputs = fieldsContainer.querySelectorAll('input[type="number"]');
  [...selects, ...inputs].forEach(inp => {
    inp.disabled = disabled;
    if (disabled) inp.classList.add('disabled-input');
    else inp.classList.remove('disabled-input');
  });
});

let paraEntryCount = 0;
btnAddPara.addEventListener('click', () => {
  if (currentMemorizedJuz.length === 0) {
    alert("This student has no memorized juz on record yet.");
    return;
  }
  
  paraEntryCount++;
  const id = `para-${paraEntryCount}`;
  
  const card = document.createElement('div');
  card.className = 'para-entry-card dp-grid';
  card.id = id;
  
  const closeBtn = document.createElement('button');
  closeBtn.type = 'button';
  closeBtn.className = 'btn-remove-para';
  closeBtn.innerHTML = '✕';
  closeBtn.onclick = () => card.remove();
  
  const juzGroup = document.createElement('div');
  juzGroup.className = 'form-group';
  const juzLabel = document.createElement('label');
  juzLabel.className = 'form-label';
  juzLabel.textContent = 'Juz';
  const juzSel = document.createElement('select');
  juzSel.className = 'form-select dp-para-juz-sel';
  currentMemorizedJuz.forEach(j => {
    const opt = document.createElement('option');
    opt.value = j;
    opt.textContent = `Juz ${j}`;
    juzSel.appendChild(opt);
  });
  juzGroup.appendChild(juzLabel);
  juzGroup.appendChild(juzSel);
  
  const surahGroup = document.createElement('div');
  surahGroup.className = 'form-group';
  const surahLabel = document.createElement('label');
  surahLabel.className = 'form-label';
  surahLabel.textContent = 'Surah';
  const surahSel = document.createElement('select');
  surahSel.className = 'form-select dp-para-surah-sel';
  surahGroup.appendChild(surahLabel);
  surahGroup.appendChild(surahSel);
  
  const startGroup = document.createElement('div');
  startGroup.className = 'form-group';
  startGroup.innerHTML = `<label class="form-label">Start Ayah</label><input type="number" class="form-input dp-para-start" min="1">`;
  
  const endGroup = document.createElement('div');
  endGroup.className = 'form-group';
  endGroup.innerHTML = `<label class="form-label">End Ayah</label><input type="number" class="form-input dp-para-end" min="1">`;
  
  const notRecitedGroup = document.createElement('div');
  notRecitedGroup.className = 'form-group';
  notRecitedGroup.style.gridColumn = "1 / -1";
  notRecitedGroup.innerHTML = `
    <label class="dp-checkbox" style="margin-top:var(--space-2);">
      <input type="checkbox" class="dp-para-not-recited">
      <span class="dp-checkmark"></span> Not Recited Today
    </label>
  `;
  
  card.appendChild(closeBtn);
  card.appendChild(juzGroup);
  card.appendChild(surahGroup);
  card.appendChild(startGroup);
  card.appendChild(endGroup);
  card.appendChild(notRecitedGroup);
  
  paraEntriesContainer.appendChild(card);
  
  filterSurahsByJuz(parseInt(juzSel.value, 10), surahSel);
  juzSel.addEventListener('change', () => filterSurahsByJuz(parseInt(juzSel.value, 10), surahSel));
  
  const checkbox = card.querySelector('.dp-para-not-recited');
  checkbox.addEventListener('change', (e) => {
    const disabled = e.target.checked;
    [juzSel, surahSel, card.querySelector('.dp-para-start'), card.querySelector('.dp-para-end')].forEach(inp => {
      inp.disabled = disabled;
      if (disabled) inp.classList.add('disabled-input');
      else inp.classList.remove('disabled-input');
    });
  });
});

// --- SUBMIT DAILY PROGRESS & OPTION B ---
formDailyProgress.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!currentUpdateStudent) return;
  dpError.hidden = true;

  const records = [];
  
  // Parse Sabaq
  const sabaqNotRecited = dpSabaqNotRecited.checked;
  const sabaqJuz = parseInt(document.getElementById('dp-sabaq-juz').value, 10);
  const sabaqSurah = document.getElementById('dp-sabaq-surah').value;
  const sabaqStart = parseInt(document.getElementById('dp-sabaq-start').value, 10);
  const sabaqEnd = parseInt(document.getElementById('dp-sabaq-end').value, 10);
  
  if (!sabaqNotRecited && (!sabaqStart || !sabaqEnd)) {
    dpError.textContent = "Please fill Sabaq ayahs.";
    dpError.hidden = false;
    return;
  }
  
  records.push({
    type: "SABAQ",
    juz: sabaqNotRecited ? null : sabaqJuz,
    surah: sabaqNotRecited ? null : sabaqSurah,
    start_ayah: sabaqNotRecited ? null : sabaqStart,
    end_ayah: sabaqNotRecited ? null : sabaqEnd,
    not_recited: sabaqNotRecited
  });
  
  // Parse Sabaq Para
  const spNotRecited = dpSpNotRecited.checked;
  const spJuz = parseInt(dpSpJuzInput.dataset.val, 10);
  const spSurah = document.getElementById('dp-sp-surah').value;
  const spStart = parseInt(document.getElementById('dp-sp-start').value, 10);
  const spEnd = parseInt(document.getElementById('dp-sp-end').value, 10);
  
  if (!spNotRecited) {
    if (!spStart || !spEnd) {
      dpError.textContent = "Please fill Sabaq Para ayahs.";
      dpError.hidden = false;
      return;
    }

    // Check 1: Validate ayah numbers don't exceed what the Surah actually has.
    const surahTotalAyahs = SURAH_AYAHS[spSurah] || 999;
    const outOfRange = [];
    for (let i = spStart; i <= spEnd; i++) {
        if (i > surahTotalAyahs) outOfRange.push(i);
    }
    if (outOfRange.length > 0) {
      const rangeStr = outOfRange.length === 1
        ? `Ayah ${outOfRange[0]}`
        : `Ayah ${outOfRange[0]}-${outOfRange[outOfRange.length - 1]}`;
      dpError.textContent = `${spSurah} only has ${surahTotalAyahs} ayahs. ${rangeStr} does not exist in this Surah.`;
      dpError.hidden = false;
      return;
    }

    // Check 2: Validate against EXACT memorized ayahs
    const memorizedSet = currentMemorizedAyahsSet[spSurah] || new Set();
    const missingAyahs = [];
    for (let i = spStart; i <= spEnd; i++) {
        if (!memorizedSet.has(i)) {
            missingAyahs.push(i);
        }
    }
    
    if (missingAyahs.length > 0) {
      const missingRanges = formatMissingRanges(missingAyahs);
      dpError.textContent = `Some selected ayath are not memorized yet. Missing in SABAQ history: Ayah(s) ${missingRanges} in ${spSurah}.`;
      dpError.hidden = false;
      return;
    }
  }
  
  records.push({
    type: "SABAQ PARA",
    juz: spNotRecited ? null : spJuz,
    surah: spNotRecited ? null : spSurah,
    start_ayah: spNotRecited ? null : spStart,
    end_ayah: spNotRecited ? null : spEnd,
    not_recited: spNotRecited
  });
  
  // Parse Para(s)
  const paraCards = paraEntriesContainer.querySelectorAll('.para-entry-card');
  for (let card of paraCards) {
    const pNotRecited = card.querySelector('.dp-para-not-recited').checked;
    const pJuz = parseInt(card.querySelector('.dp-para-juz-sel').value, 10);
    const pSurah = card.querySelector('.dp-para-surah-sel').value;
    const pStart = parseInt(card.querySelector('.dp-para-start').value, 10);
    const pEnd = parseInt(card.querySelector('.dp-para-end').value, 10);
    
    if (!pNotRecited && (!pStart || !pEnd)) {
      dpError.textContent = "Please fill ayahs for all Para entries.";
      dpError.hidden = false;
      return;
    }
    records.push({
      type: "PARA",
      juz: pNotRecited ? null : pJuz,
      surah: pNotRecited ? null : pSurah,
      start_ayah: pNotRecited ? null : pStart,
      end_ayah: pNotRecited ? null : pEnd,
      not_recited: pNotRecited
    });
  }
  
  const comment = dpCommentInput.value.trim();
  const date = dpDateInput.value;
  
  if (!date) {
    dpError.textContent = "Date is required.";
    dpError.hidden = false;
    return;
  }
  
  const payload = {
    date: date,
    records: records,
    comment: comment || null
  };
  
  btnDpSubmit.disabled = true;
  btnDpSubmit.textContent = 'Saving...';
  
  try {
    // 1. Save daily progress first
    await apiFetch(`/students/${currentUpdateStudent.id}/daily-progress`, {
      method: 'POST',
      body: JSON.stringify(payload)
    });
    
    // 2. ONLY IF valid SABAQ exists, automatically call existing PUT
    if (!sabaqNotRecited) {
      await putUpdateStudent(currentUpdateStudent.id, {
        current_juz: sabaqJuz,
        current_surah: sabaqSurah,
        current_ayah: `${sabaqStart}-${sabaqEnd}`,
        update_date: date
      });
    }
    
    closeUpdateModal();
    await loadAndRender();
  } catch (err) {
    dpError.textContent = err.message;
    dpError.hidden = false;
    btnDpSubmit.disabled = false;
    btnDpSubmit.textContent = 'Submit Daily Progress';
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
  
  // Starting Juz
  for (let j = 1; j <= 30; j++) {
    const opt = document.createElement('option');
    opt.value = j;
    opt.textContent = `Juz ${j}`;
    selCreateStartJuz.appendChild(opt);
  }
  
  // Phase G: Previous Juz Grid
  for (let j = 1; j <= 30; j++) {
    const btn = document.createElement('div');
    btn.className = 'juz-btn';
    btn.textContent = j;
    btn.dataset.juz = j;
    btn.addEventListener('click', () => {
      if (!btn.classList.contains('disabled')) {
        btn.classList.toggle('selected');
      }
    });
    createJuzGrid.appendChild(btn);
  }
  
  const updateDisabledJuz = () => {
    const startJuz = selCreateStartJuz.value;
    createJuzGrid.querySelectorAll('.juz-btn').forEach(btn => {
      if (btn.dataset.juz === startJuz) {
        btn.classList.add('disabled');
        btn.classList.remove('selected');
      } else {
        btn.classList.remove('disabled');
      }
    });
  };
  
  selCreateStartJuz.addEventListener('change', updateDisabledJuz);
  // Initial call
  updateDisabledJuz();
  
  createHasPreviousJuz.addEventListener('change', (e) => {
    if (e.target.checked) {
      createPreviousJuzSection.style.display = 'block';
    } else {
      createPreviousJuzSection.style.display = 'none';
      // Clear selections if unchecked
      createJuzGrid.querySelectorAll('.juz-btn.selected').forEach(b => b.classList.remove('selected'));
    }
  });
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

/** Formats an array of missing ayahs into compact ranges (e.g., [11,12,13,15] -> "11-13, 15") */
function formatMissingRanges(missing) {
  if (missing.length === 0) return "";
  missing.sort((a,b) => a - b);
  let ranges = [];
  let start = missing[0];
  let end = missing[0];
  for (let i = 1; i < missing.length; i++) {
    if (missing[i] === end + 1) {
      end = missing[i];
    } else {
      ranges.push(start === end ? `${start}` : `${start}-${end}`);
      start = missing[i];
      end = missing[i];
    }
  }
  ranges.push(start === end ? `${start}` : `${start}-${end}`);
  return ranges.join(", ");
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
    credentials: 'include',
    ...options,
  });
  
  if (response.status === 401) {
    window.location.href = 'login.html';
    throw new Error('Unauthorized');
  }
  
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
      const [history, dailyProgress] = await Promise.all([
        apiFetch(`/students/${student.id}/history`),
        apiFetch(`/students/${student.id}/daily-progress`)
      ]);

      const grouped = {};
      
      // Find all dates that have at least one Daily Progress record
      const datesWithDailyProgress = new Set(dailyProgress.map(dp => dp.date));

      // Process legacy history
      history.forEach(item => {
        // Skip legacy update if we have a detailed daily progress for this date
        if (datesWithDailyProgress.has(item.update_date)) return;
        
        if (!grouped[item.update_date]) grouped[item.update_date] = [];
        grouped[item.update_date].push({
          isLegacy: true,
          ...item
        });
      });

      // Process daily progress
      dailyProgress.forEach(item => {
        // Group by exact submission timestamp to show multiple submissions per day
        const key = item.created_at;
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(item);
      });

      // Sort keys descending. (ISO timestamps and YYYY-MM-DD sort naturally)
      const sortedKeys = Object.keys(grouped).sort((a,b) => b.localeCompare(a));
      
      if (sortedKeys.length === 0) {
        historyModalBadge.textContent = 'No entries';
        historyModalBody.innerHTML = `
          <div class="history-empty">
            <div class="history-empty-icon">📋</div>
            <div class="history-empty-text">No progress updates yet.<br>Use "Update Progress" to log the first entry.</div>
          </div>`;
        return;
      }
      
      historyModalBadge.textContent = `${sortedKeys.length} Entr${sortedKeys.length > 1 ? 'ies' : 'y'}`;

      let timelineHTML = '';
      
      sortedKeys.forEach((key, index) => {
         const records = grouped[key];
         let dateContent = '';
         
         // Extract comment from the first record that has one
         const groupComment = records.find(r => !r.isLegacy && r.comment)?.comment;
         
         records.forEach(r => {
            if (r.isLegacy) {
               dateContent += `
                 <div class="tl-item legacy sabaq">
                   <div class="tl-type-wrapper"><span class="tl-type">SABAQ</span> <span class="tl-badge badge-legacy" style="background: rgba(99, 102, 241, 0.15); color: #818cf8; font-size: 10px; padding: 2px 6px; border-radius: 4px; font-weight: 600; border: 1px solid rgba(99, 102, 241, 0.3);">Legacy</span></div>
                   <div class="tl-detail">Juz ${r.juz}, ${escapeHtml(r.surah)} (${escapeHtml(r.ayah)})</div>
                 </div>`;
            } else {
               let badge = r.not_recited ? '<span class="tl-badge badge-not-recited">Not Recited</span>' : '';
               let detail = r.not_recited ? '' : (r.surah ? `Juz ${r.juz}, ${escapeHtml(r.surah)} (${r.start_ayah}-${r.end_ayah})` : `Juz ${r.juz}`);
               let typeClass = r.type.replace(' ', '-').toLowerCase();
               
               dateContent += `
                 <div class="tl-item ${typeClass} ${r.not_recited ? 'not-recited' : ''}">
                   <div class="tl-type-wrapper"><span class="tl-type">${r.type}</span> ${badge}</div>
                   ${detail ? `<div class="tl-detail">${detail}</div>` : ''}
                 </div>`;
            }
         });
         
         // Append the comment as a distinct timeline item inside the card
         if (groupComment) {
             dateContent += `
                 <div class="tl-item comment" style="margin-top: 4px;">
                   <div class="tl-type">COMMENT</div>
                   <div class="tl-detail">"${escapeHtml(groupComment)}"</div>
                 </div>`;
         }
         
         // Format the display date/time
         let displayDate = '';
         if (key.includes('T')) {
             const d = new Date(key);
             displayDate = d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) + 
                           ', ' + d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
         } else {
             displayDate = formatDate(key); // Legacy string
         }
         
         if (dateContent) {
           timelineHTML += `
             <div class="history-entry">
               <div class="history-entry-dot"></div>
               <div class="history-entry-content">
                 <div class="history-entry-date">
                   ${displayDate}
                   ${index === 0 ? '<span class="latest-tag">Latest</span>' : ''}
                 </div>
                 <div class="tl-card">
                   ${dateContent}
                 </div>
               </div>
             </div>
           `;
         }
      });
      
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
  const startJuz  = parseInt(selCreateStartJuz.value, 10) || 1;

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

  // Phase G: Gather previous juz
  let previousJuz = [];
  if (createHasPreviousJuz.checked) {
    const selectedBtns = createJuzGrid.querySelectorAll('.juz-btn.selected');
    selectedBtns.forEach(btn => previousJuz.push(parseInt(btn.dataset.juz, 10)));
  }

  const submitBtn = formCreate.querySelector('[type="submit"]');
  submitBtn.disabled = true;
  submitBtn.textContent = 'Creating…';

  try {
    const firstSurah = JUZ_SURAHS[startJuz][0];
    await postCreateStudent({
      full_name:     fullName,
      batch_year:    batchYear,
      current_juz:   startJuz,
      current_surah: firstSurah,
      current_ayah:  "1-1",
      previous_juz:  previousJuz,
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
// LOGOUT
// ─────────────────────────────────────────────────────────────────────────────

const btnLogout = document.getElementById('btn-logout');
if (btnLogout) {
  btnLogout.addEventListener('click', async () => {
    btnLogout.disabled = true;
    btnLogout.textContent = 'Logging out...';
    try {
      await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        credentials: 'include'
      });
    } catch (err) {
      console.warn("Logout request failed:", err);
    }
    window.location.href = 'login.html';
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
