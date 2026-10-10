import { useMemo } from 'react'
import {
  getAppBackgroundHostProps,
  resolveAppBackgroundAppearance,
  type AppBackgroundAppearance,
  type AppBackgroundHostProps
} from '@/lib/app-background-appearance'
import type { AppBackgroundScope } from '../../../shared/app-background-settings'
import type { AppBackgroundLayerProps } from '../components/app-background/AppBackgroundLayer'
import { isWebClientLocation } from '@/lib/web-client-location'
import { useAppStore } from '../store'

/** Applied (not draft) background settings; null when no image is saved or on the web client. */
export function useAppBackgroundAppearance(): AppBackgroundAppearance | null {
  const appBackgroundImageId = useAppStore((s) => s.settings?.appBackgroundImageId)
  const appBackgroundScope = useAppStore((s) => s.settings?.appBackgroundScope)
  const appBackgroundImageOpacity = useAppStore((s) => s.settings?.appBackgroundImageOpacity)
  const appBackgroundBlur = useAppStore((s) => s.settings?.appBackgroundBlur)
  const appBackgroundPanelOpacity = useAppStore((s) => s.settings?.appBackgroundPanelOpacity)
  return useMemo(
    () =>
      resolveAppBackgroundAppearance(
        {
          appBackgroundImageId,
          appBackgroundScope,
          appBackgroundImageOpacity,
          appBackgroundBlur,
          appBackgroundPanelOpacity
        },
        isWebClientLocation()
      ),
    [
      appBackgroundImageId,
      appBackgroundScope,
      appBackgroundImageOpacity,
      appBackgroundBlur,
      appBackgroundPanelOpacity
    ]
  )
}

export type ScopedAppBackground = {
  host: AppBackgroundHostProps
  layer: AppBackgroundLayerProps
}

/** Host props and layer props when the applied background targets `scope`; null otherwise. */
export function useScopedAppBackground(scope: AppBackgroundScope): ScopedAppBackground | null {
  const appearance = useAppBackgroundAppearance()
  return useMemo(() => {
    if (appearance?.scope !== scope) {
      return null
    }
    return {
      host: getAppBackgroundHostProps(scope, appearance.panelOpacity),
      layer: {
        imageId: appearance.imageId,
        imageOpacity: appearance.imageOpacity,
        blur: appearance.blur
      }
    }
  }, [appearance, scope])
}
