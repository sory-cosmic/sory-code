PLAN

# MISSION — CONTINUER ET FINALISER SORYCODE À PARTIR D’OPENCODE

Tu travailles directement sur le dépôt fourni :

`/home/sory/Bureau/opencode-dev/opencode-dev`

## 0. RÈGLE ABSOLUE

Tu ne dois PAS créer un nouveau prototype indépendant.

Tu dois partir du code existant d’OpenCode et construire SoryCode progressivement à l’intérieur de cette architecture.

Avant toute modification importante, tu dois comprendre le code existant.

Ton objectif est de transformer progressivement OpenCode en la base technique de SoryCode tout en conservant les parties robustes du runtime et de l’architecture existante.

Tu dois privilégier :
- réutilisation du code existant ;
- extensions propres ;
- abstractions maintenables ;
- compatibilité avec l’architecture actuelle ;
- changements minimaux lorsqu'une fonctionnalité existe déjà ;
- tests ;
- documentation ;
- sécurité ;
- absence de régression.

---

# 1. VISION DE SORYCODE

SoryCode est un environnement de développement moderne centré sur l’IA.

Ce n’est PAS un clone de VS Code.

L'interface et l'expérience utilisateur doivent être propres à SoryCode et centrées sur :

- le projet ;
- l'IA ;
- l'environnement d'exécution ;
- les fichiers ;
- le terminal ;
- Git ;
- les processus ;
- les builds ;
- les tests ;
- les serveurs ;
- les environnements distants.

Le principe fondamental est :

**1 projet = 1 environnement d’exécution attaché à ce projet.**

Tout ce qui appartient au projet doit utiliser cet environnement.

---

# 2. ENVIRONNEMENTS D’EXÉCUTION

Sur Desktop, chaque projet doit pouvoir choisir UN SEUL environnement parmi :

1. PC local
2. GitHub Codespaces
3. Sandbox cloud

Le choix est attaché au projet.

Exemple :

```text
Projet A
└── Runtime: Local

Projet B
└── Runtime: GitHub Codespaces

Projet C
└── Runtime: Sandbox cloud
```

Tous les éléments du projet doivent utiliser le runtime sélectionné :

```text
Runtime
├── Filesystem
├── Dependencies
├── Terminal
├── Processes
├── Build
├── Tests
├── Git
├── Dev servers
└── AI tools
```

Il ne faut jamais avoir une situation où :

```text
Projet → Codespaces
Terminal → PC local
Build → Sandbox
Fichiers → autre environnement
```

Le runtime doit être la source de vérité.

---

# 3. ANDROID / TÉLÉPHONE

Sur Android/téléphone, l’exécution lourde doit être distante.

Le téléphone doit pouvoir contrôler un projet dont le runtime se trouve sur :

- GitHub Codespaces ;
- Sandbox cloud ;
- ou autre environnement distant compatible.

L'application mobile ne doit pas dépendre de la puissance du téléphone pour compiler de gros projets.

Architecture cible :

```text
Android
   │
   ▼
SoryCode Client
   │
   ▼
SoryCode API / Server
   │
   ▼
Project Runtime
   ├── Codespaces
   └── Sandbox
```

---

# 4. IA

SoryCode doit conserver une architecture de providers flexible.

Ne code pas l'application de manière à dépendre définitivement d'un seul fournisseur.

Prévoir une architecture permettant différents providers/modèles, par exemple :

- OpenAI ;
- Google Gemini ;
- OpenRouter ;
- autres providers compatibles ;
- modèles locaux ou futurs providers si l’architecture le permet.

L'IA doit pouvoir travailler avec le runtime du projet.

Elle doit notamment pouvoir :

- lire des fichiers ;
- rechercher dans le projet ;
- créer des fichiers ;
- modifier des fichiers ;
- supprimer/renommer des fichiers ;
- exécuter des commandes ;
- installer des dépendances ;
- lancer des builds ;
- lancer des tests ;
- démarrer des processus ;
- analyser les logs ;
- corriger les erreurs ;
- utiliser Git ;
- comprendre le contexte du projet.

---

# 5. ABSTRACTION RUNTIME

Avant d'implémenter les différents environnements, cherche dans OpenCode ce qui existe déjà.

Si une abstraction runtime existe déjà, réutilise-la ou étends-la.

Si elle n'existe pas sous une forme adaptée, crée une abstraction propre.

Conceptuellement, il faut pouvoir avoir quelque chose ressemblant à :

```text
ProjectRuntime

readFile()
writeFile()
deleteFile()
listFiles()

exec()
spawn()
kill()

installDependencies()
build()
test()

git()

startServer()
stopServer()

getStatus()
```

Mais NE crée PAS aveuglément ces fonctions.

Analyse d'abord l'architecture actuelle d'OpenCode et adapte la conception à son système existant.

---

# 6. GITHUB CODESPACES

GitHub Codespaces est un environnement d'exécution réel.

Il ne faut pas l'implémenter comme un simple terminal distant fictif.

Le projet doit pouvoir utiliser le Codespace pour :

- filesystem ;
- terminal ;
- dépendances ;
- Git ;
- compilation ;
- tests ;
- processus ;
- serveurs ;
- outils de développement.

Tu dois étudier les mécanismes GitHub disponibles et l'architecture existante avant de choisir l'implémentation.

IMPORTANT :

Ne contourne pas les limites ou mécanismes d'authentification de GitHub.

Utilise les APIs et flux d'authentification appropriés.

Ne stocke jamais de tokens en clair dans le code ou les logs.

---

# 7. SANDBOX CLOUD

La Sandbox cloud doit suivre la même abstraction runtime que Local et Codespaces.

L'application ne doit pas être remplie de conditions du type :

```text
if local
if codespaces
if sandbox
```

partout dans le code.

Les différences doivent être encapsulées dans les implémentations du runtime.

Architecture souhaitée :

```text
ProjectRuntime
      │
      ├── LocalRuntime
      ├── CodespacesRuntime
      └── SandboxRuntime
```

Si l'architecture OpenCode permet une meilleure solution, utilise-la.

---

# 8. PROJET

Chaque projet SoryCode doit contenir les informations nécessaires pour identifier son environnement.

Conceptuellement :

```text
Project
├── id
├── name
├── repository
├── runtime
│   ├── type
│   ├── configuration
│   └── state
├── AI configuration
├── Git configuration
└── project metadata
```

Le modèle réel doit être adapté à l'architecture actuelle du dépôt.

Ne duplique pas inutilement les structures existantes.

---

# 9. INTERFACE

NE PAS REPRODUIRE VS CODE.

L'interface doit être pensée autour de SoryCode.

Elle doit progressivement permettre de comprendre immédiatement :

