// Utilities and helpers shared across module reducers

/// Normalize a human-entered label/title by trimming whitespace and validating basic constraints.
/// Returns an error if the string is empty after trimming or exceeds length limits.
pub fn normalize_label(s: &str) -> Result<String, String> {
    let t = s.trim();
    if t.is_empty() {
        return Err("Empty strings are not allowed".into());
    }
    if t.len() > 200 {
        return Err("String too long (max 200 chars)".into());
    }
    Ok(t.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn normalize_trims_and_accepts_ok_length() {
        let s = "  Hello  ";
        assert_eq!(normalize_label(s).unwrap(), "Hello");
    }

    #[test]
    fn normalize_rejects_empty() {
        assert!(normalize_label("   ").is_err());
    }

    #[test]
    fn normalize_rejects_too_long() {
        let s = "x".repeat(201);
        assert!(normalize_label(&s).is_err());
    }
}
