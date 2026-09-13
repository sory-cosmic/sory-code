# SoryCode — Status

Date : 2026-09-05

## Travail effectué (Step 9)
- Suivi `AGENT.md` : vérifié Steps 1-8 (modèle `environment`, adapters,
  `EnvironmentManager` in-memory, UI V2, routage distant existant).
- Constat : backend (`ProjectTable.environment`, `PATCH /project/:projectID`, SDK
  `project.update(environment)`) déjà réel ; l'UI n'envoyait jamais `environment`
  (localStorage seul) et `layout.tsx` montait encore le dialogue V1.
- Corrigé : `edit-project.ts` initialise depuis le serveur et envoie `environment`
  dans `project.update` ; `layout.tsx` monte `DialogEditProjectV2`.
- Docs créées : `docs/SORYCODE_ARCHITECTURE.md`, `docs/SORYCODE_TODO.md`,
  `CHANGELOG_SORYCODE.md`, ce status. Log ajouté dans `AGENT.md` (Step 9).

## Travail effectué (Step 10)
- Cas utilisateur étudié sur captures : le menu « Exécuter la session dans →
  Dépôt local » est le sélecteur de worktree git, pas l'environnement ; l'env réel
  n'était visible nulle part dans le flux nouvelle-session.
- Ajouté `PromptEnvironmentBadge` : pastille `● PC local / Codespaces / Sandbox`
  dans le fil d'Ariane nouvelle-session (serveur d'abord, stockage en fallback),
  tooltip repo/branche ou URL, clic → `DialogEditProjectV2`.
- `PromptProject.environment` typé, `resolveInitialEnvironment` exportée/réutilisée,
  clés i18n en+fr, `edit-project.test.ts` (3 tests).

## Fonctionnalités terminées
- Sélection d'environnement persistée UI → DB (plus de faux bouton au sens
  persistance : le choix est stocké côté projet).

## Tests
- Lint fichiers modifiés : 0 erreur (nouveaux fichiers 0 warning).
- Harness documenté : workspace-controller + server-compat 12 pass,
  edit-project 3 pass / 0 fail.
- Typecheck complet app : timeout, non concluant (à refaire en env Bun complet).

## Fichiers modifiés
- `packages/app/src/components/edit-project.ts`
- `packages/app/src/components/edit-project.test.ts` (nouveau)
- `packages/app/src/components/prompt-environment-badge.tsx` (nouveau)
- `packages/app/src/components/prompt-project-selector.tsx`
- `packages/app/src/pages/layout.tsx`
- `packages/app/src/pages/new-session/new-session-view.tsx`
- `packages/app/src/i18n/en.ts`, `packages/app/src/i18n/fr.ts`

## Problèmes
- Typecheck complet trop long (> 3 min) dans cet env.
- `edit-project.ts` ne persiste que sous protocole `v1` (chemin v2 inchangé).
- Pas de lifecycle Codespaces/Sandbox réel (documenté, non prétendu terminé).

## Travail effectué (Step 11)
- Référence `reference-projets/open-lovable` étudiée (`SandboxProvider`,
  `SandboxFactory`, providers Vercel/E2B, `.env.example` avec `SANDBOX_PROVIDER`).
- Implémenté le contrat provider Sandbox façon SoryCode (objets, dynamic imports,
  `import type` statiques) avec les SDK réels (`@vercel/sandbox@3.2.1`,
  `e2b@2.46.1`) ajoutés en dépendances exactes de `packages/opencode`.
