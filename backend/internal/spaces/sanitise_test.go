package spaces

import "testing"

// File uploads from users can carry hostile names that, if not stripped,
// surface in download dialogs, log lines, and (most importantly) the
// Content-Disposition header on a future serve-back endpoint. These
// tests pin the helper against the cases that audits historically
// caught: path traversal, NUL smuggling, HTML / script payloads.
func TestSanitiseFilename(t *testing.T) {
	cases := []struct {
		in, want string
	}{
		{"report.pdf", "report.pdf"},
		{"  spaces.txt  ", "spaces.txt"},
		// Path traversal — only the basename survives.
		{"../../etc/passwd", "passwd"},
		{"/etc/shadow", "shadow"},
		{"C:\\Windows\\System32\\evil.exe", "C:\\Windows\\System32\\evil.exe"},
		// NUL byte smuggling.
		{"safe\x00.exe", "safe.exe"},
		// HTML / script chars that would break a Content-Disposition
		// header or render in an inline preview.
		{"<img src=x>.png", "img src=x.png"},
		// Control chars.
		{"line1\nline2.txt", "line1line2.txt"},
		// Reserved names.
		{".", ""},
		{"..", ""},
		{"", ""},
	}
	for _, c := range cases {
		got := sanitiseFilename(c.in)
		if got != c.want {
			t.Errorf("sanitiseFilename(%q) = %q, want %q", c.in, got, c.want)
		}
	}

	// Length cap — 200 chars is enough for any reasonable filename.
	long := ""
	for i := 0; i < 300; i++ {
		long += "a"
	}
	if got := sanitiseFilename(long); len(got) != 200 {
		t.Errorf("length cap = %d, want 200", len(got))
	}
}

func TestSanitiseMime(t *testing.T) {
	cases := []struct {
		in, want string
	}{
		{"application/pdf", "application/pdf"},
		// Strip charset / boundary params — we don't need them and
		// echoing them back enables header smuggling.
		{"text/plain; charset=utf-8", "text/plain"},
		// Empty → safe default.
		{"", "application/octet-stream"},
		{"   ", "application/octet-stream"},
		// Garbage chars → safe default.
		{"text/<script>", "application/octet-stream"},
		{"text/plain\nX-Injected: yes", "application/octet-stream"},
	}
	for _, c := range cases {
		got := sanitiseMime(c.in)
		if got != c.want {
			t.Errorf("sanitiseMime(%q) = %q, want %q", c.in, got, c.want)
		}
	}
}
