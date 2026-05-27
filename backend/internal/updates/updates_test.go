package updates

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/go-chi/chi/v5"
)

func TestSemverCompare(t *testing.T) {
	cases := []struct {
		a, b string
		want int
	}{
		{"0.1.0", "0.1.0", 0},
		{"0.1.0", "0.1.1", -1},
		{"0.2.0", "0.1.9", 1},
		{"1.0.0", "0.99.99", 1},
		{"v0.1.0", "0.1.0", 0},
		{"0.1.0-beta.1", "0.1.0", 0}, // pre-release suffix stripped — caller decides ordering
		{"0.10.0", "0.9.9", 1},       // numeric, not lexical
	}
	for _, c := range cases {
		got := cmpSemver(stripV(c.a), stripV(c.b))
		if got != c.want {
			t.Errorf("cmpSemver(%q, %q) = %d, want %d", c.a, c.b, got, c.want)
		}
	}
}

func TestHandler_NoManifestReturns204(t *testing.T) {
	svc := New(Config{})
	r := chi.NewRouter()
	svc.Register(r)
	req := httptest.NewRequest("GET", "/api/desktop/update/windows/x86_64/0.1.0", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusNoContent {
		t.Errorf("no-manifest: got %d, want 204", w.Code)
	}
}

func TestHandler_NewerVersionReturnsJSON(t *testing.T) {
	manifest := Manifest{
		Version: "0.2.0",
		PubDate: "2026-05-25T00:00:00Z",
		Notes:   "rev",
		Platforms: map[string]PlatformAsset{
			"windows-x86_64": {URL: "https://example.com/m1.app.tar.gz", Signature: "sig1"},
		},
	}
	raw, _ := json.Marshal(manifest)
	svc := New(Config{Inline: string(raw)})
	r := chi.NewRouter()
	svc.Register(r)
	req := httptest.NewRequest("GET", "/api/desktop/update/windows/x86_64/0.1.0", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("got %d, want 200", w.Code)
	}
	var resp map[string]any
	if err := json.Unmarshal(w.Body.Bytes(), &resp); err != nil {
		t.Fatalf("response not json: %v", err)
	}
	if resp["version"] != "0.2.0" {
		t.Errorf("version = %v", resp["version"])
	}
	if resp["url"] != "https://example.com/m1.app.tar.gz" {
		t.Errorf("url = %v", resp["url"])
	}
}

func TestHandler_UpToDateReturns204(t *testing.T) {
	manifest := Manifest{
		Version: "0.1.0",
		Platforms: map[string]PlatformAsset{
			"windows-x86_64": {URL: "x", Signature: "y"},
		},
	}
	raw, _ := json.Marshal(manifest)
	svc := New(Config{Inline: string(raw)})
	r := chi.NewRouter()
	svc.Register(r)
	req := httptest.NewRequest("GET", "/api/desktop/update/windows/x86_64/0.1.0", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusNoContent {
		t.Errorf("up-to-date: got %d, want 204", w.Code)
	}
}

func TestHandler_RemoteManifestCached(t *testing.T) {
	calls := 0
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		calls++
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write([]byte(`{
			"version": "0.5.0",
			"pub_date": "2026-05-25T00:00:00Z",
			"platforms": {"windows-x86_64": {"url": "https://x", "signature": "s"}}
		}`))
	}))
	defer srv.Close()

	svc := New(Config{ManifestURL: srv.URL})
	r := chi.NewRouter()
	svc.Register(r)
	for i := 0; i < 3; i++ {
		req := httptest.NewRequest("GET", "/api/desktop/update/windows/x86_64/0.1.0", nil)
		w := httptest.NewRecorder()
		r.ServeHTTP(w, req)
		if w.Code != http.StatusOK {
			t.Fatalf("got %d", w.Code)
		}
	}
	if calls != 1 {
		t.Errorf("expected 1 upstream fetch, got %d", calls)
	}
}

func TestHandler_AliasLookup(t *testing.T) {
	// Manifest uses the rust-target-triple flavour; desktop sends the
	// vanilla "windows"/"x86_64" pair. The lookup should still match.
	raw := `{
		"version": "0.3.0",
		"pub_date": "2026-05-25T00:00:00Z",
		"platforms": {
			"x86_64-pc-windows-msvc": {"url": "https://w", "signature": "ws"}
		}
	}`
	svc := New(Config{Inline: raw})
	r := chi.NewRouter()
	svc.Register(r)
	req := httptest.NewRequest("GET", "/api/desktop/update/windows/x86_64/0.1.0", nil)
	w := httptest.NewRecorder()
	r.ServeHTTP(w, req)
	if w.Code != http.StatusOK {
		t.Fatalf("got %d (body=%s)", w.Code, w.Body.String())
	}
}
