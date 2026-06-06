package billing

import "strings"

// Plan is the single source of truth for what a subscription tier costs, how
// many monthly credits it grants, and WHICH models it unlocks. Derived from the
// pricing model (Downloads/ai_pricing_model.xlsx): each plan has an API-cost
// budget (Go $10 / Plus $20 / Pro $35 / Max $50 ≈ 50% COGS); credits are that
// budget in cents (1 credit = $0.01). The frontend mirrors the model matrix in
// apps/web/app/lib/models.ts (PLAN_MODELS) — keep the two in sync.
type Plan struct {
	Name    string
	Price   int             // USD / month
	Credits int             // monthly credit allowance (shared pool)
	Models  map[string]bool // model ids unlocked on this plan
}

func modelSet(ids ...string) map[string]bool {
	m := make(map[string]bool, len(ids))
	for _, id := range ids {
		m[id] = true
	}
	return m
}

// Cumulative model lists (each tier = the one below it + more), matching the
// availability matrix in the pricing model. Model ids match apps/web/app/lib/models.ts.
var (
	goModels   = []string{"deepseek-v4-pro", "glm-5.1", "qwen-3.7-max"}
	plusModels = append(append([]string{}, goModels...), "gemini-pro-3.1", "wan2.7-image-pro", "qwen-image-2.0-pro")
	proModels  = append(append([]string{}, plusModels...), "sonnet-4.6", "gpt-5.4", "gpt-image-2", "happy-horse-1.0")
	maxModels  = append(append([]string{}, proModels...), "opus-4.8", "gpt-5.5")
)

// Plans — ordered low→high. Free is the no-card trial tier (basic text models,
// small credit grant); the paid tiers are Go/Plus/Pro/Max.
var Plans = map[string]Plan{
	"free": {Name: "Free", Price: 0, Credits: 200, Models: modelSet(goModels...)},
	"go":   {Name: "Go", Price: 20, Credits: 1000, Models: modelSet(goModels...)},
	"plus": {Name: "Plus", Price: 40, Credits: 2000, Models: modelSet(plusModels...)},
	"pro":  {Name: "Pro", Price: 70, Credits: 3500, Models: modelSet(proModels...)},
	"max":  {Name: "Max", Price: 100, Credits: 5000, Models: modelSet(maxModels...)},
}

// PlanOrder is the display / upgrade order.
var PlanOrder = []string{"free", "go", "plus", "pro", "max"}

func normPlan(plan string) string {
	p := strings.ToLower(strings.TrimSpace(plan))
	if _, ok := Plans[p]; ok {
		return p
	}
	return "free"
}

// AllowsModel reports whether a plan may use a given model id. Empty model id is
// allowed (the backend resolves a default model). Unknown models are allowed
// (fail-open — a freshly-added model shouldn't be blocked before the matrix is
// updated; the picker is the primary gate, this is the secondary one for the
// curated ids we DO know about).
func AllowsModel(plan, modelID string) bool {
	id := strings.TrimSpace(modelID)
	if id == "" {
		return true
	}
	p := Plans[normPlan(plan)]
	// Only gate ids we actually track in some plan; pass through unknown ones.
	if !anyPlanHas(id) {
		return true
	}
	return p.Models[id]
}

func anyPlanHas(id string) bool {
	for _, pl := range Plans {
		if pl.Models[id] {
			return true
		}
	}
	return false
}

// AllowedModels returns the unlocked model ids for a plan (unordered).
func AllowedModels(plan string) []string {
	p := Plans[normPlan(plan)]
	out := make([]string, 0, len(p.Models))
	for id := range p.Models {
		out = append(out, id)
	}
	return out
}

// CreditsFor / PriceFor expose the plan numbers.
func CreditsFor(plan string) int { return Plans[normPlan(plan)].Credits }
func PriceFor(plan string) int   { return Plans[normPlan(plan)].Price }
