---
name: market-research-reports
description: "Generate comprehensive market research reports (50+ pages) in the style of top consulting firms (McKinsey, BCG, Gartner). Features professional LaTeX formatting, extensive visual generation with scientific-schematics and generate-image, deep integration with research-lookup for data gathering, and multi-framework strategic analysis including Porter's Five Forces, PESTLE, SWOT, TAM/SAM/SOM, and BCG Matrix."
allowed-tools: [Read, Write, Edit, Bash]
---

# Market Research Reports

## Overview

Market research reports are comprehensive strategic documents that analyze industries, markets, and competitive landscapes to inform business decisions, investment strategies, and strategic planning. This skill generates **professional-grade reports of 50+ pages** with extensive visual content, modeled after deliverables from top consulting firms like McKinsey, BCG, Bain, Gartner, and Forrester.

**Key Features:**
- **Comprehensive length**: Reports are designed to be 50+ pages with no token constraints
- **Visual-rich content**: 5-6 key diagrams generated at start (more added as needed during writing)
- **Data-driven analysis**: Deep integration with research-lookup for market data
- **Multi-framework approach**: Porter's Five Forces, PESTLE, SWOT, BCG Matrix, TAM/SAM/SOM
- **Professional formatting**: Consulting-firm quality typography, colors, and layout
- **Actionable recommendations**: Strategic focus with implementation roadmaps

**Output Format:** LaTeX with professional styling, compiled to PDF. Uses the `market_research.sty` style package for consistent, professional formatting.

## When to Use This Skill

This skill should be used when:
- Creating comprehensive market analysis for investment decisions
- Developing industry reports for strategic planning
- Analyzing competitive landscapes and market dynamics
- Conducting market sizing exercises (TAM/SAM/SOM)
- Evaluating market entry opportunities
- Preparing due diligence materials for M&A activities
- Creating thought leadership content for industry positioning
- Developing go-to-market strategy documentation
- Analyzing regulatory and policy impacts on markets
- Building business cases for new product launches

## Visual Enhancement Requirements

**CRITICAL: Market research reports should include key visual content.**

Every report should generate **6 essential visuals** at the start, with additional visuals added as needed during writing. Start with the most critical visualizations to establish the report framework.

### Visual Generation Tools

**Use `scientific-schematics` for:**
- Market growth trajectory charts
- TAM/SAM/SOM breakdown diagrams (concentric circles)
- Porter's Five Forces diagrams
- Competitive positioning matrices
- Market segmentation charts
- Value chain diagrams
- Technology roadmaps
- Risk heatmaps
- Strategic prioritization matrices
- Implementation timelines/Gantt charts
- SWOT analysis diagrams
- BCG Growth-Share matrices

```bash
# Example: Generate a TAM/SAM/SOM diagram
python skills/scientific-schematics/scripts/generate_schematic.py \
  "TAM SAM SOM concentric circle diagram showing Total Addressable Market $50B outer circle, Serviceable Addressable Market $15B middle circle, Serviceable Obtainable Market $3B inner circle, with labels and arrows pointing to each segment" \
  -o figures/tam_sam_som.png --doc-type report

# Example: Generate Porter's Five Forces
python skills/scientific-schematics/scripts/generate_schematic.py \
  "Porter's Five Forces diagram with center box 'Competitive Rivalry' connected to four surrounding boxes: 'Threat of New Entrants' (top), 'Bargaining Power of Suppliers' (left), 'Bargaining Power of Buyers' (right), 'Threat of Substitutes' (bottom). Each box should show High/Medium/Low rating" \
  -o figures/porters_five_forces.png --doc-type report
```

**Use `generate-image` for:**
- Executive summary hero infographics
- Industry/sector conceptual illustrations
- Abstract technology visualizations
- Cover page imagery

```bash
# Example: Generate executive summary infographic
python skills/generate-image/scripts/generate_image.py \
  "Professional executive summary infographic for market research report, showing key metrics in modern data visualization style, blue and green color scheme, clean minimalist design with icons representing market size, growth rate, and competitive landscape" \
  --output figures/executive_summary.png
```

### Recommended Visuals by Section (Generate as Needed)

| Section | Priority Visuals | Optional Visuals |
|---------|-----------------|------------------|
| Executive Summary | Executive infographic (START) | - |
| Market Size & Growth | Growth trajectory (START), TAM/SAM/SOM (START) | Regional breakdown, segment growth |
| Competitive Landscape | Porter's Five Forces (START), Positioning matrix (START) | Market share chart, strategic groups |
| Risk Analysis | Risk heatmap (START) | Mitigation matrix |
| Strategic Recommendations | Opportunity matrix | Priority framework |
| Implementation Roadmap | Timeline/Gantt | Milestone tracker |
| Investment Thesis | Financial projections | Scenario analysis |

**Start with 6 priority visuals** (marked as START above), then generate additional visuals as specific sections are written and require visual support.

---

## Report Structure (50+ Pages)

### Front Matter (~5 pages)

#### Cover Page (1 page)
- Report title and subtitle
- Hero visualization (generated)
- Date and classification
- Prepared for / Prepared by

#### Table of Contents (1-2 pages)
- Automated from LaTeX
- List of Figures
- List of Tables

#### Executive Summary (2-3 pages)
- **Market Snapshot Box**: Key metrics at a glance
- **Investment Thesis**: 3-5 bullet point summary
- **Key Findings**: Major discoveries and insights
- **Strategic Recommendations**: Top 3-5 actionable recommendations
- **Executive Summary Infographic**: Visual synthesis of report highlights

---

### Core Analysis (~35 pages)

#### Chapter 1: Market Overview & Definition (4-5 pages)

**Content Requirements:**
- Market definition and scope
- Industry ecosystem mapping
- Key stakeholders and their roles
- Market boundaries and adjacencies
- Historical context and evolution

**Required Visuals (2):**
1. Market ecosystem/value chain diagram
2. Industry structure diagram

**Key Data Points:**
- Market definition criteria
- Included/excluded segments
- Geographic scope
- Time horizon for analysis

---

#### Chapter 2: Market Size & Growth Analysis (6-8 pages)

**Content Requirements:**
- Total Addressable Market (TAM) calculation
- Serviceable Addressable Market (SAM) definition
- Serviceable Obtainable Market (SOM) estimation
- Historical growth analysis (5-10 years)
- Growth projections (5-10 years forward)
- Growth drivers and inhibitors
- Regional market breakdown
- Segment-level analysis

**Required Visuals (4):**
1. Market growth trajectory chart (historical + projected)
2. TAM/SAM/SOM concentric circles diagram
3. Regional market breakdown (pie chart or treemap)
4. Segment growth comparison (bar chart)

**Key Data Points:**
- Current market size (with source)
- CAGR (historical and projected)
- Market size by region
- Market size by segment
- Key assumptions for projections

**Data Sources:**
Use `research-lookup` to find:
- Market research reports (Gartner, Forrester, IDC, etc.)
- Industry association data
- Government statistics
- Company financial reports
- Academic studies

---

#### Chapter 3: Industry Drivers & Trends (5-6 pages)

**Content Requirements:**
- Macroeconomic factors
- Technology trends
- Regulatory drivers
- Social and demographic shifts
- Environmental factors
- Industry-specific trends

**Analysis Frameworks:**
- **PESTLE Analysis**: Political, Economic, Social, Technological, Legal, Environmental
- **Trend Impact Assessment**: Likelihood vs Impact matrix

**Required Visuals (3):**
1. Industry trends timeline or radar chart
2. Driver impact matrix
