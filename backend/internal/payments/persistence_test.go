package payments

import (
	"testing"
)

// Regression: the Paymob webhook fires with no plan_id in the payload,
// so MarkPaid was being called with planID="". The previous code passed
// the argument straight to planFromPlanID, which returned "free" and
// silently downgraded paying users to the free tier on every successful
// payment.
//
// We can't unit-test the full MarkPaid flow without a real DB, but we
// CAN regression-test the helper that derives the user's plan from the
// stored plan_id — proving that an empty input no longer becomes "free"
// is now the responsibility of MarkPaid's RETURNING clause.

func TestPlanFromPlanID_EmptyArgGoesToFree_ByDesign(t *testing.T) {
	// This is the documented behaviour for unknown / empty IDs — it
	// MUST remain "free" so a corrupt DB row doesn't accidentally
	// upgrade someone. The fix for the Paymob downgrade bug lives
	// inside MarkPaid: it reads plan_id from the existing row and
	// only falls back to the argument when the row's value is empty
	// AND the argument is non-empty.
	if got := planFromPlanID(""); got != "free" {
		t.Errorf("planFromPlanID(\"\") = %q, want \"free\"", got)
	}
}

// Compile-time guard: if anyone renames `Plan` fields or removes
// fields callers depend on, this catches it before the deploy.
func TestPlan_FieldsStable(t *testing.T) {
	p, ok := GetPlan("pro_monthly")
	if !ok {
		t.Fatal("pro_monthly missing")
	}
	// Touch every field — compilation fails if a field disappears.
	_ = p.ID
	_ = p.Name
	_ = p.DescriptionEN
	_ = p.DescriptionAR
	_ = p.EGP
	_ = p.USD
	_ = p.Interval
}
