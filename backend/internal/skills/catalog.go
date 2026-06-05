// Package skills is the curated catalog of reusable assistant capabilities,
// adapted from the open-source davila7/claude-code-templates collection plus a
// few Pervagans-authored entries. Each skill is a markdown file (frontmatter
// name+description + a guidance body) embedded at build time; catalog_entries.go
// (generated) defines membership, display category, and which feature workspaces
// auto-enable it.
//
// Two consumers:
//   - HTTP: GET /api/skills (metadata list) + GET /api/skills/{id} (with body)
//     power the in-app skill picker.
//   - Library: Resolve(ids) returns injection-ready bodies for the chat system
//     prompt builder; DefaultsForFeature(slug) seeds a feature's default skills.
package skills

import (
	"embed"
	"encoding/json"
	"net/http"
	"strings"
	"sync"
	"unicode/utf8"

	"github.com/go-chi/chi/v5"
)

//go:embed data/*.md
var dataFS embed.FS

// entry is one catalog membership record (defined in catalog_entries.go).
type entry struct {
	id       string
	category string
	features []string // feature slugs that auto-enable this skill
}

// Skill is the public shape. Content carries the guidance body and is omitted
// from the list endpoint (json:"-") — it ships only via Resolve and the
// per-skill detail endpoint.
type Skill struct {
	ID          string   `json:"id"`
	Name        string   `json:"name"`
	Description string   `json:"description"`
	Category    string   `json:"category"`
	Features    []string `json:"features"`
	Content     string   `json:"-"`
}

const (
	// Per-skill cap applied at injection time so one verbose skill can't
	// dominate the system prompt. The full body is still available via the
	// detail endpoint for the picker's "view".
	injectPerSkillCap = 1600
	descCap           = 280
)

var (
	once           sync.Once
	ordered        []Skill             // catalog display order
	byID           map[string]*Skill   // id -> skill
	defaultsByFeat map[string][]string // feature slug -> default skill ids
)

func ensure() { once.Do(load) }

func load() {
	byID = make(map[string]*Skill)
	defaultsByFeat = make(map[string][]string)
	ordered = make([]Skill, 0, len(catalogEntries))
	for _, e := range catalogEntries {
		raw, err := dataFS.ReadFile("data/" + e.id + ".md")
		if err != nil {
			// A catalog entry without a backing file is a curation bug; skip it
			// so the server still boots (the skill is simply absent).
			continue
		}
		name, desc, body := parseFrontmatter(string(raw))
		if name == "" {
			name = e.id
		}
		ordered = append(ordered, Skill{
			ID: e.id, Name: name, Description: desc,
			Category: e.category, Features: e.features, Content: body,
		})
	}
	for i := range ordered {
		sk := &ordered[i]
		byID[sk.ID] = sk
		for _, f := range sk.Features {
			defaultsByFeat[f] = append(defaultsByFeat[f], sk.ID)
		}
	}
}

// ─── library API (used by the chat builder + features package) ───────────────

// Resolve returns catalog skills for the given ids (known ids only, de-duped,
// in input order), each with its body capped for prompt injection. Unknown ids
// are silently dropped — the caller decides how to treat free-text labels.
func Resolve(ids []string) []Skill {
	ensure()
	out := make([]Skill, 0, len(ids))
	seen := make(map[string]bool, len(ids))
	for _, id := range ids {
		id = strings.TrimSpace(id)
		if id == "" || seen[id] {
			continue
		}
		sk, ok := byID[id]
		if !ok {
			continue
		}
		seen[id] = true
		cp := *sk
		cp.Content = capStr(cp.Content, injectPerSkillCap)
		out = append(out, cp)
	}
	return out
}

// DefaultsForFeature returns the skill ids auto-enabled for a feature slug.
func DefaultsForFeature(slug string) []string {
	ensure()
	src := defaultsByFeat[slug]
	out := make([]string, len(src))
	copy(out, src)
	return out
}

// Known reports whether id is a catalog skill (vs a legacy free-text label).
func Known(id string) bool {
	ensure()
	_, ok := byID[strings.TrimSpace(id)]
	return ok
}

// ─── HTTP ────────────────────────────────────────────────────────────────────

type Service struct{}

// New builds the catalog (idempotent) and returns the HTTP service.
func New() *Service { ensure(); return &Service{} }

// Register wires the read-only catalog endpoints. No auth: the catalog is
// public product metadata (no per-user data), like a marketing page.
func (s *Service) Register(r chi.Router) {
	r.Get("/api/skills", s.handleList)
	r.Get("/api/skills/{id}", s.handleGet)
}

