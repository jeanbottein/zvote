/// Optional: Server-side JWT validation for production deployments
/// 
/// This module provides JWT token validation to ensure that users
/// are who they claim to be. In production, you should:
/// 1. Verify JWT signatures using provider's public keys
/// 2. Validate claims (iss, sub, exp, aud)
/// 3. Derive Identity and verify it matches the sender
/// 
/// To use this, add to Cargo.toml:
/// ```toml
/// [dependencies]
/// jsonwebtoken = "9.2"
/// serde = { version = "1.0", features = ["derive"] }
/// blake3 = "1.5"
/// ```

use spacetimedb::{Identity, ReducerContext};
use serde::{Deserialize, Serialize};

/// JWT Claims we care about
#[derive(Debug, Serialize, Deserialize)]
pub struct JwtClaims {
    /// Issuer - identifies the authentication provider
    pub iss: String,
    /// Subject - unique user ID from the provider
    pub sub: String,
    /// Email (optional)
    pub email: Option<String>,
    /// Name (optional)
    pub name: Option<String>,
    /// Expiration time (Unix timestamp)
    pub exp: i64,
    /// Audience (optional)
    pub aud: Option<String>,
}

/// Derive SpacetimeDB Identity from JWT claims
/// This matches the algorithm used by SpacetimeDB and the client
pub fn derive_identity_from_claims(issuer: &str, subject: &str) -> Identity {
    // Concatenate issuer and subject with null byte separator
    let combined = format!("{}\0{}", issuer, subject);
    
    // Hash using BLAKE3
    let hash = blake3::hash(combined.as_bytes());
    
    // Return first 32 bytes as Identity
    let hash_bytes = hash.as_bytes();
    Identity::from_byte_array(*hash_bytes)
}

/// Validate JWT token and return claims
/// 
/// NOTE: This is a simplified example. For production:
/// - Fetch and cache provider public keys (JWKS)
/// - Validate signature using proper algorithm (RS256, ES256, etc.)
/// - Check audience (aud) claim matches your app
/// - Handle key rotation
/// 
/// Example with jsonwebtoken crate:
/// ```rust
/// use jsonwebtoken::{decode, DecodingKey, Validation, Algorithm};
/// 
/// pub fn validate_jwt(token: &str, provider: &str) -> Result<JwtClaims, String> {
///     // Get provider's public key (you'd fetch this from JWKS endpoint)
///     let public_key = get_provider_public_key(provider)?;
///     
///     let decoding_key = DecodingKey::from_rsa_pem(public_key.as_bytes())
///         .map_err(|e| format!("Invalid key: {}", e))?;
///     
///     let mut validation = Validation::new(Algorithm::RS256);
///     validation.set_audience(&["your-client-id"]);
///     
///     let token_data = decode::<JwtClaims>(token, &decoding_key, &validation)
///         .map_err(|e| format!("Invalid token: {}", e))?;
///     
///     Ok(token_data.claims)
/// }
/// ```
pub fn validate_jwt_placeholder(token: &str) -> Result<JwtClaims, String> {
    // PLACEHOLDER: In production, implement proper JWT validation
    // For now, just parse without verification (INSECURE!)
    
    let parts: Vec<&str> = token.split('.').collect();
    if parts.len() != 3 {
        return Err("Invalid JWT format".into());
    }
    
    // Decode base64url payload
    let payload = parts[1];
    let decoded = base64_url_decode(payload)
        .map_err(|e| format!("Failed to decode payload: {}", e))?;
    
    let claims: JwtClaims = serde_json::from_slice(&decoded)
        .map_err(|e| format!("Failed to parse claims: {}", e))?;
    
    // Check expiration
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs() as i64;
    
    if claims.exp < now {
        return Err("Token expired".into());
    }
    
    Ok(claims)
}

/// Example: Authenticated reducer
/// 
/// This shows how to validate a JWT and verify the caller's identity
#[spacetimedb::reducer]
pub fn authenticated_create_vote(
    ctx: &ReducerContext,
    jwt_token: String,
    title: String,
    options: Vec<String>,
) -> Result<(), String> {
    // 1. Validate JWT token
    let claims = validate_jwt_placeholder(&jwt_token)?;
    
    // 2. Derive expected Identity from claims
    let expected_identity = derive_identity_from_claims(&claims.iss, &claims.sub);
    
    // 3. Verify caller matches derived identity
    if ctx.sender != expected_identity {
        return Err("Identity mismatch: JWT claims don't match sender".into());
    }
    
    // 4. User is authenticated - proceed with vote creation
    log::info!(
        "Authenticated vote creation by {} ({})",
        claims.email.as_deref().unwrap_or("unknown"),
        claims.sub
    );
    
    // Call the regular create_vote reducer
    crate::vote::create_vote(ctx, title, options, None, None)
}

/// Base64URL decode helper
fn base64_url_decode(input: &str) -> Result<Vec<u8>, String> {
    use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
    URL_SAFE_NO_PAD
        .decode(input)
        .map_err(|e| format!("Base64 decode error: {}", e))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_derive_identity() {
        let issuer = "https://accounts.google.com";
        let subject = "123456789";
        
        let identity = derive_identity_from_claims(issuer, subject);
        
        // Identity should be deterministic
        let identity2 = derive_identity_from_claims(issuer, subject);
        assert_eq!(identity, identity2);
        
        // Different subject should produce different identity
        let identity3 = derive_identity_from_claims(issuer, "different-user");
        assert_ne!(identity, identity3);
    }
}
