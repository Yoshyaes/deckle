package docuforge

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"
)

const (
	defaultBaseURL = "https://api.getdocuforge.dev"
	userAgent      = "docuforge-go/0.1.0"
)

// --------------------------------------------------------------------------
// Error types
// --------------------------------------------------------------------------

// APIError represents a generic error response from the DocuForge API.
type APIError struct {
	// StatusCode is the HTTP status code returned by the API.
	StatusCode int
	// Code is the machine-readable error code (e.g. "UNKNOWN").
	Code string
	// Message is the human-readable error description.
	Message string
}

// Error implements the error interface.
func (e *APIError) Error() string {
	return fmt.Sprintf("docuforge: %s (status %d, code %s)", e.Message, e.StatusCode, e.Code)
}

// AuthenticationError is returned when the API key is invalid or missing (HTTP 401).
type AuthenticationError struct {
	// Message is the human-readable error description.
	Message string
}

// Error implements the error interface.
func (e *AuthenticationError) Error() string {
	return fmt.Sprintf("docuforge: authentication failed: %s", e.Message)
}

// RateLimitError is returned when the API rate limit has been exceeded (HTTP 429).
type RateLimitError struct {
	// RetryAfter is the number of seconds to wait before retrying.
	RetryAfter int
	// Message is the human-readable error description.
	Message string
}

// Error implements the error interface.
func (e *RateLimitError) Error() string {
	return fmt.Sprintf("docuforge: rate limit exceeded, retry after %ds: %s", e.RetryAfter, e.Message)
}

// --------------------------------------------------------------------------
// Client options
// --------------------------------------------------------------------------

// Option configures the Client.
type Option func(*Client)

// WithBaseURL overrides the default API base URL.
func WithBaseURL(url string) Option {
	return func(c *Client) {
		c.baseURL = strings.TrimRight(url, "/")
	}
}

// WithHTTPClient sets a custom *http.Client for making API requests.
func WithHTTPClient(hc *http.Client) Option {
	return func(c *Client) {
		c.httpClient = hc
	}
}

// WithTimeout sets the timeout for HTTP requests. The default is 30 seconds.
func WithTimeout(d time.Duration) Option {
	return func(c *Client) {
		c.httpClient.Timeout = d
	}
}

// WithMaxRetries sets the maximum number of retries for failed requests
// (429/500/502/503/504). The default is 3.
func WithMaxRetries(n int) Option {
	return func(c *Client) {
		c.maxRetries = n
	}
}

// --------------------------------------------------------------------------
// Client
// --------------------------------------------------------------------------

// Client is the DocuForge API client. Create one with NewClient and use its
// methods to generate PDFs, manage templates, and query usage.
type Client struct {
	apiKey     string
	baseURL    string
	httpClient *http.Client
	maxRetries int

	// Templates provides access to template management operations.
	Templates *Templates
}

