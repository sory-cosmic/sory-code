import { ButtonV2 } from "@opencode-ai/ui/v2/button-v2"
import { Dialog, DialogBody, DialogFooter, DialogHeader, DialogTitle } from "@opencode-ai/ui/v2/dialog-v2"
import { DividerV2 } from "@opencode-ai/ui/v2/divider-v2"
import { Field } from "@opencode-ai/ui/v2/field-v2"
import { Icon } from "@opencode-ai/ui/v2/icon"
import { ProjectAvatar, PROJECT_AVATAR_VARIANTS } from "@opencode-ai/ui/v2/project-avatar-v2"
import { TextareaV2 } from "@opencode-ai/ui/v2/textarea-v2"
import { TextInputV2 } from "@opencode-ai/ui/v2/text-input-v2"
import { For, Show } from "solid-js"
import { useDialog } from "@opencode-ai/ui/context/dialog"
import { useLanguage } from "@/context/language"
import { getProjectAvatarVariant, type LocalProject } from "@/context/layout"
import { ServerConnection } from "@/context/server"
import { getProjectAvatarSource } from "@/pages/layout/helpers"
import { DialogConnectProvider, useProviderConnectController } from "./dialog-connect-provider"
import { createEditProjectModel } from "./edit-project"

export function DialogEditProjectV2(props: { project: LocalProject; server: ServerConnection.Any }) {
  const language = useLanguage()
  const dialog = useDialog()
  const connectController = useProviderConnectController()
  const model = createEditProjectModel(props)

  const openConnect = (provider: string) => {
    connectController.select(provider)
    void dialog.show(() => (
      <DialogConnectProvider controller={connectController} directory={() => props.project.worktree} />
    ))
  }

  return (
    <Dialog fit>
      <form onSubmit={model.submit} class="contents">
        <DialogHeader>
          <DialogTitle>{language.t("dialog.project.edit.title")}</DialogTitle>
        </DialogHeader>
        <DividerV2 />
        <DialogBody class="flex max-h-[min(560px,calc(100vh-160px))] w-full flex-col gap-6 overflow-y-auto px-4 pt-4 pb-1">
          <Field>
            <Field.Label>{language.t("dialog.project.edit.name")}</Field.Label>
            <TextInputV2
              autofocus
              appearance="large"
              class="!w-full"
              value={model.store.name}
              placeholder={model.folderName()}
              onInput={(event) => model.setStore("name", event.currentTarget.value)}
            />
          </Field>

          <div class="flex w-full flex-col gap-2">
            <div class="select-none text-[13px] font-[530] leading-none tracking-[-0.04px] text-v2-text-text-base">
              {language.t("dialog.project.edit.icon")}
            </div>
            <div class="flex items-center gap-3">
              <button
                type="button"
                aria-label={language.t("dialog.project.edit.icon.alt")}
                class="relative size-16 shrink-0 cursor-pointer overflow-hidden rounded-[6px] outline outline-1 outline-transparent transition-[background-color,outline-color] focus-visible:outline-v2-border-border-focus"
                classList={{
                  "bg-v2-overlay-simple-overlay-hover outline-v2-border-border-focus": model.store.dragOver,
                }}
                onMouseEnter={() => model.setStore("iconHover", true)}
                onMouseLeave={() => model.setStore("iconHover", false)}
                onDrop={model.drop}
                onDragOver={model.dragOver}
                onDragLeave={model.dragLeave}
                onClick={model.iconClick}
              >
                <ProjectAvatar
                  fallback={model.store.name || model.defaultName()}
                  src={getProjectAvatarSource(props.project.id, {
                    color: model.store.color,
                    url: props.project.icon?.url,
                    override: model.store.iconOverride,
                  })}
                  variant={getProjectAvatarVariant(model.store.color)}
                  class="!size-16 [&_[data-slot=project-avatar-surface]]:!rounded-[6px] [&_[data-slot=project-avatar-surface]]:!text-[32px]"
                />
                <span
                  class="pointer-events-none absolute inset-0 flex items-center justify-center rounded-[6px] bg-v2-background-bg-contrast/80 text-v2-icon-icon-contrast backdrop-blur-[2px] transition-opacity"
                  classList={{
                    "opacity-100": model.store.iconHover,
                    "opacity-0": !model.store.iconHover,
                  }}
                >
                  <Icon name={model.store.iconOverride ? "close" : "outline-share"} />
                </span>
              </button>
              <input
                ref={(element) => {
                  model.setIconInput(element)
                }}
                type="file"
                accept="image/*"
                class="hidden"
                onChange={model.inputChange}
              />
              <div class="flex select-none flex-col gap-[6px] text-[11px] font-[440] leading-none tracking-[0.05px] text-v2-text-text-muted">
                <span>{language.t("dialog.project.edit.icon.hint")}</span>
                <span>{language.t("dialog.project.edit.icon.recommended")}</span>
              </div>
            </div>
          </div>

          <Show when={!model.store.iconOverride}>
            <div class="flex w-full flex-col gap-2">
              <div class="select-none text-[13px] font-[530] leading-none tracking-[-0.04px] text-v2-text-text-base">
                {language.t("dialog.project.edit.color")}
              </div>
              <div class="-ml-1 flex gap-1.5">
                <For each={PROJECT_AVATAR_VARIANTS}>
                  {(color) => (
                    <button
                      type="button"
                      aria-label={language.t("dialog.project.edit.color.select", { color })}
                      aria-pressed={getProjectAvatarVariant(model.store.color) === color}
                      class="flex size-8 items-center justify-center rounded-[10px] p-1 outline outline-1 outline-transparent transition-[background-color,outline-color] hover:bg-v2-overlay-simple-overlay-hover focus-visible:outline-v2-border-border-focus"
                      classList={{
                        "bg-v2-overlay-simple-overlay-hover [box-shadow:inset_0_0_0_2px_var(--v2-border-border-focus)]":
                          getProjectAvatarVariant(model.store.color) === color,
                      }}
                      onClick={() => {
                        if (getProjectAvatarVariant(model.store.color) === color && !props.project.icon?.url) return
                        model.setStore(
                          "color",
                          getProjectAvatarVariant(model.store.color) === color ? undefined : color,
                        )
                      }}
                    >
                      <ProjectAvatar
                        fallback={model.store.name || model.defaultName()}
                        variant={getProjectAvatarVariant(color)}
                        class="!size-6 [&_[data-slot=project-avatar-surface]]:!rounded-[6px]"
                      />
                    </button>
                  )}
                </For>
              </div>
            </div>
          </Show>

          <div class="flex w-full flex-col gap-3">
            <div class="flex flex-col gap-1">
              <div class="select-none text-[13px] font-[530] leading-none tracking-[-0.04px] text-v2-text-text-base">
                Execution environment
              </div>
              <div class="text-[11px] leading-[16px] text-v2-text-text-muted">
                This project uses exactly one environment for files, terminal, builds and processes.
              </div>
            </div>
            <div class="grid grid-cols-3 gap-2">
              <For each={[
                { id: "local", title: "PC local", description: "Run on this computer" },
                { id: "codespaces", title: "GitHub Codespaces", description: "Run in a Codespace" },
                { id: "sandbox", title: "Sandbox cloud", description: "Run in an isolated cloud" },
              ] as const}>
                {(environment) => (
                  <button
                    type="button"
                    aria-pressed={model.store.environment === environment.id}
                    class="flex min-h-[82px] flex-col gap-1 rounded-[8px] border border-v2-border-border-base bg-v2-background-bg-base px-3 py-2.5 text-left transition-[background-color,border-color] hover:bg-v2-overlay-simple-overlay-hover"
                    classList={{
                      "border-v2-border-border-focus bg-v2-overlay-simple-overlay-hover": model.store.environment === environment.id,
                    }}
                    onClick={() => model.setStore("environment", environment.id)}
                  >
                    <span class="text-[12px] font-[550] text-v2-text-text-base">{environment.title}</span>
                    <span class="text-[10px] leading-[14px] text-v2-text-text-muted">{environment.description}</span>
                  </button>
                )}
              </For>
            </div>

            <Show when={model.store.environment === "codespaces"}>
              <div class="flex flex-col gap-3 rounded-[8px] border border-v2-border-border-base p-3">
                <div class="grid grid-cols-2 gap-3">
                  <Field>
                    <Field.Label>Repository</Field.Label>
                    <TextInputV2
                      class="!w-full"
                      value={model.store.codespacesRepository}
                      placeholder="owner/repository"
                      onInput={(event) => model.setStore("codespacesRepository", event.currentTarget.value)}
                    />
                  </Field>
                  <Field>
                    <Field.Label>Branch</Field.Label>
                    <TextInputV2
                      class="!w-full"
                      value={model.store.codespacesBranch}
                      placeholder="main"
                      onInput={(event) => model.setStore("codespacesBranch", event.currentTarget.value)}
                    />
                  </Field>
                </div>
                <div class="flex flex-col gap-2">
                  <div class="text-[11px] leading-[16px] text-v2-text-text-muted">
                    Connect your GitHub account (no PAT to paste — device flow like VS Code). Or set GITHUB_TOKEN.
                  </div>
                  <ButtonV2 type="button" variant="contrast" class="!w-full" onClick={() => openConnect("github")}>
                    Connect GitHub
                  </ButtonV2>
                  <GithubConnectionStatus state={() => model.githubProvider.latest ?? "unknown"} />
                  <div class="text-[11px] leading-[14px] text-v2-text-text-muted">
                    Creates or reuses a Codespace for this repo/branch. Terminal “codespace$” runs on the GitHub machine (branch {model.store.codespacesBranch || "main"}), not your PC — two shells, two filesystems, like VS Code remote.
                  </div>
                </div>
              </div>
            </Show>

            <Show when={model.store.environment === "sandbox"}>
              <Field>
                <Field.Label>{language.t("dialog.project.edit.sandbox.urlLabel")}</Field.Label>
                <Field.Prefix>{language.t("dialog.project.edit.sandbox.urlDescription")}</Field.Prefix>
                <TextInputV2
                  class="!w-full"
                  value={model.store.sandboxURL}
                  placeholder="https://..."
                  onInput={(event) => model.setStore("sandboxURL", event.currentTarget.value)}
                />
              </Field>
              <div class="flex flex-col gap-2 pb-2">
                <div class="text-[11px] leading-[16px] text-v2-text-text-muted">
                  {language.t("dialog.project.edit.sandbox.connectHint")}
                </div>
                <div class="flex flex-col gap-1">
                  <ButtonV2
                    type="button"
                    variant="contrast"
                    class="!w-full"
                    onClick={() => openConnect("e2b")}
                  >
                    {language.t("dialog.project.edit.sandbox.connectE2b")}
                  </ButtonV2>
                  <SandboxConnectionStatus
                    state={() => model.sandboxProviders.latest?.e2b ?? "unknown"}
                  />
                  <ButtonV2 type="button" variant="neutral" class="!w-full" onClick={() => openConnect("vercel-sandbox")}>
                    {language.t("dialog.project.edit.sandbox.connectVercel")}
                  </ButtonV2>
                  <SandboxConnectionStatus
                    state={() => model.sandboxProviders.latest?.vercel ?? "unknown"}
                  />
                </div>
                <div class="text-[11px] leading-[16px] text-v2-text-text-muted">
                  {language.t("dialog.project.edit.sandbox.providerNote")}
                </div>
              </div>
            </Show>
          </div>

          <Field>
            <Field.Label>{language.t("dialog.project.edit.worktree.startup")}</Field.Label>
            <Field.Prefix>{language.t("dialog.project.edit.worktree.startup.description")}</Field.Prefix>
            <TextareaV2
              class="!w-full [&_[data-slot=textarea-v2-textarea]]:font-mono"
              rows={3}
              value={model.store.startup}
              placeholder={language.t("dialog.project.edit.worktree.startup.placeholder")}
              spellcheck={false}
              onInput={(event) => model.setStore("startup", event.currentTarget.value)}
            />
          </Field>
        </DialogBody>
        <DialogFooter>
          <ButtonV2 type="button" variant="neutral" disabled={model.save.isPending} onClick={model.close}>
            {language.t("common.cancel")}
          </ButtonV2>
          <ButtonV2 type="submit" variant="contrast" disabled={model.save.isPending}>
            {model.save.isPending ? language.t("common.saving") : language.t("common.save")}
          </ButtonV2>
        </DialogFooter>
      </form>
    </Dialog>
  )
}

