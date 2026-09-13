# SoryCode environment architecture

This layer is intentionally **not** a VS Code UI clone.

A project owns exactly one execution environment:

- `local`: local filesystem + local PTY/processes/builds.
- `codespaces`: a remote OpenCode-compatible workspace server running in GitHub Codespaces.
- `sandbox`: an isolated remote workspace server.

The existing OpenCode workspace runtime already knows how to proxy requests when
an adapter returns `{ type: "remote", url }`. Therefore the environment layer
only selects and describes the execution target; filesystem, PTY, sessions,
SSE/events and agent operations remain in the existing runtime.

For Codespaces, the next integration point is a GitHub service that creates or
opens a Codespace and supplies the forwarded workspace-server URL to the
`CodespacesEnvironmentAdapter` as `remoteURL`.
