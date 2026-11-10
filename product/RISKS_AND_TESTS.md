# Kiosque — Risques et tests

> Version 2 · 2026-10-17

## 1. Risques

| ID | Risque | Type | Probabilité | Impact | Prévention | Repli |
|---|---|---|---|---|---|---|
| R1 | Un flux redirige vers un autre domaine (ancien domaine francetvinfo.fr de France Info, page de consentement Google pour un utilisateur européen) : la récupération échoue faute de permission sur ce domaine **[À vérifier]** | Technique | Moyenne | Moyen | Message d'erreur explicite ; essai des flux de départ (brief, 6.1 et 6.2) dès la tranche 1 (H6) | L'utilisateur ajoute l'URL finale ; V2 : demander la permission du domaine final |
| R2 | Données effacées à la désinstallation de l'extension | Fonctionnel | Moyenne | Moyen | Avertissement dans le README ; export OPML prévu en V2 (F5) | Ressaisir les sources |
| R3 | Examen du Chrome Web Store plus strict à cause du motif d'hôte optionnel large **[À vérifier]** | Plateforme | Moyenne | Moyen | Usage personnel par chargement non empaqueté d'abord (H3) ; justification écrite de chaque permission | Réduire à une liste de domaines ou renoncer à la publication |
| R4 | Des sources visées n'ont pas de flux : **réalisé** pour AFP (aucun flux trouvé), Reuters et AP (flux officiels arrêtés) | Fonctionnel | Forte | Moyen | Vérification faite (brief, 6.1) ; AFP laissée de côté sauf piste Google News | V2 : découverte automatique du flux d'une page ; extraction de pages hors périmètre (F11) |
| R5 | Quota de `chrome.storage.local` dépassé (H5) | Technique | Faible | Moyen | Titre 300, lien 1 000, identifiant 200 et extrait 300 caractères au plus, 100 articles par source, 30 sources ; test de charge automatique (pire cas mesuré : 6,36 Mio sur 10) | Message clair ; supprimer d'abord les articles lus les plus anciens ; passer à IndexedDB |
| R6 | Réponse XML volumineuse ou piégée | Technique | Faible | Moyen | Taille ≤ 2 Mo, délai 10 s, analyse dans la page | Source marquée en erreur |
| R7 | Contenu hostile d'un flux (script, image pistage) | Technique | Moyenne | Fort | `textContent` partout, aucune image, CSP par défaut, tests AC-F2-5 | Aucun : prévention obligatoire |
| R8 | Vie privée : chaque actualisation révèle l'adresse IP aux sites sources | Légal | Faible | Faible | Mention dans le README et dans une politique de confidentialité en cas de publication | — |
| R9 | Droit d'auteur : republication de contenu | Légal | Faible | Moyen | Titre + extrait de 200 caractères + lien seulement | Réduire l'extrait **[À vérifier]** avant toute publication |
| R11 | Les flux Google News ne sont pas une interface documentée par Google : changement de format, blocage, page de consentement, conditions d'utilisation **[À vérifier]** | Plateforme | Moyenne | Moyen | Usage personnel, 2 requêtes par actualisation seulement, message d'erreur par source | Retirer Reuters et AP, ou les suivre via d'autres sites |
| R10 | Catégorie « lecteur RSS » saturée : peu de valeur ajoutée (H4) | Fonctionnel | Forte | Moyen | Test d'intérêt de 7 jours (brief, section 7) | Arrêter ou rester un projet personnel |
| R12 | Page lourde ou lente avec plusieurs centaines d'articles (jusqu'à 3 000 au maximum permis) | Technique | Moyenne | Faible | Rendu simple (une liste, pas d'image) ; mesure en M6 avec les 16 sources | V2 : affichage par pages |
| R13 | Une adresse de flux par défaut ne répond pas ou a changé (adresses non testées : France 24, RFI, Le Monde, flux Google News) ; sans page de gestion, la corriger demande de modifier le code | Fonctionnel | Moyenne | Faible | Bloc « N sources n'ont pas répondu » avec le message d'erreur de chaque source | Corriger l'adresse dans `src/lib/default-sources.js` (et l'hôte dans `manifest.json`) |

## 2. Hypothèses non vérifiées

