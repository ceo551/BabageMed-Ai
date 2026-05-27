// Native OS credential bridge (Credential Manager on Windows, libsecret
// on Linux). The web app stores tokens in localStorage for browser
// parity; on desktop we mirror them to the OS credential store so
// nothing sensitive sits in plaintext under the user's profile dir.
//
// Keys are namespaced under "babbage:<key>" so JS can't accidentally
// (or deliberately) overwrite or read keychain entries created by other
// software stored under the same service identifier.

use keyring::Entry;

const SERVICE: &str = "com.babbage.ai.desktop";
const MAX_KEY_LEN: usize = 128;
const MAX_VALUE_LEN: usize = 64 * 1024; // 64 KiB

fn validate_key(key: &str) -> Result<String, String> {
    if key.is_empty() || key.len() > MAX_KEY_LEN {
        return Err("invalid key length".into());
    }
    // Allow only a strict character set: a runaway page can't spam the
    // keychain with binary garbage or hijack reserved Apple keychain
    // entries via newlines / control chars.
    if !key.chars().all(|c| c.is_ascii_alphanumeric() || matches!(c, '_' | '.' | '-' | ':')) {
        return Err("invalid key characters".into());
    }
    Ok(format!("babbage:{key}"))
}

fn entry(key: &str) -> Result<Entry, String> {
    let scoped = validate_key(key)?;
    Entry::new(SERVICE, &scoped).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn secret_set(key: String, value: String) -> Result<(), String> {
    if value.len() > MAX_VALUE_LEN {
        return Err("value too large".into());
    }
    entry(&key)?.set_password(&value).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn secret_get(key: String) -> Result<Option<String>, String> {
    match entry(&key)?.get_password() {
        Ok(v) => Ok(Some(v)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub fn secret_delete(key: String) -> Result<(), String> {
    match entry(&key)?.delete_credential() {
        Ok(_) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}
