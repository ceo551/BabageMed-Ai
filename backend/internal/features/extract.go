package features

import (
	"bytes"
	"io"
	"log"
	"strings"
	"unicode/utf8"

	"github.com/ledongthuc/pdf"
)

// extractFeatureText mirrors spaces.extractText: pull plain text from a
// supported file type, return "" otherwise. Duplicated rather than
// imported so the features package stays a leaf (no circular
// dependency if spaces ever pulls feature-context).
func extractFeatureText(mime, name string, body []byte) string {
	mime = strings.ToLower(mime)
	lname := strings.ToLower(name)
	// PDF: detected by MIME, file extension, or the %PDF magic header.
	if mime == "application/pdf" || strings.HasSuffix(lname, ".pdf") || isPDFHeader(body) {
		return extractFeaturePDFText(body)
	}
	if strings.HasPrefix(mime, "text/") ||
		strings.HasSuffix(lname, ".md") ||
		strings.HasSuffix(lname, ".txt") ||
		strings.HasSuffix(lname, ".csv") ||
		strings.HasSuffix(lname, ".json") {
		s := string(body)
		if !utf8.ValidString(s) {
			s = strings.ToValidUTF8(s, "�")
		}
		return s
	}
	return ""
}

// extractFeaturePDFText is the per-package wrapper around ledongthuc/pdf.
// See spaces.extractPDFText for the design notes — identical behaviour,
// identical defences (panic recover, 4 MiB cap, UTF-8 coerce).
func extractFeaturePDFText(body []byte) string {
	defer func() {
		if r := recover(); r != nil {
			log.Printf("features pdf: panic during text extraction: %v", r)
		}
	}()
	r, err := pdf.NewReader(bytes.NewReader(body), int64(len(body)))
	if err != nil {
		return ""
	}
	rd, err := r.GetPlainText()
	if err != nil {
		return ""
	}
	const maxExtract = 4 << 20
	var out strings.Builder
	if _, err := io.Copy(&out, io.LimitReader(rd, maxExtract+1)); err != nil {
		return ""
	}
	s := out.String()
	if len(s) > maxExtract {
		s = s[:maxExtract]
	}
	if !utf8.ValidString(s) {
		s = strings.ToValidUTF8(s, "�")
	}
	return collapseWhitespace(s)
}

func isPDFHeader(b []byte) bool {
	return len(b) >= 4 && b[0] == '%' && b[1] == 'P' && b[2] == 'D' && b[3] == 'F'
}

func collapseWhitespace(s string) string {
	var b strings.Builder
	b.Grow(len(s))
	prev := false
	for _, r := range s {
		if r == ' ' || r == '\t' || r == '\n' || r == '\r' || r == '\v' {
			if !prev {
				b.WriteByte(' ')
				prev = true
			}
			continue
		}
		b.WriteRune(r)
		prev = false
	}
	return b.String()
}
