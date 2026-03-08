// Package docuforge provides a Go client for the DocuForge PDF generation API.
package docuforge

import "encoding/json"

// CustomFormat specifies a custom page size with explicit width and height.
type CustomFormat struct {
	Width  string `json:"width"`
	Height string `json:"height"`
}

// Format represents a page format that can be either a preset string
// (e.g. "A4", "Letter", "Legal") or a CustomFormat with width and height.
type Format struct {
	Preset *string
	Custom *CustomFormat
}

// MarshalJSON implements json.Marshaler for Format.
func (f Format) MarshalJSON() ([]byte, error) {
	if f.Custom != nil {
		return json.Marshal(f.Custom)
	}
	if f.Preset != nil {
		return json.Marshal(*f.Preset)
	}
	return []byte("null"), nil
}

// UnmarshalJSON implements json.Unmarshaler for Format.
func (f *Format) UnmarshalJSON(data []byte) error {
	if len(data) == 0 || string(data) == "null" {
		return nil
	}
	// Try string first.
	var s string
	if err := json.Unmarshal(data, &s); err == nil {
		f.Preset = &s
		return nil
	}
	// Try object.
	var c CustomFormat
	if err := json.Unmarshal(data, &c); err != nil {
		return err
	}
	f.Custom = &c
	return nil
}

// FormatPreset creates a Format from a preset string such as "A4", "Letter", or "Legal".
func FormatPreset(preset string) *Format {
	return &Format{Preset: &preset}
}

// FormatCustom creates a Format from a custom width and height.
func FormatCustom(width, height string) *Format {
	return &Format{Custom: &CustomFormat{Width: width, Height: height}}
}

// MarginObject specifies individual margins for each side of the page.
type MarginObject struct {
	Top    string `json:"top,omitempty"`
	Right  string `json:"right,omitempty"`
	Bottom string `json:"bottom,omitempty"`
	Left   string `json:"left,omitempty"`
}

// Margin represents a page margin that can be either a uniform string
// (e.g. "1in") or a MarginObject with per-side values.
type Margin struct {
	Uniform *string
	Sides   *MarginObject
}

// MarshalJSON implements json.Marshaler for Margin.
func (m Margin) MarshalJSON() ([]byte, error) {
	if m.Sides != nil {
		return json.Marshal(m.Sides)
	}
	if m.Uniform != nil {
		return json.Marshal(*m.Uniform)
	}
	return []byte("null"), nil
}

// UnmarshalJSON implements json.Unmarshaler for Margin.
func (m *Margin) UnmarshalJSON(data []byte) error {
	if len(data) == 0 || string(data) == "null" {
		return nil
	}
	var s string
	if err := json.Unmarshal(data, &s); err == nil {
		m.Uniform = &s
		return nil
	}
	var obj MarginObject
	if err := json.Unmarshal(data, &obj); err != nil {
		return err
	}
	m.Sides = &obj
	return nil
}

// MarginUniform creates a Margin from a uniform string such as "1in".
func MarginUniform(value string) *Margin {
	return &Margin{Uniform: &value}
}

// MarginSides creates a Margin from individual side values.
func MarginSides(top, right, bottom, left string) *Margin {
	return &Margin{Sides: &MarginObject{Top: top, Right: right, Bottom: bottom, Left: left}}
}

// PDFOptions controls how the PDF is rendered.
type PDFOptions struct {
	Format          *Format `json:"format,omitempty"`
	Margin          *Margin `json:"margin,omitempty"`
	Orientation     string  `json:"orientation,omitempty"`
	Header          string  `json:"header,omitempty"`
	Footer          string  `json:"footer,omitempty"`
	PrintBackground *bool   `json:"print_background,omitempty"`
}

// WatermarkOptions controls the watermark applied to the PDF.
type WatermarkOptions struct {
	Text     string  `json:"text,omitempty"`
	Color    string  `json:"color,omitempty"`
	Opacity  float64 `json:"opacity,omitempty"`
	Angle    float64 `json:"angle,omitempty"`
	FontSize float64 `json:"font_size,omitempty"`
}

// GenerateParams are the parameters for generating a PDF from raw HTML.
type GenerateParams struct {
	HTML      string           `json:"html"`
	Options   *PDFOptions      `json:"options,omitempty"`
	Output    string           `json:"output,omitempty"`
	Webhook   string           `json:"webhook,omitempty"`
	Watermark *WatermarkOptions `json:"watermark,omitempty"`
}

