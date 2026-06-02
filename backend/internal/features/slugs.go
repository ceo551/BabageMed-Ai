package features

// ValidSlugs is the canonical list of feature slugs the product ships.
// Order is informational — the sidebar UI controls display order via
// apps/web/app/i18n.ts (FEATURES_EN / FEATURES_AR).
//
// Single source of truth shared between this package (per-feature
// workspace API) and internal/chats (which tags chats with their owning
// feature). Keep aligned with apps/web/app/i18n.ts and
// scripts/mcps.manifest.json `feature` enum.
var ValidSlugs = []string{
	"education",
	"writing",
	"translation",
	"data-analysis",
	"business",
	"financial",
	"consulting",
	"image-video",
	"advertisements",
}

// IsValidSlug reports whether s is one of the canonical feature slugs.
func IsValidSlug(s string) bool {
	for _, v := range ValidSlugs {
		if v == s {
			return true
		}
	}
	return false
}