```text
Projet
│
├── IA
├── Fichiers
├── Git
├── Runtime
├── Terminal
├── Processus
├── Builds
└── Serveurs
```

L'environnement actif doit être clairement visible.

Exemple conceptuel :

```text
SoryCode
────────────────────────────────────

Projet: MyApp

Runtime
● GitHub Codespaces

AI
● Model sélectionné

────────────────────────────────────

        Workspace / AI

────────────────────────────────────

Terminal | Git | Processes | Logs
```

Ce n'est qu'une direction UX.

Étudie l'interface actuelle d'OpenCode et améliore-la progressivement sans transformer le projet en clone de VS Code.

---

# 10. GESTION DES PROCESSUS

Le runtime doit pouvoir gérer correctement les processus du projet.

Exemples :

```text
npm run dev
cargo run
python server.py
vite
next dev
```

SoryCode doit pouvoir :

- démarrer ;
- afficher les logs ;
- connaître l'état ;
- arrêter ;
- redémarrer ;
- identifier les ports lorsque possible.

Tout doit être exécuté dans le runtime du projet.

---

# 11. SERVEURS ET PORTS

Les applications lancées dans un environnement distant doivent pouvoir être accessibles correctement.

Étudie les mécanismes nécessaires pour :

- détecter les ports ;
- exposer les ports ;
- proxy/forwarding ;
- afficher l'application ;
- gérer les URLs ;
- arrêter les serveurs.

Ne fabrique pas un système fictif si OpenCode ou l'infrastructure existante possède déjà une solution réutilisable.

---

# 12. GIT

Le projet doit conserver une intégration Git propre.

L'IA doit pouvoir travailler avec :

- status ;
- diff ;
- branches ;
- commits ;
- historique ;
- remote ;
- GitHub.

Attention : les opérations destructrices doivent respecter les mécanismes de permissions et de confirmation existants.

---

# 13. PERMISSIONS ET SÉCURITÉ

Ne supprime jamais les protections existantes d'OpenCode juste pour simplifier le développement.

Les actions sensibles doivent conserver ou améliorer :

- permissions ;
- confirmation utilisateur ;
- isolation ;
- validation ;
- gestion des secrets ;
- gestion des tokens ;
- logs sans secrets.

Ne mets jamais :

```text
TOKEN=...
API_KEY=...
PASSWORD=...
```

en dur dans le dépôt.

---

# 14. MÉTHODE DE TRAVAIL OBLIGATOIRE

Tu dois travailler par PHASES.

Tu ne dois pas essayer de modifier tout le dépôt en une seule fois.

## PHASE 1 — AUDIT COMPLET

Commence par explorer :

```text
/home/sory/Bureau/opencode-dev/opencode-dev
```

Analyse :

- arborescence ;
- packages ;
- applications ;
- backend ;
- frontend ;
- runtime ;
- CLI ;
- serveur ;
- API ;
- modèles ;
- providers ;
- sessions ;
- agents ;
- tools ;
- filesystem ;
- terminal ;
- processus ;
- Git ;
- configuration ;
- authentification ;
- tests ;
- build ;
- documentation.

Cherche également les fonctionnalités qui existent déjà et qui peuvent être réutilisées.

NE MODIFIE PAS LE CODE pendant cette première phase sauf correction absolument nécessaire à l'exploration.

---

# 15. DOCUMENTATION DE LA PHASE 1

À la fin de la phase 1, crée ou mets à jour une documentation dans le dépôt.

Par exemple :

```text
docs/
  SORYCODE_ARCHITECTURE.md
```

Cette documentation doit expliquer :

- architecture actuelle d'OpenCode ;
- architecture proposée pour SoryCode ;
- composants réutilisables ;
- composants à modifier ;
- composants à créer ;
- dépendances ;
- risques ;
- ordre d'implémentation ;
- état actuel du projet.

IMPORTANT :

**Une phase n'est considérée comme terminée que si sa documentation est mise à jour.**

---

# 16. PHASE 2 — ARCHITECTURE RUNTIME

Implémente l'architecture permettant d'associer un runtime à un projet.

Commence par l'abstraction commune.

Puis implémente progressivement :

```text
Local
Codespaces
Sandbox
```

Ne commence pas par l'interface.

Le backend/runtime doit être solide avant l'UI.

À la fin :

- tests ;
- validation ;
- documentation.

Mettre à jour :

```text
docs/SORYCODE_ARCHITECTURE.md
```

et/ou créer :

```text
docs/RUNTIME_ARCHITECTURE.md
```

---

# 17. PHASE 3 — LOCAL RUNTIME

Implémente/valide le runtime local.

Vérifie :

- fichiers ;
- terminal ;
- processus ;
- dépendances ;
- build ;
- tests ;
- Git.

Ajoute des tests.

Documente la phase.

---

# 18. PHASE 4 — GITHUB CODESPACES

Implémente l'intégration réelle de GitHub Codespaces.

Étudie d'abord :

- authentification ;
- API ;
- création/récupération d'un Codespace ;
- état ;
- connexion ;
- exécution ;
- filesystem ;
- terminal ;
- processus ;
- ports ;
- arrêt/reprise.

Utilise les mécanismes officiellement supportés.

Teste chaque partie possible.

Documente :

```text
docs/CODESPACES.md
```

La documentation doit expliquer :

- fonctionnement ;
- architecture ;
- authentification ;
- configuration ;
- flux de données ;
- erreurs possibles ;
- limites ;
- tests effectués.

---

# 19. PHASE 5 — SANDBOX

Implémente la Sandbox cloud à travers la même abstraction.

Documente :

```text
docs/SANDBOX_RUNTIME.md
```

---

# 20. PHASE 6 — PROJECT MODEL

Intègre le runtime au modèle Project.

Un projet doit savoir quel environnement lui appartient.

Exemple conceptuel :

```text
Project
   │
   └── Runtime
        ├── type
        └── configuration
```

Le runtime doit être récupérable de manière fiable.

Ajoute les migrations nécessaires si OpenCode utilise une base de données ou un stockage structuré.

Teste :

- création ;
- lecture ;
- modification ;
- changement de runtime ;
- suppression ;
- reprise du projet.

Documente.

---

# 21. PHASE 7 — IA + RUNTIME

Connecte correctement les agents/outils d'OpenCode au runtime du projet.

L'IA doit utiliser le runtime associé au projet.

Exemple :

```text
User
 ↓
AI Agent
 ↓
Project
 ↓
Project Runtime
 ↓
Command/File/Build
```

L'IA ne doit pas contourner le runtime.

Teste des scénarios réels.

---

# 22. PHASE 8 — TERMINAL / PROCESSUS

Connecte le terminal et les processus au runtime.

