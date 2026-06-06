package payments

import "sort"

// Plans is the canonical price list. Amounts are in MINOR units (cents) for
// display; the actual charge is driven by the matching Paddle price id
// (PADDLE_PRICE_* env vars, see paddle.go).
type Plan struct {
	ID          string
	Name        string
	DescriptionEN string
	DescriptionAR string
	EGP         int64 // EGP in piasters
	USD         int64 // USD in cents
	Interval    string // "month" | "year" | "one_time"
}

// Four monthly tiers: Go $20, Plus $40, Pro $70, Max $100 (matching the pricing
// model + the per-plan model matrix in internal/billing/plans.go). EGP amounts
// are the USD figure at ~50 EGP/$.
var Plans = map[string]Plan{
	"go_monthly": {
		ID:            "go_monthly",
		Name:          "Go",
		DescriptionEN: "Core text models — DeepSeek V4 Pro, GLM 5.1, Qwen 3.7 Max",
		DescriptionAR: "نماذج النصوص الأساسية — DeepSeek V4 Pro و GLM 5.1 و Qwen 3.7 Max",
		EGP:           100000, // 1000 EGP
		USD:           2000,   // $20
		Interval:      "month",
	},
	"plus_monthly": {
		ID:            "plus_monthly",
		Name:          "Plus",
		DescriptionEN: "Everything in Go + Gemini 3.1 Pro and image generation",
		DescriptionAR: "كل مزايا Go + Gemini 3.1 Pro وتوليد الصور",
		EGP:           200000, // 2000 EGP
		USD:           4000,   // $40
		Interval:      "month",
	},
	"pro_monthly": {
		ID:            "pro_monthly",
		Name:          "Pro",
		DescriptionEN: "Everything in Plus + Claude Sonnet 4.6, GPT 5.4 and video",
		DescriptionAR: "كل مزايا Plus + Claude Sonnet 4.6 و GPT 5.4 والفيديو",
		EGP:           350000, // 3500 EGP
		USD:           7000,   // $70
		Interval:      "month",
	},
	"max_monthly": {
		ID:            "max_monthly",
		Name:          "Max",
		DescriptionEN: "Every model — including Claude Opus 4.8 and GPT 5.5",
		DescriptionAR: "كل النماذج — بما فيها Claude Opus 4.8 و GPT 5.5",
		EGP:           500000, // 5000 EGP
		USD:           10000,  // $100
		Interval:      "month",
	},
}

func GetPlan(id string) (Plan, bool) {
	p, ok := Plans[id]
	return p, ok
}

// ListPlans returns the plans in ascending price order (GO, Plus, Pro, Max)
// so the billing page renders them low→high. Ranging the map directly gave a
// non-deterministic order.
func ListPlans() []Plan {
	out := make([]Plan, 0, len(Plans))
	for _, p := range Plans {
		out = append(out, p)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].USD < out[j].USD })
	return out
}
