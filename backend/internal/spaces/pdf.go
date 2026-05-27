package spaces

import (
	"bytes"
	"fmt"
	"io"
	"log"
	"strings"
	"unicode/utf8"

	"github.com/ledongthuc/pdf"
)

// extractPDFText pulls plain text out of a PDF byte stream. Returns "" on
// any failure — the previous extractText() path simply ignored
// application/pdf, so this is strictly an improvement: a failure mode
// just stays the old behaviour rather than blocking the upload.
//
// We use ledongthuc/pdf (pure Go, no CGO). Extraction is non-exhaustive
// (it doesn't handle every PDF feature — embedded fonts, complex
// glyph maps, encrypted PDFs) but it's good enough for the common
// "uploaded a research paper / clinic note" case the chat grounding
// flow targets. Real OCR / Tika integration is a follow-up when the
// long tail starts to matter.
func extractPDFText(body []byte) string {
	defer func() {
		// The library panics on malformed PDFs more often than it
		// returns errors. Without recover, a single bad upload crashes
		// the whole handler goroutine — which on the http.Server
		// default crashes the process.
		if r := recover(); r != nil {
			log.Printf("pdf: panic during text extraction: %v", r)
		}
	}()
	r, err := pdf.NewReader(bytes.NewReader(body), int64(len(body)))
	if err != nil {
		return ""
	}
	var out strings.Builder
	out.Grow(len(body) / 4) // rough heuristic — PDFs are mostly metadata + glyphs
	// PlainText() flattens all pages into a single reader; some
	// versions of the library return an error here on encrypted PDFs.
	rd, err := r.GetPlainText()
	if err != nil {
		return ""
	}
	// Cap at 4 MiB of extracted text per upload — defends against a
	// PDF with a million pages spilling unbounded memory.
	const maxExtract = 4 << 20
	if _, err := io.Copy(&out, io.LimitReader(rd, maxExtract+1)); err != nil {
		return ""
	}
	s := out.String()
	if len(s) > maxExtract {
		s = s[:maxExtract]
	}
	// Coerce invalid UTF-8 so the result is safe to insert into a
	// TEXT column / to_tsvector index without poisoning the call.
	if !utf8.ValidString(s) {
		s = strings.ToValidUTF8(s, "�")
	}
	// Collapse runs of whitespace — PDFs typically emit a newline per
	// line of original text, which gives the FTS index a long tail of
	// useless single-token rows.
	s = collapseWhitespace(s)
	return s
}

func collapseWhitespace(s string) string {
	var b strings.Builder
	b.Grow(len(s))
	prevSpace := false
	for _, r := range s {
		if r == ' ' || r == '\t' || r == '\n' || r == '\r' || r == '\v' {
			if !prevSpace {
				b.WriteByte(' ')
				prevSpace = true
			}
			continue
		}
		b.WriteRune(r)
		prevSpace = false
	}
	return b.String()
}

// isPDFHeader detects a PDF by its 4-byte magic ("%PDF") so an
// octet-stream mis-labelling doesn't bypass the dedicated extractor.
func isPDFHeader(b []byte) bool {
	return len(b) >= 4 && b[0] == '%' && b[1] == 'P' && b[2] == 'D' && b[3] == 'F'
}

// Sanity check at compile time that fmt is used elsewhere; keeps the
// import group readable even if PlainText error formatting moves.
var _ = fmt.Sprintf
