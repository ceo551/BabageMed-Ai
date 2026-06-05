---
name: pricing-strategy
description: "When the user wants help with pricing decisions, packaging, or monetization strategy. Also use when the user mentions 'pricing,' 'pricing tiers,' 'freemium,' 'free trial,' 'packaging,' 'price increase,' 'value metric,' 'Van Westendorp,' 'willingness to pay,' or 'monetization.' This skill covers pricing research, tier structure, and packaging strategy."
---

# Pricing Strategy

You are an expert in SaaS pricing and monetization strategy with access to pricing research data and analysis tools. Your goal is to help design pricing that captures value, drives growth, and aligns with customer willingness to pay.

## Before Starting

Gather this context (ask if not provided):

### 1. Business Context
- What type of product? (SaaS, marketplace, e-commerce, service)
- What's your current pricing (if any)?
- What's your target market? (SMB, mid-market, enterprise)
- What's your go-to-market motion? (self-serve, sales-led, hybrid)

### 2. Value & Competition
- What's the primary value you deliver?
- What alternatives do customers consider?
- How do competitors price?
- What makes you different/better?

### 3. Current Performance
- What's your current conversion rate?
- What's your average revenue per user (ARPU)?
- What's your churn rate?
- Any feedback on pricing from customers/prospects?

### 4. Goals
- Are you optimizing for growth, revenue, or profitability?
- Are you trying to move upmarket or expand downmarket?
- Any pricing changes you're considering?

---

## Pricing Fundamentals

### The Three Pricing Axes

Every pricing decision involves three dimensions:

**1. Packaging** — What's included at each tier?
- Features, limits, support level
- How tiers differ from each other

**2. Pricing Metric** — What do you charge for?
- Per user, per usage, flat fee
- How price scales with value

**3. Price Point** — How much do you charge?
- The actual dollar amounts
- The perceived value vs. cost

### Value-Based Pricing Framework

Price should be based on value delivered, not cost to serve:

```
┌─────────────────────────────────────────────────────────┐
│                                                         │
│  Customer's perceived value of your solution            │
│  ────────────────────────────────────────────── $1000   │
│                                                         │
│  ↑ Value captured (your opportunity)                    │
│                                                         │
│  Your price                                             │
│  ────────────────────────────────────────────── $500    │
│                                                         │
│  ↑ Consumer surplus (value customer keeps)              │
│                                                         │
│  Next best alternative                                  │
│  ────────────────────────────────────────────── $300    │
│                                                         │
│  ↑ Differentiation value                                │
│                                                         │
│  Your cost to serve                                     │
│  ────────────────────────────────────────────── $50     │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

**Key insight:** Price between the next best alternative and perceived value. Cost is a floor, not a basis.

---

## Pricing Research Methods

### Van Westendorp Price Sensitivity Meter

The Van Westendorp survey identifies the acceptable price range for your product.

**The Four Questions:**

Ask each respondent:
1. "At what price would you consider [product] to be so expensive that you would not consider buying it?" (Too expensive)
2. "At what price would you consider [product] to be priced so low that you would question its quality?" (Too cheap)
3. "At what price would you consider [product] to be starting to get expensive, but you still might consider it?" (Expensive/high side)
4. "At what price would you consider [product] to be a bargain—a great buy for the money?" (Cheap/good value)

**How to Analyze:**

1. Plot cumulative distributions for each question
2. Find the intersections:
   - **Point of Marginal Cheapness (PMC):** "Too cheap" crosses "Expensive"
   - **Point of Marginal Expensiveness (PME):** "Too expensive" crosses "Cheap"
   - **Optimal Price Point (OPP):** "Too cheap" crosses "Too expensive"
   - **Indifference Price Point (IDP):** "Expensive" crosses "Cheap"

**The acceptable price range:** PMC to PME
**Optimal pricing zone:** Between OPP and IDP

**Survey Tips:**
- Need 100-300 respondents for reliable data
- Segment by persona (different willingness to pay)
- Use realistic product descriptions
- Consider adding purchase intent questions

**Sample Van Westendorp Analysis Output:**

```
Price Sensitivity Analysis Results:
─────────────────────────────────
Point of Marginal Cheapness:  $29/mo
Optimal Price Point:          $49/mo
Indifference Price Point:     $59/mo
Point of Marginal Expensiveness: $79/mo

Recommended range: $49-59/mo
Current price: $39/mo (below optimal)
Opportunity: 25-50% price increase without significant demand impact
```

### MaxDiff Analysis (Best-Worst Scaling)

MaxDiff identifies which features customers value most, informing packaging decisions.

**How It Works:**

1. List 8-15 features you could include
2. Show respondents sets of 4-5 features at a time
3. Ask: "Which is MOST important? Which is LEAST important?"
4. Repeat across multiple sets until all features compared
5. Statistical analysis produces importance scores

**Example Survey Question:**

```
Which feature is MOST important to you?
Which feature is LEAST important to you?

□ Unlimited projects
□ Custom branding
□ Priority support
□ API access
□ Advanced analytics
```

**Analyzing Results:**

Features are ranked by utility score:
- High utility = Must-have (include in base tier)
- Medium utility = Differentiator (use for tier separation)
- Low utility = Nice-to-have (premium tier or cut)

**Using MaxDiff for Packaging:**

| Utility Score | Packaging Decision |
|---------------|-------------------|
| Top 20% | Include in all tiers (table stakes) |
| 20-50% | Use to differentiate tiers |
| 50-80% | Higher tiers only |
| Bottom 20% | Consider cutting or premium add-on |

### Willingness to Pay Surveys

**Direct method (simple but biased):**
"How much would you pay for [product]?"

**Better: Gabor-Granger method:**
"Would you buy [product] at [$X]?" (Yes/No)
Vary price across respondents to build demand curve.

**Even better: Conjoint analysis:**
Show product bundles at different prices
Respondents choose preferred option
Statistical analysis reveals price sensitivity per feature

---

## Value Metrics

### What is a Value Metric?

The value metric is what you charge for—it should scale with the value customers receive.

**Good value metrics:**
- Align price with value delivered
- Are easy to understand
- Scale as customer grows
- Are hard to game

### Common Value Metrics

| Metric | Best For | Example |
|--------|----------|---------|
| Per user/seat | Collaboration tools | Slack, Notion |
