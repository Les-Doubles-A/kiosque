# Kiosque — Plan d'implémentation

> Version 2 · 2026-10-17 · Pour confier une tâche à Claude Code : « Implémente T3 de product/IMPLEMENTATION_PLAN.md » ou `/idea-to-product build T3`

## 1. Décisions

D1 à D5 : option recommandée **retenue le 2026-10-17** sur demande de l'utilisateur (« choisis la meilleure option »). Elles ne bloquent plus aucune tâche.

| ID | Décision | Options | Option retenue | Bloque |
|---|---|---|---|---|
| D1 | Comment ouvrir la page | Clic sur l'icône → onglet / popup / remplacement de la page Nouvel onglet | Clic sur l'icône → onglet (ADR-1) | T1 |
| D2 | Outil de test | Vitest + jsdom / `node:test` | Vitest + jsdom | T1 |
| D3 | Nom et icônes | « Kiosque » et icônes simples générées / autre nom | Garder « Kiosque » pour l'instant, icônes unies | T1 |
| D4 | Navigateur de vérification manuelle | Chrome stable / autre Chromium | Chrome stable | T9 |
| D5 | Flux redirigé vers un autre domaine | Afficher une erreur claire / demander la permission du domaine final | Erreur claire dans le MVP, permission supplémentaire en V2 | T4 |

## 2. Étapes

1. **Fondations** : squelette, manifeste, outillage de test, ouverture de la page (T1).
2. **Modules purs testés** : analyse de flux, stockage, récupération (T2, T3, T4).
3. **Parcours principal** : ajouter une source et lire le fil (T5).
4. **Compléments du MVP** : suppression et filtres, actualisation, lu/non lu (T6, T7, T8).
5. **Validation du MVP** : accessibilité, charge, scénarios manuels, README (T9).

## 3. Tranche 1 — premier résultat testable

- **Ce que l'utilisateur pourra faire à la fin** : charger l'extension dans Chrome, cliquer sur l'icône, ajouter l'URL d'un flux https, accepter l'autorisation et voir les articles triés par date.
- **Tâches incluses** : T1, T2, T3, T4, T5.
- **Comment le tester** : `npm test` passe ; puis scénario manuel M1 (voir `RISKS_AND_TESTS.md`) avec le flux BBC (`https://feeds.bbci.co.uk/news/rss.xml`), puis France Info et le flux Google News de Reuters (H6, H8).

## 4. Tâches

### T1 — Squelette, manifeste et ouverture de la page

- **Objectif** : projet qui se charge dans Chrome et dont l'icône ouvre une page vide.
- **Dépend de** : D1, D2, D3.
- **Fichiers ou composants** : `manifest.json`, `package.json`, `vitest.config.js`, `src/background.js`, `src/kiosque.html`, `src/kiosque.css`, `icons/`, `README.md`, `.gitignore`, `tests/chrome-mock.js`, `tests/background.test.js`.
- **À faire** :
  1. Créer le manifeste de `TECHNICAL_ARCHITECTURE.md` section 7 (permissions minimales).
  2. Écrire `background.js` : au clic sur l'icône, ouvrir `kiosque.html` dans un nouvel onglet ; rien d'autre, aucun état.
  3. Installer Vitest et jsdom, configurer `npm test`, créer le module de simulation `chrome.*`.
  4. README : installation, test, chargement dans Chrome, avertissement sur l'effacement des données à la désinstallation, et liste des sources de départ avec leurs URL de flux (`PRODUCT_BRIEF.md`, sections 6.1 et 6.2, 16 sources) à copier-coller.
