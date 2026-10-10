import type { StateCreator } from 'zustand'
import type { AppState } from '../types'
import type { GlobalSettings } from '../../../../shared/global-settings-types'
import type { AppBackgroundApi } from '../../../../preload/api/app-background-api'
import {
  normalizeAppBackgroundBlur,
  normalizeAppBackgroundImageId,
  normalizeAppBackgroundImageOpacity,
  normalizeAppBackgroundPanelOpacity,
  normalizeAppBackgroundScope,
  type AppBackgroundScope
} from '../../../../shared/app-background-settings'

/** Numeric/scope fields the background settings draft edits before Apply. */
export type AppBackgroundDraftValues = {
  scope: AppBackgroundScope
  imageOpacity: number
  blur: number
  panelOpacity: number
  terminalBackgroundOpacity: number
}

export type AppBackgroundDraftImage =
  | { kind: 'unchanged' }
  | { kind: 'staged'; stagingId: string }
  | { kind: 'remove' }

/** Session-only background settings draft (same lifetime model as feedback-draft):
 *  it survives leaving the settings page and is cleared by Apply, Discard or restart.
 *  Blob URLs never live here; see app-background-blob-cache. */
export type AppBackgroundDraft = AppBackgroundDraftValues & {
  image: AppBackgroundDraftImage
  /** Settings captured when the draft opened; the baseline for change detection and Apply. */
  snapshot: AppBackgroundDraftValues & { imageId: string | null }
}

export type AppBackgroundApplyResult =
  | { ok: true }
  | { ok: false; reason: 'noDraft' | 'busy' | 'invalidId' | 'stagingMissing' | 'saveFailed' }

export type AppBackgroundDraftSlice = {
  appBackgroundDraft: AppBackgroundDraft | null
  appBackgroundDraftApplying: boolean
  /** Opens a draft from current settings; no-op when one is already open (keeps its snapshot). */
  openAppBackgroundDraft: () => void
  /** Merges normalized values into the draft, opening it first if needed. */
  setAppBackgroundDraft: (patch: Partial<AppBackgroundDraftValues>) => void
  /** Records a picked staging image; any previously staged file is discarded. */
  stageAppBackgroundDraftImage: (stagingId: string) => void
  /** Marks the current image for removal (or just drops a staged pick when none is saved). */
  removeAppBackgroundDraftImage: () => void
  applyAppBackgroundDraft: () => Promise<AppBackgroundApplyResult>
  discardAppBackgroundDraft: () => void
}

export type AppBackgroundDraftHost = AppBackgroundDraftSlice & {
  settings: GlobalSettings | null
  updateSettingsOrThrow: (updates: Partial<GlobalSettings>) => Promise<void>
}

type HostSet = (
  partial:
    | Partial<AppBackgroundDraftHost>
    | ((state: AppBackgroundDraftHost) => Partial<AppBackgroundDraftHost>)
) => void

export function readAppBackgroundDraftValues(
  settings: GlobalSettings | null
): AppBackgroundDraftValues {
  return {
    scope: normalizeAppBackgroundScope(settings?.appBackgroundScope),
    imageOpacity: normalizeAppBackgroundImageOpacity(settings?.appBackgroundImageOpacity),
    blur: normalizeAppBackgroundBlur(settings?.appBackgroundBlur),
    panelOpacity: normalizeAppBackgroundPanelOpacity(settings?.appBackgroundPanelOpacity),
    terminalBackgroundOpacity: normalizeTerminalBackgroundOpacity(
      settings?.terminalBackgroundOpacity
    )
  }
}

function normalizeTerminalBackgroundOpacity(value: unknown): number {
  // Why: undefined means "opaque" everywhere terminalBackgroundOpacity is read.
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 1
  }
  return Math.min(1, Math.max(0, value))
}

function normalizeDraftPatch(
  patch: Partial<AppBackgroundDraftValues>
): Partial<AppBackgroundDraftValues> {
  const next: Partial<AppBackgroundDraftValues> = {}
  if (patch.scope !== undefined) {
    next.scope = normalizeAppBackgroundScope(patch.scope)
  }
  if (patch.imageOpacity !== undefined) {
    next.imageOpacity = normalizeAppBackgroundImageOpacity(patch.imageOpacity)
  }
  if (patch.blur !== undefined) {
    next.blur = normalizeAppBackgroundBlur(patch.blur)
  }
  if (patch.panelOpacity !== undefined) {
    next.panelOpacity = normalizeAppBackgroundPanelOpacity(patch.panelOpacity)
  }
  if (patch.terminalBackgroundOpacity !== undefined) {
    next.terminalBackgroundOpacity = normalizeTerminalBackgroundOpacity(
      patch.terminalBackgroundOpacity
    )
  }
  return next
}

function buildDraft(settings: GlobalSettings | null): AppBackgroundDraft {
  const values = readAppBackgroundDraftValues(settings)
  return {
    ...values,
    image: { kind: 'unchanged' },
    snapshot: { ...values, imageId: normalizeAppBackgroundImageId(settings?.appBackgroundImageId) }
  }
}

