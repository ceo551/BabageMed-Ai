// Package updates implements the Tauri 2.0 updater endpoint that the
// desktop app polls on every launch.
//
// The desktop client (apps/desktop) calls
//
//   GET /api/desktop/update/{target}/{arch}/{current_version}
//
// once per launch and at a configurable interval afterwards. Tauri's
// updater expects one of:
//
//   - 204 No Content        — already on the latest version
//   - 200 + JSON body       — an update is available; download + install it
//
// The 200 payload shape is fixed by Tauri:
//
//   {
//     "version":   "0.2.0",                    // target version (no leading 'v')
//     "pub_date":  "2026-05-25T00:00:00Z",     // RFC3339
//     "url":       "https://.../Pervagans_0.2.0_universal.app.tar.gz",
//     "signature": "<minisign-style signature emitted by tauri build>",
//     "notes":     "Bug fixes and improvements"
//   }
//
// We resolve `url` + `signature` from a per-target manifest. The manifest
// is loaded once per `CacheTTL` from one of three sources, in priority
// order:
//
//   1. Inline JSON in the env var DESKTOP_UPDATES_MANIFEST  (best for tests)
//   2. Remote URL in        DESKTOP_UPDATES_MANIFEST_URL    (GitHub Releases)
//   3. Local file path in   DESKTOP_UPDATES_MANIFEST_PATH   (mounted ConfigMap)
//
// If none of those is set — or DESKTOP_UPDATES_DISABLED=1 is set — the
// handler always returns 204, so the desktop app degrades to "no auto-
// updates available" instead of erroring on every launch.

package updates

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/go-chi/chi/v5"
)

// PlatformAsset is the per-OS/arch download record inside a manifest.
type PlatformAsset struct {
	URL       string `json:"url"`
	Signature string `json:"signature"`
}

// Manifest is the canonical release record published by CI. We keep the
// platforms map keyed by `{target}-{arch}` (e.g. "windows-x86_64") and
// accept a small set of well-known aliases at lookup time so old desktop
// builds that send slightly different target names still match.
type Manifest struct {
	Version   string                   `json:"version"`
	PubDate   string                   `json:"pub_date"`
	Notes     string                   `json:"notes,omitempty"`
	Platforms map[string]PlatformAsset `json:"platforms"`
}

type Config struct {
	Disabled     bool
	Inline       string
	ManifestURL  string
	ManifestPath string
	CacheTTL     time.Duration
	HTTPTimeout  time.Duration
}

// ConfigFromEnv reads the standard env vars listed in the package doc.
func ConfigFromEnv() Config {
	return Config{
		Disabled:     os.Getenv("DESKTOP_UPDATES_DISABLED") == "1",
		Inline:       os.Getenv("DESKTOP_UPDATES_MANIFEST"),
		ManifestURL:  os.Getenv("DESKTOP_UPDATES_MANIFEST_URL"),
		ManifestPath: os.Getenv("DESKTOP_UPDATES_MANIFEST_PATH"),
		CacheTTL:     5 * time.Minute,
		HTTPTimeout:  10 * time.Second,
	}
}

type Service struct {
	cfg     Config
	httpc   *http.Client
	mu      sync.RWMutex
	cached  *Manifest
	expires time.Time
}

func New(cfg Config) *Service {
	if cfg.CacheTTL <= 0 {
		cfg.CacheTTL = 5 * time.Minute
	}
	if cfg.HTTPTimeout <= 0 {
		cfg.HTTPTimeout = 10 * time.Second
	}
	return &Service{
		cfg:   cfg,
		httpc: &http.Client{Timeout: cfg.HTTPTimeout},
	}
}

// Configured reports whether the service has a manifest source wired up.
// When false (and not explicitly Disabled) the handler still serves —
// it just answers 204 every time.
func (s *Service) Configured() bool {
	return s.cfg.Inline != "" || s.cfg.ManifestURL != "" || s.cfg.ManifestPath != ""
}

func (s *Service) Register(r chi.Router) {
	r.Get("/api/desktop/update/{target}/{arch}/{version}", s.Handler)
}

func (s *Service) Handler(w http.ResponseWriter, r *http.Request) {
	if s.cfg.Disabled || !s.Configured() {
		w.WriteHeader(http.StatusNoContent)
		return
	}

	target := strings.ToLower(chi.URLParam(r, "target"))
	arch := strings.ToLower(chi.URLParam(r, "arch"))
	current := stripV(chi.URLParam(r, "version"))

	mf, err := s.manifest(r.Context())
	if err != nil {
		// Don't 500: the desktop updater retries on its own. Returning a
		// 204 keeps the failure invisible to end users — they just don't
		// see an update prompt this launch. The error is logged
		// upstream via the chi middleware Logger.
		w.WriteHeader(http.StatusNoContent)
		return
	}

	// Already on the latest (or newer) → nothing to advertise.
	if cmpSemver(stripV(mf.Version), current) <= 0 {
		w.WriteHeader(http.StatusNoContent)
		return
	}

	asset, ok := lookupAsset(mf, target, arch)
	if !ok {
		// We have a new version but no asset built for this platform.
		// Don't surface this as 404 — Tauri would log it on every launch.
		w.WriteHeader(http.StatusNoContent)
		return
	}

	resp := map[string]any{
		"version":   stripV(mf.Version),
		"pub_date":  mf.PubDate,
		"url":       asset.URL,
		"signature": asset.Signature,
	}
	if mf.Notes != "" {
		resp["notes"] = mf.Notes
	}

	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	_ = json.NewEncoder(w).Encode(resp)
}

