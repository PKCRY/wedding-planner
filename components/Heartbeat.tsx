'use client'

import { useEffect } from 'react'

export default function Heartbeat() {
  useEffect(() => {
    fetch('/api/heartbeat', { method: 'POST' }).catch(() => {})
    if ('clearAppBadge' in navigator) {
      (navigator as Navigator & { clearAppBadge: () => Promise<void> }).clearAppBadge().catch(() => {})
    }
  }, [])
  return null
}
