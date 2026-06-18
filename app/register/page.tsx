'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function RegisterPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, password }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Something went wrong')
        return
      }

      router.push('/her-dashboard')
    } catch {
      setError('Network error — please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex flex-col justify-center px-6 py-12 safe-bottom" style={{ backgroundColor: '#f0f4f0' }}>
      <div className="w-full max-w-sm mx-auto">
        <div className="mb-10 text-center">
          <p className="text-xs uppercase tracking-widest mb-3" style={{ color: '#7a9e7e' }}>Nick & Siobhan</p>
          <h1 className="text-4xl font-semibold mb-2" style={{ color: '#2d4a30', fontFamily: 'Georgia, serif' }}>
            Our Wedding
          </h1>
          <p className="text-sm" style={{ color: '#9db89f' }}>Create your account</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs uppercase tracking-widest mb-2" style={{ color: '#5a7d5e' }}>
              Your name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Mum, John, Aunty Claire…"
              autoCapitalize="words"
              autoComplete="name"
              autoFocus
              required
              className="w-full px-4 rounded-xl border focus:outline-none"
              style={{
                height: 52,
                backgroundColor: '#fff',
                borderColor: '#b8d0ba',
                color: '#2d4a30',
              }}
            />
          </div>

          <div>
            <label className="block text-xs uppercase tracking-widest mb-2" style={{ color: '#5a7d5e' }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Choose a password to log back in"
              autoComplete="new-password"
              required
              className="w-full px-4 rounded-xl border focus:outline-none"
              style={{
                height: 52,
                backgroundColor: '#fff',
                borderColor: '#b8d0ba',
                color: '#2d4a30',
              }}
            />
            <p className="text-xs mt-1.5" style={{ color: '#9db89f' }}>
              You'll use this to sign in next time
            </p>
          </div>

          {error && (
            <p className="text-sm text-center" style={{ color: '#c0607a' }}>{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl font-medium text-white"
            style={{
              height: 52,
              backgroundColor: '#d4849a',
              opacity: loading ? 0.6 : 1,
              letterSpacing: '0.05em',
            }}
          >
            {loading ? 'Creating account…' : 'Create Account'}
          </button>
        </form>

        <p className="mt-6 text-xs text-center" style={{ color: '#9db89f' }}>
          Already have an account?{' '}
          <Link href="/login" style={{ color: '#7a9e7e', textDecoration: 'underline' }}>
            Sign in
          </Link>
        </p>

        <p className="mt-2 text-xs text-center" style={{ color: '#9db89f' }}>
          Nick or Siobhan?{' '}
          <Link href="/login" style={{ color: '#7a9e7e', textDecoration: 'underline' }}>
            Sign in instead
          </Link>
        </p>

        <p className="mt-8 text-xs text-center tracking-widest uppercase" style={{ color: '#9db89f' }}>
          Summer 2026
        </p>
      </div>
    </div>
  )
}
