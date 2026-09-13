import { getFilename } from "@opencode-ai/core/util/path"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { useMutation } from "@tanstack/solid-query"
import { normalizeProjectInfo } from "@/context/global-sync/utils"
import { createMemo, createResource } from "solid-js"
import { createStore } from "solid-js/store"
import { useGlobal } from "@/context/global"
import { type LocalProject } from "@/context/layout"
import { ServerConnection } from "@/context/server"

export type ProjectEnvironment = "local" | "codespaces" | "sandbox"

const ENVIRONMENT_STORAGE_PREFIX = "sorycode.project.environment."

type StoredEnvironment = {
  kind: ProjectEnvironment
  repository?: string
  branch?: string
  remoteURL?: string
}

function readEnvironment(projectID: string): StoredEnvironment {
  const fallback: StoredEnvironment = { kind: "local" }
  if (typeof localStorage === "undefined") return fallback
  try {
    const raw = localStorage.getItem(ENVIRONMENT_STORAGE_PREFIX + projectID)
    if (!raw) return fallback
    const value = JSON.parse(raw) as Partial<StoredEnvironment>
    if (value.kind !== "local" && value.kind !== "codespaces" && value.kind !== "sandbox") return fallback
    return {
      kind: value.kind,
      repository: typeof value.repository === "string" ? value.repository : undefined,
      branch: typeof value.branch === "string" ? value.branch : undefined,
      remoteURL: typeof value.remoteURL === "string" ? value.remoteURL : undefined,
    }
  } catch {
    return fallback
  }
}

function writeEnvironment(projectID: string, value: StoredEnvironment) {
  if (typeof localStorage === "undefined") return
  localStorage.setItem(ENVIRONMENT_STORAGE_PREFIX + projectID, JSON.stringify(value))
}

export function resolveInitialEnvironment(project: Pick<LocalProject, "id" | "environment">): StoredEnvironment {
  const server = project.environment
  if (server?.kind === "local" || server?.kind === "codespaces" || server?.kind === "sandbox") {
    return {
      kind: server.kind,
      repository: server.repository,
      branch: server.branch,
      remoteURL: server.remoteURL,
    }
  }
  if (!project.id) return { kind: "local" }
  return readEnvironment(project.id)
}

export function buildEnvironment(input: {
  kind: ProjectEnvironment
  repository: string
  branch: string
  sandboxURL: string
  directory: string
}) {
  if (input.kind === "codespaces") {
    return {
      kind: input.kind,
      repository: input.repository.trim() || undefined,
      branch: input.branch.trim() || undefined,
      directory: input.directory,
    }
  }
  if (input.kind === "sandbox") {
    return {
      kind: input.kind,
      remoteURL: input.sandboxURL.trim() || undefined,
      directory: input.directory,
    }
  }
  return { kind: input.kind, directory: input.directory }
}

