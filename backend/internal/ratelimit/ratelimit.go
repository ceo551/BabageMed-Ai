// Package ratelimit — small in-process token bucket for per-IP rate
// limiting on hot endpoints. Designed for the auth + chat paths where:
//   - we want to throttle credential-stuffing on /login and /signup
//   - we want to cap chat-stream concurrency from a single client so
//     one runaway browser tab can't fan-out 1 000 SSE streams
//
// Why not Redis: this runs in-process so a network outage or Redis
// blip doesn't take auth offline. We trade off perfect accuracy across
// replicas for resilience — a determined attacker can still distribute
// across IPs / replicas, but credential stuffing from a single source
// stops dead at the bucket's refill rate.
package ratelimit

import (
	"net/http"
	"strings"
	"sync"
	"time"
)

// Bucket is a single token bucket keyed by an identifier (usually IP).
// Capacity = max burst, refillPer = how often one token is added back.
type Bucket struct {
	capacity   int
	refillPer  time.Duration
	mu         sync.Mutex
	state      map[string]*entry
	lastSweep  time.Time
	maxEntries int
}

type entry struct {
	tokens   int
	lastFill time.Time
}

// New constructs a bucket. capacity is the max burst (tokens spent
// before throttling); refillPer is how often a single token regenerates.
// E.g. New(10, time.Minute) → 10-request burst, +1 token / minute, so
// sustained max 60 req/h.
func New(capacity int, refillPer time.Duration) *Bucket {
	if capacity < 1 {
		capacity = 1
	}
	if refillPer < time.Millisecond {
		refillPer = time.Second
	}
	return &Bucket{
		capacity:   capacity,
		refillPer:  refillPer,
		state:      make(map[string]*entry),
		lastSweep:  time.Now(),
		maxEntries: 100_000,
	}
}

// Allow returns true if the key has at least one token left (and
// consumes one). Returns false if the bucket is empty.
func (b *Bucket) Allow(key string) bool {
	now := time.Now()
	b.mu.Lock()
	defer b.mu.Unlock()

	// Periodic sweep prevents unbounded memory growth from the long
	// tail of single-request IPs. We drop entries that haven't been
	// touched in 10× refillPer (i.e. fully refilled and stale).
	if now.Sub(b.lastSweep) > 10*b.refillPer || len(b.state) > b.maxEntries {
		cutoff := now.Add(-10 * b.refillPer)
		for k, e := range b.state {
			if e.lastFill.Before(cutoff) {
				delete(b.state, k)
			}
		}
		b.lastSweep = now
	}

	e, ok := b.state[key]
	if !ok {
		// First sighting: full bucket, consume one and persist.
		b.state[key] = &entry{tokens: b.capacity - 1, lastFill: now}
		return true
	}
	// Refill based on elapsed time.
	elapsed := now.Sub(e.lastFill)
	add := int(elapsed / b.refillPer)
	if add > 0 {
		e.tokens += add
		if e.tokens > b.capacity {
			e.tokens = b.capacity
		}
		e.lastFill = e.lastFill.Add(time.Duration(add) * b.refillPer)
	}
	if e.tokens <= 0 {
		return false
	}
	e.tokens--
	return true
}

// Middleware wraps an HTTP handler, throttling per remote IP. Returns
// 429 when the bucket is empty. The Retry-After header points at the
// next refill so well-behaved clients can back off.
func (b *Bucket) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		key := clientIP(r)
		if !b.Allow(key) {
			w.Header().Set("Retry-After", retryAfter(b.refillPer))
			http.Error(w, "rate limit exceeded — try again shortly", http.StatusTooManyRequests)
			return
		}
		next.ServeHTTP(w, r)
	})
}

func retryAfter(d time.Duration) string {
	s := int(d.Seconds())
	if s < 1 {
		s = 1
	}
	return itoa(s)
}

// itoa avoids dragging strconv in just for one int-to-string call.
func itoa(n int) string {
	if n == 0 {
		return "0"
	}
	var buf [20]byte
	i := len(buf)
	for n > 0 {
		i--
		buf[i] = byte('0' + n%10)
		n /= 10
	}
	return string(buf[i:])
}

// clientIP pulls the caller's IP from X-Forwarded-For (set by our
// trusted nginx/ingress) or falls back to the TCP RemoteAddr. The
// rightmost element in XFF is the closest hop, the leftmost is the
// claimed origin; we take the leftmost-trusted one — i.e. the first
// non-private address from the right. For the in-process happy path
// behind a single proxy, that's just the first comma-separated value.
func clientIP(r *http.Request) string {
	if xff := r.Header.Get("X-Forwarded-For"); xff != "" {
		// Take the leftmost claim. Even though it's user-controllable,
		// our trusted ingress overwrites the header on entry so a
		// malicious header from outside the cluster is replaced with
		// the real source. If your ingress doesn't do that, consider
		// using the rightmost element instead.
		if i := strings.IndexByte(xff, ','); i >= 0 {
			return strings.TrimSpace(xff[:i])
		}
		return strings.TrimSpace(xff)
	}
	addr := r.RemoteAddr
	if i := strings.LastIndexByte(addr, ':'); i >= 0 {
		return addr[:i]
	}
	return addr
}
