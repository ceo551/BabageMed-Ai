// Package mfa — TOTP (RFC 6238) second-factor authentication.
//
// Why roll our own instead of pulling pquerna/otp:
//   - dependency surface stays small (medical-grade product; every dep
//     is one more thing security review has to vet)
//   - TOTP is ~80 lines of stdlib code; not worth a transitive tree
//   - this implementation matches Google Authenticator / 1Password /
//     Authy defaults (SHA1, 6 digits, 30-second period)
//
// Threat model:
//   - secret stored AES-GCM encrypted at rest (see mfa.go)
//   - codes are verified with constant-time comparison
//   - ±1 30-second window of clock drift is accepted (default for
//     every mainstream authenticator app)
//   - replay window: a successful code is recorded so the same code
//     can't be used twice inside its 30-second window — closes the
//     race where an attacker shoulder-surfs the user typing a code and
//     submits it from another tab before it rotates
package mfa

import (
	"crypto/hmac"
	"crypto/sha1"
	"encoding/base32"
	"encoding/binary"
	"fmt"
	"net/url"
	"strconv"
	"strings"
	"time"
)

const (
	// Period is the lifetime of a single TOTP code in seconds (RFC 6238
	// default and the value every authenticator app assumes).
	Period = 30 * time.Second
	// Digits is the length of the generated code. 6 is the universal
	// default; 8 would also be valid but Google Authenticator can't
	// display it without manual configuration.
	Digits = 6
)

// GenerateCode returns the 6-digit TOTP code for the given base32-
// encoded secret at the given Unix time.
func GenerateCode(secretBase32 string, at time.Time) (string, error) {
	secret, err := decodeBase32(secretBase32)
	if err != nil {
		return "", err
	}
	counter := uint64(at.Unix()) / uint64(Period.Seconds())
	return hotpCode(secret, counter), nil
}

// Verify returns true if `code` matches the TOTP for `secret` at `at`,
// allowing ±1 period of clock drift. The comparison is constant-time.
func Verify(secretBase32, code string, at time.Time) bool {
	if len(code) != Digits {
		return false
	}
	secret, err := decodeBase32(secretBase32)
	if err != nil {
		return false
	}
	counter := uint64(at.Unix()) / uint64(Period.Seconds())
	// ±1 window of drift — matches every mainstream authenticator.
	for _, delta := range []int64{0, -1, 1} {
		c := uint64(int64(counter) + delta)
		if hmac.Equal([]byte(hotpCode(secret, c)), []byte(code)) {
			return true
		}
	}
	return false
}

// hotpCode is the HMAC-SHA1 + dynamic-truncation routine from RFC 4226.
// TOTP (RFC 6238) is HOTP with the counter set to floor(now/period).
func hotpCode(secret []byte, counter uint64) string {
	var counterBytes [8]byte
	binary.BigEndian.PutUint64(counterBytes[:], counter)

	mac := hmac.New(sha1.New, secret)
	mac.Write(counterBytes[:])
	sum := mac.Sum(nil)

	// Dynamic truncation per RFC 4226 §5.3.
	offset := sum[len(sum)-1] & 0x0f
	binCode := (uint32(sum[offset]&0x7f) << 24) |
		(uint32(sum[offset+1]) << 16) |
		(uint32(sum[offset+2]) << 8) |
		uint32(sum[offset+3])

	mod := uint32(1)
	for i := 0; i < Digits; i++ {
		mod *= 10
	}
	code := binCode % mod
	return fmt.Sprintf("%0*d", Digits, code)
}

// decodeBase32 accepts the relaxed base32 most authenticator apps emit
// (no padding, lowercase tolerated). Returns the raw secret bytes.
func decodeBase32(s string) ([]byte, error) {
	s = strings.ToUpper(strings.ReplaceAll(s, " ", ""))
	// Pad to a multiple of 8 for stdlib's strict decoder.
	for len(s)%8 != 0 {
		s += "="
	}
	return base32.StdEncoding.DecodeString(s)
}

// EncodeSecretBase32 wraps the raw secret bytes for display in an
// authenticator app or for storage in the otpauth:// URI.
func EncodeSecretBase32(secret []byte) string {
	return strings.TrimRight(base32.StdEncoding.EncodeToString(secret), "=")
}

// OtpauthURI builds the standard otpauth:// URL that authenticator
// apps consume from a QR code. issuer is rendered in the app's account
// list; accountName is usually the user's email.
func OtpauthURI(issuer, accountName, secretBase32 string) string {
	label := url.PathEscape(issuer) + ":" + url.PathEscape(accountName)
	q := url.Values{}
	q.Set("secret", secretBase32)
	q.Set("issuer", issuer)
	q.Set("algorithm", "SHA1")
	q.Set("digits", strconv.Itoa(Digits))
	q.Set("period", strconv.Itoa(int(Period.Seconds())))
	return "otpauth://totp/" + label + "?" + q.Encode()
}