- **Tests** : `tests/background.test.js` vérifie que le clic sur l'icône appelle la création d'un onglet vers `kiosque.html` ; un test lit `manifest.json` et vérifie les permissions exactes (`storage` seule, `optional_host_permissions` https).
- **Terminé quand** : `npm test` passe ; l'extension se charge sans erreur dans `chrome://extensions` ; un clic sur l'icône ouvre une page vide titrée « Kiosque » (vérification manuelle).
- **Couvre** : AC-F2-1.
- **Statut** : tests automatiques OK (5) ; **reste à faire : vérification manuelle dans Chrome** (chargement sans erreur, clic sur l'icône). Écart : le test du service worker et du manifeste est dans `tests/background.test.js` comme prévu.

### T2 — Analyse des flux RSS 2.0 et Atom

- **Objectif** : transformer un texte XML en liste d'articles normalisés, sans rien d'exécutable.
- **Dépend de** : T1.
- **Fichiers ou composants** : `src/lib/feed-parser.js`, `tests/fixtures/` (rss, atom, page HTML, flux hostile, flux sans dates, flux sans lien), `tests/feed-parser.test.js`.
- **À faire** :
  1. `parseFeed(xmlText)` renvoie `{ title, items }` ou lève une erreur « pas un flux RSS ou Atom ».
  2. Normaliser titre, lien, date (repli : date de récupération), identifiant (guid/id, repli : lien), extrait en texte brut de 300 caractères au plus (retrait des balises).
  3. Ignorer les articles sans titre ou sans lien http(s) valide.
- **Tests** : fixtures RSS et Atom nominales ; HTML renvoie l'erreur ; `<script>` et `<img onerror>` deviennent du texte ; lien `javascript:` ignoré ; identifiant stable entre deux analyses.
- **Terminé quand** : `npm test` passe pour `feed-parser.test.js`, fixture hostile incluse.
- **Couvre** : AC-F1-4, AC-F2-3, AC-F2-5, AC-F3-4.
- **Statut** : **fait** (2026-10-17), 12 tests. Écart : les fixtures sont dans `tests/fixtures.js` (chaînes) et non dans un dossier `tests/fixtures/`.

### T3 — Stockage versionné

- **Objectif** : un seul module lit et écrit les données, avec ses limites.
- **Dépend de** : T1.
- **Fichiers ou composants** : `src/lib/store.js`, `src/lib/url.js`, `tests/store.test.js`.
- **À faire** :
  1. Schéma version 1 (section 5 de l'architecture) ; création à vide au premier accès.
  2. `addSource` (limite 30, doublon après normalisation d'URL), `removeSource` (supprime aussi ses articles), `upsertItems(sourceId, items)` (fusion sans doublon, conserve `read`, rétention 100 par date), `setRead`, `getFeed`.
  3. Gestion d'une erreur d'écriture (quota) : erreur explicite, aucune écriture partielle.
- **Tests** : limite de 30, doublon, URL avec chaîne de requête conservée (flux Google News), suppression en cascade, deux fusions identiques sans doublon, état lu conservé, rétention de 100, relecture après écriture (persistance simulée).
- **Terminé quand** : `npm test` passe pour `store.test.js`.
- **Couvre** : AC-F1-3, AC-F1-5, AC-F1-6, AC-F3-4, AC-F3-5, AC-F4-3.
- **Statut** : **fait** (2026-10-17), 14 tests. Les écritures sont sérialisées par une file interne. `src/lib/url.js` et `src/lib/messages.js` ajoutés.

### T4 — Récupération réseau avec délai et erreurs

- **Objectif** : récupérer un flux en toute sécurité et isoler les pannes source par source.
- **Dépend de** : T2, T3, D5.
- **Fichiers ou composants** : `src/lib/refresh.js`, `tests/refresh.test.js`.
- **À faire** :
  1. `fetchFeed(url)` : https seulement, délai de 10 s (`AbortController`), taille ≤ 2 Mo, statut HTTP contrôlé ; erreurs typées (réseau, délai, HTTP, taille, XML).
  2. `refreshAll(sources, { concurrency: 5 })` : sources traitées séparément, erreur enregistrée dans `lastError`, succès efface l'erreur.
  3. `needsRefresh(meta, now)` : vrai si jamais actualisé ou plus de 30 minutes.
  4. `validateFeedUrl(text)` : message exact des critères.
- **Tests** : `fetch` simulé (succès, URL Google News avec `+` et `:` transmise intacte, 500, délai dépassé, réseau coupé, réponse HTML, réponse trop grande) ; une source en échec n'empêche pas les autres ; seuil de 30 minutes avec horloge simulée ; 10 sources simulées à 1 s terminent en moins de 5 s (horloge simulée).
- **Terminé quand** : `npm test` passe pour `refresh.test.js`.
- **Couvre** : AC-F1-3, AC-F1-4, AC-F3-1, AC-F3-3, AC-F3-6.
- **Statut** : **fait** (2026-10-17), 25 tests (validation d'URL, délai, taille, erreurs par source, 5 en parallèle).

### T5 — Ajouter une source et afficher le fil

- **Objectif** : le parcours principal P1 de bout en bout.
- **Dépend de** : T2, T3, T4.
- **Fichiers ou composants** : `src/kiosque.html`, `src/kiosque.css`, `src/ui.js`, `tests/ui-feed.test.js`, `tests/ui-sources.test.js`.
- **À faire** :
  1. Panneau Sources (E2) : champ, bouton « Ajouter », zone de message `aria-live`.
  2. Au clic : valider l'URL, demander `chrome.permissions.request({ origins: [origine + "/*"] })` dans le geste, récupérer, analyser, enregistrer ; messages exacts des critères en cas de refus, d'URL invalide, de doublon, de non-flux.
  3. Fil (E1) : articles triés, titre en lien (`rel="noopener noreferrer"`, nouvel onglet), source, date, extrait de 200 caractères ; tout texte inséré avec `textContent`.
  4. État vide avec bouton qui place le focus sur le champ.
- **Tests** : rendu jsdom avec articles hostiles (aucun script, aucune image créée) ; tri ; état vide ; permission simulée acceptée puis refusée.
- **Terminé quand** : `npm test` passe ; scénario manuel M1 réussi avec un flux réel.
- **Couvre** : AC-F1-1, AC-F1-2, AC-F1-3, AC-F1-4, AC-F2-2, AC-F2-3, AC-F2-4, AC-F2-5.
- **Statut** : tests automatiques OK (21) ; **reste à faire : scénario manuel M1 dans Chrome** avec les vrais flux. Écart : `src/main.js` ajouté (point d'entrée) et `tests/ui-helpers.js`.

### T6 — Supprimer une source, filtre par source

- **Objectif** : gérer la liste et naviguer dans le fil.
- **Dépend de** : T5.
- **Fichiers ou composants** : `src/ui.js`, `tests/ui-sources.test.js`, `tests/ui-feed.test.js`.
- **À faire** :
  1. Bouton « Supprimer » par source avec confirmation (annuler ne change rien).
  2. Message de limite à la 31e source.
  3. Filtre par source (« Toutes les sources » par défaut).
- **Tests** : suppression confirmée et annulée ; limite atteinte ; filtre appliqué et levé.
- **Terminé quand** : `npm test` passe ; vérification manuelle de la suppression dans Chrome.
- **Couvre** : AC-F1-5, AC-F1-6, AC-F2-6.
- **Statut** : tests automatiques OK (suppression confirmée et annulée, 31e source refusée, filtre par source) ; **reste : vérification manuelle de la suppression dans Chrome** (M3).

### T7 — Actualisation automatique et manuelle

- **Objectif** : fil à jour et erreurs visibles.
- **Dépend de** : T5.
- **Fichiers ou composants** : `src/ui.js`, `tests/ui-refresh.test.js`.
- **À faire** :
  1. À l'ouverture : actualisation si `needsRefresh`.
  2. Bouton « Actualiser », désactivé pendant l'opération ; indicateur « Actualisation… » en `aria-live` ; ancien fil conservé.
  3. Erreur par source dans E2 ; bandeau « Hors connexion ? » si toutes échouent ; date de dernière actualisation affichée.
- **Tests** : démarrage automatique avec horloge simulée ; double clic impossible ; échec partiel ; échec total conserve le fil.
- **Terminé quand** : `npm test` passe ; scénarios manuels M3 et M5 réussis.
- **Couvre** : AC-F3-1, AC-F3-2, AC-F3-3, AC-F3-4, AC-F3-5, AC-F3-6.
- **Statut** : tests automatiques OK (actualisation automatique au seuil de 30 minutes, bouton désactivé pendant l'opération, erreur par source, bandeau « Hors connexion ? », absence de doublon) ; **reste : M3 et M5 dans Chrome**.

### T8 — Lu / non lu

- **Objectif** : repérer les nouveautés.
- **Dépend de** : T5.
- **Fichiers ou composants** : `src/ui.js`, `src/kiosque.css`, `tests/ui-feed.test.js`.
- **À faire** :
  1. Marquer lu à l'ouverture d'un article ; texte « Lu » en plus du style.
  2. Compteur « N non lus » et filtre « Non lus seulement ».
  3. Bouton « Marquer comme non lu » accessible au clavier.
- **Tests** : marquage, compteur selon le filtre, bascule, persistance (relecture du stockage simulé).
- **Terminé quand** : `npm test` passe ; état conservé après redémarrage de Chrome (M3).
- **Couvre** : AC-F4-1, AC-F4-2, AC-F4-3, AC-F4-4.
- **Statut** : tests automatiques OK (clic, clic du milieu, compteur, filtre, persistance, bascule) ; **reste : redémarrage réel de Chrome** (M3).

### T9 — Accessibilité, charge et validation du MVP

- **Objectif** : prouver que chaque critère du MVP est vérifié.
- **Dépend de** : T6, T7, T8, D4.
- **Fichiers ou composants** : `README.md`, `product/RISKS_AND_TESTS.md` (statuts).
- **À faire** :
  1. Scénario M4 (clavier seul, contraste, lecteur d'écran).
  2. Test de charge : les 16 sources de départ, puis des flux supplémentaires jusqu'à 30 ; vérifier le volume stocké (H5) et le temps d'actualisation.
  3. Dérouler tous les scénarios manuels M1 à M5, renseigner la preuve.
  4. Tableau final : chaque critère MVP avec son mode de vérification.
- **Tests** : tous les scénarios manuels ; `npm test` complet.
- **Terminé quand** : le tableau de `RISKS_AND_TESTS.md` section 4 n'a plus de ligne « non vérifié ».
- **Couvre** : validation de l'ensemble des critères MVP (détail en section 4 de `RISKS_AND_TESTS.md`).
- **Statut** : **partiellement fait** : tests automatiques d'accessibilité (étiquettes, noms des boutons, régions dynamiques, contraste clair et sombre) et de charge (30 × 100 articles) faits. **Reste : scénarios manuels M1 à M6 dans Chrome**, et README à ajuster selon les résultats.

### T10 — Page « Actualités » simplifiée (ajout du 2026-10-17)

- **Objectif** : une page réduite aux actualités et au bouton « Actualiser », ouverte au clic sur l'icône.
- **Dépend de** : T4.
- **Fichiers ou composants** : `src/news.html`, `src/news.css`, `src/news.js`, `src/news-main.js`, `src/lib/default-sources.js`, `src/background.js`, `manifest.json`, `tests/news.test.js`.
- **À faire** :
  1. Charger les 16 sources par défaut au premier lancement, sans doublon.
  2. Afficher les 200 articles les plus récents (titre, source, date, extrait) et le bouton « Actualiser » ; actualisation automatique à l'ouverture après 30 minutes.
  3. Signaler les sources qui ne répondent pas dans un bloc repliable, et le mode hors connexion par un bandeau.
  4. Déclarer les 11 sites dans `host_permissions` (test de cohérence avec la liste des sources).
- **Tests** : `tests/news.test.js` (19 tests) ; `tests/background.test.js` adapté.
- **Terminé quand** : `npm test` passe ; la page s'ouvre dans Chrome au clic sur l'icône et affiche des articles (à vérifier manuellement).
- **Couvre** : aucun critère du MVP (demande de simplification de l'utilisateur).
- **Statut** : tests automatiques OK ; **reste : vérification manuelle dans Chrome**.

## 5. Peut attendre

| Élément | Pourquoi attendre | Déclencheur |
|---|---|---|
| F5 Import/export OPML | Hors parcours principal | MVP validé, ou besoin de sauvegarde |
| F6 Recherche | Confort | Plus de 1 000 articles |
| F7 Page Nouvel onglet | Intrusif | 14 jours d'usage |
| F8 Actualisation en arrière-plan | Ajoute service worker actif et permission d'alarme | Besoin de notification confirmé |
| Support de RSS 1.0 et de la permission du domaine final après redirection | Cas rares **[H6]** | Erreurs fréquentes constatées |
| Affichage du fil par pages (« Afficher plus ») | Le rendu actuel liste tous les articles (jusqu'à 3 000 au maximum permis) ; non gênant a priori avec 16 sources | Page lente constatée en M6 (R12) |
| Publication sur le Chrome Web Store | Usage personnel d'abord **[H3]** | Test d'intérêt réussi et décision de publier |
