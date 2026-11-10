# Kiosque

Dépôt GitHub : **https://github.com/Les-Doubles-A/kiosque**

## Applications desktop (Rust) et Android

Même fonctionnement sur les deux : fil en direct de 70 sources (vérifiées le 07/11/2026), favoris, recherche, filtre par source, gestion des sources. Pas de compte, pas de serveur.

| | Desktop (`desktop/`) | Android (`android/`) |
|---|---|---|
| Techno | Rust, egui | Kotlin, Jetpack Compose |
| Construire | `cargo build --release` | `gradlew assembleRelease` (JDK 17) |
| Résultat | `desktop/target/release/Kiosque.exe` | `android/app/build/outputs/apk/release/app-release.apk` |
| Tests | `cargo test` | `gradlew testDebugUnitTest` |
| Données | `%APPDATA%\Kiosque\` | stockage privé de l'app |

- **Direct** : actualisation à l'ouverture puis toutes les 5 min tant que l'app est visible ; les articles arrivent source par source. Un point rouge signale les nouveaux.
- **Catégories** : Général, Économie, Tech, Sécurité. Une rangée de boutons filtre le fil (et les favoris) ; « Tout » les montre toutes. La catégorie de chaque source se change dans la fenêtre Sources, et se choisit à l'ajout d'un flux.
- **Favoris** : étoile sur un article. Le favori est copié en entier et survit à la disparition de l'article du flux.
- Requêtes conditionnelles (ETag / Last-Modified) : un flux inchangé ne se retélécharge pas.
- Desktop : `F5` actualise, `Ctrl+F` recherche, clic ouvre dans le navigateur. Android : tirer pour actualiser, appui long pour partager.
- `cargo run --release --example probe` (dans `desktop/`) teste toutes les sources par défaut ; `-- fichier.txt` teste des candidats (lignes `Nom|https://...`).
- Les sources par défaut ajoutées dans une nouvelle version apparaissent une fois sur les installations existantes (`defaults_seen.json`) ; une source supprimée ne revient pas.
- Android : `adb logcat -s Kiosque` affiche les sources en échec et la raison.

L'APK release est signé avec la clé debug (installation directe, pas pour le Play Store).

---

## Extension Chrome

Extension Chrome : un clic sur l'icône ouvre une page « Actualités » qui regroupe, par ordre chronologique, les derniers articles de 16 sources (flux RSS et Atom). La page n'affiche que les articles (titre, source, date, extrait) et un bouton **Actualiser**. Pas de compte, pas de serveur, pas de suivi. Les données restent dans ton navigateur.

> État : la page « Actualités » est prête côté code. Les tests automatiques passent ; la vérification dans Chrome (scénarios M1 à M6 de `product/RISKS_AND_TESTS.md`) reste à faire.

## Installer l'extension dans Chrome

1. Ouvre `chrome://extensions`.
2. Active le **Mode développeur** (en haut à droite).
3. Clique sur **Charger l'extension non empaquetée** et choisis le dossier qui contient `manifest.json`.
4. Épingle l'icône Kiosque, puis clique dessus : la page « Actualités » s'ouvre dans un nouvel onglet et charge les articles toute seule.

L'extension déclare la permission `storage` et l'accès aux 11 sites des sources par défaut (liste dans `manifest.json`), et rien d'autre. Seules les adresses `https://` sont acceptées.

## Utiliser

Clique sur l'icône : les articles s'affichent, du plus récent au plus ancien (les 200 derniers). Le bouton **Actualiser** relance la récupération ; elle se fait aussi toute seule à l'ouverture si la dernière date de plus de 30 minutes.

Si une source ne répond pas, un bloc discret « N sources n'ont pas répondu » apparaît sous le bouton : clique dessus pour voir laquelle et pourquoi. Hors connexion, un bandeau le signale et les articles déjà chargés restent affichés.

**Changer de sources** : modifie `src/lib/default-sources.js` (titre et adresse du flux) et, si le site est nouveau, ajoute son nom d'hôte dans `host_permissions` de `manifest.json` ; un test échoue si les deux ne concordent pas. Puis recharge l'extension dans `chrome://extensions`. Les sources déjà enregistrées ne sont pas retirées automatiquement : pour repartir de zéro, supprime les données de l'extension.

**Ancienne page de gestion** (ajout et suppression de sources, filtre, lu/non lu) : elle reste dans le code mais n'est plus reliée à l'icône. Ouvre-la à l'adresse `chrome-extension://<identifiant>/src/kiosque.html` (l'identifiant est affiché sur la carte de l'extension).

### Sources chargées par défaut