| ID | Hypothèse | Comment la vérifier | Quand | Ce qu'on fait si elle est fausse |
|---|---|---|---|---|
| H1 | Les sources visées ont un flux RSS 2.0 ou Atom en https | Vérifiée en partie par recherche (brief, 6.1) ; test réel de chaque flux depuis l'extension | T5 (M1) | Retirer les sources ; envisager la découverte de flux |
| H2 | Chrome/Chromium, MV3, local, un seul appareil | **Confirmée par l'utilisateur** (2026-10-17) | Fait | Revoir l'architecture |
| H3 | Usage personnel | **Confirmée par l'utilisateur** (2026-10-17) | Fait | Ajouter politique de confidentialité et préparation du store si la publication est décidée |
| H4 | Un lecteur existant ne suffit pas | Test d'intérêt de 7 jours | Avant T1 | Ne pas coder, ou assumer le projet comme exercice personnel |
| H5 | 30 × 100 articles tiennent dans le quota | Test de charge automatique fait (2,14 Mio réaliste, 6,36 Mio pire cas) ; mesure réelle dans Chrome en M6 | M6 | Passer à IndexedDB |
| H6 | Peu de redirections inter-domaines | Essayer les 10 sources | T5 | Gérer le domaine final (V2) |
| H7 | Français seul suffit | Question à l'utilisateur | Avant T5 | Prévoir l'internationalisation |
| H8 | Flux Google News filtrés par site utilisables pour Reuters et AP | Les ajouter en M1 et lire leurs articles ; relire les conditions de Google | T5 (M1) | Retirer ces deux sources |

## 3. Stratégie de test

| Niveau | Outil | Ce qui est couvert | Quand l'exécuter |
|---|---|---|---|
| Unitaire | Vitest + jsdom | Analyse, stockage, URL, récupération, rendu, contraste des couleurs, structure accessible, taille du stockage au pire cas | À chaque modification |
| Intégration (modules ensemble, API Chrome simulées) | Vitest | Ajout d'une source, actualisation, états de l'interface | À chaque modification |
| Bout en bout | Non prévu dans le MVP (chargement réel dans Chrome en manuel) | — | — |
| Manuel | Chrome stable, extension non empaquetée | Fenêtre d'autorisation réelle, clic sur l'icône, redémarrage du navigateur, réseau coupé, accessibilité | Avant chaque livraison |

**Commande unique** : `npm test`

## 4. Couverture des critères d'acceptation

| Critère | Vérification | Test ou scénario | Tâche |
|---|---|---|---|
| AC-F1-1 | Automatique + manuelle | `tests/ui-sources.test.js` (permission simulée) ; M1 | T5 |
| AC-F1-2 | Automatique + manuelle | `tests/ui-sources.test.js` (refus simulé) ; M1 | T5 |
| AC-F1-3 | Automatique + manuelle | `tests/refresh.test.js` (validation URL), `tests/store.test.js` (doublon), `tests/ui-sources.test.js` ; M2 | T3, T4, T5 |
| AC-F1-4 | Automatique + manuelle | `tests/feed-parser.test.js` (HTML), `tests/refresh.test.js` ; M2 | T2, T4, T5 |
| AC-F1-5 | Automatique + manuelle | `tests/store.test.js`, `tests/ui-sources.test.js` ; M3 | T3, T6 |
| AC-F1-6 | Automatique | `tests/store.test.js`, `tests/ui-sources.test.js` | T3, T6 |
| AC-F2-1 | Automatique + manuelle | `tests/background.test.js` ; M1 | T1 |
| AC-F2-2 | Automatique | `tests/ui-feed.test.js` | T5 |
| AC-F2-3 | Automatique + manuelle | `tests/feed-parser.test.js` (lien `javascript:`), `tests/ui-feed.test.js` (attributs du lien) ; M3 | T2, T5 |
| AC-F2-4 | Automatique | `tests/ui-feed.test.js` (état vide, focus) | T5 |
| AC-F2-5 | Automatique | `tests/feed-parser.test.js`, `tests/ui-feed.test.js` (fixture hostile) | T2, T5 |
| AC-F2-6 | Automatique | `tests/ui-feed.test.js` | T6 |
| AC-F3-1 | Automatique + manuelle | `tests/refresh.test.js` (seuil 30 min), `tests/ui-refresh.test.js` ; M3 | T4, T7 |
| AC-F3-2 | Automatique | `tests/ui-refresh.test.js` | T7 |
| AC-F3-3 | Automatique + manuelle | `tests/refresh.test.js` (échec partiel), `tests/ui-refresh.test.js` ; M5 | T4, T7 |
| AC-F3-4 | Automatique | `tests/feed-parser.test.js` (identifiant), `tests/store.test.js` | T2, T3, T7 |
| AC-F3-5 | Automatique | `tests/store.test.js` (rétention) | T3, T7 |
| AC-F3-6 | Automatique + manuelle | `tests/refresh.test.js` (réseau coupé), `tests/ui-refresh.test.js` ; M5 | T4, T7 |
| AC-F4-1 | Automatique + manuelle | `tests/ui-read.test.js` ; M3 | T8 |
| AC-F4-2 | Automatique | `tests/ui-read.test.js` | T8 |
| AC-F4-3 | Automatique + manuelle | `tests/store.test.js`, `tests/ui-read.test.js` ; M3 (redémarrage) | T3, T8 |
| AC-F4-4 | Automatique + manuelle | `tests/ui-read.test.js` ; M4 (clavier) | T8 |

