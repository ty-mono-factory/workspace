import { randomBytes, scryptSync, timingSafeEqual } from 'crypto'

export function generateSalt(length: number = 16): string {
    return randomBytes(length).toString('hex')
}

export function hashPassword(password: string, salt: string): string {
    const hash = scryptSync(password, salt, 64, {
        N: 16384, // CPU/memory
        r: 8,     // block size
        p: 1      // parallelization
    })
    return hash.toString('hex')
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
    const newHash = hashPassword(password, salt)
    return timingSafeEqual(Buffer.from(newHash), Buffer.from(hash))
}

export function createPasswordHash(password: string): { hash: string; salt: string } {
    const salt = generateSalt()
    const hash = hashPassword(password, salt)
    return { hash, salt }
}

export function generateToken(length: number = 32): string {
    return randomBytes(length).toString('hex')
}