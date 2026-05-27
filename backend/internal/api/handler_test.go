package api

import "testing"

// Image / video model ids must be rejected by the text chat stream
// endpoint until a dedicated image/video routing layer ships. This
// list mirrors apps/web/app/lib/models.ts (IMAGE_MODELS + VIDEO_MODELS).
// If a new visual model is added there, add it here too — otherwise the
// frontend can pick a model the backend will silently fall back on.
func TestIsVisualModel(t *testing.T) {
	visual := []string{
		// images
		"gpt-image-2", "qwen-image-2.0",
		// video
		"sora-2", "kling-o3", "kling-3.0", "grok-imagine",
		"veo-3.1", "seedance-2.0", "happy-horse-1.0",
	}
	for _, id := range visual {
		if !isVisualModel(id) {
			t.Errorf("isVisualModel(%q) = false, want true", id)
		}
	}
	text := []string{
		"opus-4.7", "opus-4.6", "gpt-5.5", "gemini-pro-3.1",
		"glm-5.1", "kimi-k2.6", "deepseek-v4-pro", "qwen-3.7-max",
		"", "unknown-model",
	}
	for _, id := range text {
		if isVisualModel(id) {
			t.Errorf("isVisualModel(%q) = true, want false", id)
		}
	}
}

func TestBuildSystemFeatureInstructions(t *testing.T) {
	sys := buildSystem("bedside", "en", nil, nil, nil, "", "healthcare",
		"Always cite KDIGO 2024 when discussing CKD staging.")
	if !contains(sys, "healthcare") {
		t.Errorf("system prompt missing feature name: %s", sys)
	}
	if !contains(sys, "KDIGO 2024") {
		t.Errorf("system prompt missing feature instructions: %s", sys)
	}
	// Empty featureInstructions must not inject an empty block.
	sys = buildSystem("bedside", "en", nil, nil, nil, "", "writing", "   ")
	if contains(sys, "custom instructions for this feature") {
		t.Errorf("empty instructions still injected a block: %s", sys)
	}
}

func contains(s, sub string) bool {
	for i := 0; i+len(sub) <= len(s); i++ {
		if s[i:i+len(sub)] == sub {
			return true
		}
	}
	return false
}
