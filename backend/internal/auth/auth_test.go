package auth

import (
	"errors"
	"testing"

	"github.com/jackc/pgx/v5/pgconn"
)

// Login() runs bcrypt against a dummy hash when the email lookup
// misses, so attackers can't enumerate registered emails via timing.
// This test confirms the dummy hash exists and is well-formed at
// process startup — full timing-parity testing is integration-level.
func TestDummyBcryptHashInitialised(t *testing.T) {
	if dummyBcryptHash == "" {
		t.Fatal("dummyBcryptHash must be set at init() so the no-user login path can defang the timing oracle")
	}
	if len(dummyBcryptHash) < 50 {
		t.Errorf("dummyBcryptHash looks malformed (len=%d)", len(dummyBcryptHash))
	}
}

func TestLooksLikeEmail(t *testing.T) {
	cases := []struct {
		in   string
		want bool
	}{
		{"foo@example.com", true},
		{"first.last+tag@sub.example.co.uk", true},
		// Missing parts
		{"", false},
		{"foo", false},
		{"foo@", false},
		{"@example.com", false},
		{"foo@example", false}, // no dot after @
		{"foo.@example.com", true},
		// Edge cases
		{"foo@.com", false},        // dot immediately after @
		{"foo@example.", false},    // dot is last char
		{"foo bar@example.com", true}, // we don't enforce no-spaces (DB will if needed)
	}
	for _, c := range cases {
		if got := looksLikeEmail(c.in); got != c.want {
			t.Errorf("looksLikeEmail(%q) = %v, want %v", c.in, got, c.want)
		}
	}
}

func TestHashToken_Deterministic(t *testing.T) {
	// Same input → same hash, different inputs → different hashes.
	h1 := hashToken("a-session-token")
	h2 := hashToken("a-session-token")
	if h1 != h2 {
		t.Errorf("hashToken should be deterministic; got %s vs %s", h1, h2)
	}
	if hashToken("a") == hashToken("b") {
		t.Errorf("different inputs should hash differently")
	}
}

func TestHashToken_FixedLength(t *testing.T) {
	// SHA-256 hex is exactly 64 chars; if we accidentally swap for a
	// shorter hash function this test fails.
	if h := hashToken("any"); len(h) != 64 {
		t.Errorf("hashToken length %d, want 64", len(h))
	}
}

func TestHashToken_OneWay(t *testing.T) {
	// The hash must not equal the input (i.e. we're not accidentally
	// the identity function from a refactor gone wrong).
	const token = "the-actual-token-value"
	if hashToken(token) == token {
		t.Errorf("hashToken returned input verbatim — must be a one-way digest")
	}
}

func TestIsUniqueViolation_PgError(t *testing.T) {
	// The signup path relies on this to convert duplicate-email into a
	// 409. Substring matching on the error TEXT would break under
	// non-English locales; we match the SQLSTATE constant instead.
	pgErr := &pgconn.PgError{Code: "23505", Message: "duplicate key value violates unique constraint"}
	if !isUniqueViolation(pgErr) {
		t.Errorf("expected SQLSTATE 23505 to match")
	}
	other := &pgconn.PgError{Code: "23502"}
	if isUniqueViolation(other) {
		t.Errorf("non-23505 PgError must NOT match")
	}
}

func TestIsUniqueViolation_WrappedError(t *testing.T) {
	// Substring fallback branch — older versions of pgx (or tx-wrapped
	// errors) lose the typed PgError, leaving us with a plain string.
	withDuplicateKey := errors.New("ERROR: duplicate key value violates unique constraint \"users_email_idx\"")
	if !isUniqueViolation(withDuplicateKey) {
		t.Errorf("\"duplicate key\" substring must match")
	}
	withState := errors.New("SQLSTATE 23505: unique violation")
	if !isUniqueViolation(withState) {
		t.Errorf("\"SQLSTATE 23505\" substring must match")
	}
}

func TestIsUniqueViolation_OtherErrors(t *testing.T) {
	// A plain "connection refused" must NOT be mistaken for a duplicate.
	if isUniqueViolation(errors.New("connection refused")) {
		t.Errorf("connection error should not match unique violation")
	}
}