// NewClient creates a new DocuForge API client.
//
// The apiKey is required and must be a valid DocuForge API key. Use functional
// options to customise the base URL, HTTP client, or request timeout.
//
//	client := docuforge.NewClient("df_live_...",
//	    docuforge.WithTimeout(60 * time.Second),
//	)
func NewClient(apiKey string, opts ...Option) *Client {
	if apiKey == "" {
		panic("docuforge: API key is required")
	}
	c := &Client{
		apiKey:     apiKey,
		baseURL:    defaultBaseURL,
		maxRetries: 3,
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
	for _, opt := range opts {
		opt(c)
	}
	c.Templates = &Templates{client: c}
	return c
}

// --------------------------------------------------------------------------
// Internal helpers
// --------------------------------------------------------------------------

// apiErrorBody is the expected JSON body for error responses.
type apiErrorBody struct {
	Error struct {
		Message string `json:"message"`
		Code    string `json:"code"`
	} `json:"error"`
}

// isRetryableStatus reports whether the HTTP status code is safe to retry.
func isRetryableStatus(code int) bool {
	switch code {
	case 429, 500, 502, 503, 504:
		return true
	}
	return false
}

// doRequest performs an HTTP request and decodes the JSON response into dest.
// If dest is nil the response body is discarded (useful for DELETE requests
// where only the status code matters). Retries retryable errors with
// exponential backoff.
func (c *Client) doRequest(ctx context.Context, method, path string, body interface{}, dest interface{}) error {
	reqURL := c.baseURL + path

	var bodyBytes []byte
	if body != nil {
		b, err := json.Marshal(body)
		if err != nil {
			return fmt.Errorf("docuforge: failed to marshal request body: %w", err)
		}
		bodyBytes = b
	}

	var lastErr error
	for attempt := 0; attempt <= c.maxRetries; attempt++ {
		var reqBody io.Reader
		if bodyBytes != nil {
			reqBody = bytes.NewReader(bodyBytes)
		}

		req, err := http.NewRequestWithContext(ctx, method, reqURL, reqBody)
		if err != nil {
			return fmt.Errorf("docuforge: failed to create request: %w", err)
		}

		req.Header.Set("Authorization", "Bearer "+c.apiKey)
		req.Header.Set("User-Agent", userAgent)
		if body != nil {
			req.Header.Set("Content-Type", "application/json")
		}

		resp, err := c.httpClient.Do(req)
		if err != nil {
			lastErr = fmt.Errorf("docuforge: request failed: %w", err)
			if attempt < c.maxRetries {
				delay := time.Duration(1<<uint(attempt)) * time.Second
				select {
				case <-ctx.Done():
					return ctx.Err()
				case <-time.After(delay):
				}
				continue
			}
			return lastErr
		}

		respBytes, err := io.ReadAll(io.LimitReader(resp.Body, 50*1024*1024))
		resp.Body.Close()
		if err != nil {
			return fmt.Errorf("docuforge: failed to read response body: %w", err)
		}

		if resp.StatusCode >= 400 {
			// Retry on retryable status codes unless exhausted
			if isRetryableStatus(resp.StatusCode) && attempt < c.maxRetries {
				var delay time.Duration
				if resp.StatusCode == 429 {
					if ra := resp.Header.Get("Retry-After"); ra != "" {
						if v, parseErr := strconv.Atoi(ra); parseErr == nil {
							delay = time.Duration(v) * time.Second
						}
					}
					if delay == 0 {
						delay = time.Duration(1<<uint(attempt)) * time.Second
					}
				} else {
					delay = time.Duration(1<<uint(attempt)) * time.Second
				}
				select {
				case <-ctx.Done():
					return ctx.Err()
				case <-time.After(delay):
				}
				continue
			}
			return c.handleErrorResponse(resp, respBytes)
		}

		if dest != nil && len(respBytes) > 0 {
			if err := json.Unmarshal(respBytes, dest); err != nil {
				return fmt.Errorf("docuforge: failed to decode response: %w", err)
			}
		}

		return nil
	}

	return lastErr
}

// handleErrorResponse parses an error response and returns the appropriate
// error type based on the HTTP status code.
func (c *Client) handleErrorResponse(resp *http.Response, body []byte) error {
	var errBody apiErrorBody
	_ = json.Unmarshal(body, &errBody) // best-effort parse

	msg := errBody.Error.Message
	code := errBody.Error.Code

	switch resp.StatusCode {
	case http.StatusUnauthorized:
		if msg == "" {
			msg = "Invalid API key"
		}
		return &AuthenticationError{Message: msg}

	case http.StatusTooManyRequests:
		if msg == "" {
			msg = "Rate limit exceeded"
		}
		retryAfter := 1
		if ra := resp.Header.Get("Retry-After"); ra != "" {
			if v, err := strconv.Atoi(ra); err == nil {
				retryAfter = v
			}
		}
		return &RateLimitError{RetryAfter: retryAfter, Message: msg}

	default:
		if msg == "" {
			msg = "Request failed"
		}
		if code == "" {
			code = "UNKNOWN"
		}
		return &APIError{StatusCode: resp.StatusCode, Code: code, Message: msg}
	}
}

// --------------------------------------------------------------------------
// PDF generation methods
// --------------------------------------------------------------------------

// Generate creates a PDF from raw HTML.
//
//	resp, err := client.Generate(ctx, docuforge.GenerateParams{
//	    HTML: "<h1>Invoice #1234</h1>",
//	    Options: &docuforge.PDFOptions{Format: docuforge.FormatPreset("A4")},
//	})
func (c *Client) Generate(ctx context.Context, params GenerateParams) (*GenerateResponse, error) {
	var result GenerateResponse
	if err := c.doRequest(ctx, http.MethodPost, "/v1/generate", params, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// FromTemplate generates a PDF by merging data into a saved template.
//
//	resp, err := client.FromTemplate(ctx, docuforge.TemplateParams{
//	    Template: "tmpl_abc123",
//	    Data:     map[string]interface{}{"name": "Acme Corp", "amount": 500},
//	})
func (c *Client) FromTemplate(ctx context.Context, params TemplateParams) (*GenerateResponse, error) {
	var result GenerateResponse
	if err := c.doRequest(ctx, http.MethodPost, "/v1/generate", params, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// FromReact generates a PDF from a React component string.
//
// Pass a JSX/TSX source with a default-exported function component. Props
// are supplied via the Data field.
//
//	resp, err := client.FromReact(ctx, docuforge.ReactParams{
//	    React: `export default function Invoice({ company }) { return <h1>{company}</h1>; }`,
//	    Data:  map[string]interface{}{"company": "Acme Corp"},
//	})
func (c *Client) FromReact(ctx context.Context, params ReactParams) (*GenerateResponse, error) {
	var result GenerateResponse
	if err := c.doRequest(ctx, http.MethodPost, "/v1/generate", params, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Batch submits multiple PDF generation jobs for asynchronous processing.
//
//	resp, err := client.Batch(ctx, docuforge.BatchParams{
//	    Items: []docuforge.BatchItem{
//	        {HTML: "<h1>Doc 1</h1>"},
//	        {Template: "tmpl_xxx", Data: map[string]interface{}{"name": "Acme"}},
//	    },
//	    Webhook: "https://example.com/webhook",
//	})
func (c *Client) Batch(ctx context.Context, params BatchParams) (*BatchResponse, error) {
	var result BatchResponse
	if err := c.doRequest(ctx, http.MethodPost, "/v1/generate/batch", params, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// --------------------------------------------------------------------------
// Generation queries
// --------------------------------------------------------------------------

// GetGeneration retrieves a generation by its ID.
func (c *Client) GetGeneration(ctx context.Context, id string) (*Generation, error) {
	var result Generation
	if err := c.doRequest(ctx, http.MethodGet, "/v1/generations/"+id, nil, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// ListGenerations returns a paginated list of recent generations.
//
// Use limit to control how many results are returned (max varies by plan) and
// offset to paginate through results.
func (c *Client) ListGenerations(ctx context.Context, limit, offset int) (*ListResponse, error) {
	path := fmt.Sprintf("/v1/generations?limit=%d&offset=%d", limit, offset)
	var result ListResponse
	if err := c.doRequest(ctx, http.MethodGet, path, nil, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// --------------------------------------------------------------------------
// Usage
// --------------------------------------------------------------------------

// GetUsage returns usage statistics for the current billing period.
func (c *Client) GetUsage(ctx context.Context) (*UsageStats, error) {
	var result UsageStats
	if err := c.doRequest(ctx, http.MethodGet, "/v1/usage", nil, &result); err != nil {
		return nil, err
	}
	return &result, nil
}
