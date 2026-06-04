// Package push — Web Push (RFC 8291 payload encryption + RFC 8292 VAPID), used
// to notify a user when their async agent run finishes even with the tab closed
// (P6.5). Implemented with the Go stdlib + golang.org/x/crypto/hkdf only — no
// new module dependency. The server VAPID keypair is generated once on first
// boot and persisted in app_secrets (shared across pods). If key init fails the
// service is simply disabled and the /tasks page keeps polling — push is purely
// additive, so a crypto failure degrades gracefully rather than breaking runs.
package push

import (
	"bytes"
	"context"
	"crypto/aes"
	"crypto/cipher"
	"crypto/ecdh"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/binary"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"math/big"
	"net/http"
	"net/url"
	"strings"
	"time"

	"github.com/pervagans/backend/internal/auth"
	"github.com/pervagans/backend/internal/db"
	"github.com/go-chi/chi/v5"
	"golang.org/x/crypto/hkdf"
)

// Web Push uses unpadded base64url everywhere (keys, JWT segments, body).
var b64 = base64.RawURLEncoding

type Service struct {
	db      *db.DB
	auth    *auth.Service
	http    *http.Client
	pubB64  string            // VAPID public key (uncompressed P-256 point, base64url)
	priv    *ecdsa.PrivateKey // VAPID signing key
	subject string            // VAPID "sub" claim (mailto:)
}

func New(d *db.DB, a *auth.Service) *Service {
	s := &Service{db: d, auth: a, http: &http.Client{Timeout: 10 * time.Second}, subject: "mailto:admin@pervagans.com"}
	if d != nil {
		if err := s.loadOrCreateKeys(context.Background()); err != nil {
			log.Printf("push: VAPID key init failed (push disabled): %v", err)
		} else {
			log.Printf("push: VAPID ready")
		}
	}
	return s
}

func (s *Service) enabled() bool { return s != nil && s.db != nil && s.priv != nil && s.pubB64 != "" }

// ─── VAPID keypair (generate-once, persisted, race-safe across pods) ─────────

func (s *Service) loadOrCreateKeys(ctx context.Context) error {
	pub, _ := s.getSecret(ctx, "vapid_public")
	privB64, _ := s.getSecret(ctx, "vapid_private")
	if pub == "" || privB64 == "" {
		priv, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
		if err != nil {
			return err
		}
		pub = b64.EncodeToString(elliptic.Marshal(elliptic.P256(), priv.X, priv.Y)) //nolint:staticcheck
		privB64 = b64.EncodeToString(priv.D.Bytes())
		// Two pods booting together: first writer wins, then everyone re-reads.
		s.putSecret(ctx, "vapid_public", pub)
		s.putSecret(ctx, "vapid_private", privB64)
		pub, _ = s.getSecret(ctx, "vapid_public")
		privB64, _ = s.getSecret(ctx, "vapid_private")
	}
	dBytes, err := b64.DecodeString(privB64)
	if err != nil {
		return err
	}
	d := new(big.Int).SetBytes(dBytes)
	priv := new(ecdsa.PrivateKey)
	priv.PublicKey.Curve = elliptic.P256()
	priv.D = d
	priv.PublicKey.X, priv.PublicKey.Y = elliptic.P256().ScalarBaseMult(d.Bytes())
	s.priv = priv
	s.pubB64 = pub
	return nil
}

func (s *Service) getSecret(ctx context.Context, key string) (string, error) {
	var v string
	err := s.db.Pool.QueryRow(ctx, `SELECT value FROM app_secrets WHERE key = $1`, key).Scan(&v)
	return v, err
}

func (s *Service) putSecret(ctx context.Context, key, value string) {
	_, _ = s.db.Pool.Exec(ctx, `INSERT INTO app_secrets (key, value) VALUES ($1, $2) ON CONFLICT (key) DO NOTHING`, key, value)
}

// ─── HTTP ────────────────────────────────────────────────────────────────────

