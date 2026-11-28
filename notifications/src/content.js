// WikiMasters Notifications — extension NON OFFICIELLE, non affiliée à WikiMasters.
// Elle lit seulement les pages que tu ouvres et change l'affichage de la cloche chez toi :
// aucun clic automatique, aucune requête aux serveurs du jeu, aucune action sur ton compte.
(() => {
  'use strict';

  // même code pour Chrome, Brave, Edge et Firefox
  const ext = globalThis.browser || globalThis.chrome;
  const DAY = 24 * 3600 * 1000;

  // ---------- mémoire ----------
  // listings : enchères vues { id: { t: titre, r: rareté, end: fin (ms), st: 'active'|'ended'|'sold'|'unsold', p: prix final, v: déjà ouverte, seen } }
  const KEYS = ['wmn-listings', 'wmn-settings'];
  const DEFAULTS = { hideEnded: false, hideClicked: false, staleHours: 24 };
  const db = { listings: {}, settings: { ...DEFAULTS } };
  const dirty = new Set();
  const ownWrites = {}; // nos propres écritures : on ne les relit pas
  let saveTimer = null;

  function mark(name) {
    dirty.add(name);
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, 800);
  }
  function save() {
    const out = {};
    for (const n of dirty) { out['wmn-' + n] = db[n]; ownWrites['wmn-' + n] = (ownWrites['wmn-' + n] || 0) + 1; }
    dirty.clear();
    try { ext.storage.local.set(out); } catch (e) { /* extension rechargée : recharger la page */ }
  }

  const ready = ext.storage.local.get(KEYS).then((r) => {
    db.listings = r['wmn-listings'] || {};
    db.settings = { ...DEFAULTS, ...(r['wmn-settings'] || {}) };
    prune();
  });
  ext.storage.onChanged.addListener((ch, area) => {
    if (area && area !== 'local') return;
    for (const k of KEYS) {
      if (!ch[k]) continue;
      if (ownWrites[k] > 0) { ownWrites[k]--; continue; }
      const n = k.slice(4);
      db[n] = n === 'settings' ? { ...DEFAULTS, ...(ch[k].newValue || {}) } : (ch[k].newValue || {});
    }
    schedule();
  });

  // on oublie les enchères de plus de 14 jours
  function prune() {
    const limit = Date.now() - 14 * DAY;
    let changed = false;
    for (const [id, l] of Object.entries(db.listings)) {
      if ((l.seen || 0) < limit) { delete db.listings[id]; changed = true; }
    }
    if (changed) mark('listings');
  }

  // ---------- petits outils de lecture ----------
  // "1 685" → 1685 (espaces normales, insécables ou fines)
  function num(s) {
    const m = String(s || '').replace(/[\s  ]/g, '').match(/\d+/);
    return m ? parseInt(m[0], 10) : null;
  }
  // "2h 59m", "59m 53s", "1j 3h" → millisecondes
  function duration(s) {
    let ms = 0, found = false;
    const re = /(\d+)\s*(j|d|h|m(?:in)?|s)\b/gi;
    let m;
    while ((m = re.exec(s))) {
      found = true;
      const v = +m[1], u = m[2].toLowerCase();
      ms += v * (u === 'j' || u === 'd' ? DAY : u === 'h' ? 3600e3 : u.startsWith('m') ? 60e3 : 1e3);
    }
    return found ? ms : null;
  }
  const MONTHS = { janv: 0, jan: 0, 'févr': 1, fev: 1, 'fév': 1, mars: 2, avr: 3, mai: 4, juin: 5, juil: 6, 'août': 7, aout: 7, sept: 8, oct: 9, nov: 10, 'déc': 11, dec: 11 };
  // "26 nov., 10:55" → date (année en cours, ou l'an dernier si la date est dans le futur)
  function frDate(s) {
    const t = String(s || '').toLowerCase();
    const now = new Date();
    let m = t.match(/(\d{1,2})\s+([a-zéûô]+)\.?,?\s*(\d{1,2}):(\d{2})/);
    if (m && MONTHS[m[2]] !== undefined) {
      const d = new Date(now.getFullYear(), MONTHS[m[2]], +m[1], +m[3], +m[4]);
      if (d - now > DAY) d.setFullYear(d.getFullYear() - 1);
      return d.getTime();
    }
    m = t.match(/(aujourd'hui|hier)[^\d]*(\d{1,2}):(\d{2})/);
    if (m) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), +m[2], +m[3]);
      if (m[1] === 'hier') d.setDate(d.getDate() - 1);
      return d.getTime();
    }
    return null;
  }
  function listingId(a) {
    const m = (a.getAttribute('href') || '').match(/\/marketplace\/([0-9a-f-]{16,})/i);
    return m ? m[1] : null;
  }
  // rareté = la pastille en haut à gauche (C, PC, R, SR, UR, L)
  function rarityIn(el) {
    for (const n of el.querySelectorAll('div, span')) {
      if (n.childElementCount) continue;
      const t = n.textContent.trim();
      if (/^(C|PC|R|SR|UR|L)$/.test(t) && /\btop-2\b/.test(n.className) && /\bleft-2\b/.test(n.className)) return t;
    }
    for (const n of el.querySelectorAll('div, span')) {
      if (!n.childElementCount && /^(C|PC|R|SR|UR|L)$/.test(n.textContent.trim())) return n.textContent.trim();
    }
    return null;
  }
  const titleIn = (el) => { const h = el.querySelector('h3, h1, h2'); return h ? h.textContent.trim() : null; };
  // nombre d'exemplaires possédés affiché par le jeu sur le marché ("✓ ×2")

  // paires "étiquette → valeur" d'une carte du marché (MISE DE DÉPART → 10, DURÉE → 2h 59m…)
  function labelPairs(el) {
    const out = {};
    for (const n of el.querySelectorAll('span, p, div')) {
      // l'étiquette peut contenir une petite icône (svg), mais pas d'autre élément
      if (!/uppercase/.test(n.className) || [...n.children].some((c) => c.tagName.toLowerCase() !== 'svg')) continue;
      const v = n.nextElementSibling;
      out[n.textContent.trim().toLowerCase()] = v ? v.textContent.trim() : '';
    }
    return out;
  }

  function listing(id) { return db.listings[id] || (db.listings[id] = {}); }
  function setListing(id, data) {
    const l = listing(id);
    let changed = false;
    for (const [k, v] of Object.entries(data)) {
      if (v === undefined || v === null) continue;
      if (k === 'end' && l.end && Math.abs(l.end - v) < 90e3) continue; // même fin à une minute près
      if (l[k] !== v) { l[k] = v; changed = true; }
    }
    if (changed || !l.seen || Date.now() - l.seen > 3600e3) { l.seen = Date.now(); mark('listings'); }
  }





  // ---------- 1. marché : temps restant et issue des enchères (pour griser les « Liste de souhaits » finies) ----------
  function readMarketCards() {
    const main = document.querySelector('main');
    if (!main) return;
    for (const a of main.querySelectorAll('a[href^="/marketplace/"]')) {
      const id = listingId(a);
      if (!id) continue;
      const title = titleIn(a);
      if (!title) continue;
      const pairs = labelPairs(a);
      const data = { t: title, r: rarityIn(a) };
      const dur = pairs['durée'];
      if (dur !== undefined) {
        if (/termin/i.test(dur)) data.st = db.listings[id] && db.listings[id].st && db.listings[id].st !== 'active' ? db.listings[id].st : 'ended';
        else { const ms = duration(dur); if (ms != null) { data.end = Date.now() + ms; data.st = 'active'; } }
      }
      if (pairs['achetée pour'] !== undefined) { data.st = 'sold'; data.p = num(pairs['achetée pour']); }
      for (const k of Object.keys(pairs)) {
        if (/^vendue?\s+pour/.test(k)) { data.st = 'sold'; data.p = num(pairs[k]); }
        if (/^non vendue/.test(k)) data.st = 'unsold';
      }
      setListing(id, data);
    }
  }

  // ---------- 2. page d'une enchère (/marketplace/<id>) ----------
  function readListingPage() {
    const m = location.pathname.match(/^\/marketplace\/([0-9a-f-]{16,})/i);
    if (!m) return;
    const main = document.querySelector('main');
    if (!main) return;
    const text = main.innerText;
    if (!/Mis en vente par/i.test(text)) return; // page pas encore chargée
    const id = m[1];
    if (!(db.listings[id] && db.listings[id].v)) setListing(id, { v: 1 }); // tu as ouvert cette enchère
    const data = { t: titleIn(main), r: rarityIn(main) };
    const ends = text.match(/Se termine dans\s+([^\n]+)/i);
    const won = text.match(/Remportée par\s+(.+?)\s+pour\s+([\d\s  ]+)\s*wikibidous/i);
    const status = text.match(/Statut\s*\n+\s*([^\n]+)/i);
    if (ends) { const ms = duration(ends[1]); if (ms != null) { data.end = Date.now() + ms; data.st = 'active'; } }
    if (won) { data.st = 'sold'; data.p = num(won[2]); }
    else if (status && !ends) data.st = /non vendue|invendue|annul|expir/i.test(status[1]) ? 'unsold' : /vendue/i.test(status[1]) ? 'sold' : 'ended';
    setListing(id, data);
  }

  // ---------- 5. notifications étendues ----------
  const TYPE_KEYS = [
    ['all', 'Tout'],
    ['liste de souhaits', 'Souhaits'],
    ['surenchéri', 'Surenchéri'],
    ['enchère gagnée', 'Gagnées'],
    ['enchère terminée', 'Terminées'],
    ['carte vendue', 'Vendues'],
  ];
  // les notifications = les liens vers une enchère, hors de la page principale, regroupés dans une même liste
  function notifLinks() {
    const links = [...document.querySelectorAll('a[href^="/marketplace/"]')].filter((a) => !a.closest('main') && a.querySelectorAll('p').length >= 2);
    const byParent = new Map();
    for (const a of links) byParent.set(a.parentElement, (byParent.get(a.parentElement) || 0) + 1);
    let best = null, n = 0;
    for (const [p, c] of byParent) if (c > n) { best = p; n = c; }
    return links.filter((a) => a.parentElement === best);
  }
  // texte d'un élément sans nos propres pastilles
  function ownText(n) {
    if (!n) return '';
    let t = '';
    for (const c of n.childNodes) {
      if (c.nodeType === 3) t += c.nodeValue;
      else if (c.nodeType === 1 && !c.classList.contains('wmn-nbadge')) t += ownText(c);
    }
    return t;
  }
  function notifType(a) { return ownText(a.querySelector('p')).trim().toLowerCase(); }

  // état d'une enchère : 'done' (terminée/vendue), 'maybe' (sûrement terminée), 'live' (en cours) ou null (inconnu)
  function stateOf(id, notifTime) {
    const l = db.listings[id];
    if (l) {
      if (l.st && l.st !== 'active') return { s: 'done', l };
      if (l.end && l.end <= Date.now()) return { s: 'done', l };
      if (l.end) return { s: 'live', l };
    }
    if (notifTime && Date.now() - notifTime > db.settings.staleHours * 3600e3) return { s: 'maybe', l };
    return { s: null, l };
  }
  function left(ms) {
    const m = Math.round(ms / 60e3);
    if (m < 60) return m + ' min';
    const h = Math.floor(m / 60);
    return h < 24 ? h + ' h ' + String(m % 60).padStart(2, '0') : Math.floor(h / 24) + ' j ' + (h % 24) + ' h';
  }

  function decorateNotifications() {
    const links = notifLinks();
    if (!links.length) return;
    const list = links[0].parentElement;
    const root = list.parentElement;
    if (root && !root.classList.contains('wmn-notif-root')) {
      root.classList.add('wmn-notif-root');
      list.classList.add('wmn-notif-list');
    }

    const counts = {};
    let hiddenDone = 0, hiddenSeen = 0, hiddenAll = 0, unreadN = 0;
    for (const a of links) {
      const id = listingId(a);
      const type = notifType(a);
      counts[type] = (counts[type] || 0) + 1;
      a.dataset.wmnType = type;
      const ps = a.querySelectorAll('p');
      const text = ps[1] ? ps[1].textContent : '';
      const when = frDate(ps[2] ? ps[2].textContent : '');

      // ces notifications prouvent que l'enchère est finie
      if (id && (type === 'enchère gagnée' || type === 'enchère terminée')) {
        const l = db.listings[id];
        if (!l || !l.st || l.st === 'active') setListing(id, { st: 'ended' });
      }
      if (id && type === 'liste de souhaits') {
        const t = (text.match(/^(.+?) vient d'être mise en vente/) || [])[1];
        if (t && !(db.listings[id] && db.listings[id].t)) setListing(id, { t });
      }

      let badge = '', cls = '';
      if (id && type === 'liste de souhaits') {
        const { s, l } = stateOf(id, when);
        if (s === 'done') {
          // enchère finie (vendue, non vendue ou issue inconnue) : grisée, inutile de cliquer
          cls = 'wmn-done';
          badge = l && l.st === 'sold' ? '✓ Vendue' + (l.p != null ? ' · ' + l.p.toLocaleString('fr-FR') + ' W' : '')
            : l && l.st === 'unsold' ? '✗ Terminée, non vendue' : '✓ Terminée';
        }
        else if (s === 'maybe') { cls = 'wmn-maybe'; badge = '⌛ Sûrement terminée'; }
        else if (s === 'live') { cls = 'wmn-live'; badge = '⏱ Encore ' + left(l.end - Date.now()); }
      }
      // déjà ouverte (clic sur la notification ou page de l'enchère vue) : grisée aussi
      const checked = !!(id && db.listings[id] && db.listings[id].v) && !isUnread(a);
      a.classList.toggle('wmn-checked', checked && cls !== 'wmn-done');
      if (checked && cls !== 'wmn-done') badge = (badge ? badge + ' · ' : '') + '👁 Vue';
      a.classList.toggle('wmn-done', cls === 'wmn-done');
      a.classList.toggle('wmn-sold', cls === 'wmn-sold');
      a.classList.toggle('wmn-maybe', cls === 'wmn-maybe');
      a.classList.toggle('wmn-live', cls === 'wmn-live');
      let b = a.querySelector('.wmn-nbadge');
      if (badge) {
        if (!b) { b = document.createElement('span'); b.className = 'wmn-nbadge'; (ps[0] || a).appendChild(b); }
        if (b.textContent !== badge) b.textContent = badge;
      } else if (b) b.remove();

      // notification pas encore lue (le site la surligne) : jamais cachée, jamais grisée
      const unread = isUnread(a);
      a.classList.toggle('wmn-unread', unread);
      if (unread) { a.classList.remove('wmn-done', 'wmn-checked', 'wmn-maybe'); unreadN++; }
      const f = notifFilter;
      const hideByType = f !== 'all' && type !== f;
      const hideDone = db.settings.hideEnded && (cls === 'wmn-done' || cls === 'wmn-sold' || cls === 'wmn-maybe');
      // réglage « supprimer les notifications une fois cliquées » : masquées chez toi (rien n'est effacé sur le site)
      const hideSeen = db.settings.hideClicked && checked;
      // le filtre que tu choisis (Souhaits, Gagnées…) s'applique toujours ; seuls les masquages automatiques épargnent les non lues
      const hide = hideByType || (!unread && (hideDone || hideSeen));
      if (!unread && !hideByType && hideSeen) hiddenSeen++;
      if (!unread && !hideByType && hideDone && !hideSeen) hiddenDone++;
      if (hide) hiddenAll++;
      a.classList.toggle('wmn-hidden', hide);
    }
    // les autres notifications du site (échange accepté…) : cachées quand tu filtres par type
    const mine = new Set(links);
    for (const o of list.children) {
      if (mine.has(o)) continue;
      const hideOther = notifFilter !== 'all';
      o.classList.toggle('wmn-hidden', hideOther);
      if (hideOther) hiddenAll++;
    }
    renderNotifBar(list, counts, hiddenDone, links.length, hiddenSeen, hiddenAll, unreadN);
  }

  // clic sur une notification : on la retient comme « vue »
  document.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('a[href^="/marketplace/"]');
    if (!a || a.closest('main') || !a.dataset.wmnType) return;
    const id = listingId(a);
    if (id && !(db.listings[id] && db.listings[id].v)) { setListing(id, { v: 1 }); save(); }
    a.classList.add('wmn-checked');
    // on la fait disparaître juste après le clic (le site a déjà reçu ton clic et ouvre l'enchère)
    if (db.settings.hideClicked) setTimeout(() => { a.classList.add('wmn-hidden'); lastBar = ''; schedule(); }, 150);
  }, true);

  function renderNotifBar(list, counts, hiddenDone, total, hiddenSeen, hiddenAll, unreadN) {
    let bar = list.parentElement.querySelector(':scope > .wmn-nbar');
    if (!bar) {
      bar = document.createElement('div');
      bar.className = 'wmn-nbar';
      list.parentElement.insertBefore(bar, list);
      bar.addEventListener('click', (e) => {
        const btn = e.target.closest('button');
        if (!btn) return;
        e.preventDefault(); e.stopPropagation();
        if (btn.dataset.type) notifFilter = btn.dataset.type; // filtre valable sur cette page seulement
        if (btn.dataset.showall) { notifFilter = 'all'; db.settings.hideEnded = false; db.settings.hideClicked = false; }
        if (btn.dataset.toggle) db.settings.hideEnded = !db.settings.hideEnded;
        if (btn.dataset.seen) db.settings.hideClicked = !db.settings.hideClicked;
        mark('settings');
        lastBar = '';
        decorateNotifications();
      });
    }
    const key = JSON.stringify([counts, hiddenDone, total, notifFilter, db.settings.hideEnded, db.settings.hideClicked, hiddenSeen, hiddenAll, unreadN]);
    if (key === lastBar && bar.childElementCount) return;
    lastBar = key;
    bar.textContent = '';
    for (const [k, label] of TYPE_KEYS) {
      const n = k === 'all' ? total : (counts[k] || 0);
      if (k !== 'all' && !n) continue;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.type = k;
      btn.className = 'wmn-chip' + (notifFilter === k ? ' wmn-on' : '');
      btn.textContent = label + ' ' + n;
      bar.appendChild(btn);
    }
    const t = document.createElement('button');
    t.type = 'button';
    t.dataset.toggle = '1';
    t.className = 'wmn-chip wmn-toggle' + (db.settings.hideEnded ? ' wmn-on' : '');
    t.textContent = db.settings.hideEnded ? '👁 Afficher les terminées' + (hiddenDone ? ' (' + hiddenDone + ')' : '') : '🙈 Masquer les terminées';
    bar.appendChild(t);
    // case à cocher (un bouton ☐ / ☑ : un vrai <input> se cocherait deux fois dans ce menu)
    const c = document.createElement('button');
    c.type = 'button';
    c.dataset.seen = '1';
    c.className = 'wmn-chip wmn-seen' + (db.settings.hideClicked ? ' wmn-on' : '');
    c.title = 'Masque chez toi les notifications déjà ouvertes (le site, lui, les garde)';
    c.setAttribute('role', 'checkbox');
    c.setAttribute('aria-checked', db.settings.hideClicked ? 'true' : 'false');
    c.textContent = (db.settings.hideClicked ? '☑' : '☐') + ' Supprimer les notifs cliquées' + (db.settings.hideClicked && hiddenSeen ? ' (' + hiddenSeen + ')' : '');
    bar.appendChild(c);
    // explication quand des notifications sont cachées (sinon la liste paraît vide)
    if (hiddenAll) {
      const info = document.createElement('div');
      info.className = 'wmn-ninfo';
      info.textContent = hiddenAll + ' notification(s) cachée(s) par tes filtres ';
      const all = document.createElement('button');
      all.type = 'button'; all.dataset.showall = '1'; all.className = 'wmn-chip wmn-on';
      all.textContent = 'Tout afficher';
      info.appendChild(all);
      bar.appendChild(info);
    }
  }
  // non lue = surlignée par le site (fond « accent »)
  function isUnread(a) { return /bg-\[var\(--color-accent\)\]/.test(a.className); }
  let notifFilter = 'all';
  let lastBar = '';


  // ---------- boucle principale ----------
  let timer = null;
  // au plus une lecture toutes les 300 ms (la page change sans arrêt : comptes à rebours…)
  function schedule() {
    if (timer) return;
    timer = setTimeout(() => { timer = null; run(); }, 300);
  }
  function run() {
    try {
      readMarketCards();
      readListingPage();
      decorateNotifications();
    } catch (e) {
      console.warn('[WikiMasters Notifications]', e);
    }
  }

  ready.then(() => {
    run();
    new MutationObserver((muts) => {
      // on ignore nos propres changements
      if (muts.every((m) => [...m.addedNodes, ...m.removedNodes].every((n) => n.nodeType === 1 && /\bwmn-/.test(n.className || '')) || (m.target.closest && m.target.closest('.wmn-nbar, .wmn-nbadge')))) return;
      schedule();
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
    setInterval(schedule, 30e3); // met à jour les « Encore 12 min »
  });
})();
