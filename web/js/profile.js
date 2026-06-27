// Player profile + app settings, persisted to localStorage.
// Plain serializable objects — exactly what a future server would sync.

const PKEY = 'db_profile';
const SKEY = 'db_settings';

export const DEFAULT_PROFILE = { name: 'You', color: '#38BDF8', mood: 'grin' };
export const DEFAULT_SETTINGS = {
  sfx: true,
  sfxVol: 0.6,
  music: true,         // background music on
  theme: 'night',      // reserved for future themes
  rounds: 3,
  drawTime: 75,
  category: 'all',     // 'all' or a category name
};

function load(key, defaults) {
  try { return { ...defaults, ...JSON.parse(localStorage.getItem(key) || '{}') }; }
  catch { return { ...defaults }; }
}
function save(key, obj) {
  try { localStorage.setItem(key, JSON.stringify(obj)); } catch { /* ignore */ }
}

export const loadProfile  = () => load(PKEY, DEFAULT_PROFILE);
export const saveProfile  = (p) => save(PKEY, p);
export const loadSettings = () => load(SKEY, DEFAULT_SETTINGS);
export const saveSettings = (s) => save(SKEY, s);