func (s *Service) Register(r chi.Router) {
	if s == nil || s.db == nil || s.auth == nil {
		return
	}
	r.Group(func(gr chi.Router) {
		gr.Use(s.auth.Required)
		gr.Get("/api/push/config", s.handleConfig)
		gr.Post("/api/push/subscribe", s.handleSubscribe)
	})
}

func (s *Service) handleConfig(w http.ResponseWriter, r *http.Request) {
	pk := ""
	if s.enabled() {
		pk = s.pubB64
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]string{"publicKey": pk})
}

type subscribeReq struct {
	Endpoint string `json:"endpoint"`
	Keys     struct {
		P256dh string `json:"p256dh"`
		Auth   string `json:"auth"`
	} `json:"keys"`
}

func (s *Service) handleSubscribe(w http.ResponseWriter, r *http.Request) {
	u := auth.FromContext(r.Context())
	if u == nil {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}
	r.Body = http.MaxBytesReader(w, r.Body, 1<<16)
	var in subscribeReq
	if err := json.NewDecoder(r.Body).Decode(&in); err != nil {
		http.Error(w, "bad json", http.StatusBadRequest)
		return
	}
	if in.Endpoint == "" || in.Keys.P256dh == "" || in.Keys.Auth == "" {
		http.Error(w, "incomplete subscription", http.StatusBadRequest)
		return
	}
	_, err := s.db.Pool.Exec(r.Context(), `
        INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (user_id, endpoint) DO UPDATE SET p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth
    `, u.ID, in.Endpoint, in.Keys.P256dh, in.Keys.Auth)
	if err != nil {
		log.Printf("push: subscribe %v", err)
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

// ─── Send (satisfies the agent's Notifier interface) ─────────────────────────

// Send pushes a notification to every device a user has subscribed. Best-effort
// + fire-and-forget from the caller's perspective; dead subscriptions (404/410)
// are pruned. No-op when push is disabled.
func (s *Service) Send(userID, title, body, urlPath string) {
	if !s.enabled() || userID == "" {
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	rows, err := s.db.Pool.Query(ctx, `SELECT id::text, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1`, userID)
	if err != nil {
		log.Printf("push: list subs %v", err)
		return
	}
	type sub struct{ id, endpoint, p256dh, auth string }
	var subs []sub
	for rows.Next() {
		var x sub
		if rows.Scan(&x.id, &x.endpoint, &x.p256dh, &x.auth) == nil {
			subs = append(subs, x)
		}
	}
	rows.Close()
	payload, _ := json.Marshal(map[string]string{"title": title, "body": body, "url": urlPath})
	for _, sb := range subs {
		if err := s.sendOne(ctx, sb.endpoint, sb.p256dh, sb.auth, payload); err != nil {
			es := err.Error()
			if strings.Contains(es, "410") || strings.Contains(es, "404") {
				_, _ = s.db.Pool.Exec(ctx, `DELETE FROM push_subscriptions WHERE id = $1`, sb.id)
			} else {
				log.Printf("push: send %v", err)
			}
		}
	}
}

func (s *Service) sendOne(ctx context.Context, endpoint, p256dh, authSecret string, payload []byte) error {
	enc, err := s.encrypt(p256dh, authSecret, payload)
	if err != nil {
		return err
	}
	authHdr, err := s.vapidAuth(endpoint)
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, "POST", endpoint, bytes.NewReader(enc))
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", authHdr)
	req.Header.Set("Content-Encoding", "aes128gcm")
	req.Header.Set("Content-Type", "application/octet-stream")
	req.Header.Set("TTL", "86400")
	resp, err := s.http.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	_, _ = io.Copy(io.Discard, resp.Body)
	if resp.StatusCode >= 300 {
		return fmt.Errorf("push status %d", resp.StatusCode)
	}
	return nil
}

// ─── Crypto: RFC 8291 (aes128gcm) + RFC 8292 (VAPID) ─────────────────────────

// encrypt builds the aes128gcm-encrypted Web Push body for one subscription.
func (s *Service) encrypt(p256dhB64, authB64 string, plaintext []byte) ([]byte, error) {
	uaPub, err := b64.DecodeString(p256dhB64)
	if err != nil {
		return nil, err
	}
	authSecret, err := b64.DecodeString(authB64)
	if err != nil {
		return nil, err
	}
	curve := ecdh.P256()
	asPriv, err := curve.GenerateKey(rand.Reader)
	if err != nil {
		return nil, err
	}
	asPub := asPriv.PublicKey().Bytes() // 65-byte uncompressed point
	uaKey, err := curve.NewPublicKey(uaPub)
	if err != nil {
		return nil, err
	}
	shared, err := asPriv.ECDH(uaKey)
	if err != nil {
		return nil, err
	}
	// RFC 8291: IKM = HKDF(salt=auth_secret, ikm=ecdh, info="WebPush: info\0"||ua||as, 32)
	keyInfo := append([]byte("WebPush: info\x00"), uaPub...)
	keyInfo = append(keyInfo, asPub...)
	ikm := hkdfBytes(shared, authSecret, keyInfo, 32)
	// RFC 8188 content keys from a fresh 16-byte salt.
	salt := make([]byte, 16)
	if _, err := rand.Read(salt); err != nil {
		return nil, err
	}
	cek := hkdfBytes(ikm, salt, []byte("Content-Encoding: aes128gcm\x00"), 16)
	nonce := hkdfBytes(ikm, salt, []byte("Content-Encoding: nonce\x00"), 12)
	block, err := aes.NewCipher(cek)
	if err != nil {
		return nil, err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return nil, err
	}
	// Single record: plaintext + 0x02 last-record delimiter (no extra padding).
	rec := append(append([]byte{}, plaintext...), 0x02)
	ct := gcm.Seal(nil, nonce, rec, nil)
	// Header: salt(16) | rs(4, uint32) | idlen(1) | keyid(as_public 65).
	var hdr bytes.Buffer
	hdr.Write(salt)
	rs := make([]byte, 4)
	binary.BigEndian.PutUint32(rs, 4096)
	hdr.Write(rs)
	hdr.WriteByte(byte(len(asPub)))
	hdr.Write(asPub)
	return append(hdr.Bytes(), ct...), nil
}

// hkdfBytes = HKDF-SHA256(salt, ikm, info) read to `length` bytes. Arg order
// mirrors hkdf.New(hash, secret, salt, info).
func hkdfBytes(ikm, salt, info []byte, length int) []byte {
	r := hkdf.New(sha256.New, ikm, salt, info)
	out := make([]byte, length)
	_, _ = io.ReadFull(r, out)
	return out
}

// vapidAuth builds the RFC 8292 "vapid t=<jwt>, k=<pub>" Authorization header.
func (s *Service) vapidAuth(endpoint string) (string, error) {
	u, err := url.Parse(endpoint)
	if err != nil {
		return "", err
	}
	header := b64.EncodeToString([]byte(`{"typ":"JWT","alg":"ES256"}`))
	claims, _ := json.Marshal(map[string]any{
		"aud": u.Scheme + "://" + u.Host,
		"exp": time.Now().Add(12 * time.Hour).Unix(),
		"sub": s.subject,
	})
	signingInput := header + "." + b64.EncodeToString(claims)
	digest := sha256.Sum256([]byte(signingInput))
	r, ss, err := ecdsa.Sign(rand.Reader, s.priv, digest[:])
	if err != nil {
		return "", err
	}
	// JWS ES256 wants the raw r||s (each padded to 32 bytes), NOT ASN.1 DER.
	sig := make([]byte, 64)
	r.FillBytes(sig[:32])
	ss.FillBytes(sig[32:])
	jwt := signingInput + "." + b64.EncodeToString(sig)
	return "vapid t=" + jwt + ", k=" + s.pubB64, nil
}
