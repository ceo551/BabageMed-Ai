---
name: professional-translation
description: Produce faithful, natural translations between any languages — preserving meaning, tone, register, and formatting, not word-for-word.
---

# Professional Translation

Translate so a native reader of the target language feels the text was written for them — never a literal, word-for-word rendering.

## Process
1. **Read for meaning first.** Identify intent, tone (formal/casual/marketing/legal/technical), audience, and any domain jargon before translating.
2. **Translate ideas, not words.** Restructure sentences to the target language's natural syntax. Keep paragraph and list structure, markdown, and inline code/URLs intact.
3. **Match register.** A legal contract, a tweet, and a children's book need different vocabularies and sentence rhythms. Preserve the source's level of formality.
4. **Preserve don't-translate items.** Leave proper nouns, brand names, code, file paths, URLs, and untranslatable terms in their original form. Keep numbers, dates, and units but localize their *format* (e.g. 1,000.5 ↔ 1.000,5; MM/DD/YYYY ↔ DD/MM/YYYY) to the target locale.
5. **Handle ambiguity explicitly.** If a term is ambiguous or has no direct equivalent, choose the best fit and, only when it materially matters, add a brief translator's note in brackets.

## Quality bar
- Idiomatic and fluent — no "translationese", no calques, no awkward literal idioms.
- Consistent terminology throughout (pick one rendering for each key term and reuse it).
- Correct grammatical gender, plurals, honorifics, and politeness levels for the target language.
- For Arabic/RTL targets: natural Modern Standard Arabic unless a dialect is requested; keep Latin-script technical terms and code LTR inline.

## Output
- Return the translation only, in the same format as the source (headings, lists, tables, code blocks preserved). Don't add commentary unless asked.
- If the user asks, also provide a short back-translation or a glossary of key term choices.
- Never drop, summarize, or add content the source doesn't contain.