Statut au 2026-10-17 (tranches 1 à 3 livrées) : **163 tests automatiques passent**, aucun scénario manuel n'a encore été exécuté dans Chrome.

| Critère | Statut |
|---|---|
| AC-F1-1, AC-F1-2, AC-F1-3, AC-F1-4 | Vérifiés automatiquement. **Reste M1 et M2** (vraie fenêtre d'autorisation, vrais flux) |
| AC-F1-5 | Vérifié automatiquement (stockage et interface, confirmation et annulation). **Reste M3** |
| AC-F1-6 | Vérifié automatiquement (stockage et interface) |
| AC-F2-1 | Vérifié automatiquement (service worker simulé). **Reste M1** |
| AC-F2-2, AC-F2-4, AC-F2-5, AC-F2-6 | Vérifiés automatiquement |
| AC-F2-3 | Vérifié automatiquement. **Reste M3** (ouverture réelle dans un nouvel onglet) |
| AC-F3-1, AC-F3-2, AC-F3-4, AC-F3-5 | Vérifiés automatiquement. **Reste M3** pour l'ouverture après 30 minutes |
| AC-F3-3, AC-F3-6 | Vérifiés automatiquement (échec partiel, hors connexion). **Reste M5** (vraie coupure réseau) |
| AC-F4-1, AC-F4-2, AC-F4-4 | Vérifiés automatiquement. **Reste M3 et M4** (clavier réel) |
| AC-F4-3 | Persistance vérifiée automatiquement sur le stockage simulé. **Reste M3** (vrai redémarrage de Chrome) |
| Accessibilité (section 6 des fonctionnalités) | Vérifiée automatiquement : langue, étiquettes, noms des boutons, régions dynamiques, ordre de tabulation, contraste d'au moins 4,5 à 1 en thème clair et sombre (article lu compris), focus visible, thème sombre, mouvement réduit. **Reste M4** (clavier réel, lecteur d'écran, zoom) |
| H5 (taille du stockage) | Vérifiée par test automatique (2,14 Mio réaliste, 6,36 Mio pire cas). **Reste M6** (mesure réelle) |

Le tableau passera à « vérifié » critère par critère à mesure que M1 à M6 sont exécutés.

## 5. Scénarios de test manuels

### M1 — Premier lancement et ajout d'une source

