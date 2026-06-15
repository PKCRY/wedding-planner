import { NextResponse } from 'next/server'
import { getSession } from '@/lib/session'
import { supabase } from '@/lib/db'

// Status map derived from monthly Excel sheets (May, June, July, August).
// Rule: furthest status wins (done > in_progress > pending).
// Matched case-insensitively against task titles in DB.
const STATUS_MAP: Record<string, 'done' | 'in_progress' | 'pending'> = {
  'ask lydia to make the jewelry': 'done',
  'attend pre-cana': 'done',
  'cabin assignments - finalize': 'done',
  'clarify drink package': 'done',
  'collect vases': 'done',
  'decide on drink package': 'done',
  'decide on signature drinks': 'done',
  'design camp logo': 'done',
  'ensure groomsmen suit rentals are ordered': 'done',
  'finalize list and send invitations': 'done',
  'find sage green round placemats': 'done',
  'finish registry': 'done',
  'get dance shoes (flower sneakers)': 'done',
  'get dress tailored': 'done',
  'make schedule for friday': 'done',
  'make timeline of wedding day': 'done',
  'sign makeup contract': 'done',
  'buy wedding rings': 'in_progress',
  'figure out shuttle for church and campground': 'in_progress',
  'schedule makeup trial': 'in_progress',
  'seating chart': 'in_progress',
  'test syrups for signature drink': 'in_progress',
  '2 altar flowers': 'pending',
  'ask booklet passers (2)': 'pending',
  'ask family member about place setting setup on friday': 'pending',
  'ask ringbearers and flowergirls': 'pending',
  'bar menu': 'pending',
  'beer, wine, water, soda for weekend': 'pending',
  'beer/picture canoe': 'pending',
  'bucket list sign': 'pending',
  'buy bridal party gifts': 'pending',
  'buy paper products for weekend': 'pending',
  'chips for rehearsal': 'pending',
  'choose gift bearers (2-3)': 'pending',
  'choose lectors (2-3)': 'pending',
  'cigar bar sign': 'pending',
  'create wedding booklet': 'pending',
  'decide on and buy getting ready outfits': 'pending',
  'decide on and buy team bandanas / something for friday': 'pending',
  'embroidered napkin for picnic basket': 'pending',
  'game board sign': 'pending',
  'get veil': 'pending',
  'get wooden bucket': 'pending',
  'give dj timeline of speeches, etc.': 'pending',
  'gold frame': 'pending',
  'groomsmen boutonnières': 'pending',
  'hang pics on until we meet again': 'pending',
  'hot dogs, burgers, ketchup, buns, mustard, cheese': 'pending',
  'make olympic flag': 'pending',
  'make camp card logo': 'pending',
  'make mock table decor setup': 'pending',
  'make more napkin rings': 'pending',
  'order drinking cups for friday': 'pending',
  'order plastic water goblets': 'pending',
  'peel stickers off all jars': 'pending',
  'phone sign for church': 'pending',
  'pick songs': 'pending',
  'pictures for until we meet again': 'pending',
  'pizza for rehearsal': 'pending',
  'plan cake with olivia': 'pending',
  'plan a photo booth (ask erin)': 'pending',
  'plan games / competitions': 'pending',
  'practice hair style - schedule': 'pending',
  'qr code sign': 'pending',
  "s'more sign": 'pending',
  "s'more table": 'pending',
  'set up tables and take picture of setup': 'pending',
  'table numbers (places)': 'pending',
  'team names (places)': 'pending',
  'update aunt marge on table decor': 'pending',
  'verify and order desserts from olivia': 'pending',
  'welcome campfire mug with care package': 'pending',
  'write dad song': 'pending',
  'write speeches': 'pending',
  'bridesmaid flowers': 'pending',
  'flowers for vases': 'pending',
}

export async function POST() {
  const session = await getSession()
  if (!session.user || session.user.role !== 'admin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: tasks, error: fetchErr } = await supabase
    .from('tasks')
    .select('id, title, status')

  if (fetchErr) return NextResponse.json({ error: fetchErr.message }, { status: 500 })

  const updates: { id: number; title: string; old: string; new: string }[] = []
  const unmatched: string[] = []

  for (const task of tasks ?? []) {
    const key = task.title.toLowerCase().trim()
    const target = STATUS_MAP[key]
    if (target === undefined) {
      unmatched.push(task.title)
      continue
    }
    if (task.status !== target) {
      updates.push({ id: task.id, title: task.title, old: task.status, new: target })
    }
  }

  const errors: string[] = []
  for (const u of updates) {
    const patch: Record<string, unknown> = { status: u.new }
    if (u.new === 'done') patch.completed_date = new Date().toISOString().slice(0, 10)
    else patch.completed_date = null

    const { error } = await supabase.from('tasks').update(patch).eq('id', u.id)
    if (error) errors.push(`${u.title}: ${error.message}`)
  }

  return NextResponse.json({
    updated: updates.length,
    errors,
    unmatched_count: unmatched.length,
    changes: updates.map(u => ({ title: u.title, from: u.old, to: u.new })),
    unmatched,
  })
}
