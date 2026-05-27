package features

import "testing"

// Guards against silent drift between the 10 canonical feature slugs
// here, in apps/web/app/i18n.ts, and in scripts/mcps.manifest.json. If
// you add or rename a feature, update all three at once and update this
// test's expected list.
func TestValidSlugs(t *testing.T) {
	want := []string{
		"healthcare", "education", "writing", "translation",
		"data-analysis", "business", "financial", "consulting",
		"image-video", "advertisements",
	}
	if len(ValidSlugs) != len(want) {
		t.Fatalf("ValidSlugs has %d entries, want %d", len(ValidSlugs), len(want))
	}
	got := make(map[string]bool, len(ValidSlugs))
	for _, s := range ValidSlugs {
		got[s] = true
	}
	for _, s := range want {
		if !got[s] {
			t.Errorf("missing canonical slug %q", s)
		}
	}
}

func TestIsValidSlug(t *testing.T) {
	for _, s := range ValidSlugs {
		if !IsValidSlug(s) {
			t.Errorf("IsValidSlug(%q) = false, want true", s)
		}
	}
	for _, s := range []string{"", "math-science", "Healthcare", "foo", "general"} {
		if IsValidSlug(s) {
			t.Errorf("IsValidSlug(%q) = true, want false", s)
		}
	}
}
