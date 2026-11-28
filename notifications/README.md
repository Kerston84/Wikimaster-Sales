# 🔔 WikiMasters Notifications

Extension de navigateur **non officielle, non affiliée à WikiMasters**, pour [WikiMasters](https://www.wiki-masters.com) : des notifications (la cloche) plus claires et plus faciles à trier.

> L'extension **lit seulement les pages que tu ouvres** et change l'affichage chez toi. Elle n'envoie aucune requête aux serveurs du jeu, ne clique jamais à ta place et n'efface rien sur le site. Les autres joueurs ne voient rien.

Fonctionne sur **Chrome, Brave, Edge** et **Firefox**. Elle marche seule ou avec son extension sœur **WikiMasters Vente** (panneau de prix et cartes vendues).

👤 Créée par **Le Vagicien**.

---

## ✨ Ce que fait l'extension

| Fonction | Détail |
|---|---|
| **Fenêtre plus grande** | La liste des notifications est plus large et plus haute. |
| **Filtres** | Boutons *Tout / Souhaits / Surenchéri / Gagnées / Terminées / Vendues*, avec le nombre de chaque. Le filtre choisi n'affiche que son type. |
| **Couleurs** | Chaque type de notification a sa couleur. |
| **Enchères finies en gris** | Une notification « Liste de souhaits » dont l'enchère est finie est **grisée** (« ✓ Vendue · 120 W » ou « ✗ Terminée, non vendue »). Plus besoin de cliquer pour vérifier. |
| **Déjà ouvertes en gris** | Une notification sur laquelle tu as cliqué est grisée avec « 👁 Vue ». |
| **Temps restant** | Si l'enchère est encore en cours : « ⏱ Encore 35 min ». |
| **Masquer les terminées** | Un bouton les cache complètement. |
| **Supprimer les notifs cliquées** | Case ☐ dans la barre de la cloche : chaque notification que tu ouvres disparaît de ta liste. Décoche pour les revoir. |
| **Non lues protégées** | Une notification pas encore lue (surlignée par le site) n'est jamais grisée ni masquée automatiquement. |

**Comment l'extension sait qu'une enchère est finie**, sans rien demander au jeu :
- tu as déjà ouvert l'enchère (même une seule fois) ;
- tu l'as vue au marché avec son temps restant, et ce temps est écoulé ;
- une notification « Enchère terminée » ou « Enchère gagnée » en parle ;
- sinon, la notification a plus de 24 h (réglable) : elle est marquée « ⌛ Sûrement terminée ».

---

## 📥 Installation

Télécharge le fichier qui correspond à ton navigateur dans le dossier [`telechargements/`](telechargements/) de ce dossier `notifications/` (le numéro dans le nom est la version) :

| Navigateur | Fichier |
|---|---|
| Chrome, Brave, Edge | `wikimasters-notifications-1.0.0-chrome-brave-edge.zip` |
| Firefox | `wikimasters-notifications-1.0.0-firefox.zip` |

### Chrome / Brave / Edge
1. Clic droit sur le zip → **« Extraire tout »**. Range le dossier dans un endroit où tu ne le supprimeras pas (par ex. *Documents*).
2. Tape dans la barre d'adresse : `chrome://extensions` (Brave : `brave://extensions`, Edge : `edge://extensions`).
3. Active le **Mode développeur** (en haut à droite ; sur Edge, en bas à gauche).
4. Clique sur **« Charger l'extension non empaquetée »** et choisis le dossier extrait (celui qui contient `manifest.json`).
5. Recharge ta page WikiMasters et ouvre la cloche : la barre de filtres apparaît.

### Firefox
1. Tape : `about:debugging#/runtime/this-firefox`
2. **« Charger un module complémentaire temporaire… »** → choisis le **zip**.
3. Si la page de réglages s'ouvre avec un bandeau jaune, clique sur **« Autoriser l'accès au site »**.
4. Recharge WikiMasters.

> ⚠ Sur Firefox, une extension chargée ainsi est retirée quand tu fermes le navigateur.

### Tu utilisais déjà WikiMasters Vente (avant 2.0.0) ?
Pour garder tes notifications « 👁 Vue » : ouvre les réglages de **WikiMasters Vente** → **Exporter**, puis les réglages de **WikiMasters Notifications** → **Importer une sauvegarde** et choisis ce fichier.

## 🔄 Mettre à jour
**Chrome / Brave / Edge** : remplace le contenu de ton ancien dossier par celui du nouveau zip, puis clique sur la **flèche ronde ↻** de « WikiMasters Notifications » dans la page des extensions, et recharge WikiMasters. Tes données sont conservées.
**Firefox** : recharge le nouveau zip depuis `about:debugging`.

## 🆕 Nouveautés
- **1.0.0** : première version, séparée de WikiMasters Vente (qui faisait les notifications jusqu'à sa version 1.7.1). Mêmes fonctions qu'avant : filtres, couleurs, enchères finies grisées, « 👁 Vue », « Supprimer les notifs cliquées ». L'import accepte une sauvegarde de WikiMasters Vente.

## ⚙ Réglages et sauvegarde
Clique sur l'icône de l'extension (pièce de puzzle → *WikiMasters Notifications*) : options, **export / import** d'une sauvegarde, remise à zéro.

---

## ❓ Limites à connaître
- Le site ne garde qu'un nombre limité de notifications.
- Le bouton « Tout marquer lu » est celui du site : il n'apparaît que s'il reste des notifications non lues.
- Si le site change sa mise en page, l'extension peut cesser de marcher jusqu'à une mise à jour.

---

## 🛠 Pour les développeurs
`python3 build.py` fabrique `dist/wikimasters-notifications-<version>-chrome-brave-edge/`, `dist/wikimasters-notifications-<version>-firefox/` et les deux zips dans `telechargements/` (version dans le nom).
Vérification Firefox : `npx web-ext lint -s dist/wikimasters-notifications-<version>-firefox`.
