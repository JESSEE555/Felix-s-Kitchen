/* ============================================================
   Progress store (v2) — persisted via localStorage so progress
   survives across pages. Falls back to an in-memory object if
   storage isn't available so pages never crash because of it.

   v2 schema: Italian and French are tracked as completely
   separate buckets (lessons completed, vocab, pronunciation /
   grammar scores) under `languages`, since a learner's progress
   in one language should never bleed into or block the other.
   XP, streak and the daily activity log stay shared/global —
   showing up to practice either language still counts toward
   one streak.
   ============================================================ */
const PROGRESS_KEY = 'lingua-progress-v2';
const PROGRESS_LANGUAGES = ['Italian', 'French'];
let _memProgress = null;

function _defaultLanguageBucket(){
  return {
    lessonsCompleted: {},     // { lessonId: { timesCompleted, lastScore, lastCompletedAt, skipped } }
    vocab: [],                // [{ word, meaning, status: 'learning'|'mastered', addedAt }]
    pronunciationScores: [],  // numbers 0-100, most recent last
    grammarScores: [],        // numbers 0-100, most recent last
    autoPlaced: false,        // true once the placement-test level has been used to auto-skip early units
    placedLevel: null         // the CEFR level the learner was placed at, e.g. 'B1'
  };
}

function _defaultProgress(){
  const languages = {};
  PROGRESS_LANGUAGES.forEach(l => { languages[l] = _defaultLanguageBucket(); });
  return {
    xp: 0,
    lastActiveDate: null,     // 'YYYY-MM-DD', last day any XP was earned
    streakDays: 0,
    activityLog: {},          // { 'YYYY-MM-DD': xpEarnedThatDay }
    languages
  };
}

function _today(){
  return new Date().toISOString().slice(0,10);
}
function _yesterday(){
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0,10);
}

// Normalizes whatever was loaded (old shape, partial shape, etc.) into a
// full v2-shaped object so every reader can assume every field exists.
function _normalize(raw){
  const base = _defaultProgress();
  if(!raw || typeof raw !== 'object') return base;
  const p = Object.assign(base, raw);
  p.languages = p.languages || {};
  PROGRESS_LANGUAGES.forEach(l => {
    p.languages[l] = Object.assign(_defaultLanguageBucket(), p.languages[l] || {});
  });
  return p;
}

function _load(){
  try{
    const raw = localStorage.getItem(PROGRESS_KEY);
    return raw ? _normalize(JSON.parse(raw)) : _defaultProgress();
  }catch(e){
    return _memProgress || (_memProgress = _defaultProgress());
  }
}
let _suppressCloud = false;
function _save(p){
  try{ localStorage.setItem(PROGRESS_KEY, JSON.stringify(p)); }
  catch(e){ _memProgress = p; }
  // Mirror to Firestore (debounced) when a user is signed in.
  if(!_suppressCloud && window.LinguaCloud) window.LinguaCloud.queueSave(p);
}

// Resolves with window.LinguaCloud once firebase-cloud.js has loaded, or
// null if it never does (offline / blocked) — pages await this so they can
// sync once but still work without it.
window.LinguaCloudReady = new Promise(res => {
  window.__linguaCloudResolve = res;
  setTimeout(() => res(window.LinguaCloud || null), 10000);
});

function _bucket(p, language){
  if(!p.languages[language]) p.languages[language] = _defaultLanguageBucket();
  return p.languages[language];
}

// Bumps the streak counter at most once per calendar day, called whenever
// the learner does something that counts as "showing up" (finishing a
// lesson, practicing speaking, etc) in EITHER language.
function _touchStreakOnActivity(p){
  const today = _today();
  if(p.lastActiveDate === today) return p;
  p.streakDays = (p.lastActiveDate === _yesterday()) ? p.streakDays + 1 : 1;
  p.lastActiveDate = today;
  return p;
}