/** Only fields the user changed are written, so edits made elsewhere while the draft was open survive Apply. */
export function getAppBackgroundDraftSettingsUpdates(
  draft: AppBackgroundDraft
): Partial<GlobalSettings> {
  const updates: Partial<GlobalSettings> = {}
  if (draft.scope !== draft.snapshot.scope) {
    updates.appBackgroundScope = draft.scope
  }
  if (draft.imageOpacity !== draft.snapshot.imageOpacity) {
    updates.appBackgroundImageOpacity = draft.imageOpacity
  }
  if (draft.blur !== draft.snapshot.blur) {
    updates.appBackgroundBlur = draft.blur
  }
  if (draft.panelOpacity !== draft.snapshot.panelOpacity) {
    updates.appBackgroundPanelOpacity = draft.panelOpacity
  }
  if (draft.terminalBackgroundOpacity !== draft.snapshot.terminalBackgroundOpacity) {
    updates.terminalBackgroundOpacity = draft.terminalBackgroundOpacity
  }
  return updates
}

export function hasUnappliedAppBackgroundChanges(draft: AppBackgroundDraft | null): boolean {
  if (!draft) {
    return false
  }
  return (
    draft.image.kind !== 'unchanged' ||
    Object.keys(getAppBackgroundDraftSettingsUpdates(draft)).length > 0
  )
}

export const selectAppBackgroundDraftHasUnappliedChanges = (
  state: Pick<AppBackgroundDraftSlice, 'appBackgroundDraft'>
): boolean => hasUnappliedAppBackgroundChanges(state.appBackgroundDraft)

/** The image the draft would show: a staged pick, the saved image, or none. */
export function resolveAppBackgroundDraftImage(
  draft: AppBackgroundDraft
): { id: string; staging: boolean } | null {
  if (draft.image.kind === 'staged') {
    return { id: draft.image.stagingId, staging: true }
  }
  if (draft.image.kind === 'remove' || !draft.snapshot.imageId) {
    return null
  }
  return { id: draft.snapshot.imageId, staging: false }
}

function discardStagedFile(api: AppBackgroundApi, image: AppBackgroundDraftImage): void {
  if (image.kind !== 'staged') {
    return
  }
  void api.discard(image.stagingId).catch((err: unknown) => {
    console.warn('Failed to discard staged background image:', err)
  })
}

export function createAppBackgroundDraftActions(
  set: HostSet,
  get: () => AppBackgroundDraftHost,
  getApi: () => AppBackgroundApi
): AppBackgroundDraftSlice {
  const ensureDraft = (): AppBackgroundDraft => {
    const existing = get().appBackgroundDraft
    if (existing) {
      return existing
    }
    const created = buildDraft(get().settings)
    set({ appBackgroundDraft: created })
    return created
  }

  return {
    appBackgroundDraft: null,
    appBackgroundDraftApplying: false,

    openAppBackgroundDraft: () => {
      ensureDraft()
    },

    setAppBackgroundDraft: (patch) => {
      const draft = ensureDraft()
      set({ appBackgroundDraft: { ...draft, ...normalizeDraftPatch(patch) } })
    },

    stageAppBackgroundDraftImage: (stagingId) => {
      const draft = ensureDraft()
      if (draft.image.kind === 'staged' && draft.image.stagingId === stagingId) {
        return
      }
      discardStagedFile(getApi(), draft.image)
      set({ appBackgroundDraft: { ...draft, image: { kind: 'staged', stagingId } } })
    },

    removeAppBackgroundDraftImage: () => {
      const draft = ensureDraft()
      discardStagedFile(getApi(), draft.image)
      set({
        appBackgroundDraft: {
          ...draft,
          image: draft.snapshot.imageId ? { kind: 'remove' } : { kind: 'unchanged' }
        }
      })
    },

    applyAppBackgroundDraft: async () => {
      const draft = get().appBackgroundDraft
      if (!draft) {
        return { ok: false, reason: 'noDraft' }
      }
      if (get().appBackgroundDraftApplying) {
        return { ok: false, reason: 'busy' }
      }
      set({ appBackgroundDraftApplying: true })
      try {
        let applied = draft
        if (draft.image.kind !== 'unchanged') {
          const stagingId = draft.image.kind === 'staged' ? draft.image.stagingId : null
          const committed = await getApi().commit({ stagingId })
          if (!committed.ok) {
            return { ok: false, reason: committed.reason }
          }
          // Why: the staging file is gone after commit; rebase so a retry after a later failure doesn't re-commit it.
          applied = {
            ...draft,
            image: { kind: 'unchanged' },
            snapshot: { ...draft.snapshot, imageId: committed.imageId }
          }
          // Why: main also broadcasts settings:changed; merging here keeps Apply synchronous for this window.
          set((state) => ({
            appBackgroundDraft: state.appBackgroundDraft ? applied : null,
            settings: state.settings
              ? { ...state.settings, appBackgroundImageId: committed.imageId }
              : state.settings
          }))
        }
        const updates = getAppBackgroundDraftSettingsUpdates(applied)
        if (Object.keys(updates).length > 0) {
          await get().updateSettingsOrThrow(updates)
        }
        set({ appBackgroundDraft: null })
        return { ok: true }
      } catch (err) {
        console.error('Failed to apply background settings:', err)
        return { ok: false, reason: 'saveFailed' }
      } finally {
        set({ appBackgroundDraftApplying: false })
      }
    },

    discardAppBackgroundDraft: () => {
      const draft = get().appBackgroundDraft
      if (!draft) {
        return
      }
      discardStagedFile(getApi(), draft.image)
      set({ appBackgroundDraft: null })
    }
  }
}

export const createAppBackgroundDraftSlice: StateCreator<
  AppState,
  [],
  [],
  AppBackgroundDraftSlice
> = (set, get) => createAppBackgroundDraftActions(set, get, () => window.api.appBackground)