Adresses relevées dans des répertoires de flux tiers, **à confirmer en les ajoutant** (certaines peuvent avoir changé). Détails et réserves : `product/PRODUCT_BRIEF.md`, sections 6.1 et 6.2.

Les 16 sources chargées :

| Source | Adresse du flux |
|---|---|
| BBC | `https://feeds.bbci.co.uk/news/rss.xml` |
| France 24 (français) | `https://www.france24.com/fr/rss` |
| France Info | `https://www.franceinfo.fr/titres.rss` |
| Reuters (via Google News) | `https://news.google.com/rss/search?q=when:24h+site:reuters.com&ceid=US:en&hl=en-US&gl=US` |
| AP (via Google News) | `https://news.google.com/rss/search?q=when:24h+site:apnews.com&hl=en-US&gl=US&ceid=US:en` |
| Al Jazeera | `https://www.aljazeera.com/xml/rss/all.xml` |
| The Guardian (monde) | `https://www.theguardian.com/world/rss` |
| NPR | `https://feeds.npr.org/1001/rss.xml` |
| New York Times (monde) | `https://rss.nytimes.com/services/xml/rss/nyt/World.xml` |
| RFI (édition anglaise) | `https://www.rfi.fr/en/rss` |
| Le Monde (édition anglaise) | `https://www.lemonde.fr/en/rss/une.xml` |
| BBC, économie | `https://feeds.bbci.co.uk/news/business/rss.xml` |
| BBC, technologie | `https://feeds.bbci.co.uk/news/technology/rss.xml` |
| France Info, marchés | `https://www.franceinfo.fr/economie/bourse/marches.rss` |
| France Info, tech | `https://www.franceinfo.fr/internet.rss` |
| Le Monde Informatique, sécurité | `https://www.lemondeinformatique.fr/flux-rss/thematique/securite/rss.xml` |

L'AFP n'a pas de flux public trouvé : elle n'est pas dans la liste.

## Limites à connaître

- **Désinstaller l'extension efface toutes tes données** (sources, articles, état de lecture). Note tes sources ailleurs ; l'export OPML est prévu en version 2.
- Un flux qui **redirige vers un autre domaine** (par exemple un ancien nom de site) peut échouer : ajoute alors l'adresse finale.
- Les flux Google News (Reuters, AP) ne sont pas une interface documentée par Google : ils peuvent changer ou cesser de répondre.
- Chaque actualisation contacte les sites sources, qui peuvent enregistrer ton adresse IP.
- Limites : 30 sources, 100 articles conservés par source, réponse de 2 Mo au plus, 10 secondes par source.

## Développer

Les tests demandent Node.js. L'extension elle-même n'a besoin d'aucune installation ni d'étape de build.

```bash
npm install     # Vitest et jsdom (développement seulement)
npm test        # 163 tests automatiques
```

Structure :

```
manifest.json          Manifest V3, permission storage, accès aux 11 sites des sources par défaut
src/background.js      service worker : ouvre la page au clic sur l'icône
src/news.html|css, news.js  la page « Actualités » (celle de l'icône)
src/kiosque.html|css, ui.js  ancienne page de gestion des sources (non reliée)
src/lib/default-sources.js  les 16 sources chargées par défaut
src/lib/feed-parser.js RSS 2.0 et Atom 1.0 → articles normalisés
src/lib/store.js       seul module qui lit et écrit chrome.storage.local
src/lib/refresh.js     récupération réseau (délai, taille, erreurs par source)
src/lib/url.js         validation des adresses de flux
tests/                 Vitest + jsdom, API chrome simulées
product/               brief, critères d'acceptation, architecture, plan, risques
```

<!-- installeur-release -->
## Installation

Téléchargez **`kiosque-Setup-1.0.0.exe`** depuis la [dernière release](https://github.com/Les-Doubles-A/kiosque/releases/latest), puis lancez-le.

L'installation se fait pour l'utilisateur courant, sans droits administrateur (par défaut dans `%LOCALAPPDATA%\Programs\kiosque`), avec un raccourci dans le menu Démarrer et une désinstallation depuis les Paramètres Windows.

L'installeur n'est pas signé : si Windows SmartScreen l'affiche, cliquez sur « Informations complémentaires » puis « Exécuter quand même ».

La release contient aussi l'APK Android (`kiosque-1.0.0.apk`). L'installeur Windows copie en plus l'extension navigateur dans le sous-dossier `extension` (à charger comme extension non empaquetée).

### Recréer l'installeur

Compiler l'application (`cargo build --release (dans desktop/)`), puis lancer [Inno Setup 6](https://jrsoftware.org/isinfo.php) : `iscc installer\kiosque.iss`. Le setup est créé dans `installer\Output\`.