- Écarts v3/v2 vérifiés sur les `.d.ts` réels (pas copiés d'open-lovable v0).
- Tests 12 pass, lint 0, `docs/SANDBOX_RUNTIME.md` créée.

## Fichiers modifiés (Step 11)
- `packages/opencode/src/control-plane/adapters/sandbox-provider.ts` (nouveau)
- `packages/opencode/src/control-plane/adapters/sandbox-vercel.ts` (nouveau)
- `packages/opencode/src/control-plane/adapters/sandbox-e2b.ts` (nouveau)
- `packages/opencode/test/sandbox-provider.test.ts` (nouveau)
- `packages/opencode/package.json` (+2 dépendances exactes)
- `docs/SANDBOX_RUNTIME.md` (nouveau)

## Travail effectué (Step 12)
- Étude du circuit : `Integration` + `Credential` + `connection.key` (déjà
  utilisé par les providers IA) ; `plugin/models-dev.ts` et `plugin/provider/openai.ts`
  servent de référence.
- Plugin core `sandbox` enregistré : `e2b` et `vercel-sandbox` apparaissent
  dans le sélecteur de providers, même UI que les clés LLM (secure, jamais
  en projet).
- UI : `dialog-edit-project-v2` montre les boutons Connect E2B/Vercel
  sous `Sandbox cloud` ; i18n en + fr.
- Pont : `sandboxCredentials` lit l'active connection via `Integration.Service`
  et mappe en `ProviderCredentials` pour `createSandboxProvider`.
- `environment.ts` rendu persistant via DB (`selectionFromProject`,
  `selectionFor`, `targetFor`). 6 tests, 18/18 verts.

## Fichiers modifiés (Step 12)
- `packages/core/src/plugin/sandbox.ts` (nouveau)
- `packages/core/src/plugin/internal.ts` (enregistrement)
- `packages/core/package.json` (export `./environment`)
- `packages/opencode/src/control-plane/sandbox-credentials.ts` (nouveau)
- `packages/opencode/src/control-plane/environment.ts` (sélection DB)
- `packages/opencode/test/environment.test.ts` (nouveau)
- `packages/app/src/components/dialog-edit-project-v2.tsx` (boutons)
- `packages/app/src/components/dialog-connect-provider.tsx` (fallback)
- `packages/app/src/i18n/en.ts`, `packages/app/src/i18n/fr.ts`

## Travail effectué (Step 13)
- `control-plane/adapters/environment-adapter.ts` : adapter `environment`
  dont `target()` lit `Project.environment` via `targetFor`.
- Enregistrement par projet dans `plugin/index.ts`.
- `middleware/workspace-routing.ts` : `planRequest` autoritaire sur la session,
  plan `Remote` avec `Workspace.Info` synthétique pour les cibles distantes.
- Backend : `serve :4097` démarre sans erreur après les modifs. 18/18 tests verts.

## Travail effectué (Step 14)
- `provisionSandboxEnvironment` : sélection DB → short-circuit si déjà
  provisionné → sinon provider + credentials → `create()` réel → URL écrite
  via `Project.Service.update`. `env` injectable, erreurs explicites.
- `EnvironmentManager` supprimé (0 référence).
- 3 tests d'intégration sur vraies layers (pattern `project.test.ts`) :
  réutilisation sans réseau, refus local, `E2B_API_KEY` manquante.
  21/21 verts au total. Lint 0.

## Travail effectué (Step 15)
- `sandbox-shell.ts` : shell détaché (bash) + read/write via log file.
- `Provider.publicUrl(port)` + `CreateInput.ports` : URL servante réelle par
  port (Vercel `domain(port)`, E2B `getHost(port)`).
- `shellQuote`/`shellJoin` centralisés dans `sandbox-provider.ts`.
- Tests 8 sandbox-shell + 13 sandbox-provider, total **31 pass** sur 4 fichiers.
- Lint 0 erreur.

## Travail effectué (Step 16)
- `sandbox-pty.ts` : sessions virtuelles (banner, écho, `sh -c` par ligne,
  `[exit N]`, Ctrl-C/D, backspace, replay borné pour reconnect).
- Handler PTY : `create` provisionne à la demande et ouvre la session
  sandbox si projet sandbox ; `get/list/update/remove/connectToken/connect`
  branchés avec le même framing. Credentials via layer location, erreurs
  explicites.
- Badge `● Sandbox cloud` / `● Codespaces` dans la barre d'onglets du
  panneau terminal (caché en local).
- 45/45 tests, lint 0 erreur, backend boot OK.

## Prochaine étape exacte
Boot SoryCode workspace server dans le sandbox (`bootWorkspaceServer` déjà
défini + ports exposés) pour shell persistant + PTY live, puis pastille
environnement dans la liste projets de l'accueil.
