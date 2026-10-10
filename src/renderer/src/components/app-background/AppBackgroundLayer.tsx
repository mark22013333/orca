import { useEffect, useState } from 'react'
import {
  acquireAppBackgroundBlobUrl,
  peekAppBackgroundBlobUrl,
  type AppBackgroundImageRef
} from './app-background-blob-cache'

/** Blob URL for the image while mounted; null until loaded or when unreadable. */
export function useAppBackgroundBlobUrl(image: AppBackgroundImageRef | null): string | null {
  const id = image?.id ?? null
  const staging = image?.staging === true
  const [loaded, setLoaded] = useState<{ key: string; url: string | null } | null>(null)
  const key = id ? `${staging}:${id}` : null

  useEffect(() => {
    if (!id) {
      return undefined
    }
    const ref = { id, staging }
    const effectKey = `${staging}:${id}`
    const handle = acquireAppBackgroundBlobUrl(ref)
    let active = true
    void handle.url.then((url) => {
      if (active) {
        setLoaded({ key: effectKey, url })
      }
    })
    return () => {
      active = false
      handle.release()
    }
  }, [id, staging])

  if (!id || !key) {
    return null
  }
  if (loaded?.key === key) {
    return loaded.url
  }
  return peekAppBackgroundBlobUrl({ id, staging })
}

export type AppBackgroundLayerProps = {
  imageId: string
  /** True for a not-yet-applied pick in userData/appearance/.staging. */
  staging?: boolean
  /** 0..1 */
  imageOpacity: number
  /** px */
  blur: number
}

/** Paints the background image behind a host carrying getAppBackgroundHostProps(); render it as the host's first child. */
export function AppBackgroundLayer({
  imageId,
  staging,
  imageOpacity,
  blur
}: AppBackgroundLayerProps): React.JSX.Element | null {
  const url = useAppBackgroundBlobUrl({ id: imageId, staging })
  if (!url) {
    return null
  }
  return (
    <div
      aria-hidden="true"
      className="app-background-layer"
      data-testid="app-background-layer"
      style={{
        backgroundImage: `url("${url}")`,
        opacity: imageOpacity,
        filter: blur > 0 ? `blur(${blur}px)` : undefined,
        // Why: blur samples transparent pixels past the edge; overscan hides the faded rim.
        inset: blur > 0 ? `${-blur * 2}px` : undefined
      }}
    />
  )
}
