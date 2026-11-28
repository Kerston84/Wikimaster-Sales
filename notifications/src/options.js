// Page de réglages de WikiMasters Notifications
const ext = globalThis.browser || globalThis.chrome;
const KEYS = ['wmn-listings', 'wmn-settings'];
const DEFAULTS = { hideEnded: false, hideClicked: false, staleHours: 24 };
const $ = (id) => document.getElementById(id);

function status(text) {
  $('status').textContent = text;
  setTimeout(() => { $('status').textContent = ''; }, 4000);
}

async function load() {
  const r = await ext.storage.local.get(KEYS);
  const s = { ...DEFAULTS, ...(r['wmn-settings'] || {}) };
  $('hideEnded').checked = !!s.hideEnded;
  $('hideClicked').checked = !!s.hideClicked;
  $('staleHours').value = s.staleHours;
  const l = Object.values(r['wmn-listings'] || {});
  $('stats').textContent = `${l.length} enchère(s) suivie(s) · ${l.filter((x) => x.v).length} notification(s) déjà ouverte(s)`;
}

async function saveSettings() {
  const r = await ext.storage.local.get('wmn-settings');
  const s = { ...DEFAULTS, ...(r['wmn-settings'] || {}) };
  s.hideEnded = $('hideEnded').checked;
  s.hideClicked = $('hideClicked').checked;
  s.staleHours = Math.min(168, Math.max(1, parseInt($('staleHours').value, 10) || 24));
  await ext.storage.local.set({ 'wmn-settings': s });
  status('Enregistré ✓');
}
for (const id of ['hideEnded', 'hideClicked', 'staleHours']) $(id).addEventListener('change', saveSettings);

$('export').addEventListener('click', async () => {
  const r = await ext.storage.local.get(KEYS);
  const blob = new Blob([JSON.stringify({ app: 'wikimasters-notifications', date: new Date().toISOString(), data: r }, null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'wikimasters-notifications-sauvegarde.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
});

// garde seulement ce qui sert aux notifications dans une enchère retenue
function slim(listings) {
  const out = {};
  for (const [id, l] of Object.entries(listings || {})) {
    if (!l || typeof l !== 'object') continue;
    const o = {};
    for (const k of ['t', 'r', 'end', 'st', 'p', 'v', 'seen']) if (l[k] != null) o[k] = l[k];
    out[id] = o;
  }
  return out;
}

$('import').addEventListener('click', () => $('file').click());
$('file').addEventListener('change', async () => {
  const f = $('file').files[0];
  if (!f) return;
  try {
    const j = JSON.parse(await f.text());
    if (!j || !j.data) throw new Error('format');
    const out = {};
    if (j.app === 'wikimasters-notifications') {
      for (const k of KEYS) if (j.data[k]) out[k] = j.data[k];
    } else if (j.app === 'wikimasters-vente') {
      // ancienne sauvegarde de WikiMasters Vente (avant 2.0.0) : on reprend les enchères vues et les réglages des notifications
      const cur = await ext.storage.local.get(KEYS);
      out['wmn-listings'] = { ...(cur['wmn-listings'] || {}), ...slim(j.data['wmv-listings']) };
      const old = j.data['wmv-settings'] || {};
      const s = { ...DEFAULTS, ...(cur['wmn-settings'] || {}) };
      for (const k of Object.keys(DEFAULTS)) if (old[k] != null) s[k] = old[k];
      out['wmn-settings'] = s;
    } else throw new Error('format');
    await ext.storage.local.set(out);
    status('Sauvegarde importée ✓');
    load();
  } catch (e) {
    status('Ce fichier n\'est pas une sauvegarde WikiMasters Notifications (ou Vente).');
  }
  $('file').value = '';
});

$('reset').addEventListener('click', async () => {
  if (!window.confirm('Effacer toutes les données retenues par WikiMasters Notifications ?')) return;
  await ext.storage.local.remove(KEYS);
  status('Tout est effacé.');
  load();
});

// Firefox : autorisation d'accès au site, demandée à part
const origins = ext.runtime.getManifest().host_permissions || [];
async function checkPerm() {
  const ok = await ext.permissions.contains({ origins }).catch(() => true);
  $('perm').style.display = ok ? 'none' : 'block';
}
$('perm-btn').addEventListener('click', async () => {
  await ext.permissions.request({ origins }).catch(() => false);
  checkPerm();
});

checkPerm();
load();
