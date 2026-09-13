# SoryCode — Sandbox Runtime (Phase 5, étape 1 : provider)

Date : 2026-09-05. Référence : `reference-projets/open-lovable`
(`lib/sandbox/` : `SandboxProvider` abstrait, `SandboxFactory`, providers
Vercel/E2B, config `.env.example` avec `SANDBOX_PROVIDER=vercel` par défaut).

## Fonctionnement

Le provider sandbox gère le **lifecycle d'une machine isolée** :
`create → runCommand/writeFile/readFile/listFiles → terminate`, plus `isAlive`
et l'URL publique du port exposé. Il ne rejoue pas le runtime OpenCode dans
l'UI : l'étape suivante y fera tourner un workspace server, et le
`SandboxEnvironmentAdapter` existant continuera de router vers son URL.

```text
Project (environment.kind = "sandbox")
 └── SandboxEnvironmentAdapter.target() → remoteURL (workspace server distant)
 └── SandboxProvider (ce document)
      ├── VercelProvider  (@vercel/sandbox@3.2.1, runtime node22, port 5173)
      └── E2BProvider      (e2b@2.46.1, template base, port 5173)
```

Fichiers : `packages/opencode/src/control-plane/adapters/`
`shuffle sandbox-provider.ts` (contrat `Provider`, `resolveProviderKind`,
`isProviderAvailable`, `missingProviderCredentials`, `createSandboxProvider`),
`sandbox-vercel.ts`, `sandbox-e2b.ts`. Tests :
`packages/opencode/test/sandbox-provider.test.ts` (12 tests).

## Architecture

- Objets simples + `export * as …` (conventions du dépôt), pas de classes.
- SDK lourds/optionnels en **dynamic import** dans `create()` uniquement ;
  seuls des `import type` sont statiques (aucun coût runtime sans usage).
- `runCommand({cmd, args, cwd})` : Vercel reçoit cmd/args natifs ; E2B reçoit
  une ligne shell assemblée par `shellQuote` (guillemets simples, quotes
  échappées) car `commands.run` prend une chaîne unique.
- Écarts assumés vs open-lovable (vérifiés sur les `.d.ts` réels, pas copiés) :
  - Vercel v3 identifie par `name` (`sandboxId` = API v0, n'existe plus) ;
  - `CommandFinished.stdout()/stderr()` sont des méthodes async, `exitCode: number` ;
  - filesystem via `sandbox.fs.readFile/writeFile/readdir/stat` (style
    `node:fs/promises`), pas de `writeFiles` racine + fallback `echo` ;
  - pas de `setupViteApp`/`restartViteServer` : SoryCode bootera un workspace
    server, pas une démo Vite.

## Authentification

Variables d'environnement uniquement, jamais en dur (règle AGENT.md §13/§30) :

```text
SANDBOX_PROVIDER=vercel            # ou 'e2b' (défaut: vercel)
# Vercel méthode A (dev) : VERCEL_OIDC_TOKEN (via `vercel link` + `vercel env pull`)
# Vercel méthode B (prod) : VERCEL_TOKEN + VERCEL_TEAM_ID + VERCEL_PROJECT_ID
# E2B : E2B_API_KEY (https://e2b.dev)
```

`createSandboxProvider` lève avec la **liste exacte des variables manquantes**
au lieu d'échouer plus tard dans le SDK. Des `overrides` explicites permettent
un futur credential store.

## Configuration

`VercelProviderInput` / `E2BProviderInput` : `timeoutMs` (défaut 300 000),
`port` (défaut 5173), `template` (E2B). Workdirs : `/vercel/sandbox`,
`/home/user/app`. `listFiles` exclut `node_modules/.git/.next/dist/build`.

## Flux de données

`resolveProviderKind(env)` → `isProviderAvailable` →
`createSandboxProvider(kind, overrides, env)` → `provider.create()` →
`SandboxInfo{sandboxId, url, provider, createdAt}` → commandes/fichiers →
`terminate()`. Sans credentials : erreur claire, jamais de simulation.

## Erreurs possibles

- `Unknown sandbox provider` : `SANDBOX_PROVIDER` hors `vercel|e2b`.
- `not configured. Missing: …` : credentials absentes.
- `No active … sandbox. Call create() first.` : usage avant `create()`.
- Erreurs vendor (réseau, quota, timeout) : propagées telles quelles.

## Limites (non prétendu terminé)

- **Non testé contre les vraies APIs** (aucune clé ici) : `create/runCommand/files`
  compilent contre les `.d.ts` réels (vérifié au compilateur en isolation) mais
  seule la sélection/construction de la factory est couverte par tests.
- Pas encore branché sur `SandboxEnvironmentAdapter.target()` : l'auto-provision
  (create → boot workspace server → `remoteURL`) est l'étape suivante, avec le
  `EnvironmentManager` persistant.
- `isAlive()` Vercel = présence du handle local ; E2B = `isRunning()` distant.

## Tests effectués

- `bun test test/sandbox-provider.test.ts` (packages/opencode) : **12 pass**.
  Sélection/défaut/rejet inconnu, matrice de disponibilité OIDC/PAT/E2B,
  overrides, erreurs exactes, construction sans réseau, garde `create()` d'abord,
  `shellQuote`.
- `bun run lint` (racine) sur les 4 fichiers : **0 warning, 0 erreur**.
- `bun typecheck` complet de `packages/opencode` : > 10 min, impraticable ici ;
  formes d'appel SDK validées par `tsgo --strict` isolé sur les `.d.ts` réels
  (a attrapé et fait corriger `sandboxId` → `name` sur Vercel v3).
