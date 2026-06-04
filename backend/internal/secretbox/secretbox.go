// Package secretbox provides authenticated symmetric encryption for small
// secrets (per-user connector credentials) stored at rest. It is deliberately
// opportunistic: if no key is configured the value passes through unchanged,
// and Decrypt transparently returns legacy plaintext (values without the
// "enc:v1:" tag) — so enabling, rotating, or losing the key never corrupts or
// hard-fails on existing rows.
package secretbox

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"io"
	"os"
	"strings"
)

const prefix = "enc:v1:"

type Box struct {
	gcm cipher.AEAD // nil when no usable key was configured
}

// New builds a Box from CONNECTOR_ENCRYPTION_KEY, falling back to
// MFA_ENCRYPTION_KEY (always present in the deployment — the chart auto-
// generates and pins it). The value is base64 of a 16/24/32-byte AES key. If
// it is absent or invalid the Box is disabled and Encrypt becomes a no-op
// passthrough, so connectors keep working without encryption.
func New() *Box {
	for _, env := range []string{"CONNECTOR_ENCRYPTION_KEY", "MFA_ENCRYPTION_KEY"} {
		v := strings.TrimSpace(os.Getenv(env))
		if v == "" {
			continue
		}
		key, err := base64.StdEncoding.DecodeString(v)
		if err != nil || (len(key) != 16 && len(key) != 24 && len(key) != 32) {
			continue
		}
		block, err := aes.NewCipher(key)
		if err != nil {
			continue
		}
		gcm, err := cipher.NewGCM(block)
		if err != nil {
			continue
		}
		return &Box{gcm: gcm}
	}
	return &Box{}
}

// Enabled reports whether a usable key was configured.
func (b *Box) Enabled() bool { return b != nil && b.gcm != nil }

// Encrypt returns an "enc:v1:"-tagged base64 ciphertext, or the plaintext
// unchanged when no key is configured (so the caller still stores a usable
// value). Empty input is returned as-is.
func (b *Box) Encrypt(plain string) string {
	if !b.Enabled() || plain == "" {
		return plain
	}
	nonce := make([]byte, b.gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return plain // fail open to plaintext rather than dropping the secret
	}
	ct := b.gcm.Seal(nonce, nonce, []byte(plain), nil)
	return prefix + base64.StdEncoding.EncodeToString(ct)
}

// Decrypt reverses Encrypt. Values without the "enc:v1:" tag are treated as
// legacy plaintext and returned unchanged. A tagged value that can't be opened
// (wrong/absent key, tamper) returns "" rather than leaking the raw blob.
func (b *Box) Decrypt(stored string) string {
	if !strings.HasPrefix(stored, prefix) {
		return stored
	}
	if !b.Enabled() {
		return ""
	}
	raw, err := base64.StdEncoding.DecodeString(stored[len(prefix):])
	if err != nil || len(raw) < b.gcm.NonceSize() {
		return ""
	}
	nonce, ct := raw[:b.gcm.NonceSize()], raw[b.gcm.NonceSize():]
	pt, err := b.gcm.Open(nil, nonce, ct, nil)
	if err != nil {
		return ""
	}
	return string(pt)
}