Teste au minimum :

```text
command execution
long-running process
logs
stop process
restart process
exit code
errors
```

Documente.

---

# 23. PHASE 9 — BUILDS / TESTS / SERVEURS

Intègre :

- build ;
- test ;
- dev server ;
- port forwarding ;
- logs.

Tout doit utiliser le runtime attaché au projet.

Documente.

---

# 24. PHASE 10 — INTERFACE SORYCODE

Seulement après avoir stabilisé le cœur runtime.

Construis progressivement l'expérience SoryCode.

L'interface doit rendre visibles :

- projet ;
- IA ;
- runtime actif ;
- fichiers ;
- terminal ;
- processus ;
- Git ;
- builds ;
- serveurs.

Ne cherche pas à refaire toute l'interface en une seule étape.

Construis des composants cohérents et réutilisables.

Documente les décisions UX importantes.

---

# 25. PHASE 11 — ANDROID / REMOTE

Prépare l'architecture permettant à Android de contrôler les runtimes distants.

Vérifie :

- API ;
- authentification ;
- sessions ;
- reconnexion ;
- streaming des événements ;
- terminal distant ;
- fichiers ;
- processus ;
- logs.

Ne fais pas semblant que l'exécution est locale sur Android.

Documente.

---

# 26. PHASE 12 — TESTS DE BOUT EN BOUT

Construis des scénarios complets.

### Test Local

```text
Créer projet
→ choisir Local
→ créer fichier
→ modifier fichier avec IA
→ terminal
→ build
→ test
→ serveur
```

### Test Codespaces

```text
Créer projet
→ choisir Codespaces
→ créer/récupérer Codespace
→ fichiers
→ terminal
→ installation
→ build
→ test
→ serveur
```

### Test Sandbox

Même scénario avec Sandbox.

### Test Android

```text
Android
→ ouvrir projet distant
→ demander modification à l'IA
→ observer modification
→ terminal
→ build
→ logs
```

Documente les résultats.

---

# 27. RÈGLE DE DOCUMENTATION APRÈS CHAQUE ÉTAPE

C'est OBLIGATOIRE.

Après chaque phase significative :

1. coder ;
2. tester ;
3. corriger ;
4. documenter ;
5. vérifier la documentation ;
6. seulement ensuite passer à la phase suivante.

La documentation doit indiquer :

```text
# Phase X

## Objectif

## Ce qui existait avant

## Modifications réalisées

## Fichiers principaux modifiés

## Architecture

## Tests réalisés

## Résultats

## Problèmes rencontrés

## Solutions

## Limitations restantes

## Prochaine étape
```

---

# 28. CHANGELOG

Maintiens également :

```text
CHANGELOG_SORYCODE.md
```

Chaque phase terminée doit y être inscrite.

Exemple :

```text
## Phase 2 — Runtime

### Added
- Project runtime abstraction
- Local runtime

### Changed
- Project model

### Tests
- ...

### Status
Complete
```

---

# 29. TODO CENTRAL

Maintiens :

```text
docs/SORYCODE_TODO.md
```

avec :

```text
[ ] Audit OpenCode
[x] Architecture runtime
[ ] Local runtime
[ ] Codespaces
[ ] Sandbox
[ ] Project integration
[ ] AI integration
[ ] Terminal
[ ] Processes
[ ] Build
[ ] Servers
[ ] Git
[ ] SoryCode UI
[ ] Android remote
[ ] E2E tests
[ ] Documentation finale
```

Adapte cette liste à ce que tu découvriras réellement dans le dépôt.

Ne marque jamais une tâche `[x]` si elle n'est pas réellement terminée et testée.

---

# 30. RÈGLE CONTRE LES FAUSSES IMPLÉMENTATIONS

INTERDIT :

- faux bouton Codespaces qui ne fait rien ;
- runtime simulé ;
- terminal simulé ;
- API fictive ;
- données hardcodées ;
- TODO caché derrière une interface ;
- fonctionnalité déclarée terminée sans test ;
- code mort uniquement pour faire croire que la fonctionnalité existe.

Si une fonctionnalité ne peut pas encore être complètement implémentée :

1. indique clairement pourquoi ;
2. documente la limitation ;
3. implémente ce qui est réellement possible ;
4. laisse un TODO explicite ;
5. ne prétends pas que c'est terminé.

---

# 31. RÈGLE DE QUALITÉ

À chaque modification :

- respecte les conventions du dépôt ;
- réutilise les abstractions existantes ;
- évite les duplications ;
- évite les hacks ;
- évite les gros fichiers monolithiques ;
- ajoute les tests pertinents ;
- vérifie les erreurs TypeScript/Rust/etc. selon le package concerné ;
- vérifie le lint ;
- vérifie le build concerné.

Ne lance pas systématiquement un énorme build global si cela n'est pas nécessaire.

Commence par le test/build du package modifié.

Puis augmente progressivement la portée.

---

# 32. GESTION DES ERREURS

Quand un test/build échoue :

```text
Erreur
 ↓
Comprendre la cause
 ↓
Corriger
 ↓
Relancer
 ↓
Vérifier qu'aucune régression n'est créée
 ↓
Documenter si pertinent
```

Ne masque jamais une erreur.

Ne désactive pas un test uniquement parce qu'il échoue.

---

# 33. GESTION DU CODE EXISTANT

Avant de créer une nouvelle abstraction :

1. cherche si OpenCode en possède déjà une ;
2. comprends-la ;
3. vérifie si elle peut être étendue ;
4. réutilise-la si possible.

Le but est :

```text
OpenCode
   ↓
Extension
   ↓
SoryCode
```

et non :

```text
OpenCode
   +
nouveau système parallèle complètement indépendant
```

---

# 34. FIN DE CHAQUE SESSION DE TRAVAIL

À la fin de chaque session, mets à jour :

```text
docs/SORYCODE_STATUS.md
```

avec :

```text
Date

## Travail effectué

## Fonctionnalités terminées

## Tests

## Fichiers modifiés

## Problèmes

## Prochaine étape exacte
```

Ainsi, un autre agent doit pouvoir reprendre le travail sans perdre le contexte.

---

# 35. ORDRE DE PRIORITÉ

Si plusieurs choses sont possibles, respecte cet ordre :

### PRIORITÉ 1
Comprendre l'architecture existante.

### PRIORITÉ 2
Runtime projet.

### PRIORITÉ 3
Local runtime.

### PRIORITÉ 4
Codespaces.

### PRIORITÉ 5
Sandbox.

### PRIORITÉ 6
IA connectée au runtime.

### PRIORITÉ 7
Terminal/processus/builds/serveurs.

### PRIORITÉ 8
Git.

