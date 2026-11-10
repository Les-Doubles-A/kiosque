# Kiosque — Fonctionnalités et critères d'acceptation

> Version 1 · 2026-10-17 · Hypothèses : voir `PRODUCT_BRIEF.md` (H1 à H7)

## 1. Priorités

| ID | Fonctionnalité | Priorité | Justification |
|---|---|---|---|
| F1 | Gérer les sources (ajouter par URL de flux, supprimer) | MVP | Sans source, rien à agréger |
| F2 | Afficher le fil agrégé dans une page dédiée | MVP | C'est la valeur promise |
| F3 | Actualiser les flux (à l'ouverture et à la demande) | MVP | Sans actualisation le fil se périme |
| F4 | Suivre lu / non lu | MVP | Distingue les nouveautés des articles déjà vus (parcours quotidien) |
| F5 | Importer / exporter les sources (OPML) | V2 | Utile pour la sauvegarde et le démarrage, mais le parcours principal reste possible sans |
| F6 | Recherche dans les articles stockés | V2 | Confort, pas nécessaire à la lecture |
| F7 | Remplacer la page Nouvel onglet | V2 | Intrusif ; à décider après usage |
| F8 | Actualisation en arrière-plan et badge de non lus | V2 | Ajoute permission d'alarme et service worker actif |
| F9 | Résumés par IA | Hors périmètre | Clé secrète à protéger, coût récurrent, besoin non démontré |
| F10 | Comptes et synchronisation multi-appareils | Hors périmètre | Exige un serveur ; contredit la proposition de valeur |
| F11 | Sources sans flux (extraction de pages, réseaux sociaux) | Hors périmètre | Fragile, risques juridiques et techniques |

## 2. Parcours utilisateurs

### P1 — Premier lancement

1. L'utilisateur clique sur l'icône de l'extension : la page Kiosque s'ouvre dans un nouvel onglet, vide.
2. Il saisit l'URL d'un flux (https) et valide.
3. Chrome demande l'autorisation d'accéder au site de ce flux ; il accepte.
4. La source apparaît dans la liste et ses articles dans le fil.

**Résultat** : un fil non vide avec au moins une source.

### P2 — Lecture quotidienne

1. Clic sur l'icône : la page s'ouvre et le fil s'actualise si la dernière actualisation date de plus de 30 minutes.
2. L'utilisateur parcourt les articles, filtre sur « Non lus » ou sur une source.
3. Il ouvre un article (nouvel onglet) ; l'article passe en « lu ».

**Résultat** : les nouveautés sont lues en quelques minutes.

### P3 — Une source ne répond plus

1. Une source échoue à l'actualisation ; un message d'erreur apparaît à côté d'elle.
2. Le reste du fil reste à jour et lisible.
3. L'utilisateur supprime la source ou la laisse réessayer à la prochaine actualisation.

**Résultat** : une panne ne bloque jamais la lecture.

## 3. Écrans et surfaces

| ID | Écran / surface | Rôle | État vide | Chargement | Erreur | Succès |
|---|---|---|---|---|---|---|
| E1 | Page Kiosque : fil agrégé, barre d'outils (Actualiser, filtre Non lus, filtre par source) | Lire | « Aucune source. Ajoute un flux RSS pour commencer. » + bouton Ajouter | « Actualisation… » ; l'ancien fil reste visible | Bandeau si toutes les sources échouent (« Hors connexion ? ») | Date de dernière actualisation affichée |
| E2 | Panneau Sources (volet de la même page) : liste, champ d'ajout, suppression | Gérer | « Aucune source » | « Ajout en cours… » | Message sous le champ (URL invalide, refus, pas un flux) ; erreur par source dans la liste | Source ajoutée visible dans la liste |

L'icône de l'extension n'ouvre pas de popup : elle ouvre E1 (décision D1).

## 4. Spécifications du MVP

### F1 — Gérer les sources

- **Objectif** : choisir les sites suivis.
- **Comportement attendu** : champ d'URL + bouton « Ajouter » dans E2. L'ajout demande l'autorisation Chrome pour l'origine du flux, récupère le flux, vérifie qu'il s'agit de RSS 2.0 ou Atom, puis enregistre la source. Chaque source a un bouton « Supprimer ».
- **Règles et limites** : https uniquement ; 30 sources au plus ; une source = une URL normalisée (hôte en minuscules, fragment `#…` retiré ; la chaîne de requête `?…` est conservée telle quelle, car les flux Google News en dépendent) ; titre de la source pris dans le flux, sinon le nom d'hôte.
- **Erreurs et cas limites** : URL vide ou invalide, http, doublon, autorisation refusée, page qui n'est pas un flux, limite atteinte.
- **Critères d'acceptation** :
  - **AC-F1-1** — Étant donné la page ouverte, quand l'utilisateur saisit l'URL https d'un flux RSS ou Atom valide, valide, puis accepte l'autorisation demandée par Chrome, alors la source apparaît dans la liste avec le titre du flux (à défaut, son nom d'hôte) et ses articles apparaissent dans le fil.
  - **AC-F1-2** — Quand l'utilisateur refuse l'autorisation demandée par Chrome, alors aucune source n'est ajoutée et le message « Autorisation refusée pour <hôte> : la source n'a pas été ajoutée. » s'affiche.
  - **AC-F1-3** — Une saisie vide, une URL non valide ou une URL en `http://` n'ajoute rien et affiche « Saisis une adresse https:// valide. » ; une URL déjà présente (après normalisation) n'ajoute rien et affiche « Source déjà ajoutée. »
  - **AC-F1-4** — Quand l'URL répond mais que le contenu n'est ni RSS 2.0 ni Atom (par exemple une page HTML), alors rien n'est ajouté et le message « Ce n'est pas un flux RSS ou Atom. » s'affiche.
  - **AC-F1-5** — Quand l'utilisateur supprime une source et confirme, alors la source et tous ses articles disparaissent du fil et du stockage ; s'il annule, rien ne change.
  - **AC-F1-6** — Avec 30 sources enregistrées, l'ajout d'une 31e est refusé avec le message « Limite de 30 sources atteinte. »
- **Vérification** : automatique (stockage, validation, analyse, interface avec API Chrome simulées) ; manuelle dans Chrome pour la vraie fenêtre d'autorisation (M1, M2).

### F2 — Afficher le fil agrégé

- **Objectif** : lire toutes les sources au même endroit.
- **Comportement attendu** : E1 liste les articles de toutes les sources, du plus récent au plus ancien.
- **Règles et limites** : l'extrait est du texte brut de 200 caractères au plus ; aucun contenu HTML du flux n'est interprété ; seuls les liens http et https sont acceptés ; aucune image distante (pas de pistage) ; un titre est tronqué à 300 caractères, un lien de plus de 1 000 caractères est ignoré, un identifiant de plus de 200 caractères est remplacé par une empreinte courte (limite de stockage).
- **Erreurs et cas limites** : article sans date (date de récupération utilisée), sans lien valide (article ignoré), titre vide (ignoré), contenu HTML dans le titre ou l'extrait.
- **Critères d'acceptation** :
  - **AC-F2-1** — Quand l'utilisateur clique sur l'icône de l'extension, alors la page Kiosque s'ouvre dans un nouvel onglet.
  - **AC-F2-2** — Le fil affiche, pour chaque article : titre, nom de la source, date de publication et extrait ; les articles sont triés par date décroissante (à défaut de date de publication, par date de récupération).
  - **AC-F2-3** — Quand l'utilisateur active le titre d'un article (clic ou touche Entrée), alors le lien s'ouvre dans un nouvel onglet avec `rel="noopener noreferrer"` ; un article dont le lien n'est pas en http ou https (par exemple `javascript:`) n'est pas affiché.
  - **AC-F2-4** — Sans aucune source, E1 affiche « Aucune source. Ajoute un flux RSS pour commencer. » et un bouton « Ajouter une source » qui place le focus sur le champ d'ajout.
  - **AC-F2-5** — Un titre ou un extrait contenant du HTML (par exemple `<script>alert(1)</script>` ou `<img src=x onerror=alert(1)>`) s'affiche comme texte inerte : aucun script ne s'exécute et aucune requête d'image n'est émise.
  - **AC-F2-6** — Quand l'utilisateur choisit une source dans le filtre, seuls les articles de cette source sont affichés ; choisir « Toutes les sources » rétablit le fil complet.
- **Vérification** : automatique (analyse et rendu avec jsdom) ; manuelle pour AC-F2-1 (M1).

### F3 — Actualiser les flux

- **Objectif** : garder le fil à jour sans effort.
- **Comportement attendu** : à l'ouverture de E1 et sur clic du bouton « Actualiser », chaque source est récupérée (5 en parallèle au plus), analysée, et ses nouveaux articles fusionnés.
- **Règles et limites** : délai maximal de 10 secondes par source ; réponse limitée à 2 Mo ; 100 articles conservés par source ; identifiant d'article = identifiant du flux (guid ou id), à défaut le lien.
- **Erreurs et cas limites** : réseau coupé, délai dépassé, erreur HTTP, XML invalide, flux inchangé, flux de plus de 100 articles, actualisation lancée pendant une autre.
- **Critères d'acceptation** :
  - **AC-F3-1** — À l'ouverture de la page, si la dernière actualisation date de plus de 30 minutes ou n'a jamais eu lieu, alors l'actualisation de toutes les sources démarre seule, l'indicateur « Actualisation… » est visible et l'ancien fil reste affiché pendant ce temps.
  - **AC-F3-2** — Un clic sur « Actualiser » lance l'actualisation à tout moment ; le bouton est désactivé tant qu'une actualisation est en cours.
  - **AC-F3-3** — Quand une source échoue (réseau, délai de 10 s dépassé, erreur HTTP, XML invalide), alors un message d'erreur apparaît à côté d'elle dans E2, les autres sources sont mises à jour normalement et les articles déjà stockés de la source en échec restent affichés.
  - **AC-F3-4** — Actualiser deux fois de suite un flux inchangé ne crée aucun doublon et conserve l'état lu des articles.
  - **AC-F3-5** — Au plus 100 articles par source sont conservés : quand le 101e arrive, le plus ancien (par date) est supprimé.
  - **AC-F3-6** — Sans connexion réseau, toutes les sources affichent une erreur, le bandeau « Hors connexion ? » apparaît et le fil déjà stocké reste lisible.
- **Vérification** : automatique (récupération simulée) ; manuelle pour la coupure réseau réelle et l'ouverture après redémarrage (M3, M5).

### F4 — Suivre lu / non lu

- **Objectif** : repérer les nouveautés.
- **Comportement attendu** : un article ouvert passe en « lu » ; l'état est visible ; un filtre « Non lus seulement » et un compteur existent ; un bouton permet de repasser un article en non lu.
- **Règles et limites** : l'état lu ne dépend pas de la couleur seule (mention textuelle « Lu » visible ou lisible par lecteur d'écran).
- **Erreurs et cas limites** : article supprimé par la rétention, clic accidentel.
- **Critères d'acceptation** :
  - **AC-F4-1** — Quand l'utilisateur ouvre un article depuis le fil, alors l'article est marqué « lu » et son aspect le distingue des non lus par un texte « Lu » en plus d'un style visuel.
  - **AC-F4-2** — Le compteur « N non lus » correspond au nombre d'articles non lus du filtre courant ; avec « Non lus seulement » activé, aucun article lu n'est affiché.
  - **AC-F4-3** — L'état lu d'un article survit au rechargement de la page et au redémarrage du navigateur.
  - **AC-F4-4** — Un bouton « Marquer comme non lu », accessible au clavier, remet un article lu en non lu et met le compteur à jour.
- **Vérification** : automatique (stockage, rendu) ; manuelle pour le redémarrage du navigateur (M3).

## 5. Permissions et données sensibles

| Permission ou donnée | Pourquoi elle est nécessaire | Alternative plus faible envisagée | Ce qui se passe si elle est refusée |
|---|---|---|---|
| `storage` (requise) | Conserver sources, articles et état lu | `localStorage` : inadapté pour une extension partageant ses pages, pas de gestion de quota claire | L'extension ne peut pas fonctionner |
| Accès à l'origine d'un flux (permission d'hôte **optionnelle**, demandée à l'ajout, https seulement) | Récupérer le flux depuis la page de l'extension | Permission d'hôte globale obligatoire à l'installation : avertissement fort, examen plus strict | La source n'est pas ajoutée (AC-F1-2) |
| Aucune de : `tabs`, `activeTab`, `alarms`, `downloads`, `unlimitedStorage`, accès aux pages visitées | Non nécessaires au MVP | — | Sans objet |
| Données : liste de sources, articles (titre, lien, extrait, date, état lu) | Fonctionnement | — | — |

Les données restent sur l'ordinateur. Chaque actualisation contacte les sites sources (leur journal peut enregistrer l'adresse IP de l'utilisateur). Aucune télémétrie.

## 6. Accessibilité

- Interface entièrement utilisable au clavier (ordre de tabulation logique, titres d'articles activables avec Entrée), focus visible.
- Libellés explicites sur le champ d'ajout et tous les boutons ; `lang="fr"` sur la page.
- Contraste de texte d'au moins 4,5 à 1 ; mode sombre selon la préférence du système ; `prefers-reduced-motion` respecté.
- Messages d'erreur et d'état (« Actualisation… », erreurs de source) annoncés par une région `aria-live` ou `role="alert"`.
- Aucune information portée par la couleur seule (état lu, erreurs).
- Vérification : scénario manuel M4 (clavier seul, lecteur d'écran, contraste mesuré).

## 7. Version 2

| ID | Fonctionnalité | Condition pour la lancer |
|---|---|---|
| F5 | Import/export OPML | MVP validé, ou premier besoin de sauvegarde (les données sont effacées à la désinstallation) |
| F6 | Recherche | Plus de 1 000 articles stockés ou demande répétée |
| F7 | Page Nouvel onglet | 14 jours d'usage avec ouverture quotidienne |
| F8 | Actualisation en arrière-plan | Besoin de notification confirmé ; ajout de la permission d'alarme |

## 8. Hors périmètre

| Fonctionnalité | Raison |
|---|---|
| F9 Résumés par IA | Clé secrète impossible à embarquer dans une extension ; coût par appel ; non démontré utile |
| F10 Comptes et synchronisation | Exige un serveur, contredit « sans compte, sans serveur » |
| F11 Sources sans flux | Extraction fragile, risques de droits et de conditions d'utilisation des sites |

## 9. Page « Actualités » (ajout du 2026-10-17)

Demande de l'utilisateur : une page avec seulement les actualités et leurs informations, plus un bouton « Actualiser ». Elle remplace la page de gestion comme page d'ouverture.

- **Contenu** : bouton « Actualiser », date de dernière actualisation, liste des articles (titre en lien, source, date, extrait de 200 caractères au plus). Aucun titre « Kiosque », aucun panneau Sources, aucun champ d'ajout, aucun filtre ni compteur.
- **Sources** : les 16 sources par défaut, chargées automatiquement. Une source qui ne répond pas est signalée dans un bloc repliable discret (« N sources n'ont pas répondu ») ; hors connexion, un bandeau s'affiche.
- **Limites** : les 200 articles les plus récents sont affichés ; l'actualisation est automatique à l'ouverture si elle date de plus de 30 minutes.
- **Hors périmètre de cette page** : ajouter ou supprimer une source, lu/non lu, filtres. Ces fonctions restent dans l'ancienne page, non reliée.
- **Vérification** : `tests/news.test.js` (19 tests) ; pas de nouveaux critères numérotés.
