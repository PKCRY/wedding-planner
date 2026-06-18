import crypto from 'node:crypto'

export function generateSalt(): string {
  return crypto.randomBytes(16).toString('hex')
}

export function hashPassword(password: string, salt: string): string {
  return crypto.createHash('sha256').update(salt + password).digest('hex')
}

export function verifyPassword(password: string, salt: string, hash: string): boolean {
  return hashPassword(password, salt) === hash
}

export function nameToId(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, '-')
}
