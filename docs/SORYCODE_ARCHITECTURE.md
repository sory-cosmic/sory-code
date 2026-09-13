# SoryCode — Architecture (audit OpenCode + cible)

Date : 2026-09-05. Mission définie par `AGENT.md` : transformer OpenCode en base de SoryCode
sans prototype parallèle, par phases, sans régression.

## 1. Architecture actuelle d'OpenCode (constat)

Monorepo Bun (`bun@1.3.14`, `turbo`, `effect@4.0.0-beta.83`). Chaîne imposée :
`Schema → Core/Protocol → Server → Client → sdk-next`.

| Couche | Rôle constaté |
|---|---|
| `packages/schema` | Contrats wire/storage browser-safe (`project.ts`, `environment.ts`, …). `Project.Info.environment` existe déjà. |
| `packages/core` | Domaines : `project.ts` (resolve/commit, pas de persistance), `project/sql.ts` (`ProjectTable` **avec colonne `environment` JSON**, migration `20260905040000_project_environment`), sessions V2, tools, permissions, system-context. `environment/index.ts` : `Kind`, `Config`, `Target`, `Adapter`, `isRemote`. |
| `packages/opencode` | App réelle : `project/project.ts` persiste `environment` (`fromRow` défaut `{kind:"local",directory}`, `UpdateInput/UpdatePayload` avec `environment`, `update()` + `fromDirectory()` upsert). `control-plane/` : `environment.ts` (`EnvironmentManager` **in-memory**), `adapters/environment-local.ts`, `adapters/environment-remote.ts`, `adapters/environments.ts`, `workspace.ts` + `workspace-adapter-runtime.ts` (routage workspace distant existant via `WorkspaceAdapterRuntime.target()` + proxy HTTP/SSE). |
| Serveur | `server/routes/instance/httpapi/groups/project.ts` : `PATCH /project/:projectID` accepte `environment` (SDK `sdk.client.project.update` généré avec `environment?: EnvironmentConfig`). |
| UI (`packages/app`) | `components/edit-project.ts` + `dialog-edit-project-v2.tsx` (sélecteur local/codespaces/sandbox). `home-projects-controller.tsx` utilisait déjà V2 ; `pages/layout.tsx` montait encore V1 (sans sélecteur). |

## 2. Architecture proposée pour SoryCode

```text
Project
 └── Runtime (1 seul, source de vérité)
      ├── LocalRuntime      → target local existant
      ├── CodespacesRuntime → target remote (workspace server dans le Codespace)
      └── SandboxRuntime    → target remote (provider isolé)
```

Règles : UI configure, backend résout et exécute ; aucune duplication `if local/if codespaces`
hors adapters ; fichiers/terminal/processus/builds/tests/Git/serveurs/IA passent par le target
du projet via `WorkspaceAdapterRuntime` existant.

## 3. Réutilisable tel quel

- `ProjectTable.environment` + migration, `fromRow`, `update()`, `fromDirectory()` upsert.
- `PATCH /project/:projectID` avec `environment` + SDK généré.
- `WorkspaceAdapterRuntime.target()` + proxy workspace (chemin remote existant).
- `Environment.Kind/Config/Adapter/isRemote` + adapters local/remote + registre.

## 4. À modifier (fait ou prévu)

- [x] `app/.../edit-project.ts` : envoyait `name/icon/commands` seuls, `environment` en
      localStorage uniquement → **corrigé 2026-09-05** : init depuis `project.environment`
      serveur (fallback localStorage), `buildEnvironment()` + envoi dans `project.update`.
- [x] `app/pages/layout.tsx` : montait le dialogue V1 → basculé sur `DialogEditProjectV2`
      (cohérent avec `home-projects-controller.tsx`).
- [ ] `EnvironmentManager` : in-memory → brancher sur `Project.get/update` (source DB).
- [ ] Résolution target workspace : rendre l'`environment` du projet autoritaire.
- [x] Contrat provider Sandbox (`control-plane/adapters/sandbox-{provider,vercel,e2b}.ts`,
      factory `SANDBOX_PROVIDER`, voir `docs/SANDBOX_RUNTIME.md`).
- [ ] Lifecycle Codespaces réel (API GitHub + workspace server).

## 5. À créer

- `docs/CODESPACES.md`, `docs/SANDBOX_RUNTIME.md`, `docs/RUNTIME_ARCHITECTURE.md` (phases 2-5).
- Tests automatisés : sélection/persistance/résolution target/proxy distant.
- Intégration IA → runtime projet (phase 7), terminal/processus/builds/serveurs (8-9).

## 6. Risques

- `bun typecheck` complet de `packages/app` > 3 min (timeout constaté) : vérifier par
  package/ciblé + lint.
- Protocole V1 vs HttpApi : `edit-project.ts` ne persiste les projets que sous protocole
  `v1` (`if protocol !== "v1" return`) ; le chemin v2 reste à traiter.
- Adapters distants : `target()` exige `remoteURL` ; l'UI Codespaces collecte
  `repository/branch` (pas d'URL) → création/récupération du Codespace non implémentée.

## 7. Ordre d'implémentation (cf. AGENT.md §35)

Audit → runtime backend → local → codespaces → sandbox → project model → IA →
terminal/processus → builds/serveurs → UI → Android → E2E.

## 8. État actuel

Phase 1 (audit) documentée ici. Câblage UI→backend de l'`environment` fait et vérifié.
Badge d'environnement dans le flux nouvelle-session fait et vérifié.
Contrat provider Sandbox (Vercel/E2B, factory `SANDBOX_PROVIDER`) fait et vérifié :
12 tests, lint 0, types SDK validés en isolation (cf. `docs/SANDBOX_RUNTIME.md`).
Prochaine étape exacte : rendre `EnvironmentManager` persistant via `Project` DB,
brancher l'auto-provision sandbox (create → boot workspace server → `remoteURL`)
sur `SandboxEnvironmentAdapter.target()`, avec tests.
