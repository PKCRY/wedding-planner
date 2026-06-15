import { redirect } from 'next/navigation'
import { getSession } from '@/lib/session'

export default async function Home() {
  const session = await getSession()

  if (!session.user) redirect('/login')
  if (session.user.role === 'admin') redirect('/dashboard')
  redirect('/her-dashboard')
}
