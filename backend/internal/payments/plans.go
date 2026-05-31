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

// Four monthly tiers: GO $17, Plus $30, Pro $50, Max $100. EGP amounts are
// the USD figure at ~50 EGP/$ (matching the historical price points).
var Plans = map[string]Plan{
	"go_monthly": {
		ID:            "go_monthly",
		Name:          "GO",
		DescriptionEN: "Everyday AI · all connectors · standard speed",
		DescriptionAR: "ذكاء اصطناعي يومي · كل الموصّلات · سرعة قياسية",
		EGP:           85000, // 850 EGP
		USD:           1700,  // $17
		Interval:      "month",
	},
	"plus_monthly": {
		ID:            "plus_monthly",
		Name:          "Plus",
		DescriptionEN: "Higher limits · all features · faster responses",
		DescriptionAR: "حدود أعلى · كل الميزات · ردود أسرع",
		EGP:           150000, // 1500 EGP
		USD:           3000,   // $30
		Interval:      "month",
	},
	"pro_monthly": {
		ID:            "pro_monthly",
		Name:          "Pro",
		DescriptionEN: "Unlimited chats · all connectors · cited + deep modes",
		DescriptionAR: "محادثات غير محدودة · كل الموصّلات · أوضاع الاستشهاد والتعمّق",
		EGP:           250000, // 2500 EGP
		USD:           5000,   // $50
		Interval:      "month",
	},
	"max_monthly": {
		ID:            "max_monthly",
		Name:          "Max",
		DescriptionEN: "Team seats · priority compute · everything in Pro",
		DescriptionAR: "مقاعد للفريق · حوسبة بأولوية · كل مزايا Pro",
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