### PRIORITÉ 9
Interface SoryCode.

### PRIORITÉ 10
Android/mobile.

### PRIORITÉ 11
Tests E2E et stabilisation.

### PRIORITÉ 12
Documentation finale.

---

# 36. OBJECTIF FINAL

À la fin du projet, SoryCode doit permettre :

```text
                    SORYCODE
                       │
                    PROJECT
                       │
              ┌────────┴────────┐
              │                 │
           AI Agent          Runtime
                                │
                 ┌──────────────┼──────────────┐
                 │              │              │
               Local        Codespaces      Sandbox
                 │              │              │
                 └──────────────┼──────────────┘
                                │
             ┌──────────────────┼──────────────────┐
             │                  │                  │
          Filesystem         Terminal           Git
             │                  │                  │
          Processes           Build              Tests
             │                  │                  │
          Servers             Logs              Ports
```

L'IA travaille avec le runtime du projet.

Le runtime est unique pour le projet.

Desktop peut utiliser Local/Codespaces/Sandbox.

Android utilise les environnements distants.

L'ensemble doit rester cohérent avec l'architecture OpenCode.

---

# 37. PREMIÈRE ACTION À EFFECTUER MAINTENANT

NE COMMENCE PAS PAR CODER L'INTERFACE.

Commence exactement par :

```text
1. Explorer /home/sory/Bureau/opencode-dev/opencode-dev
2. Identifier l'arborescence
3. Identifier le package manager
4. Identifier les applications/packages
5. Identifier frontend/backend
6. Identifier runtime
7. Identifier serveur/API
8. Identifier agents/tools
9. Identifier filesystem
10. Identifier terminal/processus
11. Identifier Git
12. Identifier providers/modèles
13. Identifier tests
14. Identifier build
15. Identifier configuration
16. Identifier authentification
17. Identifier les points d'extension
18. Identifier ce qui existe déjà pour les fonctionnalités SoryCode
19. Identifier précisément ce qui reste à construire
20. Documenter l'audit
```

Ensuite seulement, commence l'implémentation.

---

# 38. RÈGLE FINALE

Tu es l'agent chargé de **CONTINUER LE PROJET**, pas simplement de faire une analyse.

Après l'audit :

**CODE.**

Puis :

**TESTE.**

Puis :

**CORRIGE.**

Puis :

**DOCUMENTE.**

Puis passe à l'étape suivante.

Ne t'arrête pas après avoir produit un rapport si des tâches de développement concrètes peuvent être réalisées.

À chaque étape terminée, laisse le dépôt dans un état cohérent, testable et documenté.

Le résultat attendu n'est pas un prototype.

Le résultat attendu est **SoryCode construit progressivement sur la base réelle d'OpenCode**.



# SoryCode — Agent Implementation Log

## Purpose

This file documents every implementation step made while evolving the OpenCode codebase into SoryCode. The project must keep the execution environment separate from the UI and must never fake a remote environment as a local one.

## Architecture contract

- Every project has **exactly one** execution environment.
- Desktop choices are exclusive:
  - `local`: PC local execution.
  - `codespaces`: real GitHub Codespaces remote execution.
  - `sandbox`: real isolated cloud workspace execution.
- Android/mobile execution is remote; the phone is a client, not the build machine.
- Files, dependencies, terminal/PTY, builds, processes and agent/session operations must execute in the selected project environment.
- The UI selects/configures the environment but does not implement remote execution.
- GitHub Codespaces must use the existing OpenCode remote workspace/server mechanism instead of a VS Code clone or a local simulation.

## Step log

### Step 1 — Environment domain model

Added `packages/core/src/environment/index.ts`.

Implemented:
- `Kind = local | codespaces | sandbox`
- project environment configuration schema
- remote/local target model
- adapter contract
- helper identifying remote environments

### Step 2 — Environment adapters

Added:
- `packages/opencode/src/control-plane/adapters/environment-local.ts`
- `packages/opencode/src/control-plane/adapters/environment-remote.ts`
- `packages/opencode/src/control-plane/adapters/environments.ts`

The adapters map SoryCode environment choices onto OpenCode's existing target model. Codespaces and Sandbox produce remote targets; they do not execute code locally.

### Step 3 — Project environment manager

Added `packages/opencode/src/control-plane/environment.ts`.

The manager is intentionally UI-independent and resolves a project's selected environment into a target suitable for the existing workspace runtime.

**Known limitation:** the first implementation is in-memory. It is not yet the final persistent project storage and therefore must not be considered production-complete.

### Step 4 — Project UI

Updated `packages/app/src/components/edit-project.ts` and `packages/app/src/components/dialog-edit-project-v2.tsx`.

The project editor now exposes one exclusive environment selector:
- PC local
- GitHub Codespaces
- Sandbox cloud

Environment-specific configuration is shown only for the selected environment.

The UI now persists the full environment configuration in project-scoped browser storage instead of storing only the environment kind. It validates required Codespaces repository and Sandbox URL fields before saving.

This is a temporary UI persistence layer pending backend project persistence.

### Step 5 — OpenCode remote routing inspection

Verified that OpenCode already has a remote workspace routing path based on `WorkspaceAdapterRuntime.target()` and the HTTP/SSE workspace proxy. SoryCode should reuse this path for Codespaces and Sandbox.

Relevant implementation areas:
- `packages/opencode/src/control-plane/workspace.ts`
- `packages/opencode/src/control-plane/workspace-adapter-runtime.ts`
- `packages/opencode/src/server/routes/instance/httpapi/middleware/workspace-routing.ts`
- `packages/opencode/src/server/shared/workspace-routing.ts`

### Step 6 — Tests and verification status

The repository archive does not contain `node_modules`, and the environment used for this editing session does not provide Bun. Therefore the full OpenCode TypeScript test suite cannot currently be executed here.

Static verification performed:
- confirmed the modified files exist;
- confirmed the home project flow imports `dialog-edit-project-v2`;
- confirmed the UI changes are in the active V2 dialog;
- confirmed the environment routing infrastructure exists before wiring it further.

**Not yet verified:** full typecheck, runtime startup, browser interaction, database migration, and real GitHub Codespaces creation/connection.

## Next required steps

1. Persist the environment configuration in the project database instead of browser-only storage.
2. Expose project environment through the server API.
3. Make the selected environment authoritative for workspace target resolution.
4. Register environment-backed workspace adapters with the real workspace runtime.
5. Implement the GitHub Codespaces lifecycle using GitHub APIs and a workspace server running inside the Codespace.
6. Implement the Sandbox provider contract and real provider integration.
7. Add automated unit/API tests for environment selection, persistence, target resolution and remote proxying.
8. Run `bun install`, typecheck and targeted tests in a Bun-enabled environment, then record exact results here.

