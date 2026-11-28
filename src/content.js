// WikiMasters Vente — extension NON OFFICIELLE, non affiliée à WikiMasters.
// Elle lit seulement les pages que tu ouvres et change l'affichage chez toi :
// aucun clic automatique, aucune requête aux serveurs du jeu, aucune action sur ton compte.
// (Le site refuse les lectures en série : « L'automatisation n'est pas autorisée ».)
(() => {
  'use strict';

  // même code pour Chrome, Brave, Edge et Firefox
  const ext = globalThis.browser || globalThis.chrome;

  const RARITIES = ['C', 'PC', 'R', 'SR', 'UR', 'L'];
  const RARITY_NAMES = { C: 'Commune', PC: 'Peu commune', R: 'Rare', SR: 'Super rare', UR: 'Ultra rare', L: 'Légendaire' };
  const RARITY_BY_NAME = {};
  for (const [k, v] of Object.entries(RARITY_NAMES)) RARITY_BY_NAME[v.toLowerCase()] = k;
  const DAY = 24 * 3600 * 1000;

  // ---------- mémoire ----------
  // listings : enchères vues   { id: { t: titre, r: rareté, end: fin (ms), st: 'active'|'ended'|'sold'|'unsold', p: prix final, seen } }
  // buys     : prix d'achat    { titre: { r, p, id, at } }
  // sales    : ventes vues     { titre: [ { p, at, id } ] }   (prix finaux observés pour cette carte)
  // rarity   : prix moyens     { L: { avg, low, high, n, at } }
  // coll     : ta collection   { titre: { r, fav, tags: [], n: exemplaires, at, cid } }
  // prices   : prix de la carte, lu dans son onglet « Marché » { titre: { p: moyenne de la semaine, lo, hi, n: ventes, r, at } }
  // sold     : TES ventes, lues dans les notifications « Carte vendue » { idEnchère: { t: titre, p: prix de vente, at: date, buy: prix d'achat, r } }
  const KEYS = ['wmv-listings', 'wmv-buys', 'wmv-sales', 'wmv-rarity', 'wmv-coll', 'wmv-prices', 'wmv-sold', 'wmv-removed', 'wmv-settings'];
  const DEFAULTS = { panelTab: 'active', hideEnded: false, hideClicked: false, notifType: 'all', excludeTags: true, excludeFav: true, staleHours: 24, panelRarity: 'all', sortKey: 'ref', sortDir: 'desc' };
  const db = { listings: {}, buys: {}, sales: {}, rarity: {}, coll: {}, prices: {}, sold: {}, removed: {}, settings: { ...DEFAULTS } };
  const dirty = new Set();
  const ownWrites = {}; // nos propres écritures : on ne les relit pas (sinon on perdrait ce qui a changé entre-temps)
  let saveTimer = null;

  function mark(name) {
    dirty.add(name);
    clearTimeout(saveTimer);
    saveTimer = setTimeout(save, 800);
  }
  function save() {
    const out = {};
    for (const n of dirty) { out['wmv-' + n] = db[n]; ownWrites['wmv-' + n] = (ownWrites['wmv-' + n] || 0) + 1; }
    dirty.clear();
    try { ext.storage.local.set(out); } catch (e) { /* extension rechargée : recharger la page */ }
  }

  const ready = ext.storage.local.get(KEYS).then((r) => {
    db.listings = r['wmv-listings'] || {};
    db.buys = r['wmv-buys'] || {};
    db.sales = r['wmv-sales'] || {};
    db.rarity = r['wmv-rarity'] || {};
    db.coll = r['wmv-coll'] || {};
    db.prices = r['wmv-prices'] || {};
    db.sold = r['wmv-sold'] || {};
    db.removed = r['wmv-removed'] || {}; // cartes retirées à la main du panneau { titre: date }
    db.settings = { ...DEFAULTS, ...(r['wmv-settings'] || {}) };
    prune();
  });
  ext.storage.onChanged.addListener((ch, area) => {
    if (area && area !== 'local') return;
    // changement venant de la page de réglages (import, remise à zéro…)
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
  function ownedIn(el) {
    for (const n of el.querySelectorAll('span, div')) {
      if (n.childElementCount > 1) continue;
      const other = n.closest('[class*="wmp-"], [class*="wmi-"]'); // pastille « ×2 » d'une autre extension
      if (other && el.contains(other)) continue;
      const m = n.textContent.trim().match(/^✓?\s*×\s*(\d+)$/);
      if (m) return +m[1];
    }
    return null;
  }
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
  function addSale(title, price, id) {
    if (!title || price == null) return;
    const arr = db.sales[title] || (db.sales[title] = []);
    if (arr.some((s) => s.id === id)) return;
    arr.push({ p: price, at: Date.now(), id });
    if (arr.length > 10) arr.shift();
    mark('sales');
  }
  function setBuy(title, rarity, price, id) {
    if (!title || price == null) return;
    const b = db.buys[title];
    if (b && b.id === id && b.p === price) return;
    db.buys[title] = { r: rarity, p: price, id, at: Date.now() };
    mark('buys');
  }
  function setColl(title, data) {
    if (!title) return;
    const c = db.coll[title] || (db.coll[title] = {});
    let changed = false;
    for (const [k, v] of Object.entries(data)) {
      if (v === undefined || v === null) continue;
      if (JSON.stringify(c[k]) !== JSON.stringify(v)) { c[k] = v; changed = true; }
    }
    if (changed || !c.at || Date.now() - c.at > 3600e3) { c.at = Date.now(); mark('coll'); }
  }

  // ---------- 1. lecture du marché (liste des enchères, Gagnées, Historique…) ----------
  function readMarketCards() {
    const main = document.querySelector('main');
    if (!main) return;
    for (const a of main.querySelectorAll('a[href^="/marketplace/"]')) {
      const id = listingId(a);
      if (!id) continue;
      const title = titleIn(a);
      if (!title) continue;
      const r = rarityIn(a);
      const pairs = labelPairs(a);
      const data = { t: title, r };
      const dur = pairs['durée'];
      if (dur !== undefined) {
        if (/termin/i.test(dur)) data.st = db.listings[id] && db.listings[id].st && db.listings[id].st !== 'active' ? db.listings[id].st : 'ended';
        else { const ms = duration(dur); if (ms != null) { data.end = Date.now() + ms; data.st = 'active'; } }
      }
      if (pairs['achetée pour'] !== undefined) {
        const p = num(pairs['achetée pour']);
        data.st = 'sold'; data.p = p;
        setBuy(title, r, p, id);
        addSale(title, p, id);
      }
      for (const k of Object.keys(pairs)) {
        if (/^vendue?\s+pour/.test(k)) { const p = num(pairs[k]); data.st = 'sold'; data.p = p; addSale(title, p, id); }
        if (/^non vendue/.test(k)) data.st = 'unsold';
      }
      setListing(id, data);
      const owned = ownedIn(a);
      if (owned != null && db.coll[title]) setColl(title, { n: owned });
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
    const title = titleIn(main);
    const r = rarityIn(main);
    const data = { t: title, r };
    const ends = text.match(/Se termine dans\s+([^\n]+)/i);
    const won = text.match(/Remportée par\s+(.+?)\s+pour\s+([\d\s  ]+)\s*wikibidous/i);
    const status = text.match(/Statut\s*\n+\s*([^\n]+)/i);
    if (ends) { const ms = duration(ends[1]); if (ms != null) { data.end = Date.now() + ms; data.st = 'active'; } }
    if (won) {
      data.st = 'sold'; data.p = num(won[2]);
      addSale(title, data.p, id);
      const me = (text.match(/Meneur\s*:\s*([^\n]+)/i) || [])[1];
      if (me && me.trim() === won[1].trim() && /Achetée pour/i.test(text)) setBuy(title, r, data.p, id);
    } else if (status && !ends) {
      data.st = /non vendue|invendue|annul|expir/i.test(status[1]) ? 'unsold' : /vendue/i.test(status[1]) ? 'sold' : 'ended';
    }
    setListing(id, data);
    const owned = ownedIn(main);
    if (owned != null && db.coll[title]) setColl(title, { n: owned });
  }

  // ---------- 3. prix moyen par rareté (fiche d'une carte → onglet « Marché ») ----------
  // nœuds de texte qui commencent par un mot donné (insensible à la casse)
  function textNodes(re) {
    const out = [];
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
      acceptNode: (n) => (re.test(n.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP),
    });
    while (w.nextNode()) out.push(w.currentNode);
    return out;
  }

  // onglet « Marché » d'une carte : prix moyen de la semaine DE CETTE CARTE, dans la rareté choisie
  function readCardPrices() {
    for (const tn of textNodes(/^\s*prix moyen\b/i)) {
      const lab = tn.parentElement;
      if (!lab || lab.closest('.wmv-panel')) continue;
      const m = lab.textContent.trim().match(/^prix moyen\s*·\s*(.+)$/i);
      const code = m && RARITY_BY_NAME[m[1].trim().toLowerCase()];
      if (!code) continue;
      // on remonte jusqu'au bloc qui contient aussi « Ventes »
      let box = lab.parentElement;
      for (let i = 0; i < 6 && box && !/\bventes\b/i.test(box.innerText.replace(lab.innerText, '')); i++) box = box.parentElement;
      if (!box) continue;
      // le nom de la carte : le titre h2 de la fenêtre
      let win = box;
      while (win && !win.querySelector('h2')) win = win.parentElement;
      const h2 = win && win.querySelector('h2');
      let title = h2 && h2.textContent.trim();
      if (!title) continue;
      if (db.coll[title] && db.coll[title].r && db.coll[title].r !== code) title += ` (${code})`; // autre rareté que la tienne
      const lines = box.innerText.split('\n').map((s) => s.trim()).filter(Boolean);
      const i0 = lines.findIndex((l) => /^prix moyen/i.test(l));
      const avg = num(lines.slice(i0 + 1).find((l) => /^\D{0,3}[\d\s\u00a0\u202f]+$/.test(l)) || '');
      const after = (label) => {
        const i = lines.findIndex((l) => l.toLowerCase() === label);
        return i >= 0 ? num(lines[i + 1]) : null;
      };
      if (avg == null) continue;
      const cur = db.prices[title] || {};
      const next = { p: avg, lo: after('plus bas'), hi: after('plus haut'), n: after('ventes'), r: code, at: Date.now() };
      if (cur.p !== next.p || cur.lo !== next.lo || cur.hi !== next.hi || cur.n !== next.n || !cur.at || Date.now() - cur.at > 3600e3) {
        db.prices[title] = next;
        mark('prices');
      }
    }
  }

  // ---------- 4. collection (favoris, étiquettes) ----------
  function readCollection() {
    if (!/^\/collection/.test(location.pathname)) return;
    for (const card of document.querySelectorAll('main .group')) {
      const title = titleIn(card);
      if (!title) continue;
      const fav = !!card.querySelector('button[aria-label^="Retirer des favoris"]');
      const tags = [...card.querySelectorAll('span.rounded-full')]
        .filter((s) => { // on ignore les pastilles ajoutées par des extensions (wmv-, wmi-, wmp-…) à l'intérieur de la carte
          const x = s.closest('[class*="wmv-"], [class*="wmi-"], [class*="wmp-"]');
          return !x || !card.contains(x);
        })
        .map((s) => s.textContent.trim()).filter(Boolean);
      setColl(title, { r: rarityIn(card), fav, tags });
    }
    // fiche ouverte : nombre d'exemplaires (« Exemplaires : 2 »)
    for (const tn of textNodes(/^\s*exemplaires\s*:/i)) {
      const n = num(tn.parentElement.textContent);
      let box = tn.parentElement;
      for (let i = 0; i < 8 && box && !box.querySelector('h3'); i++) box = box.parentElement;
      const title = box && titleIn(box);
      if (n && title && db.coll[title]) setColl(title, { n });
    }
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
      else if (c.nodeType === 1 && !c.classList.contains('wmv-nbadge')) t += ownText(c);
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

  // une de TES cartes vendue (lu dans la notification, rien n'est demandé au jeu)
  function addSold(id, text, when) {
    if (db.sold[id]) return;
    const m = text.match(/«\s*(.+?)\s*»\s*a été vendue pour\s*([\d\s  ]+)/);
    if (!m) return;
    const t = m[1], p = num(m[2]);
    const at = when || Date.now();
    const b = db.buys[t];
    const c = db.coll[t] || {};
    // prix d'achat : seulement s'il date d'avant la vente (sinon c'est un nouvel achat de la même carte)
    db.sold[id] = { t, p, at, buy: b && (!b.at || b.at <= at + 60e3) ? b.p : null, r: c.r || (b && b.r) || null };
    mark('sold');
    setListing(id, { t, st: 'sold', p });
  }
  function soldGain(s) { return s.p != null ? s.p - (s.buy || 0) : null; }
  // combien d'exemplaires de cette carte tu as vendus depuis que tu as vu ta collection (ou ton dernier achat)
  function soldSince(title) {
    const c = db.coll[title] || {};
    const b = db.buys[title];
    const since = Math.max(c.at || 0, (b && b.at) || 0);
    let n = 0, last = 0;
    for (const s of Object.values(db.sold)) {
      if (s.t !== title) continue;
      if (s.at > since) n++;
      last = Math.max(last, s.at);
    }
    return { n, last };
  }

  function decorateNotifications() {
    const links = notifLinks();
    if (!links.length) return;
    const list = links[0].parentElement;
    const root = list.parentElement;
    if (root && !root.classList.contains('wmv-notif-root')) {
      root.classList.add('wmv-notif-root');
      list.classList.add('wmv-notif-list');
    }

    const counts = {};
    let hiddenDone = 0, hiddenSeen = 0, hiddenAll = 0, unreadN = 0;
    for (const a of links) {
      const id = listingId(a);
      const type = notifType(a);
      counts[type] = (counts[type] || 0) + 1;
      a.dataset.wmvType = type;
      const ps = a.querySelectorAll('p');
      const text = ps[1] ? ps[1].textContent : '';
      const when = frDate(ps[2] ? ps[2].textContent : '');

      // ces notifications prouvent que l'enchère est finie
      if (id && (type === 'enchère gagnée' || type === 'enchère terminée')) {
        const l = db.listings[id];
        if (!l || !l.st || l.st === 'active') setListing(id, { st: 'ended' });
      }
      // « Votre carte « X » a été vendue pour N wikibidous » : on la range dans « Cartes vendues »
      if (id && type === 'carte vendue') addSold(id, text, when);
      if (id && type === 'liste de souhaits') {
        const t = (text.match(/^(.+?) vient d'être mise en vente/) || [])[1];
        if (t && !(db.listings[id] && db.listings[id].t)) setListing(id, { t });
      }

      let badge = '', cls = '';
      if (id && type === 'carte vendue' && db.sold[id]) {
        const g = soldGain(db.sold[id]);
        badge = '💰 Rangée dans « Cartes vendues »' + (g != null ? ' · gain ' + (g > 0 ? '+' : '') + fmt(g) + ' W' : '');
      }
      if (id && type === 'liste de souhaits') {
        const { s, l } = stateOf(id, when);
        if (s === 'done') {
          // enchère finie (vendue, non vendue ou issue inconnue) : grisée, inutile de cliquer
          cls = 'wmv-done';
          badge = l && l.st === 'sold' ? '✓ Vendue' + (l.p != null ? ' · ' + l.p.toLocaleString('fr-FR') + ' W' : '')
            : l && l.st === 'unsold' ? '✗ Terminée, non vendue' : '✓ Terminée';
        }
        else if (s === 'maybe') { cls = 'wmv-maybe'; badge = '⌛ Sûrement terminée'; }
        else if (s === 'live') { cls = 'wmv-live'; badge = '⏱ Encore ' + left(l.end - Date.now()); }
      }
      // déjà ouverte (clic sur la notification ou page de l'enchère vue) : grisée aussi
      const checked = !!(id && db.listings[id] && db.listings[id].v) && !isUnread(a);
      a.classList.toggle('wmv-checked', checked && cls !== 'wmv-done');
      if (checked && cls !== 'wmv-done') badge = (badge ? badge + ' · ' : '') + '👁 Vue';
      a.classList.toggle('wmv-done', cls === 'wmv-done');
      a.classList.toggle('wmv-sold', cls === 'wmv-sold');
      a.classList.toggle('wmv-maybe', cls === 'wmv-maybe');
      a.classList.toggle('wmv-live', cls === 'wmv-live');
      let b = a.querySelector('.wmv-nbadge');
      if (badge) {
        if (!b) { b = document.createElement('span'); b.className = 'wmv-nbadge'; (ps[0] || a).appendChild(b); }
        if (b.textContent !== badge) b.textContent = badge;
      } else if (b) b.remove();

      // notification pas encore lue (le site la surligne) : jamais cachée, jamais grisée
      const unread = isUnread(a);
      a.classList.toggle('wmv-unread', unread);
      if (unread) { a.classList.remove('wmv-done', 'wmv-checked', 'wmv-maybe'); unreadN++; }
      const f = notifFilter;
      const hideByType = f !== 'all' && type !== f;
      const hideDone = db.settings.hideEnded && (cls === 'wmv-done' || cls === 'wmv-sold' || cls === 'wmv-maybe');
      // réglage « supprimer les notifications une fois cliquées » : masquées chez toi (rien n'est effacé sur le site)
      const hideSeen = db.settings.hideClicked && checked;
      // le filtre que tu choisis (Souhaits, Gagnées…) s'applique toujours ; seuls les masquages automatiques épargnent les non lues
      const hide = hideByType || (!unread && (hideDone || hideSeen));
      if (!unread && !hideByType && hideSeen) hiddenSeen++;
      if (!unread && !hideByType && hideDone && !hideSeen) hiddenDone++;
      if (hide) hiddenAll++;
      a.classList.toggle('wmv-hidden', hide);
    }
    // les autres notifications du site (échange accepté…) : cachées quand tu filtres par type
    const mine = new Set(links);
    for (const o of list.children) {
      if (mine.has(o)) continue;
      const hideOther = notifFilter !== 'all';
      o.classList.toggle('wmv-hidden', hideOther);
      if (hideOther) hiddenAll++;
    }
    renderNotifBar(list, counts, hiddenDone, links.length, hiddenSeen, hiddenAll, unreadN);
  }

  // clic sur une notification : on la retient comme « vue »
  document.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('a[href^="/marketplace/"]');
    if (!a || a.closest('main') || !a.dataset.wmvType) return;
    const id = listingId(a);
    if (id && !(db.listings[id] && db.listings[id].v)) { setListing(id, { v: 1 }); save(); }
    a.classList.add('wmv-checked');
    // on la fait disparaître juste après le clic (le site a déjà reçu ton clic et ouvre l'enchère)
    if (db.settings.hideClicked) setTimeout(() => { a.classList.add('wmv-hidden'); lastBar = ''; schedule(); }, 150);
  }, true);

  function renderNotifBar(list, counts, hiddenDone, total, hiddenSeen, hiddenAll, unreadN) {
    let bar = list.parentElement.querySelector(':scope > .wmv-nbar');
    if (!bar) {
      bar = document.createElement('div');
      bar.className = 'wmv-nbar';
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
      btn.className = 'wmv-chip' + (notifFilter === k ? ' wmv-on' : '');
      btn.textContent = label + ' ' + n;
      bar.appendChild(btn);
    }
    const t = document.createElement('button');
    t.type = 'button';
    t.dataset.toggle = '1';
    t.className = 'wmv-chip wmv-toggle' + (db.settings.hideEnded ? ' wmv-on' : '');
    t.textContent = db.settings.hideEnded ? '👁 Afficher les terminées' + (hiddenDone ? ' (' + hiddenDone + ')' : '') : '🙈 Masquer les terminées';
    bar.appendChild(t);
    // case à cocher (un bouton ☐ / ☑ : un vrai <input> se cocherait deux fois dans ce menu)
    const c = document.createElement('button');
    c.type = 'button';
    c.dataset.seen = '1';
    c.className = 'wmv-chip wmv-seen' + (db.settings.hideClicked ? ' wmv-on' : '');
    c.title = 'Masque chez toi les notifications déjà ouvertes (le site, lui, les garde)';
    c.setAttribute('role', 'checkbox');
    c.setAttribute('aria-checked', db.settings.hideClicked ? 'true' : 'false');
    c.textContent = (db.settings.hideClicked ? '☑' : '☐') + ' Supprimer les notifs cliquées' + (db.settings.hideClicked && hiddenSeen ? ' (' + hiddenSeen + ')' : '');
    bar.appendChild(c);
    // explication quand des notifications sont cachées (sinon la liste paraît vide)
    if (hiddenAll) {
      const info = document.createElement('div');
      info.className = 'wmv-ninfo';
      info.textContent = hiddenAll + ' notification(s) cachée(s) par tes filtres ';
      const all = document.createElement('button');
      all.type = 'button'; all.dataset.showall = '1'; all.className = 'wmv-chip wmv-on';
      all.textContent = 'Tout afficher';
      info.appendChild(all);
      bar.appendChild(info);
    }
  }
  // non lue = surlignée par le site (fond « accent »)
  function isUnread(a) { return /bg-\[var\(--color-accent\)\]/.test(a.className); }
  let notifFilter = 'all';
  let lastBar = '';

  // ---------- 6. panneau « Vente » ----------
  function refPrice(title) {
    const lp = db.prices[title];
    if (lp && lp.p != null) return { p: lp.p, src: 'carte', n: lp.n, lo: lp.lo, hi: lp.hi, at: lp.at };
    // sinon : médiane des dernières ventes de cette carte que tu as vues au marché
    const mine = db.buys[title] && db.buys[title].id;
    const s = (db.sales[title] || []).filter((x) => x.id !== mine);
    if (s.length) {
      const recent = s.slice(-5).map((x) => x.p).sort((a, b) => a - b);
      return { p: recent[Math.floor(recent.length / 2)], src: 'ventes', n: s.length };
    }
    return { p: null, src: null };
  }

  // tri : 'prio' = doublons puis gain ; sinon par colonne, croissant ou décroissant
  const RANK = { C: 1, PC: 2, R: 3, SR: 4, UR: 5, L: 6 };
  const SORTS = {
    name: (r) => r.t.toLowerCase(),
    rarity: (r) => RANK[r.r] || 0,
    buy: (r) => r.buy,
    ref: (r) => r.ref.p,
    gain: (r) => r.gain,
    n: (r) => r.n,
  };
  function sortRows(list) {
    const key = db.settings.sortKey;
    const dir = db.settings.sortDir === 'asc' ? 1 : -1;
    const get = SORTS[key];
    if (!get) {
      list.sort((a, b) => (b.dup - a.dup) || ((b.gain ?? -1e9) - (a.gain ?? -1e9)) || a.t.localeCompare(b.t));
      return;
    }
    list.sort((a, b) => {
      const x = get(a), y = get(b);
      // les valeurs inconnues vont toujours à la fin
      if (x == null && y == null) return a.t.localeCompare(b.t);
      if (x == null) return 1;
      if (y == null) return -1;
      const c = typeof x === 'string' ? x.localeCompare(y) : x - y;
      return c * dir || a.t.localeCompare(b.t);
    });
  }

  function rows() {
    const titles = new Set([...Object.keys(db.coll), ...Object.keys(db.buys)]);
    const out = [];
    let excluded = 0, removedN = 0;
    for (const t of titles) {
      const c = db.coll[t] || {};
      const b = db.buys[t];
      const r = c.r || (b && b.r) || null;
      // vendue : on enlève un exemplaire par vente ; plus aucun → elle passe dans « Cartes vendues »
      const sold = soldSince(t);
      const remain = (c.n || 1) - sold.n;
      if (remain <= 0) continue;
      if (db.removed[t]) { removedN++; continue; } // retirée à la main (✕)
      if (db.settings.excludeFav && c.fav) { excluded++; continue; }
      if (db.settings.excludeTags && c.tags && c.tags.length) { excluded++; continue; }
      if (db.settings.panelRarity !== 'all' && r !== db.settings.panelRarity) continue;
      const ref = refPrice(t);
      const buy = b ? b.p : null;
      const gain = ref.p != null ? ref.p - (buy || 0) : null;
      const n = c.n ? remain : null;
      const dup = remain > 1;
      out.push({ t, r, buy, ref, gain, n, dup, fav: !!c.fav, tags: c.tags || [] });
    }
    // priorité : d'abord les doublons, puis le plus gros gain estimé
    sortRows(out);
    return { list: out, excluded, removedN };
  }

  const fmt = (n) => (n == null ? '—' : n.toLocaleString('fr-FR'));
  function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

  function ensureFab() {
    if (document.querySelector('.wmv-fab')) return;
    const b = el('button', 'wmv-fab', '💰 Vente');
    b.type = 'button';
    b.title = 'WikiMasters Vente (non officiel) : prix et priorités de vente';
    b.addEventListener('click', () => (panelOpen() ? closePanel() : openPanel()));
    document.body.appendChild(b);
  }
  const panelOpen = () => !!document.querySelector('.wmv-panel');
  function closePanel() { const p = document.querySelector('.wmv-panel'); if (p) p.remove(); }

  function openPanel() {
    closePanel();
    const p = el('div', 'wmv-panel');
    p.setAttribute('role', 'dialog');
    p.setAttribute('aria-label', 'WikiMasters Vente');
    document.body.appendChild(p);
    renderPanel();
  }


  let panelSearch = '';
  function renderPanel() {
    const p = document.querySelector('.wmv-panel');
    if (!p) return;
    const scrollTop = (p.querySelector('.wmv-table-wrap') || {}).scrollTop || 0;
    p.textContent = '';

    const head = el('div', 'wmv-phead');
    head.appendChild(el('b', null, '💰 WikiMasters Vente'));
    head.appendChild(el('span', 'wmv-dim', 'non officiel, non affilié à WikiMasters'));
    const x = el('button', 'wmv-x', '✕'); x.type = 'button'; x.title = 'Fermer'; x.onclick = closePanel;
    head.appendChild(x);
    p.appendChild(head);

    // deux onglets : cartes à vendre / cartes vendues
    const soldList = Object.values(db.sold);
    const tabs = el('div', 'wmv-tabs');
    for (const [k, label] of [['active', '🃏 À vendre'], ['sold', `✓ Cartes vendues (${soldList.length})`]]) {
      const b = el('button', 'wmv-tab' + (db.settings.panelTab === k ? ' wmv-on' : ''), label);
      b.type = 'button';
      b.onclick = () => { db.settings.panelTab = k; mark('settings'); renderPanel(); };
      tabs.appendChild(b);
    }
    p.appendChild(tabs);
    if (db.settings.panelTab === 'sold') { renderSold(p, soldList); return; }

    const sec = el('div', 'wmv-sec');
    const nPrices = Object.values(db.prices).filter((x) => x.p != null).length;
    const g = el('div', 'wmv-guide');
    g.appendChild(el('b', null, `${nPrices} carte(s) avec un prix de vente. Pour en ajouter :`));
    g.appendChild(el('div', 'wmv-step', '1. Collection → clique sur une carte → onglet « Marché ». Son prix moyen de la semaine est retenu.'));
    g.appendChild(el('div', 'wmv-step', '2. Marché → « Gagnées » et « Historique » : tes prix d\'achat et tes ventes.'));
    g.appendChild(el('div', 'wmv-step wmv-dim', 'Le site interdit les lectures automatiques en série : l\'extension retient seulement ce que tu affiches.'));
    sec.appendChild(g);
    sec.appendChild(el('div', 'wmv-hint', 'Prix de vente = prix moyen de la carte cette semaine (passe la souris dessus pour le détail), sinon la médiane de ses ventes que tu as vues. Gain = prix de vente − prix d\'achat (carte sortie d\'un paquet = gratuite). Pastille : 🟢 prix relevé il y a moins de 6 mois, 🟠 plus de 6 mois, 🔴 plus d\'un an.'));
    p.appendChild(sec);

    // filtres
    const f = el('div', 'wmv-filters');
    const search = el('input', 'wmv-search');
    search.placeholder = 'Chercher une carte…';
    search.value = panelSearch;
    search.oninput = () => { panelSearch = search.value; renderTable(); };
    f.appendChild(search);
    const sel = el('select', 'wmv-select');
    for (const [v, label] of [['all', 'Toutes raretés'], ...RARITIES.map((r) => [r, RARITY_NAMES[r]])]) {
      const o = el('option', null, label); o.value = v; if (db.settings.panelRarity === v) o.selected = true; sel.appendChild(o);
    }
    sel.onchange = () => { db.settings.panelRarity = sel.value; mark('settings'); renderTable(); };
    f.appendChild(sel);
    for (const [key, label] of [['excludeFav', 'Exclure les favoris'], ['excludeTags', 'Exclure les cartes avec étiquette']]) {
      const lab = el('label', 'wmv-check');
      const cb = el('input'); cb.type = 'checkbox'; cb.checked = !!db.settings[key];
      cb.onchange = () => { db.settings[key] = cb.checked; mark('settings'); renderTable(); };
      lab.appendChild(cb); lab.appendChild(document.createTextNode(' ' + label));
      f.appendChild(lab);
    }
    const quick = el('div', 'wmv-quick');
    quick.appendChild(el('span', 'wmv-dim', 'Trier par prix de vente :'));
    for (const [dir, label] of [['desc', '▼ du plus cher au moins cher'], ['asc', '▲ du moins cher au plus cher']]) {
      const b = el('button', 'wmv-btn' + (db.settings.sortKey === 'ref' && db.settings.sortDir === dir ? ' wmv-on' : ''), label);
      b.type = 'button';
      b.onclick = () => { db.settings.sortKey = 'ref'; db.settings.sortDir = dir; mark('settings'); renderPanel(); };
      quick.appendChild(b);
    }
    const pr = el('button', 'wmv-btn' + (db.settings.sortKey === 'prio' ? ' wmv-on' : ''), '★ Ordre conseillé');
    pr.type = 'button';
    pr.onclick = () => { db.settings.sortKey = 'prio'; mark('settings'); renderPanel(); };
    quick.appendChild(pr);
    f.appendChild(quick);
    p.appendChild(f);

    const info = el('div', 'wmv-hint wmv-count');
    p.appendChild(info);
    const wrap = el('div', 'wmv-table-wrap');
    p.appendChild(wrap);

    const foot = el('div', 'wmv-foot');
    const csv = el('button', 'wmv-btn', '⬇ Exporter en CSV'); csv.type = 'button'; csv.onclick = exportCsv;
    foot.appendChild(csv);
    foot.appendChild(el('span', 'wmv-dim', 'L\'extension lit seulement les pages que tu ouvres : elle n\'interroge jamais le jeu et ne vend rien à ta place.'));
    p.appendChild(foot);

    function renderTable() {
      const { list, excluded, removedN } = rows();
      const q = panelSearch.trim().toLowerCase();
      const shown = q ? list.filter((r) => r.t.toLowerCase().includes(q)) : list;
      info.textContent = `${shown.length} carte(s) classée(s)` + (excluded ? ` · ${excluded} exclue(s) (favoris ou étiquettes)` : '') +
        ` · ${Object.keys(db.coll).length} carte(s) de ta collection déjà vues · ${Object.keys(db.buys).length} prix d'achat connus`;
      if (removedN) {
        info.appendChild(document.createTextNode(` · ${removedN} retirée(s) à la main `));
        const back = el('button', 'wmv-link', '↩ Tout remettre');
        back.type = 'button';
        back.title = 'Remettre dans la liste les cartes retirées avec ✕';
        back.onclick = () => { db.removed = {}; mark('removed'); save(); renderTable(); };
        info.appendChild(back);
      }
      wrap.textContent = '';
      if (!shown.length) {
        wrap.appendChild(el('div', 'wmv-empty', 'Rien à afficher pour l\'instant. Parcours ta Collection et ouvre l\'onglet « Marché » de tes cartes : l\'extension retient ce qu\'elle voit.'));
        return;
      }
      const table = el('table', 'wmv-table');
      const thead = el('tr');
      const cols = [['prio', '#'], ['name', 'Carte'], ['buy', 'Achetée'], ['ref', 'Prix de vente'], ['gain', 'Gain estimé'], ['n', 'Ex.'], ['rm', '']];
      for (const [key, label] of cols) {
        if (key === 'rm') { thead.appendChild(el('th')); continue; } // colonne du ✕, pas de tri
        const on = db.settings.sortKey === key;
        const th = el('th', 'wmv-sort' + (on ? ' wmv-sorted' : ''), label + (on && key !== 'prio' ? (db.settings.sortDir === 'asc' ? ' ▲' : ' ▼') : ''));
        th.title = key === 'prio' ? 'Ordre conseillé : doublons d\'abord, puis le plus gros gain' : 'Trier (cliquer encore pour inverser)';
        th.onclick = () => {
          if (key === 'prio') { db.settings.sortKey = 'prio'; }
          else if (db.settings.sortKey === key) db.settings.sortDir = db.settings.sortDir === 'asc' ? 'desc' : 'asc';
          else { db.settings.sortKey = key; db.settings.sortDir = key === 'name' ? 'asc' : 'desc'; }
          mark('settings');
          renderPanel(); // met aussi à jour les boutons ▼ / ▲
        };
        thead.appendChild(th);
      }
      table.appendChild(thead);
      shown.slice(0, 500).forEach((r, i) => {
        const tr = el('tr', r.dup ? 'wmv-dup' : '');
        tr.appendChild(el('td', 'wmv-dim', String(i + 1)));
        const name = el('td');
        if (r.r) name.appendChild(el('span', 'wmv-rtag wmv-r-' + r.r, r.r));
        const nb = el('button', 'wmv-link', r.t); nb.type = 'button'; nb.title = 'Ouvrir la fiche de cette carte, prête à « Mettre aux enchères »';
        nb.onclick = () => openSale(r.t);
        name.appendChild(nb);
        tr.appendChild(name);
        tr.appendChild(el('td', null, r.buy != null ? fmt(r.buy) : '—'));
        const ref = el('td', null, fmt(r.ref.p));
        ref.title = r.ref.src === 'carte' ? `Prix moyen de cette carte cette semaine (relevé le ${new Date(r.ref.at).toLocaleString('fr-FR')}). Sur la période affichée par le site : de ${fmt(r.ref.lo)} à ${fmt(r.ref.hi)} W, ${fmt(r.ref.n)} ventes.` : r.ref.src === 'ventes' ? `Médiane des dernières ventes vues de cette carte (${r.ref.n})` : 'Prix inconnu : ouvre l\'onglet « Marché » de cette carte';
        if (r.ref.src === 'ventes') ref.classList.add('wmv-approx');
        // pastille d'âge du prix : verte (< 6 mois), orange (6 mois à 1 an), rouge (plus d'un an)
        if (r.ref.src === 'carte' && r.ref.at) {
          const age = Date.now() - r.ref.at;
          const k = age >= 365 * DAY ? 'red' : age >= 182 * DAY ? 'orange' : 'green';
          const dot = el('span', 'wmv-age wmv-age-' + k);
          ref.insertBefore(dot, ref.firstChild);
          ref.title += k === 'green' ? ' Pastille verte : relevé il y a moins de 6 mois.' : k === 'orange' ? ' Pastille orange : relevé il y a plus de 6 mois, rouvre son onglet « Marché ».' : ' Pastille rouge : relevé il y a plus d\'un an, rouvre son onglet « Marché ».';
        }
        tr.appendChild(ref);
        const g = el('td', r.gain == null ? '' : r.gain >= 0 ? 'wmv-pos' : 'wmv-neg', r.gain == null ? '—' : (r.gain > 0 ? '+' : '') + fmt(r.gain));
        tr.appendChild(g);
        tr.appendChild(el('td', null, r.n ? '×' + r.n : '—'));
        // ✕ : retirer la carte du panneau (seulement ici, rien ne change sur le site)
        const rm = el('button', 'wmv-rm', '✕');
        rm.type = 'button';
        rm.title = 'Retirer « ' + r.t + ' » du panneau (tu peux la remettre avec « ↩ Tout remettre »)';
        rm.onclick = (e) => {
          e.stopPropagation();
          db.removed[r.t] = Date.now(); mark('removed'); save();
          renderTable();
          toast('« ' + r.t + ' » retirée du panneau.');
        };
        const td = el('td', 'wmv-rmcell'); td.appendChild(rm); tr.appendChild(td);
        table.appendChild(tr);
      });
      wrap.appendChild(table);
      if (shown.length > 500) wrap.appendChild(el('div', 'wmv-hint', `… et ${shown.length - 500} autres (utilise la recherche ou l'export CSV).`));
    }
    renderTable();
    wrap.scrollTop = scrollTop;
  }

  // onglet « Cartes vendues » : tes ventes lues dans les notifications « Carte vendue »
  function renderSold(p, list) {
    const sec = el('div', 'wmv-sec');
    const tot = list.reduce((a, s) => a + (s.p || 0), 0);
    const known = list.filter((s) => s.buy != null);
    const gain = known.reduce((a, s) => a + soldGain(s), 0);
    sec.appendChild(el('div', 'wmv-guide', `${list.length} carte(s) vendue(s) · ${fmt(tot)} W encaissés` +
      (known.length ? ` · gain ${gain > 0 ? '+' : ''}${fmt(gain)} W sur ${known.length} carte(s) dont tu connais le prix d'achat` : '')));
    sec.appendChild(el('div', 'wmv-hint', 'Rempli tout seul quand tu ouvres tes notifications : chaque « Carte vendue » est retenue ici et la carte quitte l\'onglet « À vendre ». Pense à ouvrir tes notifications avant qu\'elles disparaissent.'));
    p.appendChild(sec);
    const wrap = el('div', 'wmv-table-wrap');
    p.appendChild(wrap);
    if (!list.length) {
      wrap.appendChild(el('div', 'wmv-empty', 'Aucune vente retenue pour l\'instant. Ouvre la cloche des notifications : les « Carte vendue » s\'ajoutent ici.'));
    } else {
      const table = el('table', 'wmv-table wmv-sold-table');
      const thead = el('tr');
      for (const h of ['Carte', 'Vendue le', 'Achetée', 'Vendue', 'Gain']) thead.appendChild(el('th', null, h));
      table.appendChild(thead);
      for (const s of list.slice().sort((a, b) => b.at - a.at)) {
        const tr = el('tr', 'wmv-soldrow');
        const name = el('td');
        if (s.r) name.appendChild(el('span', 'wmv-rtag wmv-r-' + s.r, s.r));
        name.appendChild(el('span', null, s.t));
        name.appendChild(el('span', 'wmv-soldtag', 'VENDUE'));
        tr.appendChild(name);
        const d = new Date(s.at);
        tr.appendChild(el('td', null, d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' }) + ' à ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })));
        const buy = el('td', null, s.buy != null ? fmt(s.buy) : '—');
        if (s.buy == null) buy.title = 'Prix d\'achat inconnu : ouvre Marché → « Gagnées » avant la vente pour qu\'il soit retenu (carte de paquet = gratuite)';
        tr.appendChild(buy);
        tr.appendChild(el('td', null, fmt(s.p)));
        const g = soldGain(s);
        tr.appendChild(el('td', g == null ? '' : g >= 0 ? 'wmv-pos' : 'wmv-neg', g == null ? '—' : (g > 0 ? '+' : '') + fmt(g)));
        table.appendChild(tr);
      }
      wrap.appendChild(table);
    }
    const foot = el('div', 'wmv-foot');
    foot.appendChild(el('span', 'wmv-dim', 'Prix d\'achat « — » = inconnu (compté comme 0 dans le gain, comme une carte de paquet). L\'extension n\'interroge jamais le jeu.'));
    p.appendChild(foot);
  }

  function toast(text) {
    const t = el('div', 'wmv-toast', text);
    document.body.appendChild(t);
    setTimeout(() => t.remove(), 3500);
  }

  function exportCsv() {
    const { list } = rows();
    const esc = (v) => '"' + String(v ?? '').replace(/"/g, '""') + '"';
    const lines = [['Carte', 'Rareté', 'Prix d\'achat', 'Prix de référence', 'Source du prix', 'Gain estimé', 'Exemplaires', 'Étiquettes'].map(esc).join(';')];
    for (const r of list) lines.push([r.t, r.r, r.buy, r.ref.p, r.ref.src, r.gain, r.n, r.tags.join(', ')].map(esc).join(';'));
    const blob = new Blob(['﻿' + lines.join('\n')], { type: 'text/csv;charset=utf-8' });
    const a = el('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'wikimasters-vente.csv';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }

  // ---------- 7. flèches ‹ › dans la fiche d'une carte (Collection) ----------
  // Un clic sur une flèche ouvre la carte voisine de la page, exactement comme si tu cliquais
  // dessus toi-même. Rien d'autre : pas de requête au jeu, pas d'action sur ton compte.
  function cardModal() {
    if (!/^\/collection/.test(location.pathname)) return null;
    for (const ov of document.querySelectorAll('div.fixed.inset-0')) {
      const frame = ov.querySelector(':scope > .card-frame');
      if (frame && frame.querySelector('h2')) return { ov, frame };
    }
    return null;
  }
  function pageCards() { return [...document.querySelectorAll('main .group')].filter((g) => titleIn(g)); }
  function neighbour(dir) {
    const m = cardModal();
    if (!m) return null;
    const title = m.frame.querySelector('h2').textContent.trim();
    const cards = pageCards();
    const i = cards.findIndex((g) => titleIn(g) === title);
    return i < 0 ? null : cards[i + dir] || null;
  }
  function goCard(dir) {
    const m = cardModal();
    const target = neighbour(dir);
    if (!m || !target) return;
    // on garde le même onglet (Détails, Marché…) d'une carte à l'autre
    const sel = m.frame.querySelector('[role="tab"][aria-selected="true"]');
    const tab = sel ? sel.textContent.trim() : null;
    const before = m.frame.querySelector('h2').textContent.trim();
    (target.firstElementChild || target).click();
    if (!tab || /^d[ée]tails$/i.test(tab)) return;
    let tries = 0;
    const again = () => {
      const m2 = cardModal();
      const h = m2 && m2.frame.querySelector('h2');
      if (h && h.textContent.trim() !== before) {
        const t = [...m2.frame.querySelectorAll('[role="tab"]')].find((x) => x.textContent.trim() === tab);
        if (t && t.getAttribute('aria-selected') !== 'true') t.click();
      } else if (++tries < 20) setTimeout(again, 50);
    };
    setTimeout(again, 50);
  }
  function decorateCardModal() {
    const m = cardModal();
    if (!m) return;
    for (const [dir, cls, label] of [[-1, 'wmv-nav-prev', '‹'], [1, 'wmv-nav-next', '›']]) {
      let b = m.ov.querySelector(':scope > .' + cls);
      if (!b) {
        b = el('button', 'wmv-nav ' + cls, label);
        b.type = 'button';
        b.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); goCard(dir); });
        m.ov.appendChild(b);
      }
      const ok = !!neighbour(dir);
      if (b.disabled === ok) b.disabled = !ok;
      const tip = ok ? (dir < 0 ? 'Carte précédente (flèche ←)' : 'Carte suivante (flèche →)')
        : (dir < 0 ? 'Première carte de la page' : 'Dernière carte de la page : passe à la page suivante');
      if (b.title !== tip) b.title = tip;
    }
  }
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const t = e.target;
    if (t && (t.isContentEditable || /^(input|textarea|select)$/i.test(t.tagName))) return;
    if (!cardModal()) return;
    e.preventDefault();
    goCard(e.key === 'ArrowLeft' ? -1 : 1);
  });

  // ---------- 8. pastille du prix sur les cartes (Collection + fiche ouverte) ----------
  function priceAge(at) {
    const age = Date.now() - at;
    return age >= 365 * DAY ? 'red' : age >= 182 * DAY ? 'orange' : 'green';
  }
  const AGE_TIP = { green: 'relevé il y a moins de 6 mois', orange: 'relevé il y a plus de 6 mois : rouvre l\'onglet « Marché »', red: 'relevé il y a plus d\'un an : rouvre l\'onglet « Marché »' };
  // petite étiquette « ● 120 W » (rien si le prix de la carte n'a jamais été relevé)
  function pricePill(host, title, cls) {
    const pr = db.prices[title];
    let pill = host.querySelector(':scope > .' + cls);
    if (!pr || pr.p == null || !pr.at) { if (pill) pill.remove(); return; }
    const k = priceAge(pr.at);
    const text = fmt(pr.p) + ' W';
    const tip = `Prix moyen de la semaine : ${text}, ${AGE_TIP[k]} (le ${new Date(pr.at).toLocaleDateString('fr-FR')}). WikiMasters Vente, non officiel.`;
    if (!pill) { pill = el('span', cls); pill.appendChild(el('span', 'wmv-age')); pill.appendChild(el('span', 'wmv-pill-t')); host.appendChild(pill); }
    const dot = pill.firstChild;
    if (dot.className !== 'wmv-age wmv-age-' + k) dot.className = 'wmv-age wmv-age-' + k;
    if (pill.lastChild.textContent !== text) pill.lastChild.textContent = text;
    if (pill.title !== tip) pill.title = tip;
  }
  function decorateCardPrices() {
    if (/^\/collection/.test(location.pathname)) {
      for (const card of document.querySelectorAll('main .group')) {
        const t = titleIn(card);
        const host = card.firstElementChild;
        if (t && host) pricePill(host, t, 'wmv-cprice');
      }
    }
    const m = cardModal();
    if (m) {
      const h = m.ov.querySelector('.card-frame h2');
      if (h && h.parentElement) pricePill(h.parentElement, h.textContent.trim(), 'wmv-mprice');
    }
  }

  // ---------- 9. clic sur une carte du panneau : ouvrir sa fiche, prête à « Mettre aux enchères » ----------
  // Fait seulement ce que tu ferais à la main : chercher la carte dans ta Collection et ouvrir sa fiche.
  // Le bouton « Mettre aux enchères » est mis en évidence, mais c'est TOI qui cliques dessus (aucune vente automatique).
  const GOTO_KEY = 'wmv-goto';
  function openSale(title) {
    closePanel();
    if (!/^\/collection/.test(location.pathname)) {
      try { sessionStorage.setItem(GOTO_KEY, JSON.stringify({ t: title, at: Date.now() })); } catch (e) { /* rien */ }
      location.href = '/collection';
      return;
    }
    findAndOpen(title);
  }
  function resumeGoto() {
    let g = null;
    try { g = JSON.parse(sessionStorage.getItem(GOTO_KEY) || 'null'); sessionStorage.removeItem(GOTO_KEY); } catch (e) { /* rien */ }
    if (g && g.t && Date.now() - g.at < 60e3 && /^\/collection/.test(location.pathname)) findAndOpen(g.t);
  }
  function findTile(title) { return pageCards().find((c) => titleIn(c) === title); }
  function findAndOpen(title) {
    const m = cardModal();
    if (m) { const x = m.ov.querySelector('button[aria-label="Fermer"]'); if (x) x.click(); }
    let tries = 0, typed = false;
    const step = () => {
      const tile = findTile(title);
      if (tile) { (tile.firstElementChild || tile).click(); waitSellButton(title); return; }
      // pas sur la page : on tape son nom dans la recherche de la Collection (comme toi)
      const input = [...document.querySelectorAll('main input[type="text"], input[placeholder*="Rechercher"]')].find((i) => !i.closest('.wmv-panel'));
      if (input && !typed) {
        typed = true;
        input.focus();
        input.value = title;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        input.dispatchEvent(new Event('change', { bubbles: true }));
      }
      if (++tries < 40) setTimeout(step, 150);
      else toast('Carte « ' + title + ' » introuvable dans ta Collection (déjà vendue ou échangée ?).');
    };
    step();
  }
  function waitSellButton(title) {
    let tries = 0;
    const look = () => {
      const m = cardModal();
      const h = m && m.frame.querySelector('h2');
      if (m && h && h.textContent.trim() === title) {
        const det = [...m.frame.querySelectorAll('[role="tab"]')].find((x) => /^d[ée]tails$/i.test(x.textContent.trim()));
        if (det && det.getAttribute('aria-selected') !== 'true') det.click();
        const b = [...m.ov.querySelectorAll('button')].find((x) => /mettre aux ench/i.test(x.textContent));
        if (b) {
          b.scrollIntoView({ block: 'center', behavior: 'smooth' });
          b.classList.remove('wmv-sellhint'); void b.offsetWidth; b.classList.add('wmv-sellhint');
          toast('Fiche ouverte : clique sur « Mettre aux enchères » pour la vendre.');
          return;
        }
        if (m.ov.querySelector('button[aria-label^="Retirer des favoris"]')) { toast('« ' + title + ' » est en favori (verrouillée) : retire-la des favoris pour pouvoir la vendre.'); return; }
      }
      if (++tries < 30) setTimeout(look, 100);
    };
    look();
  }

  // ---------- boucle principale ----------
  let timer = null;
  // au plus une lecture toutes les 300 ms (la page change sans arrêt : comptes à rebours…)
  function schedule() {
    if (timer) return;
    timer = setTimeout(() => { timer = null; run(); }, 300);
  }
  let lastPanelKey = '';
  function run() {
    try {
      readMarketCards();
      readListingPage();
      readCardPrices();
      readCollection();
      decorateNotifications();
      decorateCardModal();
      decorateCardPrices();
      ensureFab();
      if (panelOpen()) {
        const key = JSON.stringify([Object.keys(db.coll).length, Object.keys(db.buys).length, Object.keys(db.prices).length, Object.keys(db.sales).length, Object.keys(db.sold).length, Object.keys(db.removed).length]);
        if (key !== lastPanelKey) { lastPanelKey = key; renderPanel(); }
      }
    } catch (e) {
      console.warn('[WikiMasters Vente]', e);
    }
  }

  ready.then(() => {
    run();
    setTimeout(resumeGoto, 600);
    new MutationObserver((muts) => {
      // on ignore nos propres changements
      if (muts.every((m) => [...m.addedNodes, ...m.removedNodes].every((n) => n.nodeType === 1 && /\bwmv-/.test(n.className || '')) || (m.target.closest && m.target.closest('.wmv-panel, .wmv-nbar, .wmv-nbadge, .wmv-cprice, .wmv-mprice')))) return;
      schedule();
    }).observe(document.body, { childList: true, subtree: true, characterData: true });
    setInterval(schedule, 30e3); // met à jour les « Encore 12 min »
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && panelOpen()) closePanel(); });
  });
})();
