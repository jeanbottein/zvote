/**
 * Identity derivation following SpacetimeDB's algorithm
 * Based on: https://spacetimedb.com/docs
 * 
 * SpacetimeDB derives a unique 32-byte Identity from JWT claims (issuer + subject)
 * This allows the same user to have consistent identity across sessions
 */

/**
 * Derives a SpacetimeDB Identity from JWT issuer and subject claims
 * 
 * Algorithm (from SpacetimeDB docs):
 * 1. Concatenate issuer and subject with null byte separator: issuer + "\0" + subject
 * 2. Hash using BLAKE3 to produce 32 bytes
 * 3. This 32-byte value is the Identity
 * 
 * @param issuer - The JWT issuer (iss claim)
 * @param subject - The JWT subject (sub claim) - unique user ID from provider
 * @returns 32-byte Identity as hex string
 */
export async function deriveIdentityFromClaims(issuer: string, subject: string): Promise<string> {
  // SpacetimeDB concatenates with null byte separator
  const combined = `${issuer}\0${subject}`;
  const encoder = new TextEncoder();
  const data = encoder.encode(combined);
  
  // Use BLAKE3 hash (we'll use SHA-256 as a fallback since BLAKE3 isn't in Web Crypto API)
  // For production, you may want to use a BLAKE3 WASM library for exact compatibility
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  
  // Convert to hex string
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  
  return hashHex;
}

/**
 * Parse JWT token to extract claims without verification
 * For actual verification, use a proper JWT library on the backend
 * 
 * @param token - JWT token string
 * @returns Decoded JWT payload
 */
export function parseJWT(token: string): {
  iss?: string;
  sub?: string;
  email?: string;
  name?: string;
  [key: string]: any;
} {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid JWT format');
    }
    
    // Decode base64url payload
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    
    return JSON.parse(jsonPayload);
  } catch (error) {
    console.error('Failed to parse JWT:', error);
    throw new Error('Invalid JWT token');
  }
}

/**
 * Extract identity-relevant claims from JWT
 */
export function extractIdentityClaims(token: string): {
  issuer: string;
  subject: string;
  email?: string;
  name?: string;
} {
  const payload = parseJWT(token);
  
  if (!payload.iss || !payload.sub) {
    throw new Error('JWT missing required claims (iss, sub)');
  }
  
  return {
    issuer: payload.iss,
    subject: payload.sub,
    email: payload.email,
    name: payload.name,
  };
}

/**
 * Validate JWT token format and required claims
 */
export function validateJWTFormat(token: string): boolean {
  try {
    const claims = extractIdentityClaims(token);
    return !!(claims.issuer && claims.subject);
  } catch {
    return false;
  }
}
