# SoryCode — GitHub Codespaces

Date : 2026-09-06. Phase 4. Référence : `reference-projets/vscode-main` (`extensions/github-authentication` device flow + remote `codespaces+` authority).

## Fonctionnement

Codespace = **ordinateur GitHub distant** (Ubuntu container, `/workspaces/<repo>`, branche `main/master` du repo — jamais le FS local).

```text
Project (environment.kind = "codespaces", repository = "owner/repo", branch = "main")
  └─ CodespacesEnvironmentAdapter.target() → remoteURL (web_url du Codespace)
  └─ provisionCodespaceEnvironment() → GitHub API
  └─ CodespacePty (dual shell)
     ├─ local$  → Processus sur ton PC (OS local, C:\ ou /home)
     └─ codespace$ → Processus sur la machine GitHub (Linux, /workspaces/repo, branch main)
```

Comme VS Code : `remoteAuthority = "codespaces+<name>"` (`remoteHosts.ts:9 getRemoteName`) → `RemoteTerminalBackend` vs `LocalTerminalBackend` (`terminalProcessManager.ts:182`). Deux filesystems (`vscode-remote://codespaces+...` vs `file://`), deux `PtyHost`.

## Authentification — comme VS Code, sans PAT manuel

VS Code ne demande jamais de coller un token : `extensions/github-authentication/src/github.ts:241 registerAuthenticationProvider("github")` + `src/flows.ts:387 DeviceCodeFlow` (`POST /login/device/code` → `user_code` → polling `POST /login/oauth/access_token?grant_type=device_code`).

SoryCode reproduit le même flux via le système `Integration` (pas de marketplace) :

- Plugin `packages/core/src/plugin/github.ts` : `Integration github` (`oauth-device` + `key` + `env GITHUB_TOKEN/GH_TOKEN`).
- OAuth Device Flow : `POST https://github.com/login/device/code {client_id, scope="repo codespace read:user"}` → modal `user_code` + `verification_uri` → polling.
- Client ID par défaut `01ab8ac9400c4e429b23` (même que VS Code officiel, `reference-projets/vscode-main/extensions/github-authentication/src/config.ts`). Surcharge via `GITHUB_CLIENT_ID`.
- Alternative PAT/env : `GITHUB_TOKEN` ou `GH_TOKEN` (fallback `sandbox-credentials` pattern).
- UI : `DialogEditProjectV2` codespaces → `Connect GitHub` (ouvre `DialogConnectProvider` existant) → `GithubConnectionStatus` (`oauth|key|env|none`). Pas de nouveau dialog.

Flux : `user → Connect GitHub → device code → browser → GitHub authorize → token stocké chiffré (Credential OAuth)` → `codespaceToken()` résout `Integration.connection.active("github")`.

## Configuration

```text
Repository obligatoire : "owner/repo" (parseRepository)
Branch optionnelle : "main" (défaut), stockée dans Project.environment.branch
remoteURL : web_url du Codespace, rempli automatiquement par provision (pas saisi manuellement)
Machine optionnelle : selection.codespaces.machine
```

Env fallback :
```text
GITHUB_TOKEN / GH_TOKEN
GITHUB_CLIENT_ID (override OAuth app)
```

## Flux de données

```
resolveInitialEnvironment(project) → server Project.environment
→ buildEnvironment({kind:"codespaces", repository, branch})
→ Project.update({environment})
→ selectionFor(projectID) → targetFor → CodespacesEnvironmentAdapter.target() exige remoteURL
→ provisionCodespaceEnvironment(projectID) :
   listCodespaces(token) → réutilise si repo match déjà
   sinon createCodespace(token, {repository, branch, machine}) → POST /repos/{owner}/{repo} → id → POST /user/codespaces
   → waitForCodespace(name) polling state === Available
   → Project.update({environment: {...remoteURL: web_url}})
→ Pty create : codespaceTarget() → createCodespacePty({repository, branch, url}) → banner
  "Connected to GitHub Codespace owner/repo@main · https://...github.dev"
→ feedCodespacePty : chaque ligne = remote execution (workspace server non encore booté, message explicatif)
→ workspace-routing middleware déjà gère Target remote → proxy HTTP/SSE
```

Fichiers : `packages/core/src/plugin/github.ts`, `packages/opencode/src/control-plane/codespace.ts` (API REST), `codespace-credentials.ts`, `codespace-pty.ts`, `environment.ts:provisionCodespaceEnvironment`, `adapters/environment-remote.ts` (makeRemoteAdapter idem sandbox), `server/handlers/pty.ts` (codespaceTarget/createCodespaceTerminal vs sandboxTarget).

## Deux shells

- `sandboxTarget`/`codespaceTarget` distinguent par `selection.kind` — pas de `if local/if codespaces` partout.
- Pty local = `Pty.Service` (pid réel) ; Pty distant = `SandboxPty`/`CodespacePty` (`pid 0`, `sh -c` ou message). Le panel terminal est le même (même hamburger, même panel) — seul le backend change, comme `terminalService.ts:979 isLocalInRemoteTerminal`.

## Erreurs possibles

- `Repository is required` / `Invalid repository "x". Expected "owner/repo"`
- `GitHub not connected. Connect via Settings → Integrations → GitHub` → manque token + pas d'env
- `Unknown codespace provider` / `Timed out waiting for codespace ... to become Available` / terminal states `Failed/Unavailable/Deleted`
- `codespaces environment is not connected: remoteURL is missing` → avant provision, jamais silencieux

## Limites (non prétendu terminé)

- Live `createCodespace/waitForCodespace` non exercé sans token ici (même limite que sandbox : factory testée, pas le réseau).
- `feedCodespacePty` est explicatif, pas encore `runCommand` réel via Codespace (nécessite workspace server booté dans le Codespace + port forwarding, comme `sandbox-boot.ts` pour sandbox). Le dual shell est visible (`codespace$` vs local), mais l'exécution distante complète arrive avec le boot.
- Typecheck complet `packages/opencode` >10 min timeout local ; formes d'appel validées contre `.d.ts` GitHub (`api.github.com/user/codespaces`).

## Tests

- `packages/opencode/test/codespace.test.ts` : parseRepository, Device poll logic mock (pending→success, slow_down, expired), provision reuse.
- Manuel : Edit Project → Codespaces → saisir `owner/repo` + `Connect GitHub` (device flow) → vert `GitHub connected (OAuth)` → créer terminal → banner `Connected to GitHub Codespace`.
