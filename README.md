# 💰 WikiMasters Vente

Extension de navigateur **non officielle, non affiliée à WikiMasters**, pour [WikiMasters](https://www.wiki-masters.com) : des notifications plus claires (les enchères déjà terminées sont grisées) et un panneau qui t'aide à savoir quelles cartes vendre en priorité.

> L'extension **lit seulement les pages que tu ouvres** et change l'affichage chez toi. Elle n'envoie aucune requête aux serveurs du jeu, ne clique jamais à ta place, ne vend et n'achète rien. Les autres joueurs ne voient rien.

Fonctionne sur **Chrome, Brave, Edge** et **Firefox**.

👤 Créée par **Le Vagicien**.

---

## ✨ Ce que fait l'extension

### 🔔 Notifications étendues
| Fonction | Détail |
|---|---|
| **Fenêtre plus grande** | La liste des notifications est plus large et plus haute. |
| **Filtres** | Boutons *Tout / Souhaits / Surenchéri / Gagnées / Terminées*, avec le nombre de chaque. |
| **Couleurs** | Chaque type de notification a sa couleur. |
| **Enchères finies en gris** | Une notification « Liste de souhaits » dont l'enchère est finie est **grisée**, qu'elle soit vendue (« ✓ Vendue · 120 W ») ou non (« ✗ Terminée, non vendue »). Plus besoin de cliquer pour vérifier. |
| **Déjà ouvertes en gris** | Une notification sur laquelle tu as cliqué (ou dont tu as ouvert l'enchère) est grisée avec « 👁 Vue » : tu vois d'un coup d'œil ce que tu as déjà vérifié. |
| **Temps restant** | Si l'enchère est encore en cours : « ⏱ Encore 35 min ». |
| **Masquer les terminées** | Un bouton les cache complètement. |

**Comment l'extension sait qu'une enchère est finie**, sans rien demander au jeu :
- tu as déjà ouvert l'enchère (même une seule fois) ;
- tu l'as vue au marché avec son temps restant, et ce temps est écoulé ;
- une notification « Enchère terminée » ou « Enchère gagnée » en parle ;
- sinon, la notification a plus de 24 h (réglable) : elle est marquée « ⌛ Sûrement terminée ».

**Supprimer les notifs cliquées** : coche la case ☐ dans la barre de la cloche (ou dans les réglages de l'extension). Chaque notification que tu ouvres disparaît alors de ta liste. Décoche pour les revoir. Rien n'est effacé sur le site.

### ‹ › Flèches dans la fiche d'une carte (Collection)
Quand tu ouvres une carte dans ta Collection, deux flèches apparaissent de chaque côté : **›** ouvre la carte suivante de la page, **‹** la précédente (ou les touches ← et → du clavier). L'onglet reste le même : si tu es sur « Marché », la carte suivante s'ouvre aussi sur « Marché », pratique pour relever les prix. La flèche fait seulement ce que tu ferais en cliquant sur la carte voisine.

### 💰 Panneau « Vente » (bouton en bas à gauche)
| Fonction | Détail |
|---|---|
| **Prix d'achat** | Le prix payé pour tes cartes achetées au marché (onglet « Gagnées »). |
| **Prix de vente** | Le prix moyen de la semaine **de cette carte**, relevé quand tu ouvres son onglet « Marché » (passe la souris dessus : nombre de ventes, plus bas, plus haut). À défaut : la médiane de ses ventes que tu as vues (en italique). |
| **Tri croissant / décroissant** | Boutons « ▼ du plus cher » / « ▲ du moins cher », ou clic sur une colonne (deuxième clic = ordre inverse). |
| **Gain estimé** | Prix de référence − prix d'achat. |
| **Priorité de vente** | D'abord tes doublons, puis le plus gros gain estimé. |
| **Exclusions** | Les cartes en **favori** et les cartes avec une **étiquette** sont exclues (deux cases à cocher). |
| **Recherche, filtre par rareté, export CSV** | Pour retravailler la liste dans un tableur. |

### ✓ Cartes vendues (onglet du panneau)
Quand tu ouvres la cloche et qu'une notification dit « Votre carte « X » a été vendue pour N wikibidous », l'extension :
- range la carte dans l'onglet **« ✓ Cartes vendues »** avec la date, l'heure, le prix d'achat, le prix de vente et le gain ;
- la retire de l'onglet **« À vendre »** (ou enlève un exemplaire si tu en avais plusieurs) ;
- ajoute « 💰 Rangée dans « Cartes vendues » · gain » sur la notification.

Limite : le site ne garde qu'un nombre limité de notifications, pense à ouvrir la cloche de temps en temps. Prix d'achat inconnu = compté 0 (comme une carte de paquet).

---

## 🧭 Remplir le panneau

L'extension ne retient que ce que tu **affiches** (le site interdit les lectures automatiques en série) :
1. **Collection → clique sur une carte → onglet « Marché »** : le prix moyen de la semaine de cette carte est retenu. Fais-le pour les cartes que tu penses vendre.
2. **Marché → « Gagnées »** : les prix d'achat de tes 50 derniers achats. **« Historique »** : tes ventes.
3. **Collection** : les pages que tu parcours donnent la rareté, les favoris et les étiquettes.

---

## 📥 Installation

Télécharge le fichier qui correspond à ton navigateur dans le dossier [`telechargements/`](telechargements/) (le numéro dans le nom est la version) :

| Navigateur | Fichier |
|---|---|
| Chrome, Brave, Edge | `wikimasters-vente-1.6.0-chrome-brave-edge.zip` |
| Firefox | `wikimasters-vente-1.6.0-firefox.zip` |


### Chrome / Brave / Edge
1. Clic droit sur le zip → **« Extraire tout »**. Range le dossier dans un endroit où tu ne le supprimeras pas (par ex. *Documents*).
2. Tape dans la barre d'adresse : `chrome://extensions` (Brave : `brave://extensions`, Edge : `edge://extensions`).
3. Active le **Mode développeur** (en haut à droite ; sur Edge, en bas à gauche).
4. Clique sur **« Charger l'extension non empaquetée »** et choisis le dossier extrait (celui qui contient `manifest.json`).
5. Recharge ta page WikiMasters : le bouton **💰 Vente** apparaît en bas à gauche.

### Firefox
1. Tape : `about:debugging#/runtime/this-firefox`
2. **« Charger un module complémentaire temporaire… »** → choisis le **zip**.
3. Si la page de réglages s'ouvre avec un bandeau jaune, clique sur **« Autoriser l'accès au site »**.
4. Recharge WikiMasters.

> ⚠ Sur Firefox, une extension chargée ainsi est retirée quand tu fermes le navigateur.

## 🔄 Mettre à jour
**Chrome / Brave / Edge** : extrais le nouveau zip (le dossier porte le numéro de version), supprime l'ancienne version dans la page des extensions puis charge le nouveau dossier ; ou bien remplace le contenu de ton ancien dossier par celui du nouveau zip, puis clique sur la **flèche ronde ↻** de « WikiMasters Vente » dans la page des extensions, et recharge WikiMasters. Tes données sont conservées.
**Firefox** : recharge le nouveau zip depuis `about:debugging`.

## 🆕 Nouveautés
- **1.6.0** : pastille de couleur à côté du prix de vente relevé : 🟢 moins de 6 mois, 🟠 plus de 6 mois, 🔴 plus d'un an. Rouvrir l'onglet « Marché » de la carte remet la pastille au vert.
- **1.5.2** : les filtres par type (Souhaits, Surenchéri, Gagnées, Terminées, Vendues) n'affichent plus que leur type, même pour les notifications non lues. Les non lues restent protégées seulement contre les masquages automatiques (terminées, cliquées).
- **1.5.1** : check-up des notifications. Une notification **non lue** n'est plus jamais cachée ni grisée (avant, un filtre resté actif pouvait cacher la notif « rouge »). Le filtre par type (Souhaits, Gagnées…) n'est plus mémorisé d'une page à l'autre. Un message « N notification(s) cachée(s) · Tout afficher » apparaît quand des notifs sont masquées. Grisé plus lisible.
- **1.5.0** : case à cocher « Supprimer les notifs cliquées » (dans la cloche et dans les réglages) : une notification que tu as ouverte disparaît de ta liste au lieu d'être grisée. Elle disparaît seulement chez toi, le site la garde.
- **1.4.0** : tes ventes. Une notification « Carte vendue » range la carte dans un nouvel onglet « ✓ Cartes vendues » du panneau (date, heure, prix d'achat, prix de vente, gain) et la retire de l'onglet « À vendre ».
- **1.3.1** : une notification déjà ouverte est grisée avec « 👁 Vue ».
- **1.3.0** : flèches ‹ › (et touches ← →) pour passer d'une carte à la suivante dans la fiche d'une carte, en gardant le même onglet.
- **1.2.1** : dans les notifications « Souhaits », les enchères vendues sont grisées comme les non vendues (plus de rouge).
- **1.2.0** : tri croissant / décroissant par prix (et par colonne) ; le prix de vente est maintenant celui **de la carte** (onglet « Marché »), plus seulement la moyenne de sa rareté.
- **1.1.0** : les notifications « Liste de souhaits » dont la carte est déjà vendue passent en rouge (au lieu de gris).
- **1.0.0** : première version.

## ⚙ Réglages et sauvegarde
Clique sur l'icône de l'extension (pièce de puzzle → *WikiMasters Vente*) : options des notifications, exclusions, **export / import** d'une sauvegarde, remise à zéro.

---

## ❓ Limites à connaître
- Pas de chargement « en un clic » de toute la collection : le site le refuse (« L'automatisation n'est pas autorisée »). Le prix d'une carte n'est connu qu'après avoir ouvert son onglet « Marché ».
- Le site ne garde que tes **50 derniers achats** : les achats plus anciens n'ont pas de prix d'achat.
- Une carte dont tu n'as pas ouvert l'onglet « Marché » (ni vu de vente) n'a pas de prix : « — », rangée à la fin.
- Une carte sortie d'un paquet n'a pas de prix d'achat : elle compte comme gratuite.
- Si le site change sa mise en page, certaines lectures peuvent cesser de marcher jusqu'à une mise à jour de l'extension.

---

## 🛠 Pour les développeurs
`python3 build.py` fabrique `dist/wikimasters-vente-<version>-chrome-brave-edge/`, `dist/wikimasters-vente-<version>-firefox/` et les deux zips dans `telechargements/` (version dans le nom).
Vérification Firefox : `npx web-ext lint -s dist/wikimasters-vente-<version>-firefox`.