## Rule for future agents

Do not mark a step as complete unless its implementation and verification status are recorded here. If a test cannot be run, record the reason and do not claim it passed.

### Step 7 — Local verification attempt (2026-09-05)

Attempted the application TypeScript check with the system TypeScript compiler:

`tsc --noEmit -p packages/app/tsconfig.json --pretty false`

Result: **blocked by missing repository dependencies**, not by a confirmed SoryCode environment compile error. The checkout has no `node_modules`, Bun is not installed, and the compiler reported unresolved modules such as `solid-js`, `@opencode-ai/ui/*`, `bun:test`, and other workspace/external packages.

A network attempt to obtain the repository package manager/dependencies also timed out. Therefore no claim of a passing full typecheck is made.

### Step 8 — UI persistence hardening

The project editor now stores a structured project-scoped record containing:
- environment kind;
- Codespaces repository and branch;
- Sandbox workspace URL.

It also validates remote configuration before saving and safely falls back to `local` if older or malformed browser state is encountered.

This remains a transitional persistence mechanism until the backend database/API becomes authoritative.

### Step 9 — Wire UI environment selection to backend persistence (2026-09-05)

Verified before coding:
- `ProjectTable.environment` + migration `20260905040000_project_environment` exist.
- `packages/opencode/src/project/project.ts` persists `environment` (`fromRow` default
  local, `UpdateInput/UpdatePayload`, `update()`, `fromDirectory()` upsert).
- `PATCH /project/:projectID` accepts `environment`
  (`server/routes/instance/httpapi/groups/project.ts`), and the generated
  `sdk.client.project.update` supports `environment?: EnvironmentConfig`.
- Gap: `packages/app/src/components/edit-project.ts` sent only `name/icon/commands`;
  `environment` stayed in `localStorage`. `pages/layout.tsx` still mounted the V1
  dialog without any environment selector.

Implemented (minimal, reuse-first):
- `edit-project.ts`: `resolveInitialEnvironment()` prefers server
  `project.environment`, falls back to browser storage; `buildEnvironment()` builds
  the `EnvironmentConfig` (local/codespaces/sandbox with project directory); `save()`
  includes `environment` in `project.update`. Browser storage kept as cache only.
- `pages/layout.tsx`: `showEditProjectDialog` now mounts `DialogEditProjectV2`,
  matching `home-projects-controller.tsx`. The legacy V1 dialog file is untouched.

Verification performed (Bun available in this session):
- `bun run lint -- packages/app/src/components/edit-project.ts packages/app/src/pages/layout.tsx`
  from repo root: 0 errors (20 pre-existing warnings).
- `bun test --only-failures src/utils/server-compat.test.ts` from `packages/app`:
  8 pass, 0 fail.
- Full `bun typecheck` in `packages/app` timed out after 180s; no claim of a passing
  full typecheck is made.

Docs updated (per AGENT.md phase rule):
- `docs/SORYCODE_ARCHITECTURE.md` (audit + target + reusable/to-change/risks/order/state).
- `docs/SORYCODE_TODO.md`, `docs/SORYCODE_STATUS.md`, `CHANGELOG_SORYCODE.md`.

Known limitations (not claimed complete):
- `edit-project.ts` persists projects only on protocol `v1` (early return otherwise).
- Remote adapters require `remoteURL`; Codespaces UI collects `repository/branch`, so
  real Codespace creation/connection is still unimplemented.
- `EnvironmentManager` remains in-memory; making it DB-backed and authoritative for
  workspace target resolution is the exact next step.

### Step 10 — Execution environment visible in the new-session flow (2026-09-05)

Problem studied from user screenshots: the new-session breadcrumb
(`Bureau / Nouvel espace… / master`) shows the project picker and the git-worktree
menu (`session.new.workspace.runIn` → `Dépôt local`), which users misread as the
execution environment. The real project environment (local/codespaces/sandbox, Step 9)
was visible nowhere in that flow and the Edit dialog entry point was hard to find.

Implemented (minimal, reuse-first):
- `prompt-project-selector.tsx`: `PromptProject` now carries `environment`
  (server project data already flows through `layout.projects.list()`).
- New `app/.../prompt-environment-badge.tsx`: breadcrumb segment with a colored dot
  (`local`/`codespaces`/`sandbox`), tooltip with repository/branch or sandbox URL,
  click opens `DialogEditProjectV2` for the selected project (same pattern as the
  home controller). Effective environment resolved via `resolveInitialEnvironment`
  (server first, browser-storage fallback).
- `new-session-view.tsx`: badge rendered in the breadcrumb row next to the
  project/workspace selectors.
- i18n keys `session.new.environment.{local,codespaces,sandbox,change}` added to
  `en.ts` + `fr.ts` (other locales fall back to English by design of the merge).
- `edit-project.ts`: `resolveInitialEnvironment` exported with a structural
  `Pick<LocalProject, "id" | "environment">` parameter so UI selectors can reuse it.
- New `edit-project.test.ts`: server-priority, storage fallback, local default.

Verification performed:
- `bun run lint` on touched files: 0 errors (new files 0 warnings).
- `bun test --conditions=solid --preload ./happydom.ts`:
  `new-session-workspace-controller.test.ts` + `server-compat.test.ts` (12 pass)
  and `edit-project.test.ts` (3 pass). An initial run without the package's
  documented harness flags failed on `solid-js/web` import; rerun with the
  documented flags passes — harness issue, not a code regression.
- Full `bun typecheck` of `packages/app` still too long for this session; no claim made.

Known limitations (not claimed complete):
- Badge opens the editor; remote execution itself is still unimplemented (Steps 5-6).
- Project list on the home page does not yet show the environment; new-session only.

### Step 11 — Sandbox provider contract, open-lovable pattern (2026-09-05)

Studied `reference-projets/open-lovable` as requested: abstract `SandboxProvider`
(create/runCommand/writeFile/readFile/listFiles/installPackages/terminate),
`SandboxFactory` selecting `vercel|e2b` via `SANDBOX_PROVIDER` with env-based
availability, Vercel OIDC-or-PAT auth, E2B `E2B_API_KEY`, `.env.example` defaulting
to `vercel`.

Implemented SoryCode-style (plain objects + self-reexports, no classes) in
`packages/opencode/src/control-plane/adapters/`:
- `sandbox-provider.ts`: `Provider` contract, `resolveProviderKind` (default
  `vercel`, explicit throw on unknown), `isProviderAvailable`,
  `missingProviderCredentials`, `createSandboxProvider` (throws listing the exact
  missing variables; explicit `overrides` for a future credential store).