const Progress = {
  get(){ return _load(); },

  // Convenience accessor for just one language's bucket (lessons, vocab,
  // scores) — everything that must stay fully separate between languages.
  getLanguage(language){
    return _bucket(_load(), language);
  },

  addXp(amount){
    const p = _load();
    const today = _today();
    p.xp += amount;
    p.activityLog[today] = (p.activityLog[today] || 0) + amount;
    _touchStreakOnActivity(p);
    _save(p);
    return p;
  },

  completeLesson(language, lessonId, { xp = 10, score = null, skipped = false } = {}){
    const p = _load();
    const bucket = _bucket(p, language);
    const today = _today();
    const existing = bucket.lessonsCompleted[lessonId];
    bucket.lessonsCompleted[lessonId] = {
      timesCompleted: (existing ? existing.timesCompleted : 0) + 1,
      lastScore: score,
      lastCompletedAt: new Date().toISOString(),
      skipped: !!skipped
    };
    if(xp > 0){
      p.xp += xp;
      p.activityLog[today] = (p.activityLog[today] || 0) + xp;
    }
    _touchStreakOnActivity(p);
    _save(p);
    return p;
  },

  // Lets a learner who already knows the material mark a lesson done
  // without going through the exercises — no XP, flagged as skipped so
  // progress views can show it was skipped rather than completed.
  skipLesson(language, lessonId){
    return this.completeLesson(language, lessonId, { xp: 0, score: 'skipped', skipped: true });
  },

  isLessonComplete(language, lessonId){
    return !!_bucket(_load(), language).lessonsCompleted[lessonId];
  },

  isLessonSkipped(language, lessonId){
    const l = _bucket(_load(), language).lessonsCompleted[lessonId];
    return !!(l && l.skipped);
  },

  // Records that this language's units have already been auto-placed
  // against the learner's CEFR level (so units below that level get
  // auto-skipped exactly once, the first time the dashboard loads after
  // placement — never again, so manually redoing an earlier unit later
  // doesn't get silently re-skipped).
  markAutoPlaced(language, level){
    const p = _load();
    const bucket = _bucket(p, language);
    bucket.autoPlaced = true;
    bucket.placedLevel = level;
    _save(p);
    return p;
  },

  addVocab(language, words){ // [{word, meaning}]
    const p = _load();
    const bucket = _bucket(p, language);
    (words || []).forEach(w => {
      const exists = bucket.vocab.some(v => v.word.toLowerCase() === w.word.toLowerCase());
      if(!exists){
        bucket.vocab.push({ word: w.word, meaning: w.meaning, status: 'learning', addedAt: new Date().toISOString() });
      }
    });
    _save(p);
    return p;
  },

  recordPronunciationScore(language, score){
    const p = _load();
    const bucket = _bucket(p, language);
    bucket.pronunciationScores.push(score);
    if(bucket.pronunciationScores.length > 50) bucket.pronunciationScores.shift();
    _save(p);
    return p;
  },

  recordGrammarScore(language, score){
    const p = _load();
    const bucket = _bucket(p, language);
    bucket.grammarScores.push(score);
    if(bucket.grammarScores.length > 50) bucket.grammarScores.shift();
    _save(p);
    return p;
  },

  avgOf(arr){
    if(!arr || !arr.length) return null;
    return Math.round(arr.reduce((a,b) => a+b, 0) / arr.length);
  },

  last7DaysActivity(){
    const p = _load();
    const days = [];
    for(let i = 6; i >= 0; i--){
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0,10);
      days.push({
        date: key,
        label: d.toLocaleDateString(undefined, { weekday: 'short' }),
        xp: p.activityLog[key] || 0,
        isToday: i === 0
      });
    }
    return days;
  },

  reset(){
    _save(_defaultProgress());
  },

  // Overwrites local progress with a cloud copy (does not echo back up).
  replaceAll(raw){
    _suppressCloud = true;
    try{ _save(_normalize(raw)); } finally { _suppressCloud = false; }
  },

  // Wipes local progress without touching the cloud (used on sign-out so
  // the next person on this browser doesn't inherit it).
  clearLocal(){
    _suppressCloud = true;
    try{ _save(_defaultProgress()); } finally { _suppressCloud = false; }
  },

  // Clears just one language's lessons/vocab/scores, leaving XP/streak and
  // the other language untouched.
  resetLanguage(language){
    const p = _load();
    p.languages[language] = _defaultLanguageBucket();
    _save(p);
    return p;
  }
};
