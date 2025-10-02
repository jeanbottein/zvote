#!/usr/bin/env node
import { SignJWT } from 'jose'
import crypto from 'node:crypto'

function parseArgs(argv) {
  const args = {}
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i]
    if (!k.startsWith('--')) continue
    const key = k.slice(2)
    const v = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : 'true'
    args[key] = v
  }
  return args
}

function usage() {
  console.log(`
Generate a local HS256-signed JWT for testing.

Usage:
  node scripts/generate-jwt.mjs \
    --sub test-user-123 \
    --email test@example.com \
    --name "Test User" \
    [--issuer http://localhost/dev-issuer] \
    [--minutes 120] \
    [--aud zvote-local] \
    [--secret your-dev-secret]

Defaults:
  --issuer  = $JWT_ISSUER or http://localhost/dev-issuer
  --minutes = 120
  --aud     = zvote-local
  --secret  = $JWT_SECRET or dev-secret-not-for-production

Example:
  node scripts/generate-jwt.mjs --sub alice-123 --email alice@example.com --name "Alice"
`)
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  if (args.h || args.help) {
    usage()
    process.exit(0)
  }

  const sub = args.sub || 'test-user-123'
  const email = args.email || 'test@example.com'
  const name = args.name || 'Test User'
  const issuer = args.issuer || process.env.JWT_ISSUER || 'http://localhost/dev-issuer'
  const minutes = parseInt(args.minutes || '120', 10)
  const aud = args.aud || 'zvote-local'
  const secret = args.secret || process.env.JWT_SECRET || 'dev-secret-not-for-production'

  const payload = { email, name }
  const key = new TextEncoder().encode(secret)

  const token = await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuer(issuer)
    .setSubject(sub)
    .setAudience(aud)
    .setIssuedAt()
    .setExpirationTime(`${minutes}m`)
    .sign(key)

  // Derive the identity the same way the client does (SHA-256 of issuer + "\0" + sub)
  const identityHex = crypto
    .createHash('sha256')
    .update(`${issuer}\0${sub}`)
    .digest('hex')

  console.log('JWT token (paste this into Developer: Login with JWT):\n')
  console.log(token + '\n')

  console.log('Derived Identity (client-side):')
  console.log(identityHex + '\n')

  console.log('Claims summary:')
  console.log({ iss: issuer, sub, email, name, aud, exp_minutes: minutes })
}

main().catch((e) => {
  console.error('Failed to generate token:', e)
  process.exit(1)
})