function SandboxConnectionStatus(props: { state: () => string }) {
  const language = useLanguage()
  const text = () => {
    if (props.state() === "key") return language.t("dialog.project.edit.sandbox.connectedKey")
    if (props.state() === "env") return language.t("dialog.project.edit.sandbox.connectedEnv")
    if (props.state() === "none") return language.t("dialog.project.edit.sandbox.notConnected")
    return ""
  }
  const dot = () =>
    props.state() === "key" || props.state() === "env" ? "bg-emerald-400" : "bg-zinc-500"
  return (
    <Show when={text()}>
      <div class="flex items-center gap-1.5 px-1">
        <span class={`size-1.5 shrink-0 rounded-full ${dot()}`} aria-hidden="true" />
        <span class="text-[11px] leading-[16px] text-v2-text-text-muted">{text()}</span>
      </div>
    </Show>
  )
}

function GithubConnectionStatus(props: { state: () => string }) {
  const text = () => {
    if (props.state() === "oauth") return "GitHub connected (OAuth)"
    if (props.state() === "key") return "GitHub connected (PAT)"
    if (props.state() === "env") return "GitHub connected (env)"
    if (props.state() === "none") return "GitHub not connected"
    return ""
  }
  const dot = () => (props.state() === "oauth" || props.state() === "key" || props.state() === "env" ? "bg-emerald-400" : "bg-zinc-500")
  return (
    <Show when={text()}>
      <div class="flex items-center gap-1.5 px-1">
        <span class={`size-1.5 shrink-0 rounded-full ${dot()}`} aria-hidden="true" />
        <span class="text-[11px] leading-[16px] text-v2-text-text-muted">{text()}</span>
      </div>
    </Show>
  )
}