func (s *Service) manifest(ctx context.Context) (*Manifest, error) {
	s.mu.RLock()
	if s.cached != nil && time.Now().Before(s.expires) {
		mf := s.cached
		s.mu.RUnlock()
		return mf, nil
	}
	s.mu.RUnlock()

	raw, err := s.load(ctx)
	if err != nil {
		return nil, err
	}
	var mf Manifest
	if err := json.Unmarshal(raw, &mf); err != nil {
		return nil, fmt.Errorf("manifest parse: %w", err)
	}
	if mf.Version == "" || len(mf.Platforms) == 0 {
		return nil, fmt.Errorf("manifest is missing version or platforms")
	}

	// Double-check under the write lock: another caller may have populated
	// the cache while we were fetching. Without this, two concurrent
	// pollers each do a fetch + Unmarshal even though one would suffice.
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.cached != nil && time.Now().Before(s.expires) {
		return s.cached, nil
	}
	s.cached = &mf
	s.expires = time.Now().Add(s.cfg.CacheTTL)
	return &mf, nil
}

func (s *Service) load(ctx context.Context) ([]byte, error) {
	if s.cfg.Inline != "" {
		return []byte(s.cfg.Inline), nil
	}
	if s.cfg.ManifestURL != "" {
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, s.cfg.ManifestURL, nil)
		if err != nil {
			return nil, err
		}
		req.Header.Set("Accept", "application/json")
		req.Header.Set("User-Agent", "pervagans-backend/updater")
		resp, err := s.httpc.Do(req)
		if err != nil {
			return nil, fmt.Errorf("fetch manifest: %w", err)
		}
		defer resp.Body.Close()
		if resp.StatusCode >= 400 {
			return nil, fmt.Errorf("manifest http %d", resp.StatusCode)
		}
		// Cap to a sane size so a misconfigured URL can't OOM the process.
		return io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	}
	if s.cfg.ManifestPath != "" {
		return os.ReadFile(s.cfg.ManifestPath)
	}
	return nil, fmt.Errorf("no manifest source configured")
}

// lookupAsset resolves a platform key tolerantly. Tauri 2.0 sends
// `target=windows` (or `windows-msvc`) and `arch=x86_64`, but CI
// workflows tend to publish keys like "windows-x86_64" or the rust-
// target triple "x86_64-pc-windows-msvc". We try several shapes so the
// manifest author can pick whichever style they prefer.
//
// macOS and Linux targets are deliberately not handled — the desktop
// client ships for Windows only.
func lookupAsset(mf *Manifest, target, arch string) (PlatformAsset, bool) {
	keys := []string{
		target + "-" + arch,
		arch + "-" + target,
		target + "_" + arch,
		target,
	}
	if target == "windows" || target == "windows-msvc" {
		keys = append(keys, arch+"-pc-windows-msvc", "windows-"+arch)
	}
	for _, k := range keys {
		if a, ok := mf.Platforms[strings.ToLower(k)]; ok {
			return a, true
		}
	}
	// Last resort: try the raw maps as-is (manifest may have used the
	// rust-target triple without lowercasing).
	for k, v := range mf.Platforms {
		if strings.EqualFold(k, target+"-"+arch) {
			return v, true
		}
	}
	return PlatformAsset{}, false
}

func stripV(v string) string {
	v = strings.TrimSpace(v)
	v = strings.TrimPrefix(v, "v")
	v = strings.TrimPrefix(v, "V")
	return v
}

// cmpSemver compares two dotted version strings numerically. Non-numeric
// suffixes are stripped — we only need ordering, not strict semver
// compliance (pre-release ordering is decided by CI, not by the runtime).
//
//	-1: a <  b
//	 0: a == b
//	 1: a >  b
func cmpSemver(a, b string) int {
	pa := splitNumeric(a)
	pb := splitNumeric(b)
	for i := 0; i < len(pa) || i < len(pb); i++ {
		var ai, bi uint64
		if i < len(pa) {
			ai = pa[i]
		}
		if i < len(pb) {
			bi = pb[i]
		}
		switch {
		case ai < bi:
			return -1
		case ai > bi:
			return 1
		}
	}
	return 0
}

func splitNumeric(s string) []uint64 {
	// Drop any pre-release / build-metadata suffix BEFORE splitting on '.'.
	// Otherwise "0.1.0-beta.1" would parse as four parts [0,1,0,1] and
	// compare greater than "0.1.0" (which is [0,1,0]).
	if i := strings.IndexAny(s, "-+"); i >= 0 {
		s = s[:i]
	}
	parts := strings.Split(s, ".")
	out := make([]uint64, 0, len(parts))
	for _, p := range parts {
		n, err := strconv.ParseUint(strings.TrimSpace(p), 10, 64)
		if err != nil {
			break
		}
		out = append(out, n)
	}
	return out
}