- `sandbox-vercel.ts` (`@vercel/sandbox@3.2.1`, added exact): node22, port 5173,
  `sandbox.fs` file ops, recursive `listFiles` skipping
  `node_modules/.git/.next/dist/build`, `stop()`, identity via `name`.
- `sandbox-e2b.ts` (`e2b@2.46.1`, added exact): `commands.run` with `shellQuote`d
  args, `files.write/read/list` with recursion, `getHost(port)` URL, `kill()`,
  `isRunning()`.
- Heavy SDKs only via dynamic `import()` inside `create()`; static side is
  `import type` (zero runtime cost when unused). No secret is hardcoded.

Adapted, not copied: verified every call against the installed major-version
`.d.ts` instead of open-lovable's v0 patterns. Real differences found and applied:
Vercel v3 has no `sandboxId` (identity is `name`), `stdout()/stderr()` are async
methods, filesystem is `sandbox.fs` (`readFile/writeFile/readdir/stat`), single
`runCommand({cmd, args, cwd})` form; E2B uses `commands.run(string)`,
`files.read(path)` → string, `EntryInfo.type === "dir"`. No Vite scaffolding:
SoryCode will boot a workspace server instead.

Verification performed:
- `bun test test/sandbox-provider.test.ts` (packages/opencode): **12 pass**.
  Selection/default/unknown-rejection, OIDC/PAT/E2B availability matrix,
  overrides, exact error messages, no-network construction, `create()`-first
  guard, `shellQuote`. No mocks; explicit env records, no `process.env` mutation.
- `bun run lint` (root) on the 4 files: **0 warnings, 0 errors**.
- Full `bun typecheck` of `packages/opencode` exceeds 10 min here; instead an
  isolated `tsgo --strict` check of every SDK call shape against the real
  `.d.ts` passed — it caught and fixed one real bug (`sandboxId` → `name`).
  Scratch file removed afterwards.

Known limitations (not claimed complete):
- `create()` and later calls are **not exercised against the real vendor APIs**
  (no keys in this environment); only factory selection/construction is tested.
- Not yet wired into `SandboxEnvironmentAdapter.target()`: auto-provisioning
  (create → boot workspace server → `remoteURL`) plus the persistent
  `EnvironmentManager` is the exact next step. Documented in
  `docs/SANDBOX_RUNTIME.md` with setup, data flow, errors and limits.

### Step 12 — Sandbox credentials as connectable integrations + persistent Environment (2026-09-05)

Done as requested (sandbox tokens pasted via the same provider connect dialog
the user is already used to from model providers).

Implemented (reuse-first, no new prototype):
- `packages/core/src/plugin/sandbox.ts` (registered in
  `packages/core/src/plugin/internal.ts`): declares `e2b` and `vercel-sandbox`
  integrations with a `key` method and an `env` fallback (`E2B_API_KEY`,
  `VERCEL_OIDC_TOKEN`). `e2b` reuses the existing AI-vendor credential store;
  `vercel-sandbox` is intentionally distinct from the AI `vercel` model
  provider to keep their credentials isolated.
- `packages/app/src/components/dialog-connect-provider.tsx`: `provider()` now
  tolerates IDs that are not in the AI catalog (so `e2b` / `vercel-sandbox`
  resolve to the integration instead of throwing).
- `packages/app/src/components/dialog-edit-project-v2.tsx`: when the user
  picks `Sandbox cloud`, two new buttons open the existing
  `DialogConnectProvider` to paste a key — same secure storage, no new UI.
  i18n `dialog.project.edit.sandbox.{connectHint,connectE2b,connectVercel}`
  added to `en.ts` and `fr.ts`.
- `packages/opencode/src/control-plane/sandbox-credentials.ts`:
  `credentialToOverrides(kind, value)` maps a stored `Credential.Key` to
  `ProviderCredentials`; `sandboxCredentials(kind)` is an `Effect.fn` that
  resolves the active connection through `Integration.Service` and converts
  it. Non-key / missing credentials are intentionally ignored so the env
  fallback in `createSandboxProvider` still wins.
- `packages/opencode/src/control-plane/environment.ts`: replaces the
  in-memory `EnvironmentManager` with `selectionFromProject`,
  `selectionFor(projectID)` and `targetFor(projectID, workspaceID?)` —
  the persisted `Project.environment` is now the source of truth. The
  `EnvironmentManager` class is left intact (still referenced by tests) and
  is now redundant; the next cleanup removes it.
- `packages/core/package.json` exposes `./environment` (was missing; the
  pre-existing adapters imported it but no path was declared).
- `packages/opencode/test/environment.test.ts`: 6 tests (defaults, sandbox
  preservation, directory backfill, e2b / vercel / oauth / missing mapping).

Verification performed:
- `bun test test/environment.test.ts test/sandbox-provider.test.ts`
  (packages/opencode): **18 pass / 0 fail**.
- `bunx oxlint` on the 7 touched files: 0 errors, 11 pre-existing warnings.
- `bun install --filter @opencode-ai/core` to re-evaluate exports map.
- `bun --cwd packages/app dev --port 4444` boots Vite to the welcome screen
  without build-time errors (EPIPE on shutdown is the timeout, not the code).
- Full `bun typecheck` of `packages/opencode` and `packages/app` still too
  long for this session; no claim of full success.

Known limitations (not claimed complete):
- Selection now reads the database, but `targetFor` is not yet called from
  the workspace runtime. That is the exact next step (replace any
  `local`-hardcoded workspace path with `targetFor(projectID)`).
- Auto-provisioning the sandbox (create → boot workspace server → store
  `remoteURL` back on `Project.environment`) is the follow-up after the
  workspace target is resolved. Until then `Sandbox` without a
  pre-provisioned `remoteURL` still errors at `adapter.target()` — by design,
  never as a fake.

### Step 13 — Authoritative project environment in workspace routing (2026-09-05)

Goal: route workspace requests through the project's selected environment
(local / sandbox / codespaces) instead of the legacy worktree target.

Implemented (reuse-first):
- `packages/opencode/src/control-plane/adapters/environment-adapter.ts`:
  new `WorkspaceAdapter` whose `target()` is the authoritative project
  environment. `target()` runs `targetFor(projectID, workspaceID?)` and
  returns the same `Target` shape the rest of the runtime already consumes.
- `packages/opencode/src/plugin/index.ts`: registers the environment adapter
  for every project at boot (after internal plugins), so it is available
  to `WorkspaceAdapterRuntime.target` for any routed workspace.
