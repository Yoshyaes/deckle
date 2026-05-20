package docuforge

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
)

// helper: spin up an httptest server that records the request shape
// and returns the supplied JSON body + status.
func newTestServer(t *testing.T, status int, body any) (*httptest.Server, *http.Request) {
	t.Helper()
	var captured *http.Request
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Capture the request before draining the body so test code
		// can inspect headers and method.
		captured = r.Clone(r.Context())
		if r.Body != nil {
			buf, _ := io.ReadAll(r.Body)
			captured.Body = io.NopCloser(strings.NewReader(string(buf)))
			r.Body.Close()
		}
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(status)
		_ = json.NewEncoder(w).Encode(body)
	}))
	t.Cleanup(srv.Close)
	// captured is set on the first request, so callers should use the
	// pointer indirectly via getCaptured below.
	return srv, captured
}

// Capture the most-recent request via a closure (the slice trick lets
// us read it back from the test even though httptest's handler is
// async-ish from the test's perspective).
func newCapturingServer(t *testing.T, status int, body any) (*httptest.Server, *[]*http.Request) {
	t.Helper()
	reqs := []*http.Request{}
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		clone := r.Clone(r.Context())
		if r.Body != nil {
			buf, _ := io.ReadAll(r.Body)
			clone.Body = io.NopCloser(strings.NewReader(string(buf)))
			r.Body.Close()
		}
		reqs = append(reqs, clone)
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(status)
		_ = json.NewEncoder(w).Encode(body)
	}))
	t.Cleanup(srv.Close)
	return srv, &reqs
}

func TestNewClientPanicsOnEmptyAPIKey(t *testing.T) {
	defer func() {
		if r := recover(); r == nil {
			t.Fatal("expected panic on empty API key")
		}
	}()
	_ = NewClient("")
}

func TestGenerateSendsBearerAuthAndCorrectBody(t *testing.T) {
	srv, reqs := newCapturingServer(t, 200, map[string]any{
		"id":                 "gen_1",
		"status":             "completed",
		"url":                "https://cdn.example/x.pdf",
		"pages":              1,
		"file_size":          1024,
		"generation_time_ms": 100,
	})

	client := NewClient("df_live_test", WithBaseURL(srv.URL), WithMaxRetries(0))
	resp, err := client.Generate(context.Background(), GenerateParams{HTML: "<h1>x</h1>"})
	if err != nil {
		t.Fatalf("Generate: %v", err)
	}
	if resp.ID != "gen_1" {
		t.Errorf("ID = %q, want gen_1", resp.ID)
	}

	if len(*reqs) != 1 {
		t.Fatalf("got %d requests, want 1", len(*reqs))
	}
	r := (*reqs)[0]
	if r.Method != http.MethodPost {
		t.Errorf("method = %s, want POST", r.Method)
	}
	if got := r.Header.Get("Authorization"); got != "Bearer df_live_test" {
		t.Errorf("Authorization = %q, want Bearer df_live_test", got)
	}
	if got := r.URL.Path; got != "/v1/generate" {
		t.Errorf("path = %s, want /v1/generate", got)
	}
}

func TestUnauthorizedReturnsAuthenticationError(t *testing.T) {
	srv, _ := newTestServer(t, 401, map[string]any{
		"error": map[string]any{"code": "UNAUTHORIZED", "message": "bad key"},
	})
	client := NewClient("df_live_test", WithBaseURL(srv.URL), WithMaxRetries(0))
	_, err := client.GetUsage(context.Background())
	var authErr *AuthenticationError
	if !errors.As(err, &authErr) {
		t.Fatalf("error = %v, want *AuthenticationError", err)
	}
}

func TestRateLimitedReturnsRateLimitError(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Retry-After", "9")
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(429)
		_, _ = w.Write([]byte(`{"error":{"code":"RATE_LIMITED","message":"slow"}}`))
	}))
	t.Cleanup(srv.Close)

	client := NewClient("df_live_test", WithBaseURL(srv.URL), WithMaxRetries(0))
	_, err := client.GetUsage(context.Background())
	var rl *RateLimitError
	if !errors.As(err, &rl) {
		t.Fatalf("error = %v, want *RateLimitError", err)
	}
	if rl.RetryAfter != 9 {
		t.Errorf("RetryAfter = %d, want 9", rl.RetryAfter)
	}
}

func TestPdfMergeUsesCorrectPath(t *testing.T) {
	srv, reqs := newCapturingServer(t, 200, map[string]any{
		"url":       "https://cdn.example/merged.pdf",
		"file_size": 2048,
	})
	client := NewClient("df_live_test", WithBaseURL(srv.URL), WithMaxRetries(0))
	_, err := client.PdfMerge(context.Background(), []string{"a", "b"}, "url")
	if err != nil {
		t.Fatalf("PdfMerge: %v", err)
	}
	if got := (*reqs)[0].URL.Path; got != "/v1/pdf/merge" {
		t.Errorf("path = %s, want /v1/pdf/merge", got)
	}
}

func TestMarketplaceListUsesGET(t *testing.T) {
	srv, reqs := newCapturingServer(t, 200, map[string]any{"data": []any{}})
	client := NewClient("df_live_test", WithBaseURL(srv.URL), WithMaxRetries(0))
	_, err := client.ListMarketplace(context.Background())
	if err != nil {
		t.Fatalf("ListMarketplace: %v", err)
	}
	r := (*reqs)[0]
	if r.Method != http.MethodGet {
		t.Errorf("method = %s, want GET", r.Method)
	}
	if r.URL.Path != "/v1/marketplace" {
		t.Errorf("path = %s, want /v1/marketplace", r.URL.Path)
	}
}

func TestPlanResolutionViaTypes(t *testing.T) {
	// Smoke test: WatermarkOptions now serializes FontSize via the
	// camelCase JSON tag (sprint-5 fix). If a future refactor
	// reintroduces font_size this test catches it.
	w := WatermarkOptions{Text: "DRAFT", FontSize: 48}
	buf, err := json.Marshal(w)
	if err != nil {
		t.Fatalf("Marshal: %v", err)
	}
	if !strings.Contains(string(buf), `"fontSize":48`) {
		t.Errorf("expected fontSize:48 in %s", string(buf))
	}
	if strings.Contains(string(buf), `"font_size"`) {
		t.Errorf("FontSize regressed to snake_case in %s", string(buf))
	}
}