func (s *Service) handleList(w http.ResponseWriter, r *http.Request) {
	ensure()
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "public, max-age=300")
	_ = json.NewEncoder(w).Encode(ordered) // Content is json:"-"
}

func (s *Service) handleGet(w http.ResponseWriter, r *http.Request) {
	ensure()
	sk, ok := byID[strings.TrimSpace(chi.URLParam(r, "id"))]
	if !ok {
		http.Error(w, "not found", http.StatusNotFound)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "public, max-age=300")
	_ = json.NewEncoder(w).Encode(struct {
		ID          string   `json:"id"`
		Name        string   `json:"name"`
		Description string   `json:"description"`
		Category    string   `json:"category"`
		Features    []string `json:"features"`
		Content     string   `json:"content"`
	}{sk.ID, sk.Name, sk.Description, sk.Category, sk.Features, sk.Content})
}

// ─── frontmatter parsing ─────────────────────────────────────────────────────

// parseFrontmatter pulls name + description out of a leading `---`-fenced YAML
// block and returns the remaining body. It is deliberately tolerant (no YAML
// dependency): it handles single-line values, quoted values, and block scalars
// (`description: |` / `>`), which is the full range the source files use.
func parseFrontmatter(s string) (name, desc, body string) {
	s = strings.ReplaceAll(s, "\r\n", "\n")
	if !strings.HasPrefix(s, "---\n") {
		return "", "", strings.TrimSpace(s)
	}
	rest := s[4:]
	idx := strings.Index(rest, "\n---")
	if idx < 0 {
		return "", "", strings.TrimSpace(s)
	}
	fm := rest[:idx]
	body = rest[idx+4:] // skip "\n---"
	// Drop the remainder of the closing fence line + leading blank lines.
	if nl := strings.IndexByte(body, '\n'); nl >= 0 {
		body = body[nl+1:]
	} else {
		body = ""
	}
	body = strings.TrimSpace(body)

	lines := strings.Split(fm, "\n")
	for i := 0; i < len(lines); i++ {
		key, val, ok := splitKey(lines[i])
		if !ok {
			continue
		}
		switch key {
		case "name":
			name = cleanScalar(val)
		case "description":
			if isBlockScalar(val) || strings.TrimSpace(val) == "" {
				var parts []string
				for j := i + 1; j < len(lines); j++ {
					if strings.TrimSpace(lines[j]) == "" {
						continue
					}
					// A non-indented line starts the next key — stop.
					if lines[j][0] != ' ' && lines[j][0] != '\t' {
						break
					}
					parts = append(parts, strings.TrimSpace(lines[j]))
				}
				desc = cleanScalar(strings.Join(parts, " "))
			} else {
				desc = cleanScalar(val)
			}
		}
	}
	return name, capStr(desc, descCap), body
}

// splitKey returns (key, value) when line is a top-level `key: value` (no
// leading indentation — indented lines are block-scalar continuations).
func splitKey(line string) (key, val string, ok bool) {
	if line == "" || line[0] == ' ' || line[0] == '\t' || line[0] == '#' {
		return "", "", false
	}
	c := strings.IndexByte(line, ':')
	if c <= 0 {
		return "", "", false
	}
	key = strings.TrimSpace(line[:c])
	// Keys are simple identifiers; anything with a space before the colon is
	// prose, not a key.
	if strings.ContainsAny(key, " \t") {
		return "", "", false
	}
	return key, strings.TrimSpace(line[c+1:]), true
}

func isBlockScalar(v string) bool {
	switch strings.TrimSpace(v) {
	case "|", ">", "|-", ">-", "|+", ">+":
		return true
	}
	return false
}

// cleanScalar trims surrounding quotes and collapses internal whitespace.
func cleanScalar(v string) string {
	v = strings.TrimSpace(v)
	v = strings.TrimLeft(v, "|>")
	v = strings.TrimSpace(v)
	if len(v) >= 2 {
		if (v[0] == '"' && v[len(v)-1] == '"') || (v[0] == '\'' && v[len(v)-1] == '\'') {
			v = v[1 : len(v)-1]
		}
	}
	return strings.Join(strings.Fields(v), " ")
}

// capStr truncates to at most n bytes, trimming any partial trailing rune and
// trailing whitespace so the result is always valid UTF-8.
func capStr(s string, n int) string {
	if len(s) <= n {
		return s
	}
	cut := s[:n]
	for len(cut) > 0 {
		r, size := utf8.DecodeLastRuneInString(cut)
		if r == utf8.RuneError && size <= 1 {
			cut = cut[:len(cut)-1]
			continue
		}
		break
	}
	return strings.TrimRight(cut, " \n\t")
}
