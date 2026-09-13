# Changelog SoryCode

## 2026-09-05 — Câblage UI → backend de l'environment projet

### Added
- `resolveInitialEnvironment()` dans `packages/app/src/components/edit-project.ts` :
  le dialogue s'initialise depuis `project.environment` serveur, fallback localStorage.
- `buildEnvironment()` : construit le `EnvironmentConfig` (local/codespaces/sandbox)
  envoyé au backend.
- `packages/app/src/pages/layout.tsx` monte désormais `DialogEditProjectV2`
  (sélecteur d'environnement partout, comme `home-projects-controller.tsx`).

### Changed
- `createEditProjectModel().save` inclut `environment` dans
  `sdk.client.project.update` (avant : `name/icon/commands` seuls, environment
  localStorage uniquement).

### Tests
- `bun run lint` sur les fichiers modifiés : 0 erreur (20 warnings pré-existants).
- `bun test src/utils/server-compat.test.ts` (packages/app) : 8 pass, 0 fail.
- `bun typecheck` complet de `packages/app` : non concluant (timeout > 3 min),
  pas d'erreur relevée sur les fichiers modifiés via lint.

### Status
Complete (persistance UI→DB). Limite connue : chemin protocole `v2` de
`edit-project.ts` inchangé (`return` précoce) ; lifecycle Codespaces/Sandbox réel
reste à implémenter (adapters exigent `remoteURL`, l'UI Codespaces collecte
`repository/branch`).

## 2026-09-05 — Environnement visible dans le flux nouvelle-session

### Added
- `PromptEnvironmentBadge` (`packages/app/src/components/prompt-environment-badge.tsx`) :
  pastille `● PC local / GitHub Codespaces / Sandbox cloud` dans le fil d'Ariane
  nouvelle-session, tooltip avec repo/branche ou URL sandbox, clic → dialogue
  `DialogEditProjectV2` du projet.
- Clés i18n `session.new.environment.{local,codespaces,sandbox,change}` (en + fr).
- `PromptProject.environment` typé ; `resolveInitialEnvironment` exportée et réutilisée.
- `edit-project.test.ts` : 3 tests (priorité serveur, fallback stockage, défaut local).

### Changed
- `new-session-view.tsx` : badge rendu à côté des sélecteurs projet/workspace.

### Tests
- Lint fichiers touchés : 0 erreur.
- Harness documenté (`--conditions=solid --preload ./happydom.ts`) :
  workspace-controller + server-compat 12 pass, edit-project 3 pass.

### Status
Complete (visibilité + accès édition). Limite connue : exécution distante réelle
toujours à implémenter ; liste projets de l'accueil sans pastille pour l'instant.

## 2026-09-05 — Contrat provider Sandbox (Vercel/E2B, style open-lovable)

### Added
- `packages/opencode/src/control-plane/adapters/sandbox-provider.ts` : contrat
  `Provider` (create/runCommand/writeFile/readFile/listFiles/terminate/isAlive),
  `resolveProviderKind` (`SANDBOX_PROVIDER`, défaut `vercel`, rejet explicite),
  `isProviderAvailable` / `missingProviderCredentials` (OIDC ou triple PAT,
  `E2B_API_KEY`), `createSandboxProvider` (erreur avec variables manquantes).
- `sandbox-vercel.ts` (`@vercel/sandbox@3.2.1`, runtime node22, `sandbox.fs`,
  identité `name`) et `sandbox-e2b.ts` (`e2b@2.46.1`, `commands`/`files`,
  `shellQuote`) : dépendances ajoutées exactes, SDK en dynamic import.
- `packages/opencode/test/sandbox-provider.test.ts` : 12 tests.
- `docs/SANDBOX_RUNTIME.md` : fonctionnement, archi, auth, config, flux,
  erreurs, limites, tests.

### Changed
- Adapté (pas copié) d'open-lovable : écarts Vercel v3 documentés
  (`name`, `stdout()`/`stderr()` async, `fs` natif, pas de scaffold Vite).

### Tests
- `bun test test/sandbox-provider.test.ts` : 12 pass / 0 fail.
- Lint : 0 warning, 0 erreur. Types SDK validés par `tsgo --strict` isolé
  (a corrigé `sandboxId` → `name`).

### Status
Complete (contrat + factory, sans exécution réelle faute de clés ici).
Limite connue : `create()` non exercé contre les vraies APIs ; pas encore branché
sur `SandboxEnvironmentAdapter.target()`.

## 2026-09-05 — Sandbox tokens via provider connect + Environment persistant

### Added
- `packages/core/src/plugin/sandbox.ts` enregistré dans
  `plugin/internal.ts` : intégrations `e2b` (key + env `E2B_API_KEY`) et
  `vercel-sandbox` (key + env `VERCEL_OIDC_TOKEN`). `vercel` modèle IA gardé
  distinct pour isoler les credentials.
- `packages/opencode/src/control-plane/sandbox-credentials.ts` :
  `credentialToOverrides` (mappage `Credential.Key` → `ProviderCredentials`)
  et `sandboxCredentials` (`Effect.fn` via `Integration.Service`).
- `packages/opencode/src/control-plane/environment.ts` : `selectionFromProject`,
  `selectionFor(projectID)`, `targetFor(projectID, workspaceID?)` — source de
  vérité = `Project.environment` en DB.
- `packages/app/src/components/dialog-edit-project-v2.tsx` : boutons
  `Connect E2B key` / `Connect Vercel token` quand le projet est en
  `Sandbox cloud`, ouvrent `DialogConnectProvider` existant.
- i18n `dialog.project.edit.sandbox.{connectHint,connectE2b,connectVercel}`.
- Export `@opencode-ai/core/environment` manquant ajouté au `package.json`.
- `packages/opencode/test/environment.test.ts` : 6 tests.

### Tests
- `bun test` environment + sandbox-provider : **18 pass / 0 fail**.
- Lint : 0 erreur (11 warnings préexistants).
- Vite dev démarre sur 4444 sans erreur de build.

### Status
Complete (UI de connexion + persistance). Limite connue : `targetFor` écrit
mais pas encore appelé par le workspace runtime. Étape suivante : brancher
la résolution target autoritaire sur le workspace runtime + auto-provision
sandbox.

## 2026-09-05 — Workspace runtime autoritaire sur l'environnement projet

### Added
- `packages/opencode/src/control-plane/adapters/environment-adapter.ts` :
  `WorkspaceAdapter` dont `target()` appelle `targetFor(projectID)` — source
  de vérité = `Project.environment` en DB.
- Enregistrement par projet dans `plugin/index.ts` après les internal plugins.
- `middleware/workspace-routing.ts` : `planRequest` lit `session.projectID`,
  résout le target via `targetFor`, et route vers le `Remote` plan avec un
  `Workspace.Info` synthétique (`type: "environment"`) si la cible est
  distante. `Project.Service` injecté dans la layer.

### Tests
- 18 pass (environment 6 + sandbox-provider 12).
- Lint 0 erreur.
- `bun run src/index.ts serve` démarre sans erreur après les modifs.

### Status
Complete (autorité environnement dans le routing). Limite connue : sandbox
sans `remoteURL` toujours en erreur → étape suivante : auto-provision
sandbox (create → boot workspace server → écrire `remoteURL` sur
`Project.environment`). `EnvironmentManager` in-memory devenu inutile,
suppression reportée.

## 2026-09-05 — Auto-provision sandbox + suppression du manager in-memory

### Added
- `provisionSandboxEnvironment(projectID, { provider?, overrides?, env? })`
  dans `control-plane/environment.ts` : short-circuit `{ reused: true }` si
  `remoteURL` déjà stocké (zéro réseau), sinon sélection provider via
  `SANDBOX_PROVIDER`, credentials via `sandboxCredentials` (best-effort avec
  fallback env), `provider.create()` réel, URL persistée par
  `Project.Service.update`. `env` injectable pour tests hermétiques.
- `packages/opencode/test/environment-provision.test.ts` : 3 tests
  d'intégration sur vraies layers (Project + Database + spawner) —
  réutilisation, refus local, credentials manquantes.

### Changed
- `EnvironmentManager` in-memory supprimé (0 référence) : la DB est
  l'unique source de vérité.

### Tests
- 21 pass / 0 fail (provision 3 + environment 6 + sandbox-provider 12).
- Lint : 0 warning, 0 erreur sur les fichiers touchés.

### Status
Complete (provision réelle, boot workspace server restant). Limite connue :
`provider.create()` live non exercé sans clés ; boot du workspace server
dans le sandbox = prochaine étape.

## 2026-09-05 — Même terminal physique, exécution sandbox (venv-like)

### Added
- `packages/opencode/src/control-plane/sandbox-pty.ts` : sessions PTY
  virtuelles (registre, banner, écho, exécution par ligne via `sh -c`,
  Ctrl-C/D, backspace, replay borné).
- `handlers/pty.ts` : `create` ouvre une session sandbox (avec provision à
  la demande) quand le projet est en environnement sandbox ; `get/list/
  update/remove/connectToken/connect` servent les sessions virtuelles avec
  le même framing WebSocket. Credentials lues via le layer location,
  fallback env ; échec explicite, jamais de fallback local silencieux.
- `terminal-panel.tsx` : `TerminalEnvironmentBadge` (`● Sandbox cloud` /
  `● GitHub Codespaces`, caché en local).
- `packages/opencode/test/sandbox-pty.test.ts` : 5 tests.

### Tests
- 45 pass / 0 fail sur 6 fichiers.
- Lint 0 erreur. Backend `serve` OK après modifs.

### Status
Complete (terminal sandbox dans le panneau existant). Limite connue : une
ligne = un `sh -c` (pas de shell persistant, pas d'interactif) ; live non
exercé sans clés vendor.

## 2026-09-05 — Terminal manuel dans le sandbox + Provider.publicUrl

### Added
- `packages/opencode/src/control-plane/sandbox-shell.ts` :
  `openInteractiveShell`, `readShellOutput`, `writeShellCommand` pour piloter
  un shell détaché dans le sandbox depuis l'UI.
- `Provider.publicUrl(port)` + `CreateInput { ports? }` dans
  `adapters/sandbox-provider.ts` ; helpers `shellQuote`/`shellJoin` centralisés.
- `sandbox-vercel.ts` / `sandbox-e2b.ts` : `create(input)` accepte les ports,
  `publicUrl(port)` branché sur `domain(port)` / `getHost(port)`.
- `packages/opencode/test/sandbox-shell.test.ts` : 8 tests.

### Tests
- 31 pass / 0 fail (provision 3 + environment 6 + sandbox-provider 13 + shell 8).
- Lint 0 erreur.

### Status
Complete (shell sandbox pilotable). Limite connue : `readShellOutput`
lit un log file (pas de streaming PTY live tant que le workspace server
n'est pas démarré dans le sandbox). Boot du SoryCode workspace server
dans le sandbox = suite directe.