- **Préparation** : extension chargée dans Chrome stable (D4), stockage vide, les URL de flux de `PRODUCT_BRIEF.md` sections 6.1 et 6.2 (BBC d'abord, puis France Info, France 24, Reuters et AP via Google News, puis les sources complémentaires).
- **Étapes** : cliquer sur l'icône ; constater l'état vide ; saisir l'URL de la BBC ; accepter l'autorisation ; ajouter les autres flux ; recommencer avec une source en refusant l'autorisation.
- **Résultat attendu** : page ouverte dans un nouvel onglet ; message d'état vide ; source ajoutée avec ses articles ; au refus, aucune source et message « Autorisation refusée… ».
- **Critères couverts** : AC-F2-1, AC-F2-4, AC-F1-1, AC-F1-2, AC-F2-2.

> **Note du 2026-10-17** : l'icône ouvre désormais la page « Actualités ». Pour M1 : ouvrir la page, vérifier que des articles apparaissent et que le bloc « N sources n'ont pas répondu » indique les flux en échec. Les étapes d'ajout et de refus d'autorisation concernent l'ancienne page de gestion, qu'on ouvre à l'adresse `chrome-extension://<identifiant de l'extension>/src/kiosque.html` (l'identifiant est affiché sur la carte de l'extension dans `chrome://extensions`).

### M2 — Erreurs à l'ajout

- **Préparation** : une URL de page HTML ordinaire, une URL en `http://`, une source déjà ajoutée.
- **Étapes** : tenter chaque ajout.
- **Résultat attendu** : messages exacts des critères ; rien n'est ajouté.
- **Critères couverts** : AC-F1-3, AC-F1-4.

### M3 — Lecture quotidienne

- **Préparation** : 3 sources réelles ajoutées.
- **Étapes** : fermer et rouvrir la page après plus de 30 minutes ; ouvrir deux articles ; filtrer « Non lus seulement » ; marquer un article en non lu ; supprimer une source en confirmant puis en annulant ; redémarrer Chrome.
- **Résultat attendu** : actualisation automatique visible ; articles ouverts passés en « Lu » ; compteur exact ; états conservés après redémarrage ; suppression correcte.
- **Critères couverts** : AC-F3-1, AC-F2-3, AC-F4-1, AC-F4-2, AC-F4-3, AC-F1-5.

### M4 — Accessibilité

- **Préparation** : page avec au moins une source.
- **Étapes** : parcourir toute la page au clavier seul ; ouvrir un article avec Entrée ; marquer non lu au clavier ; mesurer le contraste du texte ; tester avec un lecteur d'écran l'annonce de « Actualisation… » et d'une erreur.
- **Résultat attendu** : toutes les actions accessibles, focus visible, contraste d'au moins 4,5 à 1, messages annoncés.
- **Critères couverts** : AC-F4-4 et exigences de la section 6 de `FEATURES_AND_ACCEPTANCE.md`.

### M5 — Source en panne et hors connexion

- **Préparation** : 3 sources, dont une ajoutée avec une URL cassée après coup (modifier le stockage) ou bloquée.
- **Étapes** : actualiser ; puis couper le réseau et actualiser.
- **Résultat attendu** : erreur à côté de la source en panne seulement, autres sources à jour ; réseau coupé : bandeau « Hors connexion ? », fil toujours lisible.
- **Critères couverts** : AC-F3-3, AC-F3-6.

### M6 — Taille réelle du stockage et rapidité

- **Préparation** : les 16 sources du README ajoutées, au moins une actualisation terminée.
- **Étapes** : ouvrir les outils de développement de la page Kiosque (clic droit, Inspecter), onglet Application, Stockage local de l'extension, et relever la taille ; recharger la page et noter la durée avant l'apparition du fil ; chronométrer « Actualiser » sur les 16 sources.
- **Résultat attendu** : taille bien inférieure à 10 Mo ; fil affiché en moins de 2 secondes ; actualisation de 10 à 16 sources en moins de 5 secondes sur connexion domestique.
- **Critères couverts** : H5, R5, R12 et l'indicateur de rapidité du brief.

## 6. Validation du MVP

Le MVP est validé quand :

- [ ] tous les critères d'acceptation MVP sont vérifiés (tableau de la section 4, colonne de statut complétée en T9) ;
- [x] `npm test` passe sans échec (163 tests, 2026-10-17) ;
- [ ] les scénarios M1 à M6 ont été exécutés dans Chrome avec preuve notée ;
- [x] le test de charge de 30 sources × 100 articles confirme H5 en simulation (6,36 Mio au pire) ; mesure réelle en M6 ;
- [ ] 14 jours d'usage : au moins 10 jours d'ouverture et 0 perte de données (indicateurs du brief).

## 7. Après le lancement

Signaux à observer : nombre de sources en erreur persistante (révèle R1 et R4), taille du stockage (R5), jours où l'utilisateur ouvre Kiosque ou retourne à ses sites directement (H4), demandes de sauvegarde (déclencheur F5). Aucune télémétrie : tout est observé à la main.