// TemplateParams are the parameters for generating a PDF from a saved template.
type TemplateParams struct {
	Template string                 `json:"template"`
	Data     map[string]interface{} `json:"data"`
	Options  *PDFOptions            `json:"options,omitempty"`
	Output   string                 `json:"output,omitempty"`
	Webhook  string                 `json:"webhook,omitempty"`
}

// ReactParams are the parameters for generating a PDF from a React component.
type ReactParams struct {
	React   string                 `json:"react"`
	Data    map[string]interface{} `json:"data,omitempty"`
	Styles  string                 `json:"styles,omitempty"`
	Options *PDFOptions            `json:"options,omitempty"`
	Output  string                 `json:"output,omitempty"`
	Webhook string                 `json:"webhook,omitempty"`
}

// BatchItem represents a single item in a batch generation request.
type BatchItem struct {
	HTML     string                 `json:"html,omitempty"`
	React    string                 `json:"react,omitempty"`
	Template string                 `json:"template,omitempty"`
	Data     map[string]interface{} `json:"data,omitempty"`
	Styles   string                 `json:"styles,omitempty"`
	Options  *PDFOptions            `json:"options,omitempty"`
	Output   string                 `json:"output,omitempty"`
}

// BatchParams are the parameters for submitting a batch of PDF generation jobs.
type BatchParams struct {
	Items   []BatchItem `json:"items"`
	Webhook string      `json:"webhook,omitempty"`
}

// GenerateResponse is the response from a PDF generation request.
type GenerateResponse struct {
	ID               string `json:"id"`
	Status           string `json:"status"`
	URL              string `json:"url,omitempty"`
	Data             string `json:"data,omitempty"`
	Pages            int    `json:"pages"`
	FileSize         int64  `json:"file_size"`
	GenerationTimeMs int64  `json:"generation_time_ms"`
}

// BatchGenerationRef is a reference to an individual generation within a batch.
type BatchGenerationRef struct {
	ID    string `json:"id"`
	Index int    `json:"index"`
}

// BatchResponse is the response from a batch generation request.
type BatchResponse struct {
	BatchID     string               `json:"batch_id"`
	Total       int                  `json:"total"`
	Generations []BatchGenerationRef `json:"generations"`
	Status      string               `json:"status"`
}

// Generation represents a PDF generation record.
type Generation struct {
	ID               string  `json:"id"`
	TemplateID       *string `json:"template_id"`
	InputType        string  `json:"input_type"`
	Status           string  `json:"status"`
	URL              *string `json:"url"`
	Pages            *int    `json:"pages"`
	FileSize         *int64  `json:"file_size"`
	GenerationTimeMs *int64  `json:"generation_time_ms"`
	Error            *string `json:"error"`
	CreatedAt        string  `json:"created_at"`
}

// Template represents a saved PDF template.
type Template struct {
	ID          string                 `json:"id"`
	Name        string                 `json:"name"`
	HTMLContent string                 `json:"html_content,omitempty"`
	Schema      map[string]interface{} `json:"schema,omitempty"`
	Version     int                    `json:"version"`
	IsPublic    bool                   `json:"is_public"`
	CreatedAt   string                 `json:"created_at"`
	UpdatedAt   string                 `json:"updated_at"`
}

// CreateTemplateParams are the parameters for creating a new template.
type CreateTemplateParams struct {
	Name        string                 `json:"name"`
	HTMLContent string                 `json:"html_content"`
	Schema      map[string]interface{} `json:"schema,omitempty"`
	IsPublic    bool                   `json:"is_public"`
}

// UpdateTemplateParams are the parameters for updating an existing template.
// Only non-nil fields will be included in the request.
type UpdateTemplateParams struct {
	Name        *string                `json:"name,omitempty"`
	HTMLContent *string                `json:"html_content,omitempty"`
	Schema      map[string]interface{} `json:"schema,omitempty"`
	IsPublic    *bool                  `json:"is_public,omitempty"`
}

// UsageStats contains usage statistics for the current billing period.
type UsageStats struct {
	PeriodStart     string `json:"period_start"`
	PeriodEnd       string `json:"period_end"`
	GenerationCount int    `json:"generation_count"`
	TotalPages      int    `json:"total_pages"`
	TotalBytes      int64  `json:"total_bytes"`
	Plan            string `json:"plan"`
	Limit           int    `json:"limit"`
}

// ListResponse wraps a paginated list of generations.
type ListResponse struct {
	Data    []Generation `json:"data"`
	HasMore bool         `json:"has_more"`
}
