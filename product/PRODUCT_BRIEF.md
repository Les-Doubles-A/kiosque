# Kiosque — Product Brief

> Version 2 · 2026-10-17 · Statut : H2 et H3 confirmées par l'utilisateur ; H1 vérifiée (résultat en 6.1) ; décisions D1 à D5 retenues
> Légende : **[Fait]** vérifié (source ou « exprimé par l'utilisateur ») · **[H#]** hypothèse · **[Reco]** recommandation · **[À vérifier]**
> Nom de travail « Kiosque » : modifiable (décision D1).

## 1. Concept

Kiosque est une extension de navigateur : un clic sur son icône ouvre une page unique qui regroupe, dans l'ordre chronologique, les derniers articles des sites que l'utilisateur a choisis (flux RSS/Atom), sans compte, sans serveur et sans algorithme de recommandation. **[Fait]** « extension web qui crée une page d'un agrégateur d'information » (exprimé par l'utilisateur). Le choix des sources par flux RSS/Atom est une hypothèse **[H1]**, vérifiée en partie en section 6.1. **[Fait]** Sources de départ voulues : AFP, Reuters, AP, France 24, France Info, BBC (exprimé par l'utilisateur). **[Fait]** Chrome/Chromium seulement, usage personnel (exprimé par l'utilisateur).

## 2. Problème

Suivre l'actualité de 5 à 30 sites oblige à les ouvrir un par un, ou à dépendre d'un fil de réseau social qui trie à la place de l'utilisateur. Le coût est quotidien : du temps perdu, des articles manqués, une attention dirigée par un algorithme. **[H4]** : c'est le besoin réel de l'utilisateur ; à confirmer par le test de la section 7.

## 3. Utilisateurs

- **Utilisateur principal** : une personne seule (l'auteur de la demande) qui suit plusieurs sources et veut tout lire au même endroit, sur un seul ordinateur **[H2][H3]**.
- **Utilisateurs secondaires** : aucun dans le MVP. Publication éventuelle plus tard (voir R3).
- **Hors cible** : équipes qui partagent une veille, lecteurs multi-appareils, utilisateurs voulant des sources sans flux (réseaux sociaux, sites sans RSS).

## 4. Alternatives actuelles

| Alternative | Ce qu'elle fait bien | Limite pour notre cible | Statut de l'information |
|---|---|---|---|
| Ne rien faire : ouvrir les sites un par un, ou s'abonner aux newsletters | Aucune installation | Temps, articles manqués, boîte mail encombrée | **[Fait]** raisonnement, non chiffré |
| Lecteurs de flux RSS en ligne | Synchronisation entre appareils, fonctions riches | Compte, service tiers, parfois payant | **[À vérifier]** aucune recherche sur les produits précis, aucun nom cité |
| Extensions de lecteur RSS pour navigateur | Même forme que Kiosque | Catégorie probablement déjà occupée | **[À vérifier]** idem |
| Fils de réseaux sociaux ou agrégateurs algorithmiques | Zéro configuration | Tri imposé, dépendance à une plateforme | **[À vérifier]** |

## 5. Proposition de valeur

Lire ses sources en un seul endroit, **sans compte, sans serveur, avec des permissions réduites au strict nécessaire** et des données qui restent sur l'ordinateur. Différences concrètes : (1) aucune donnée envoyée à un service Kiosque ; (2) permission d'accès réseau demandée site par site, au moment de l'ajout ; (3) aucun tri algorithmique ; (4) code simple, sans dépendance à l'exécution.

**Évaluation franche** : la catégorie « lecteur RSS » est probablement très occupée **[À vérifier]**. Pour un usage personnel, construire Kiosque se justifie (contrôle, vie privée, apprentissage). Pour un public large, la différenciation est faible : ne pas investir dans la publication avant le test de la section 7.

## 6. Hypothèses

| ID | Hypothèse | Type | Si elle est fausse | Comment la tester | Coût du test |
|---|---|---|---|---|---|
| H1 | Les sources suivies publient un flux RSS 2.0 ou Atom accessible en https | Technique | Sources inutilisables ; envisager la découverte de flux (V2) | **Vérifiée en partie le 2026-10-17** (6.1) : 3 sources sur 6 ont un flux officiel, 2 passent par un contournement (H8), 1 n'a aucune solution trouvée (AFP) | Fait (20 min) |
| H2 | Chrome et navigateurs Chromium, Manifest V3, données locales, un seul appareil, pas de compte | Usage | Firefox ou synchronisation voulus : architecture à revoir | **Confirmée par l'utilisateur** (2026-10-17) | 0 |
| H3 | Usage personnel ; publication non prévue (« usage personnel » exprimé par l'utilisateur) | Usage | Publication : politique de confidentialité, examen du store | **Confirmée par l'utilisateur** (2026-10-17) | 0 |
| H4 | Le vrai besoin est de lire ses sources au même endroit, et un lecteur existant ne suffit pas | Problème | Le produit n'a pas de raison d'être au-delà de l'apprentissage | Test d'intérêt, section 7 | 7 jours |
| H5 | Au plus 30 sources et 100 articles conservés par source ; titre, lien, date et extrait court tiennent dans les 10 Mo de `chrome.storage.local` | Technique | Quota atteint ; passer à IndexedDB | Test de charge automatique fait le 2026-10-17 (2,14 Mio réaliste, 6,36 Mio au pire, pour 10 Mio de quota) ; mesure réelle dans Chrome en M6 | 1 h |
| H6 | La plupart des flux visés répondent directement en https, sans redirection vers un autre domaine | Technique | Erreurs fréquentes à l'ajout ; gérer la permission du domaine final (V2) | Essayer les flux de 6.1 et 6.2 dès la tranche 1 (franceinfo a changé de domaine, Google News peut rediriger vers une page de consentement) | 15 min |
| H7 | Une interface en français seul suffit | Usage | Internationalisation à prévoir | Confirmer avec l'utilisateur | 1 min |
| H8 | Les flux de recherche Google News filtrés par site (Reuters, AP) restent disponibles, utilisables en https et acceptables pour un usage personnel | Technique | Reuters et AP sans solution : retirer ces sources ou les suivre via les sites de leurs clients | Ajouter les deux flux de 6.1 et vérifier en tranche 1 ; relire les conditions de Google **[À vérifier]** | 30 min |

### 6.1 Vérification de H1 : sources de départ (consultée le 2026-10-17)

La liste fournie compte six noms. Résultat de la recherche (sources tierces ; aucun flux n'a été testé depuis l'extension) :

| Source | Flux à ajouter | Statut |
|---|---|---|
| BBC | `https://feeds.bbci.co.uk/news/rss.xml` | **[Fait]** flux public RSS 2.0, en https. Les liens d'articles pointent vers bbc.com, domaine différent du flux |
| France 24 (français) | `https://www.france24.com/fr/rss` | Flux officiels par rubrique au format `/<rubrique>/rss`, confirmé pour `/fr/europe/rss`. L'adresse racine en français est déduite : **[À vérifier]** |
| France Info | `https://www.franceinfo.fr/titres.rss` | **[Fait]** flux listé sur le domaine franceinfo.fr ; l'ancien domaine francetvinfo.fr est aussi listé, d'où un risque de redirection (R1) |
| Reuters | `https://news.google.com/rss/search?q=when:24h+site:reuters.com&ceid=US:en&hl=en-US&gl=US` | **[Fait]** Reuters a arrêté ses flux publics en juin 2020. Contournement : recherche Google News limitée à reuters.com ; ce flux vient de Google et non de Reuters (H8) |
| AP | `https://news.google.com/rss/search?q=when:24h+site:apnews.com&hl=en-US&gl=US&ceid=US:en` | **[Fait]** selon une source tierce, les flux apnews.com ont cessé en 2024. Même contournement que Reuters (H8) |
| AFP | Aucun flux public officiel trouvé | **[À vérifier]** : absence de preuve, pas preuve d'absence. Piste à tester : une recherche Google News sur « AFP ». Sinon, la source est exclue du MVP |

Conséquences : Reuters et AP s'afficheront avec des liens qui passent par Google, des titres suivis du nom du média et des extraits minimaux. L'ajout de ces flux exige que l'extension conserve la chaîne de requête des URL (règle ajoutée à F1).

### 6.2 Sources complémentaires retenues (ajoutées le 2026-10-17)

Choisies pour combler l'absence d'AFP, Reuters et AP en direct, couvrir le français et quelques thèmes, sans doublon (les rubriques « monde » de la BBC et de France Info sont déjà dans leur flux principal). Adresses relevées dans des répertoires de flux tiers, **non testées depuis l'extension** (test en M1).

| Source | Flux à ajouter | Rôle et statut |
|---|---|---|
| Al Jazeera | `https://www.aljazeera.com/xml/rss/all.xml` | International, hors presse occidentale. Flux listé par un répertoire tiers |
| The Guardian (monde) | `https://www.theguardian.com/world/rss` | International, accès libre. Flux listé |
| NPR | `https://feeds.npr.org/1001/rss.xml` | Actualité des États-Unis. Flux listé |
| New York Times (monde) | `https://rss.nytimes.com/services/xml/rss/nyt/World.xml` | International. Flux listé ; la lecture des articles peut être limitée par un abonnement |
| RFI | `https://www.rfi.fr/en/rss` (édition anglaise) | Monde vu de France. L'adresse de l'édition française est à tester : **[À vérifier]** |
| Le Monde | `https://www.lemonde.fr/en/rss/une.xml` (édition anglaise) | Presse française de référence. Adresse relevée sans le schéma, https supposé ; l'adresse française est à trouver sur leur page RSS : **[À vérifier]** ; articles en partie payants |
| BBC, économie | `https://feeds.bbci.co.uk/news/business/rss.xml` | Économie, flux listé |
| BBC, technologie | `https://feeds.bbci.co.uk/news/technology/rss.xml` | Tech, flux listé |
| France Info, marchés | `https://www.franceinfo.fr/economie/bourse/marches.rss` | Marchés financiers, flux listé |
| France Info, tech | `https://www.franceinfo.fr/internet.rss` | Tech et web en français, flux listé |
| Le Monde Informatique, sécurité | `https://www.lemondeinformatique.fr/flux-rss/thematique/securite/rss.xml` | Cybersécurité en français, flux listé |

**Écartées** : Deutsche Welle (flux en `http://` et au format RSS 1.0, refusé par le MVP), CNN (flux arrêtés depuis 2023). Avec les 11 flux ci-dessus et les 5 de 6.1, l'utilisateur démarre avec **16 sources**, sous la limite de 30. Une source d'accès libre par défaut pour chaque besoin évite de dépendre des deux flux Google News (H8).

## 7. Tester l'intérêt avant d'investir

Pendant 7 jours, suivre les 6 sources de départ (celles qui ont un flux, voir 6.1) avec un lecteur RSS gratuit existant. **Seuil** : si l'utilisateur ouvre ce lecteur moins de 4 jours sur 7, le problème n'est pas l'outil mais l'habitude, et coder Kiosque n'y changera rien. S'il l'ouvre régulièrement et en est satisfait, Kiosque n'apporte que le contrôle et la vie privée : acceptable pour un projet personnel, insuffisant pour une publication.

## 8. Objectifs et indicateurs de réussite

| Objectif | Indicateur | Seuil de réussite du MVP | Mesure |
|---|---|---|---|
| Habitude de lecture | Jours d'ouverture sur 14 jours d'usage | au moins 10 jours | Auto-déclaré (aucune télémétrie, par choix de vie privée) |
| Rapidité | Temps d'actualisation de 10 sources | moins de 5 s sur connexion domestique | Chronomètre manuel, indicateur « Actualisation… » |
| Fiabilité | Pertes de données pendant les 14 jours | 0 | Observation |

## 9. Périmètre du MVP

- **MVP** : F1 gérer les sources, F2 afficher le fil agrégé, F3 actualiser les flux, F4 suivre lu/non lu. Détail dans `FEATURES_AND_ACCEPTANCE.md`.
- **Version 2** : F5 import/export OPML, F6 recherche, F7 page Nouvel onglet, F8 actualisation en arrière-plan avec badge.
- **Hors périmètre** : F9 résumés par IA, F10 comptes et synchronisation, F11 sources sans flux (extraction de pages).

## 10. Contraintes

**[Fait]** Livrable : une extension de navigateur (exprimé par l'utilisateur). Aucune autre contrainte exprimée (budget, délai, compétences). Contrainte retenue par choix **[Reco]** : aucun coût récurrent ni service tiers.

## 11. Questions ouvertes

1. AFP : aucun flux public trouvé. Accepter de la laisser de côté dans le MVP, ou la suivre via une recherche Google News (à tester) ?
2. Reuters et AP via Google News (H8) : acceptable, malgré des liens passant par Google et des extraits réduits ?
3. Les 11 sources de 6.2 te conviennent-elles (plusieurs en anglais, certaines en partie payantes) ? En manque-t-il ?

## Journal des changements

- **2026-10-17 — page simplifiée.** L'utilisateur demande une page réduite aux actualités (titre, source, date, extrait) et à un bouton « Actualiser », sans titre « Kiosque », sans gestion des sources. L'icône ouvre désormais cette page « Actualités » ; les 16 sources de 6.1 et 6.2 y sont chargées automatiquement. La page de gestion des sources (F1) reste dans le code mais n'est plus reliée à l'icône.

## Sources

- Requêtes réseau depuis une page d'extension avec permissions d'hôte : https://developer.chrome.com/docs/extensions/develop/concepts/network-requests (consultée le 2026-10-17).
- Permissions optionnelles, `optional_host_permissions`, `permissions.request()` dans un geste de l'utilisateur : https://developer.chrome.com/docs/extensions/mv2/reference/permissions (consultée le 2026-10-17).
- Aucune recherche sur les produits concurrents ni sur leurs prix.
- Flux BBC : https://feeder.co/knowledge-base/rss-content/bbc-rss-feeds/ (consultée le 2026-10-17).
- Sources complémentaires (Al Jazeera, Guardian, NPR, New York Times, DW, CNN) : https://feeder.co/vi/discover/the-best-news-feeds (consultée le 2026-10-17) ; RFI et Le Monde (édition anglaise) : https://rss.feedspot.com/french_news_rss_feeds/ (consultée le 2026-10-17) ; Le Monde Informatique : https://feeder.co/fr/discover/site/lemondeinformatique.fr (consultée le 2026-10-17).
- Reuters, fin des flux publics en juin 2020 et contournement Google News : https://feeder.co/knowledge-base/rss-content/reuters-rss-feeds/ (consultée le 2026-10-17).
- AP, arrêt des flux apnews.com en 2024 et contournement Google News : https://feeder.co/knowledge-base/rss-content/ap-news-rss-feeds/ (consultée le 2026-10-17).
- France Info : https://feeder.co/discover/site/franceinfo.fr (consultée le 2026-10-17).
- France 24 : https://feeder.co/ja/discover/2c5aacb6c6/fr-europe-rss et https://rss.feedspot.com/france24_rss_feeds/ (consultées le 2026-10-17).
- AFP : recherche sans résultat sur un flux officiel (2026-10-17).