export function createEditProjectModel(props: { project: LocalProject; server: ServerConnection.Any }) {
  const dialog = useDialog()
  const global = useGlobal()
  const serverCtx = createMemo(() => global.ensureServerCtx(props.server))
  const folderName = createMemo(() => getFilename(props.project.worktree))
  const defaultName = createMemo(() => props.project.name || folderName())
  const initialEnvironment = resolveInitialEnvironment(props.project)
  const [store, setStore] = createStore({
    name: defaultName(),
    color: props.project.icon?.color,
    iconOverride: props.project.icon?.override,
    startup: props.project.commands?.start ?? "",
    environment: initialEnvironment.kind,
    codespacesRepository: initialEnvironment.repository || "",
    codespacesBranch: initialEnvironment.branch || "",
    sandboxURL: initialEnvironment.remoteURL || "",
    dragOver: false,
    iconHover: false,
  })
  let iconInput: HTMLInputElement | undefined

  function selectFile(file: File) {
    if (!file.type.startsWith("image/")) return
    const reader = new FileReader()
    reader.onload = (event) => {
      const result = event.target?.result
      if (typeof result !== "string") return
      setStore("iconOverride", result)
      setStore("iconHover", false)
    }
    reader.readAsDataURL(file)
  }

  function drop(event: DragEvent) {
    event.preventDefault()
    setStore("dragOver", false)
    const file = event.dataTransfer?.files[0]
    if (file) selectFile(file)
  }

  function dragOver(event: DragEvent) {
    event.preventDefault()
    setStore("dragOver", true)
  }

  function dragLeave() {
    setStore("dragOver", false)
  }

  function inputChange(event: Event) {
    const file = (event.currentTarget as HTMLInputElement).files?.[0]
    if (file) selectFile(file)
  }

  function iconClick() {
    if (store.iconOverride && store.iconHover) {
      setStore("iconOverride", "")
      return
    }
    iconInput?.click()
  }

  const save = useMutation(() => ({
    mutationFn: async () => {
      const name = store.name.trim() === folderName() ? "" : store.name.trim()
      const start = store.startup.trim()

      if (props.project.id) {
        if (store.environment === "codespaces" && !store.codespacesRepository.trim()) {
          throw new Error("A GitHub repository is required for Codespaces")
        }
        if (store.environment === "sandbox") {
          const url = store.sandboxURL.trim()
          if (url) {
            try {
              const parsed = new URL(url)
              if (parsed.protocol !== "https:" && parsed.protocol !== "http:") throw new Error()
            } catch {
              throw new Error("Sandbox workspace URL must be a valid HTTP(S) URL")
            }
          }
        }
        const stored: StoredEnvironment = {
          kind: store.environment,
          repository: store.codespacesRepository.trim() || undefined,
          branch: store.codespacesBranch.trim() || undefined,
          remoteURL: store.sandboxURL.trim() || undefined,
        }
        writeEnvironment(props.project.id, stored)
      }

      if (props.project.id && props.project.id !== "global") {
        if ((await serverCtx().sdk.protocol) !== "v1") return
        const environment = buildEnvironment({
          kind: store.environment,
          repository: store.codespacesRepository,
          branch: store.codespacesBranch,
          sandboxURL: store.sandboxURL,
          directory: props.project.worktree,
        })
        const project = await serverCtx()
          .sdk.client.project.update({
            projectID: props.project.id,
            directory: props.project.worktree,
            name,
            icon: { color: store.color || "", override: store.iconOverride || "" },
            commands: { start },
            environment,
          })
          .then((result) => result.data)
        if (!project) return
        serverCtx().sync.set("project", (items) =>
          items.map((item) => (item.id === project.id ? normalizeProjectInfo(project) : item)),
        )
        serverCtx().sync.project.icon(props.project.worktree, store.iconOverride || undefined)
        dialog.close()
        return
      }

      serverCtx().sync.project.meta(props.project.worktree, {
        name,
        icon: { color: store.color || undefined, override: store.iconOverride || undefined },
        commands: { start: start || undefined },
      })
      dialog.close()
    },
  }))

  function submit(event: SubmitEvent) {
    event.preventDefault()
    if (save.isPending) return
    save.mutate()
  }

  type ConnectionState = "unknown" | "key" | "env" | "none" | "oauth"
  const connState = (info: { connections?: { type: string }[] } | undefined): ConnectionState => {
    const first = info?.connections?.[0] as any
    if (!first) return "none"
    if (first.type === "env") return "env"
    if (first.type === "credential" && first.credential?.type === "oauth") return "oauth"
    if (first.type === "credential") return "key"
    return first.type === "oauth" ? "oauth" : "key"
  }

  const [sandboxProviders] = createResource(async () => {
    const ctx = serverCtx()
    const directory = props.project.worktree
    const load = async (integrationID: string) => {
      try {
        const result = await ctx.sdk.api.integration.get({ integrationID, location: { directory } })
        return result.data ?? undefined
      } catch {
        return undefined
      }
    }
    const [e2b, vercel] = await Promise.all([load("e2b"), load("vercel-sandbox")])
    return {
      e2b: e2b ? connState(e2b) : "unknown",
      vercel: vercel ? connState(vercel) : "unknown",
    } as { e2b: ConnectionState; vercel: ConnectionState }
  })

  const [githubProvider] = createResource(async () => {
    const ctx = serverCtx()
    const directory = props.project.worktree
    try {
      const result = await ctx.sdk.api.integration.get({ integrationID: "github", location: { directory } })
      const info = result.data as any
      return info ? connState(info) : "unknown"
    } catch {
      return "unknown" as ConnectionState
    }
  })

  return {
    store,
    setStore,
    folderName,
    defaultName,
    save,
    submit,
    sandboxProviders,
    githubProvider,
    drop,
    dragOver,
    dragLeave,
    inputChange,
    iconClick,
    close() {
      dialog.close()
    },
    setIconInput(input: HTMLInputElement) {
      iconInput = input
    },
  }
}
