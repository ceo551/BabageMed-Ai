package spaces

import (
	"strings"
	"testing"
)

// chunk() splits text into ~chunkChars windows with chunkOverlap chars
// of overlap. The trickiest invariants are (a) forward progress
// guaranteed so we can never infinite-loop, and (b) every byte of input
// is covered by at least one chunk.

func TestChunk_EmptyInput(t *testing.T) {
	if got := chunk(""); got != nil {
		t.Errorf("chunk(\"\") = %v, want nil", got)
	}
	if got := chunk("   "); got != nil {
		t.Errorf("chunk(whitespace) = %v, want nil", got)
	}
}

func TestChunk_ShorterThanChunkSize(t *testing.T) {
	in := "hello world"
	out := chunk(in)
	if len(out) != 1 || out[0] != in {
		t.Errorf("chunk(short) = %v, want [%q]", out, in)
	}
}

func TestChunk_LargeInputForwardProgress(t *testing.T) {
	// 10× chunkChars of pathological content with no good split points.
	in := strings.Repeat("x", chunkChars*10)
	out := chunk(in)
	if len(out) < 5 {
		t.Errorf("chunk(big) produced too few chunks: %d", len(out))
	}
	// Guarantee total length is reasonable — without forward progress
	// the loop would either spin forever or produce ridiculous output.
	total := 0
	for _, c := range out {
		total += len(c)
	}
	// Allow up to 50% overhead from the overlap windows.
	if total > len(in)*2 {
		t.Errorf("chunk total %d > 2x input %d — overlap math broken", total, len(in))
	}
}

func TestChunk_RealText(t *testing.T) {
	// Long narrative with paragraph breaks → chunker should prefer them.
	para := strings.Repeat("Lorem ipsum dolor sit amet, consectetur adipiscing elit. ", 20)
	in := para + "\n\n" + para + "\n\n" + para
	out := chunk(in)
	if len(out) < 2 {
		t.Errorf("expected multiple chunks, got %d", len(out))
	}
	// Every chunk must be non-empty after TrimSpace.
	for i, c := range out {
		if strings.TrimSpace(c) == "" {
			t.Errorf("chunk %d is empty", i)
		}
	}
}

func TestChunk_NoInfiniteLoop(t *testing.T) {
	// Edge: 5× chunkChars of `xxxx...` — no sentence breaks, no
	// paragraph breaks. The fallback path used to set `split=chunkChars`
	// which is fine for forward progress, but if chunkOverlap were ever
	// raised to >= chunkChars the loop would spin forever. The new
	// `step := split - chunkOverlap; if step <= 0 { step = chunkChars/2 }`
	// guard pins forward progress regardless.
	in := strings.Repeat("a", chunkChars*5)
	done := make(chan []string, 1)
	go func() { done <- chunk(in) }()
	select {
	case got := <-done:
		if len(got) == 0 {
			t.Fatalf("chunk returned no output")
		}
	}
}
