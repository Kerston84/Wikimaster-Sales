# 🃏 Extensions WikiMasters (Vente + Notifications)

Deux extensions de navigateur **non officielles, non affiliées à WikiMasters**, pour [WikiMasters](https://www.wiki-masters.com). Elles fonctionnent sur **Chrome, Brave, Edge** et **Firefox**. Tu peux installer les deux, ou une seule : elles marchent chacune de leur côté.

> Les deux extensions **lisent seulement les pages que tu ouvres** et changent l'affichage chez toi. Elles n'envoient aucune requête aux serveurs du jeu, ne cliquent jamais à ta place et ne font aucune action sur ton compte.

👤 Créées par **Le Vagicien**.

---

## 📥 Téléchargements

| Extension | Ce qu'elle fait | Chrome, Brave, Edge | Firefox |
|---|---|---|---|
| 💰 **WikiMasters Vente** 2.0.0 | Panneau des prix et des priorités de vente, onglet « Cartes vendues », pastilles de prix sur les cartes, flèches ‹ › dans la fiche d'une carte | [`wikimasters-vente-2.0.0-chrome-brave-edge.zip`](vente/telechargements/wikimasters-vente-2.0.0-chrome-brave-edge.zip) | [`wikimasters-vente-2.0.0-firefox.zip`](vente/telechargements/wikimasters-vente-2.0.0-firefox.zip) |
| 🔔 **WikiMasters Notifications** 1.0.0 | Cloche plus claire : filtres par type, couleurs, enchères terminées grisées, « 👁 Vue », « Supprimer les notifs cliquées » | [`wikimasters-notifications-1.0.0-chrome-brave-edge.zip`](notifications/telechargements/wikimasters-notifications-1.0.0-chrome-brave-edge.zip) | [`wikimasters-notifications-1.0.0-firefox.zip`](notifications/telechargements/wikimasters-notifications-1.0.0-firefox.zip) |

Sur la page d'un zip, clique sur **« Download raw file »** (la flèche ⬇ à droite) pour le télécharger.

Le détail de chaque extension (fonctions, installation pas à pas, nouveautés) est dans son dossier :
- [`vente/`](vente/) → [README de WikiMasters Vente](vente/README.md)
- [`notifications/`](notifications/) → [README de WikiMasters Notifications](notifications/README.md)

## 🧩 Installer (résumé)

**Chrome / Brave / Edge** : extrais le zip, va sur `chrome://extensions` (ou `brave://extensions`, `edge://extensions`), active le **Mode développeur**, clique sur **« Charger l'extension non empaquetée »** et choisis le dossier extrait. Fais-le une fois pour chaque extension.

**Firefox** : `about:debugging#/runtime/this-firefox` → **« Charger un module complémentaire temporaire… »** → choisis le zip.

## 🔀 Tu avais WikiMasters Vente avant la 2.0.0 ?
Jusqu'à la version 1.7.1, Vente faisait aussi les notifications. Depuis la 2.0.0, c'est l'extension **Notifications** qui s'en charge :
1. Mets à jour Vente avec le zip 2.0.0.
2. Installe Notifications.
3. Pour garder tes notifications déjà « 👁 Vue » : réglages de Vente → **Exporter**, puis réglages de Notifications → **Importer une sauvegarde**.

---

## 🛠 Pour les développeurs
Chaque dossier a son propre `build.py` : `python3 vente/build.py` et `python3 notifications/build.py` fabriquent les zips dans le dossier `telechargements/` de chaque extension (version dans le nom).
