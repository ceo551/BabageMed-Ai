// Package cache — thin Redis client used to memoise expensive MCP search
// calls (and anything else we want to TTL). Falls open silently when
// REDIS_URL is unset, so the rest of the codebase doesn't need to special-
// case "is Redis configured" — every method becomes a no-op cache miss.
package cache

import (
	"context"
	"encoding/json"
	"os"
	"time"

	"github.com/redis/go-redis/v9"
)

type Cache struct {
	rdb *redis.Client
}

// New returns a Cache backed by Redis when REDIS_URL is set, otherwise a
// no-op cache. Accepts the standard go-redis URL form
// (redis://[user:pass@]host:port[/db]).
func New() *Cache {
	url := os.Getenv("REDIS_URL")
	if url == "" {
		return &Cache{}
	}
	opt, err := redis.ParseURL(url)
	if err != nil {
		return &Cache{}
	}
	opt.DialTimeout = 2 * time.Second
	opt.ReadTimeout = 2 * time.Second
	opt.WriteTimeout = 2 * time.Second
	return &Cache{rdb: redis.NewClient(opt)}
}

// Enabled reports whether the cache will actually hit Redis. Useful for
// logging and metrics but never required to call before Get/Set.
func (c *Cache) Enabled() bool { return c != nil && c.rdb != nil }

// GetJSON unmarshals the cached value at `key` into `dst`. Returns false on
// any miss / error — callers should fall through to recompute.
func (c *Cache) GetJSON(ctx context.Context, key string, dst any) bool {
	if !c.Enabled() {
		return false
	}
	raw, err := c.rdb.Get(ctx, key).Bytes()
	if err != nil {
		return false
	}
	return json.Unmarshal(raw, dst) == nil
}

// SetJSON encodes `v` and stores it at `key` with the given TTL. Best-
// effort — errors are swallowed because cache writes should never fail a
// user-facing request.
func (c *Cache) SetJSON(ctx context.Context, key string, v any, ttl time.Duration) {
	if !c.Enabled() {
		return
	}
	raw, err := json.Marshal(v)
	if err != nil {
		return
	}
	_ = c.rdb.Set(ctx, key, raw, ttl).Err()
}
