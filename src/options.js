// Page de réglages de WikiMasters Vente
const ext = globalThis.browser || globalThis.chrome;
const KEYS = ['wmv-listings', 'wmv-buys', 'wmv-sales', 'wmv-rarity', 'wmv-coll', 'wmv-prices', 'wmv-sold', 'wmv-removed', 'wmv-settings'];
const DEFAULTS = { panelTab: 'active', hideEnded: false, hideClicked: false, notifType: 'all', excludeTags: true, excludeFav: true, staleHours: 24, panelRarity: 'all', sortKey: 'ref', sortDir: 'desc' };
const $ = (id) => document.getElementById(id);

function status(text) {
  $('status').textContent = text;
  setTimeout(() => { $('status').textContent = ''; }, 3000);
}

async function load() {
  const r = await ext.storage.local.get(KEYS);
  const s = { ...DEFAULTS, ...(r['wmv-settings'] || {}) };
  $('hideEnded').checked = !!s.hideEnded;
  $('hideClicked').checked = !!s.hideClicked;
  $('excludeFav').checked = !!s.excludeFav;
  $('excludeTags').checked = !!s.excludeTags;
  $('staleHours').value = s.staleHours;
  const count = (k) => Object.keys(r[k] || {}).length;
  $('stats').textContent = `${count('wmv-coll')} carte(s) de ta collection · ${count('wmv-prices')} prix de carte relevés · ${count('wmv-sold')} carte(s) vendue(s) · ${count('wmv-buys')} prix d'achat · ` +
    `${count('wmv-sales')} carte(s) avec des ventes vues · ${count('wmv-listings')} enchère(s) suivie(s)`;
}

async function saveSettings() {
  const r = await ext.storage.local.get('wmv-settings');
  const s = { ...DEFAULTS, ...(r['wmv-settings'] || {}) };
  s.hideEnded = $('hideEnded').checked;
  s.hideClicked = $('hideClicked').checked;
  s.excludeFav = $('excludeFav').checked;
  s.excludeTags = $('excludeTags').checked;
  s.staleHours = Math.min(168, Math.max(1, parseInt($('staleHours').value, 10) || 24));
  await ext.storage.local.set({ 'wmv-settings': s });
  status('Enregistré ✓');
}
for (const id of ['hideEnded', 'hideClicked', 'excludeFav', 'excludeTags', 'staleHours']) $(id).addEventListener('change', saveSettings);

$('export').addEventListener('click', async () => {
  const r = await ext.storage.local.get(KEYS);
  const blob = new Blob([JSON.stringify({ app: 'wikimasters-vente', date: new Date().toISOString(), data: r }, null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'wikimasters-vente-sauvegarde.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 5000);
});

$('import').addEventListener('click', () => $('file').click());
$('file').addEventListener('change', async () => {
  const f = $('file').files[0];
  if (!f) return;
  try {
    const j = JSON.parse(await f.text());
    if (!j || j.app !== 'wikimasters-vente' || !j.data) throw new Error('format');
    const out = {};
    for (const k of KEYS) if (j.data[k]) out[k] = j.data[k];
    await ext.storage.local.set(out);
    status('Sauvegarde importée ✓');
    load();
  } catch (e) {
    status('Ce fichier n\'est pas une sauvegarde WikiMasters Vente.');
  }
  $('file').value = '';
});

$('reset').addEventListener('click', async () => {
  if (!window.confirm('Effacer toutes les données retenues par WikiMasters Vente ?')) return;
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
