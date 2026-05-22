package payments

// Plans is the canonical price list. Amounts are in MINOR units (piasters / cents)
// so we can pass them straight to Paymob (EGP cents) and PayPal (USD cents → /100).
type Plan struct {
	ID          string
	Name        string
	DescriptionEN string
	DescriptionAR string
	EGP         int64 // EGP in piasters
	USD         int64 // USD in cents
	Interval    string // "month" | "year" | "one_time"
}

var Plans = map[string]Plan{
	"pro_monthly": {
		ID:            "pro_monthly",
		Name:          "Pro",
		DescriptionEN: "Unlimited consults · all 86 MCPs · cited mode",
		DescriptionAR: "استشارات غير محدودة · 86 خادم MCP · وضع الاستشهاد",
		EGP:           250000, // 2500 EGP
		USD:           4900,   // $49
		Interval:      "month",
	},
	"max_monthly": {
		ID:            "max_monthly",
		Name:          "Max",
		DescriptionEN: "Team seats · priority compute · EHR integrations",
		DescriptionAR: "مقاعد للفريق · حوسبة بأولوية · تكامل EHR",
		EGP:           750000, // 7500 EGP
		USD:           14900,  // $149
		Interval:      "month",
	},
	"max_yearly": {
		ID:            "max_yearly",
		Name:          "Max (annual)",
		DescriptionEN: "Same as Max, billed yearly (2 months free)",
		DescriptionAR: "نفس Max، فوترة سنوية (شهران مجانًا)",
		EGP:           7500000, // 75000 EGP
		USD:           149000,  // $1490
		Interval:      "year",
	},
}

func GetPlan(id string) (Plan, bool) {
	p, ok := Plans[id]
	return p, ok
}

func ListPlans() []Plan {
	out := make([]Plan, 0, len(Plans))
	for _, p := range Plans {
		out = append(out, p)
	}
	return out
}