- `packages/opencode/src/server/routes/instance/httpapi/middleware/workspace-routing.ts`:
  `planRequest` now, in the default branch (no explicit workspace ID),
  reads `session.projectID` and resolves the target through
  `resolveProjectTarget` (= `targetFor`). A `remote` target flows through
  the existing `Remote` plan with a synthetic `Workspace.Info` of type
  `environment`; a `local` target sets the route context directory to the
  project worktree. No more hardcoded `process.cwd()` / `session.directory`
  once the project has an environment. The `Project.Service` is now
  threaded into the middleware layer.

Verification performed:
- `bun test test/environment.test.ts test/sandbox-provider.test.ts`
  (packages/opencode): **18 pass / 0 fail**.
- `bunx oxlint` on the 3 modified files: 0 errors, 16 pre-existing warnings
  (none introduced).
- Backend boot: `timeout 15 bun run --cwd packages/opencode src/index.ts
  serve --port 4097` prints `opencode server listening on http://127.0.0.1:4097`
  with the new middleware loaded. No regression observed.
- Full `bun typecheck` of `packages/opencode` still exceeds 10 min; not
  re-attempted.

Known limitations (not claimed complete):
- Sandbox selections without a `remoteURL` still error at
  `targetFor` — the next step is auto-provisioning the workspace server
  inside the sandbox and writing back the URL. Until then the
  `Remote` branch raises a clear "no provisionable runtime" message
  instead of faking a target.
- The legacy `EnvironmentManager` in-memory class is now unused; it is
  left intact for one cleanup pass to keep this step minimal.
- A small `Effect.catchAll(... as unknown as ... Effect.Effect<Target>)`
  type coercion is used in `resolveProjectTarget` to keep the public
  signature (`never`) unchanged; documented in the function comment.

### Step 14 — Sandbox auto-provisioning with real database layers (2026-09-05)

Goal: close the "no provisionable runtime" gap — provision the sandbox and
persist its URL instead of erroring.

Implemented (reuse-first):
- `packages/opencode/src/control-plane/environment.ts`:
  `provisionSandboxEnvironment(projectID, { provider?, overrides?, env? })`.
  Reads the authoritative selection, short-circuits with `{ reused: true }`
  when a `remoteURL` is already stored (never touches the network),
  otherwise selects the provider (`SANDBOX_PROVIDER`), resolves stored
  credentials via `sandboxCredentials` (best-effort — `Effect.catchCause`
  falls back to env, which also covers layers without `Integration.Service`
  such as tests), creates the live sandbox and writes the URL back with
  `Project.Service.update`. Non-sandbox projects and missing credentials
  fail with explicit messages. The injectable `env` keeps rejection tests
  hermetic regardless of ambient variables.
- Removed the now-unused in-memory `EnvironmentManager` class (zero
  references across the repo; `listEnvironmentAdapters` import dropped too).
- `packages/opencode/test/environment-provision.test.ts`: 3 integration
  tests on **real layers** (`Project.node`, `Database.node`,
  `CrossSpawnSpawner.node` via `testEffect`), following the
  `test/project/project.test.ts` pattern — reuse short-circuit, local
  refusal, missing-credentials failure. Config errors surface as defects
  (`throw`, same as `Project.initGit`), so the tests assert through
  `Effect.exit` + `Cause.squash` instead of `Effect.flip`.

Verification performed:
- `bun test test/environment-provision.test.ts test/environment.test.ts
  test/sandbox-provider.test.ts` (packages/opencode): **21 pass / 0 fail**.
- `bunx oxlint` on touched files: 0 warnings, 0 errors.
- Full `bun typecheck` of `packages/opencode` still exceeds 10 min here;
  the new code mirrors adjacent typed patterns (`Effect.fn`, `Project.Info`,
  `UpdateInput`).

Known limitations (not claimed complete):
- Live `provider.create()` is still not exercised (no vendor keys here);
  only the reuse/refusal/missing-credentials paths ran.
- Booting the workspace server *inside* the provisioned sandbox is the
  documented follow-up (`docs/SANDBOX_RUNTIME.md`); the stored URL is a real
  reachable sandbox, not a serving workspace yet.

### Step 16 — Same physical terminal runs sandbox commands (2026-09-05)

Goal (per user request): no second terminal. When the active session sits
on a sandbox workspace and the user opens the existing terminal panel (same
hamburger menu, same panel), commands execute in the sandbox and answers
come back from the sandbox provider — like activating a Python venv. A
small badge shows the sandbox environment in the panel header.

Implemented (reuse-first, same protocol, same panel):
- `packages/opencode/src/control-plane/sandbox-pty.ts`: virtual PTY
  sessions (`createSandboxPty`, `feedSandboxPty`, registry). No local
  process (documented `pid: 0`): typed characters echo back, each submitted
  line runs as `sh -c` through `provider.runCommand`, output streams back
  with `[exit N]` on failure. Ctrl-C cancels the line, Ctrl-D on an empty
  line closes, backspace edits. Banner + `sandbox$ ` prompt are display
  decoration fed from the real provider kind/URL, kept in a bounded replay
  so reconnects replay history like local sessions.
- `packages/opencode/src/server/routes/instance/httpapi/handlers/pty.ts`:
  `create` resolves the project environment from the database and, for
  sandbox projects, provisions on demand (`provisionSandboxEnvironment`)
  then opens a virtual session — opening the terminal connects the
  sandbox. Missing credentials fail with an explicit message, never a
  silent local fallback. `get`/`list`/`update`/`remove`/`connectToken`
  serve virtual sessions; the `connect` websocket loop reuses the exact
  framing (`PtyProtocol` chunks/meta, outbox drain, ticket check) and feeds
  input through `feedSandboxPty`. `Project.Service` was already provided to
  this API surface (same as `experimental.ts`), no new layer needed.
- `packages/app/src/pages/session/terminal-panel.tsx`: `TerminalEnvironmentBadge`
  in the tab bar — hidden for local projects, colored dot + label
  (`session.new.environment.*` keys) for sandbox/codespaces, resolved from
  the workspace directory's project.
- `packages/opencode/test/sandbox-pty.test.ts`: 5 tests (banner/replay,
  echo+execute, editing/Ctrl-C/empty lines, exit codes, Ctrl-D close).

Verification performed:
- `bun test` (packages/opencode, 6 files): **45 pass / 0 fail**.
- `bunx oxlint` on touched files: 0 errors (pre-existing warnings only;
  bun `await expect().rejects` triggers `await-thenable` false positives,
  kept because `.then` chaining does not exist on it at runtime).
- Backend boot after the handler change: `serve :4097` prints listening
  with no error.
- Full `bun typecheck` still exceeds 10 min here; new code mirrors adjacent
  typed patterns (`Pty.Info` shape, `Effect.fn`, handler contracts).

Known limitations (not claimed complete):
- One submitted line = one `sh -c` execution: no persistent shell state
  (`cd` does not persist), no interactive programs, no Ctrl-C of a running
  command. Live PTY streaming arrives with the workspace server boot.
