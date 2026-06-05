---
name: premium-web-design
description: >
  Create premium, Awwwards-quality website designs as React (.jsx) components that look like they were built by a top-tier
  agency charging $50k+ per project. Use this skill whenever the user asks for a website, landing page, portfolio,
  or web component that should look expensive, premium, luxury, editorial, high-end, or agency-quality. Also trigger
  when the user mentions Awwwards, FWA, award-winning design, or references brands like Apple, Aesop, Bottega Veneta,
  Stripe, or any luxury/fashion/design-forward brand. Trigger when the user says things like "make it look professional",
  "make it look expensive", "I want it to look really good", "high quality design", "not generic", or expresses
  dissatisfaction with typical AI-generated website aesthetics. Do NOT trigger for dashboards, admin panels, internal
  tools, or functional UI where aesthetics are secondary to utility — the standard frontend-design skill handles those.
---

# Premium Web Design

Create React (.jsx) components that look like they belong on Awwwards — the kind of work that makes people ask "who designed this?" These are sites where every pixel is intentional, every animation is choreographed, and the overall impression is that serious creative talent and budget were involved.

## The AI Aesthetic Problem

Most AI-generated websites share a recognizable DNA. Avoiding it requires knowing exactly what it looks like.

### The Blacklist — Never Do These

**Typography sins**
- Inter, Poppins, Montserrat, Raleway, Space Grotesk, Outfit as primary fonts — these scream "AI template". (Note: *Inter Tight* is a separate font family with different metrics and is allowed.)
- Using one font family for everything
- Uniform font sizes with predictable hierarchy (64px → 32px → 18px → 14px)
- Default letter-spacing and line-height everywhere
- Centered text blocks everywhere, especially multi-line paragraphs

**Color sins**
- Purple-to-blue gradients (the single biggest AI design cliché)
- Indigo/violet as a primary brand color with no contextual reason
- White background + one accent color + gray text (the SaaS starter kit)
- Gradients on buttons or cards for no reason
- Using opacity or semi-transparent overlays as a substitute for real color choices
- Neon accent colors on dark backgrounds (the "developer portfolio" look)

**Layout sins**
- Hero → 3-column feature grid → testimonials → CTA → footer (the default SaaS landing page)
- Hero → stats bar → work grid → about split → CTA → footer (the "premium AI" landing page — just as formulaic)
- ANY predictable top-to-bottom section ordering that could be swapped between sites. Every site must have its own unique structural DNA — different number of sections, different ordering logic, sections that don't fit neatly into categories
- Perfectly symmetrical grids with equal-sized cards
- Everything centered, everything contained in a max-width container
- Rounded rectangles with box-shadows as the primary UI element
- Icon + heading + paragraph cards in a row of 3 or 4
- Generic hero with headline + subheadline + two buttons side by side
- Static flat hero sections with just text — hero sections should be immersive spatial experiences

**Motion sins**
- Elements fading in from below on scroll (the overused AOS effect)
- Identical transitions on everything (same duration, same easing, same direction)
- Hover effects that just scale up or add a shadow
- Loading spinners instead of skeleton screens or choreographed reveals

**Imagery & decoration sins**
- Blob shapes as background decorations
- Floating geometric shapes (circles, triangles) as "design elements"
- Generic gradient mesh backgrounds
- Stock photo grids with uniform aspect ratios
- Emoji or generic line icons as section markers

---

## What Expensive Actually Looks Like

Premium web design communicates craft through restraint, surprise, and obsessive attention to detail.

### Typography as Identity

Typography is the #1 differentiator between a $500 website and a $50,000 one.

**Font selection philosophy:**
- Use distinctive serif or display fonts for headlines — fonts with personality and opinion. Good starting points: *Playfair Display, Cormorant Garamond, DM Serif Display, Fraunces, Instrument Serif* for serifs. For sans-serifs that aren't overused: *Syne, General Sans, Satoshi, Switzer, Cabinet Grotesk, Nacelle, Inter Tight, IBM Plex Sans, Manrope, Archivo, Work Sans, Instrument Sans*.
- Pair a characterful display font with a neutral-but-refined body font.
- Monospaced fonts as accent typography (for labels, categories, dates) add an editorial quality — *JetBrains Mono, IBM Plex Mono, Space Mono*.
- Mix weights dramatically — a 900-weight headline next to a 300-weight body creates visual tension.

**Typography execution:**
- `clamp()` for fluid type scaling instead of breakpoint jumps
- Dramatic size contrast — headlines can be 8vw+ on desktop
- Negative letter-spacing on large headlines (`-0.03em` to `-0.06em`)
- Generous line-height on body (1.6–1.8), tight on headlines (0.9–1.1)
- Mixed alignment — left-aligned body with occasional right-aligned labels or asymmetric headings
- `max-width` on paragraphs (45–75ch) and `text-wrap: balance` on headings
- Uppercase micro-labels with wide letter-spacing (`0.1em`+) for categories, dates, metadata

### Color as Atmosphere

- Start with black and white. Add color only when it earns its place.
- One dominant hue with intention — "what emotional territory does this color claim?"
- Off-whites and warm grays (not pure `#ffffff` or `#000000`) feel more designed — try `#FAFAF8`, `#F5F0EB`, `#1A1A1A`, `#0D0D0D`
- Monochromatic or analogous palettes with one moment of contrast read as more sophisticated than rainbow schemes
- Dark themes done right: not just "white on dark gray" but considered background layering with subtle warm or cool tints
- Color used sparingly hits harder — a single red link in a sea of black-and-white is more powerful than red everywhere

### Layout as Storytelling

The #1 failure mode of this skill is producing sites that *look different on the surface but share the same underlying structure* — a hero, three editorial sections, a pull quote, a form, a colophon. Over a batch of sites this starts to feel like a template with different colors. Fight this actively, and deliberately.

**The structural DNA uniqueness rule:**

Before writing any markup, **name the primary structural concept out loud** — a single noun phrase, like *"index manuscript"* or *"sticky horizontal diorama"*. Inside one batch of sites, **no two sites may share the same primary structural concept.** If the previous site was a sticky-scroll narrative, this one is not. If the previous site was a 33/67 vertical split, this one is not. The structural idea is the first thing the user notices — varying color without varying structure is cosmetic.

#### Structural DNA Catalog

These are distinct primary structures. Each skill invocation should pick a concept and commit to it. **Do not mix two structures into one site** (it dilutes both).

1. **Index Manuscript** — A single long editorial column, no sections. One typographic rhythm from top to bottom. The whole page reads like a single manuscript that happens to be a website. (Good for: a chef's menu, a perfumer's letter, a manifesto.)
2. **Sticky Horizontal Diorama** — The page is a long vertical scroll, but *what you see as you scroll* is a horizontally-panning scene. Use `position: sticky` + `translateX` driven by scroll. (Good for: a timeline of commissions, a process in stages, a collection of artifacts.)
3. **Two-Pane Permanent Split** — The page is always a 50/50 (or 38/62) split; one pane is sticky, the other scrolls. Navigation happens inside a pane, never by scrolling the whole page. (Good for: an archive with a live-updating index, a librarian's catalogue.)
