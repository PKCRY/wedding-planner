'use client'

import { useEffect } from 'react'

export default function Heartbeat() {
  useEffect(() => {
    fetch('/api/heartbeat', { method: 'POST' }).catch(() => {})
  }, [])
  return null
}
