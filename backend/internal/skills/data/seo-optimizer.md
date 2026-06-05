---
name: SEO Optimizer
description: Search Engine Optimization specialist for content strategy, technical SEO, keyword research, and ranking improvements. Use when optimizing website content, improving search rankings, conducting keyword analysis, or implementing SEO best practices. Expert in on-page SEO, meta tags, schema markup, and Core Web Vitals.
---

# SEO Optimizer

Comprehensive guidance for search engine optimization across content, technical implementation, and strategic planning to improve organic search visibility and rankings.

## When to Use This Skill

Use this skill when:
- Optimizing website content for search engines
- Conducting keyword research and analysis
- Implementing technical SEO improvements
- Creating SEO-friendly meta tags and descriptions
- Auditing websites for SEO issues
- Improving Core Web Vitals and page speed
- Implementing schema markup (structured data)
- Planning content strategy for organic traffic

## SEO Fundamentals

### 1. Keyword Research & Strategy

**Primary Keyword Selection:**
- Focus on search intent (informational, navigational, transactional, commercial)
- Balance search volume with competition
- Consider keyword difficulty and ranking potential
- Target long-tail keywords for quick wins

**Keyword Research Process:**
```
1. Identify seed keywords from business objectives
2. Use tools to expand keyword list (Google Keyword Planner, Ahrefs, SEMrush)
3. Analyze search volume and difficulty
4. Group keywords by topic clusters
5. Map keywords to content types and pages
6. Prioritize based on potential ROI
```

