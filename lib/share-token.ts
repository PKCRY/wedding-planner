import { createHmac } from 'crypto'

function secret() {
  return process.env.SESSION_SECRET ?? 'fallback-dev-secret'
}

export function makeShareToken(taskId: number): string {
  return createHmac('sha256', secret()).update(String(taskId)).digest('hex').slice(0, 16)
}

export function verifyShareToken(taskId: number, token: string): boolean {
  return token === makeShareToken(taskId)
}
