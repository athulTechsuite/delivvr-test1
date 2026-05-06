import { clearAuthCookie } from '@/lib/auth'

export async function POST(): Promise<Response> {
  try {
    await clearAuthCookie()
    return Response.json({ ok: true }, { status: 200 })
  } catch (err) {
    console.error('[logout] unexpected error:', err)
    return Response.json({ error: 'Internal server error' }, { status: 500 })
  }
}