**Content Optimization Formula:**
- Primary keyword: 1-2% density (natural placement)
- Include in: Title tag, H1, first paragraph, URL, meta description
- Use semantic variations and related terms
- Maintain natural readability (don't keyword stuff)

### 2. On-Page SEO

**Title Tag Optimization:**
```html
<!-- Good: Descriptive, includes keyword, under 60 characters -->
<title>Ultimate Guide to React Hooks - Learn useEffect & useState</title>

<!-- Bad: Too long, keyword stuffing, generic -->
<title>React Hooks Guide React Hooks Tutorial React Hooks Examples Learn React</title>
```

**Best Practices:**
- Keep under 60 characters (displayed in SERPs)
- Place primary keyword near the beginning
- Include brand name if space permits
- Make compelling and click-worthy
- Unique for every page

**Meta Description:**
```html
<!-- Good: Compelling, includes keywords, call-to-action, 150-160 chars -->
<meta name="description" content="Master React Hooks with our comprehensive guide. Learn useState, useEffect, and custom hooks with practical examples. Start building better React apps today.">

<!-- Bad: Too short, no value proposition -->
<meta name="description" content="React Hooks guide and tutorial">
```

**Header Structure:**
```html
<!-- Proper hierarchy -->
<h1>Main Page Title (Primary Keyword)</h1>
  <h2>Section Heading (Related Keywords)</h2>
    <h3>Subsection</h3>
    <h3>Subsection</h3>
  <h2>Another Section</h2>
    <h3>Subsection</h3>
```

**URL Structure:**
```
✅ Good URLs:
- /blog/react-hooks-guide
- /products/running-shoes
- /learn/javascript-async-await

❌ Bad URLs:
- /blog?p=12345
- /products/cat-1/subcat-2/item-999
- /page.php?id=abc&ref=xyz
```

**Image Optimization:**
```html
<!-- Optimized image -->
<img
  src="/images/react-hooks-diagram-800w.webp"
  alt="React Hooks lifecycle diagram showing useState and useEffect"
  width="800"
  height="600"
  loading="lazy"
/>
```

**Best Practices:**
- Use descriptive, keyword-rich alt text
- Compress images (WebP format preferred)
- Specify dimensions to prevent layout shift
- Use lazy loading for below-fold images
- Include captions when relevant

### 3. Content Quality

**E-E-A-T Principles (Experience, Expertise, Authoritativeness, Trust):**
- Demonstrate author expertise with credentials
- Cite authoritative sources
- Keep content accurate and up-to-date
- Show real experience and original insights
- Include author bios and bylines

**Content Structure for SEO:**
```markdown
# Main Title (H1) - Primary Keyword

Brief introduction with primary keyword in first 100 words.

## What is [Topic]? (H2) - Answer core question

Comprehensive explanation with examples.

## Why [Topic] Matters (H2) - Value proposition

Benefits and use cases.

## How to [Action] (H2) - Practical guide

Step-by-step instructions with visuals.

## Best Practices (H2) - Advanced tips

Expert recommendations.

## Common Mistakes to Avoid (H2)

Troubleshooting and pitfalls.

## Conclusion

Summary and call-to-action.
```

**Content Length Guidelines:**
- Blog posts: 1,500-2,500 words (comprehensive topics)
- Product pages: 300-500 words minimum
- Category pages: 500-1,000 words
- Homepage: 500+ words

### 4. Technical SEO

**Schema Markup (Structured Data):**
```json
{
  "@context": "https://schema.org",
  "@type": "Article",
  "headline": "Complete Guide to React Hooks",
  "image": "https://example.com/images/react-hooks.jpg",
  "datePublished": "2024-01-15",
  "dateModified": "2024-02-01",
  "author": {
    "@type": "Person",
    "name": "Jane Developer"
  },
  "publisher": {
    "@type": "Organization",
    "name": "Tech Academy",
    "logo": {
      "@type": "ImageObject",
      "url": "https://example.com/logo.png"
    }
  }
}
```

**Common Schema Types:**
- Article (blog posts)
- Product (e-commerce)
- FAQ (question/answer pages)
- HowTo (tutorials and guides)
- Organization (company info)
- LocalBusiness (location-based businesses)
- BreadcrumbList (navigation paths)
- Review/AggregateRating (ratings and reviews)

**Robots.txt Configuration:**
```
User-agent: *
Disallow: /admin/
Disallow: /private/
Disallow: /api/
Allow: /api/public/

Sitemap: https://example.com/sitemap.xml
```

**XML Sitemap Structure:**
```xml
<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>https://example.com/</loc>
    <lastmod>2024-01-15</lastmod>
    <changefreq>weekly</changefreq>
    <priority>1.0</priority>
  </url>
  <url>
    <loc>https://example.com/blog/react-hooks-guide</loc>
    <lastmod>2024-01-10</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.8</priority>
  </url>
</urlset>
```

**Canonical Tags:**
```html
<!-- Prevent duplicate content issues -->
<link rel="canonical" href="https://example.com/original-page">

<!-- Handle URL parameters -->
<link rel="canonical" href="https://example.com/products/shoes">
<!-- Even if accessed via: /products/shoes?color=red&size=10 -->
```

### 5. Core Web Vitals

**Largest Contentful Paint (LCP) - Target: < 2.5s**
- Optimize images and videos
- Use CDN for static assets
- Minimize render-blocking resources
- Implement lazy loading

**First Input Delay (FID) - Target: < 100ms**
- Minimize JavaScript execution time
- Break up long tasks
- Use web workers for heavy computations
- Defer non-critical JavaScript

**Cumulative Layout Shift (CLS) - Target: < 0.1**
- Set size attributes on images and videos
- Avoid inserting content above existing content
- Use transform animations instead of layout-triggering properties
- Reserve space for ads and embeds

**Page Speed Optimization:**
```html
<!-- Preload critical resources -->
<link rel="preload" href="/fonts/main.woff2" as="font" crossorigin>

<!-- Defer non-critical CSS -->
<link rel="preload" href="/styles/non-critical.css" as="style" onload="this.onload=null;this.rel='stylesheet'">

<!-- Async/defer JavaScript -->
<script src="/js/analytics.js" async></script>
<script src="/js/main.js" defer></script>
```

### 6. Mobile SEO

**Mobile-First Optimization:**
- Responsive design (mobile-friendly test passed)
- Touch-friendly buttons (minimum 48x48px)
- Readable font sizes (16px minimum)
- Proper viewport configuration
- Fast mobile page speed

**Viewport Configuration:**
```html
<meta name="viewport" content="width=device-width, initial-scale=1">
```

### 7. Internal Linking Strategy

**Best Practices:**
