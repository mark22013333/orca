import { describe, expect, it } from 'vitest'
import {
  getAppBackgroundHostProps,
  resolveAppBackgroundAppearance,
  resolveTranslucentPaneTitleBackground
} from './app-background-appearance'

const IMAGE_ID = '11111111-1111-4111-8111-111111111111.png'

describe('resolveAppBackgroundAppearance', () => {
  it('is null without a saved image so nothing renders differently', () => {
    expect(resolveAppBackgroundAppearance(null, false)).toBeNull()
    expect(resolveAppBackgroundAppearance({ appBackgroundImageId: null }, false)).toBeNull()
    expect(
      resolveAppBackgroundAppearance({ appBackgroundImageId: '../escape.png' }, false)
    ).toBeNull()
  })

  it('is null on the web client even with a saved image', () => {
    expect(resolveAppBackgroundAppearance({ appBackgroundImageId: IMAGE_ID }, true)).toBeNull()
  })

  it('fills defaults and clamps values', () => {
    expect(
      resolveAppBackgroundAppearance(
        { appBackgroundImageId: IMAGE_ID, appBackgroundBlur: 99, appBackgroundPanelOpacity: 0 },
        false
      )
    ).toEqual({
      imageId: IMAGE_ID,
      scope: 'window',
      imageOpacity: 0.6,
      blur: 20,
      panelOpacity: 0.2
    })
  })
})

describe('getAppBackgroundHostProps', () => {
  it('sets the scope attribute and the unitless panel opacity variable', () => {
    expect(getAppBackgroundHostProps('workspace', 0.55)).toEqual({
      'data-app-background': 'workspace',
      style: { '--app-panel-opacity': '0.55' }
    })
  })

  it('clamps the panel opacity', () => {
    expect(getAppBackgroundHostProps('window', 5).style['--app-panel-opacity']).toBe('1')
  })
})

describe('resolveTranslucentPaneTitleBackground', () => {
  it('mixes the raw terminal background at the terminal opacity', () => {
    expect(resolveTranslucentPaneTitleBackground('#282c34', 0.6)).toBe(
      'color-mix(in srgb, #282c34 60%, transparent)'
    )
  })

  it('defers to the opaque title color when the terminal is opaque or unknown', () => {
    expect(resolveTranslucentPaneTitleBackground('#282c34', undefined)).toBeNull()
    expect(resolveTranslucentPaneTitleBackground('#282c34', 1)).toBeNull()
    expect(resolveTranslucentPaneTitleBackground(undefined, 0.5)).toBeNull()
  })
})
