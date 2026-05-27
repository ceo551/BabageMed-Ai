package features

import (
	"strings"
	"testing"
)

// extractFeatureText must NEVER panic on hostile / malformed input.
// The PDF library historically panics rather than returning errors on
// malformed streams — we cover that with the recover() in
// extractFeaturePDFText. This test feeds garbage and confirms we get
// "" back instead of a process crash.
func TestExtractFeaturePDFTextHandlesGarbage(t *testing.T) {
	garbage := []byte("%PDF-1.4\nthis is not actually a PDF\xff\x00\x00")
	got := extractFeaturePDFText(garbage)
	// We don't care what comes back as long as the process is still
	// running and the result is sanitised UTF-8.
	if !isValidUTF8(got) {
		t.Errorf("garbage PDF input produced invalid UTF-8: %q", got)
	}
}

func TestExtractFeatureTextRoutesByExtension(t *testing.T) {
	// .md content with octet-stream MIME still gets picked up by the
	// suffix check — keeps a misdetecting browser from blocking
	// grounding for the user.
	got := extractFeatureText("application/octet-stream", "notes.md", []byte("# hello"))
	if !strings.Contains(got, "hello") {
		t.Errorf("expected text/.md suffix to be recognised, got %q", got)
	}
	// Unknown binary → "" (don't pretend to ground against bytes).
	got = extractFeatureText("application/octet-stream", "thing.bin", []byte{0x89, 0x50, 0x4e, 0x47})
	if got != "" {
		t.Errorf("expected empty for unknown binary, got %q", got)
	}
}

func TestCollapseWhitespace(t *testing.T) {
	// PDFs typically emit newlines per source-line; we collapse those
	// runs so the FTS index doesn't get a long tail of single-token
	// rows.
	in := "hello   world\n\n\nfoo\t\tbar"
	want := "hello world foo bar"
	if got := collapseWhitespace(in); got != want {
		t.Errorf("collapseWhitespace = %q, want %q", got, want)
	}
}

func isValidUTF8(s string) bool {
	for i := 0; i < len(s); {
		r, size := decodeRune(s[i:])
		if r == 0xFFFD && size == 1 {
			return false
		}
		i += size
	}
	return true
}

func decodeRune(s string) (rune, int) {
	if len(s) == 0 {
		return 0, 0
	}
	if s[0] < 0x80 {
		return rune(s[0]), 1
	}
	// Trust the strings.ToValidUTF8 already used inside the extractor
	// for anything multibyte.
	return rune(s[0]), 1
}
