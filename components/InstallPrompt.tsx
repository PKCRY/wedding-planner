'use client'

import { useEffect, useState } from 'react'

type State = 'idle' | 'ios' | 'android' | 'hidden'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BeforeInstallPromptEvent = Event & { prompt: () => void; userChoice: Promise<{ outcome: string }> }

export default function InstallPrompt() {
  const [state, setState] = useState<State>('idle')
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    if (localStorage.getItem('pwa-install-dismissed')) return

    // Already installed as standalone
    if (
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as { standalone?: boolean }).standalone
    ) return

    const ua = navigator.userAgent
    const isIOS = /iPhone|iPad|iPod/.test(ua) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS/.test(ua)

    if (isIOS && isSafari) {
      setState('ios')
      return
    }

    const handler = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
      setState('android')
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  function dismiss() {
    localStorage.setItem('pwa-install-dismissed', '1')
    setState('hidden')
  }

  async function install() {
    if (!deferred) return
    deferred.prompt()
    const { outcome } = await deferred.userChoice
    if (outcome === 'accepted') setState('hidden')
    else dismiss()
  }

  if (state === 'hidden' || state === 'idle') return null

  if (state === 'ios') {
    return (
      <div className="fixed bottom-0 left-0 right-0 z-50 p-4 safe-bottom pointer-events-none">
        <div
          className="rounded-2xl p-4 shadow-lg pointer-events-auto"
          style={{ backgroundColor: '#fff', border: '1px solid #b8d0ba' }}
        >
          <div className="flex justify-between items-start mb-2">
            <p className="font-semibold text-sm" style={{ color: '#2d4a30' }}>
              Add to Home Screen
            </p>
            <button onClick={dismiss} className="text-gray-400 text-xl leading-none px-1">×</button>
          </div>
          <p className="text-xs leading-relaxed" style={{ color: '#7a9e7e' }}>
            Tap the <strong>Share</strong> button <span aria-hidden>⎙</span> at the bottom of Safari, then tap{' '}
            <strong>"Add to Home Screen"</strong> to install and enable push notifications.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 safe-bottom pointer-events-none">
      <div
        className="rounded-2xl p-4 shadow-lg flex items-center justify-between gap-3 pointer-events-auto"
        style={{ backgroundColor: '#fff', border: '1px solid #b8d0ba' }}
      >
        <p className="text-sm font-medium" style={{ color: '#2d4a30' }}>
          Install Wedding Planner
        </p>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={dismiss}
            className="text-xs px-3 py-1.5 rounded-lg"
            style={{ color: '#9db89f' }}
          >
            Not now
          </button>
          <button
            onClick={install}
            className="text-xs px-3 py-1.5 rounded-lg text-white font-medium"
            style={{ backgroundColor: '#7a9e7e' }}
          >
            Install
          </button>
        </div>
      </div>
    </div>
  )
}