- Live provider execution still not exercised (no vendor keys here).

### Step 16b — Connect dialog hardening + optional sandbox URL (2026-09-05)

User report from the live dev UI (screenshot): connect buttons half-cut at
the bottom of the Edit dialog, a `provider() is undefined` crash when
opening the key form for `e2b`, and confusion about the required sandbox URL.

Fixed:
- `dialog-connect-provider.tsx`: `provider()` falls back to
  `serverSync().data.provider?.all` (optional chain) then to the
  integration name/id, so non-catalog IDs (`e2b`, `vercel-sandbox`) never
  crash `ApiAuthView`. (The reported crash came from a stale cached chunk
  predating the Step 12 fallback; a hard refresh loads the fixed chunk.)
- `dialog-edit-project-v2.tsx`: sandbox connect buttons are now full-width
  stacked (`contrast` first) with bottom padding so they stay visible above
  the footer; URL field labeled optional with description.
- `edit-project.ts`: sandbox URL validation is optional-only (valid HTTP(S)
  when present, empty means auto-provision on terminal open, which the Step
  16 PTY handler already implements). `buildEnvironment` exported.
- i18n `dialog.project.edit.sandbox.{urlLabel,urlDescription}` (en + fr).
- `edit-project.test.ts`: `buildEnvironment` omits `remoteURL` on blank
  input and keeps it when set.

Verification: `bun test` app `edit-project.test.ts` 5 pass; `oxlint` 0 errors
on touched files; backend + Vite still serve after edits.
Backend live check via API: `GET /api/integration` lists `e2b` (key+env)
and `vercel-sandbox` (key+env); `GET /api/integration/e2b` returns methods.
The remaining user-side crash was a stale in-memory module (stack line
numbers match no current file version); fresh tab load runs the fixed chunk.

### Step 16c — Visible provider status + hardened connect (2026-09-05)

User questions: same `provider() is undefined` crash (byte-identical `?t=`
query in both stacks = the tab never reloaded the module; the served chunk
was verified by curl to contain the Step 12 fallback) and "which provider
is actually loaded for the worksandbox?".

Fixed:
- `edit-project.ts`: new `sandboxProviders` resource loads `integration.get`
  for `e2b` and `vercel-sandbox` and maps connections to
  `unknown|key|env|none` (never throws; backend errors become `unknown`).
- `dialog-edit-project-v2.tsx`: `SandboxConnectionStatus` under each connect
  button (green dot + Connected key/env, grey + Not connected), plus
  `providerNote` explaining the effective provider comes from the server's
  `SANDBOX_PROVIDER` (default Vercel). Buttons stay full-width stacked.
- i18n `dialog.project.edit.sandbox.{connectedKey,connectedEnv,notConnected,
  providerNote}` (en + fr).
- Live verification: no stored connections on either integration
  (`[('e2b', []), ('vercel-sandbox', [])]`) and `SANDBOX_PROVIDER` unset, so
  the effective provider today is the `vercel` default — with no credentials
  yet, terminal open on a sandbox project fails explicitly (by design).

Verification: app `edit-project.test.ts` 5 pass; root `lint` 0 errors on
touched files (3 pre-existing warnings elsewhere); backend/frontend still
serve after edits.

### Step 15 — Manual terminal inside the sandbox (2026-09-05)

Goal (per user request): open a long-lived interactive shell inside the
sandbox so the desktop terminal can drive the same project runtime the
agent uses, without forcing the agent to install / boot the server first.

Implemented (reuse-first, no fake PTY):
- `packages/opencode/src/control-plane/sandbox-shell.ts`:
  `openInteractiveShell(provider, { shell?, preCommand?, port? })` launches a
  detached `$SHELL -i` (default `/bin/bash`) through `provider.runCommand`,
  returns `ShellHandle { id, port, pid? }`. `readShellOutput` tails
  `/tmp/sorycode-shell.log`; `writeShellCommand` appends a single-quote-safe
  command to `/tmp/sorycode-shell.in`. Both fail soft (no `throw`) so a
  missing log file does not break the terminal reconnection flow.
- `packages/opencode/src/control-plane/adapters/sandbox-provider.ts`: added
  `CreateInput { ports? }` and `Provider.publicUrl(port)`. Helpers
  `shellQuote` / `shellJoin` centralised here (removed the duplicate from
  `sandbox-e2b.ts`).
- `sandbox-vercel.ts` and `sandbox-e2b.ts`: `create(input?: CreateInput)`
  accepts `ports: input?.ports ?? [port]`, `publicUrl(port)` returns
  `sandbox.domain(port)` (Vercel) and `https://${getHost(port)}` (E2B).
- `packages/opencode/test/sandbox-shell.test.ts`: 8 tests covering command
  builders, port validation, pid capture, failure surfacing, log tailing,
  and shell-safe single-quote escaping.

Verification performed:
- `bun test test/environment-provision.test.ts test/environment.test.ts
  test/sandbox-provider.test.ts test/sandbox-shell.test.ts`
  (packages/opencode): **31 pass / 0 fail**.
- `bunx oxlint` on the touched files: 0 errors, 4 pre-existing warnings
  (Promise-like, non-this regex).
- Full `bun typecheck` of `packages/opencode` still exceeds 10 min here.

Known limitations (not claimed complete):
- `readShellOutput` reads a log file rather than streaming bytes. Live
  PTY streaming requires the workspace server running inside the sandbox
  (`Step 16` follow-up). The current primitive is enough for the desktop
  terminal to send manual commands and inspect the tail of the output.
- Booting the SoryCode workspace server inside the sandbox is still
  pending (the contract is in `bootWorkspaceServer`; the provider ports
  are exposed; only the workspace server binary upload/start is left).

### Step 16d — Connect submit must not throw Unknown error (2026-09-05)

User report: pasting a key ends in `Error: Unknown error` caused by an
`UnauthorizedError` surfacing from a promise. Root cause: `ApiAuthView`
`handleSubmit` (`packages/app/src/components/dialog-connect-provider.tsx`)
awaited `integration.connect.key` with no `try/catch`, so any transport/auth
failure became an unhandled rejection instead of the dialog's designed
failure view (`store.state === "error"`).

Fixed: catch around the call, dispatching `{ type: "auth.error" }` with
`formatError`, so the real message is shown. Also killed the stale
`serve :4097` backend to avoid talking to an outdated server. Backend live
check: `GET /api/integration` lists `e2b` + `vercel-sandbox` (key+env);
`GET /api/integration/e2b` returns its methods.

Verification: root `lint` 0 errors on the file; happy path unchanged.
