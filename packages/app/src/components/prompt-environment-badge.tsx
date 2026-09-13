import { Show } from "solid-js"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { TooltipV2 } from "@opencode-ai/ui/v2/tooltip-v2"
import { useLanguage } from "@/context/language"
import { ServerConnection, useServer } from "@/context/server"
import { resolveInitialEnvironment, type ProjectEnvironment } from "./edit-project"
import type { PromptProject } from "./prompt-project-selector"

const dot: Record<ProjectEnvironment, string> = {
  local: "bg-emerald-400",
  codespaces: "bg-violet-400",
  sandbox: "bg-sky-400",
}

export function PromptEnvironmentBadge(props: { project: PromptProject | undefined }) {
  const language = useLanguage()
  const dialog = useDialog()
  const server = useServer()

  const environment = () => (props.project ? resolveInitialEnvironment(props.project) : undefined)
  const label = () => {
    const kind = environment()?.kind
    if (kind === "codespaces") return language.t("session.new.environment.codespaces")
    if (kind === "sandbox") return language.t("session.new.environment.sandbox")
    return language.t("session.new.environment.local")
  }
  const detail = () => {
    const env = environment()
    if (!env) return ""
    if (env.kind === "codespaces" && env.repository) {
      return env.branch ? `${env.repository} · ${env.branch}` : env.repository
    }
    if (env.kind === "sandbox" && env.remoteURL) return env.remoteURL
    return ""
  }

  const openEditor = () => {
    const project = props.project
    if (!project) return
    const conn =
      (project.server?.key
        ? server.list.find((item) => ServerConnection.key(item) === project.server?.key)
        : undefined) ?? server.current
    if (!conn) return
    const target = { ...project, expanded: false }
    void import("./dialog-edit-project-v2").then(({ DialogEditProjectV2 }) => {
      void dialog.show(() => <DialogEditProjectV2 server={conn} project={target} />)
    })
  }

  return (
    <Show when={props.project && environment()}>
      <>
        <span class="mx-1 hidden select-none opacity-50 sm:inline">/</span>
        <TooltipV2
          placement="top"
          value={detail() ? `${language.t("session.new.environment.change")} · ${detail()}` : language.t("session.new.environment.change")}
          class="min-w-0 max-w-[220px]"
          contentClass="max-w-[calc(100vw-32px)] break-all"
        >
          <button
            type="button"
            onClick={openEditor}
            class="flex h-7 min-w-0 max-w-[203px] items-center gap-1.5 rounded-sm px-1.5 text-[13px] font-[440] leading-5 tracking-[-0.04px] text-v2-text-text-faint transition-colors hover:bg-v2-overlay-simple-overlay-hover focus-visible:bg-v2-overlay-simple-overlay-hover focus-visible:outline-none"
          >
            <span class={`size-1.5 shrink-0 rounded-full ${dot[environment()?.kind ?? "local"]}`} aria-hidden="true" />
            <span class="min-w-0 truncate">{label()}</span>
          </button>
        </TooltipV2>
      </>
    </Show>
  )
}
