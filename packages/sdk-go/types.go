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
	PrintBackground *bool   `json:"printBackground,omitempty"`
}

// WatermarkOptions controls the watermark applied to the PDF.
type WatermarkOptions struct {
	Text     string  `json:"text,omitempty"`
	Color    string  `json:"color,omitempty"`
	Opacity  float64 `json:"opacity,omitempty"`
	Angle    float64 `json:"angle,omitempty"`
	FontSize float64 `json:"fontSize,omitempty"`
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

// --------------------------------------------------------------------------
// PDF tools
// --------------------------------------------------------------------------

// PdfBlobResponse is the common shape for endpoints that return either a
// hosted URL or base64 bytes plus the file size.
type PdfBlobResponse struct {
	URL      string `json:"url,omitempty"`
	Data     string `json:"data,omitempty"`
	FileSize int64  `json:"file_size"`
}

// PdfSplitPart is one part of a split result.
type PdfSplitPart struct {
	URL      string `json:"url,omitempty"`
	Data     string `json:"data,omitempty"`
	FileSize int64  `json:"file_size"`
}

// PdfSplitResponse is the response from /v1/pdf/split.
type PdfSplitResponse struct {
	Parts []PdfSplitPart `json:"parts"`
	Total int            `json:"total"`
}

// PdfInfoResponse is the response from /v1/pdf/info.
type PdfInfoResponse struct {
	Pages            int    `json:"pages"`
	FileSize         int64  `json:"fileSize,omitempty"`
	Title            string `json:"title,omitempty"`
	Author           string `json:"author,omitempty"`
	Subject          string `json:"subject,omitempty"`
	Keywords         string `json:"keywords,omitempty"`
	Creator          string `json:"creator,omitempty"`
	Producer         string `json:"producer,omitempty"`
	CreationDate     string `json:"creationDate,omitempty"`
	ModificationDate string `json:"modificationDate,omitempty"`
}

// PdfFormField is a name/value pair used by PdfFillForm.
type PdfFormField struct {
	Name  string      `json:"name"`
	Value interface{} `json:"value"`
}

// PdfFillFormParams configures /v1/pdf/forms/fill.
type PdfFillFormParams struct {
	PDF     string         `json:"pdf"`
	Fields  []PdfFormField `json:"fields"`
	Flatten bool           `json:"flatten,omitempty"`
	Output  string         `json:"output,omitempty"`
}

// PdfFormFieldDef describes a new form field for /v1/pdf/forms/add-fields.
type PdfFormFieldDef struct {
	Name         string      `json:"name"`
	Type         string      `json:"type"`
	Page         int         `json:"page"`
	X            float64     `json:"x"`
	Y            float64     `json:"y"`
	Width        float64     `json:"width,omitempty"`
	Height       float64     `json:"height,omitempty"`
	Options      []string    `json:"options,omitempty"`
	DefaultValue interface{} `json:"defaultValue,omitempty"`
}

// PdfAddFormFieldsParams configures /v1/pdf/forms/add-fields.
type PdfAddFormFieldsParams struct {
	PDF    string            `json:"pdf"`
	Fields []PdfFormFieldDef `json:"fields"`
	Output string            `json:"output,omitempty"`
}

// PdfListFormFieldsResponse is the response from /v1/pdf/forms/list-fields.
type PdfListFormFieldsResponse struct {
	Fields []struct {
		Name  string      `json:"name"`
		Type  string      `json:"type"`
		Value interface{} `json:"value,omitempty"`
	} `json:"fields"`
	Total int `json:"total"`
}

// PdfToPdfAParams configures /v1/pdf/pdfa.
type PdfToPdfAParams struct {
	PDF     string `json:"pdf"`
	Title   string `json:"title,omitempty"`
	Author  string `json:"author,omitempty"`
	Subject string `json:"subject,omitempty"`
	Output  string `json:"output,omitempty"`
}

// PdfSignSignatureMaterial is the optional cryptographic-signing payload
// for /v1/pdf/sign. When set, the API embeds a PAdES-B-B signature in
// addition to the visual annotation. The P12 blob is used ephemerally.
type PdfSignSignatureMaterial struct {
	// P12 is the PKCS#12 (P12 / PFX) credential, base64-encoded.
	// Max 100 KB decoded.
	P12 string `json:"p12"`
	// Password is the P12 passphrase; "" for unprotected P12s.
	Password string `json:"password,omitempty"`
}

// PdfSignAnnotationParams configures /v1/pdf/sign.
type PdfSignAnnotationParams struct {
	PDF       string                    `json:"pdf"`
	Name      string                    `json:"name"`
	Reason    string                    `json:"reason,omitempty"`
	Location  string                    `json:"location,omitempty"`
	Contact   string                    `json:"contact,omitempty"`
	Page      *int                      `json:"page,omitempty"`
	X         *float64                  `json:"x,omitempty"`
	Y         *float64                  `json:"y,omitempty"`
	Width     *float64                  `json:"width,omitempty"`
	Height    *float64                  `json:"height,omitempty"`
	Output    string                    `json:"output,omitempty"`
	Signature *PdfSignSignatureMaterial `json:"signature,omitempty"`
}

// PdfSignAnnotationResponse is returned by /v1/pdf/sign.
// SignatureAnnotationAdded is true on every successful response (a
// visual overlay is always drawn). CryptographicallySigned is true
// only when the request included Signature.
type PdfSignAnnotationResponse struct {
	URL                       string `json:"url,omitempty"`
	Data                      string `json:"data,omitempty"`
	FileSize                  int64  `json:"file_size"`
	SignatureAnnotationAdded  bool   `json:"signature_annotation_added"`
	CryptographicallySigned   bool   `json:"cryptographically_signed"`
	SignatureType             string `json:"signature_type,omitempty"`
}

// PdfProtectPermissions controls /v1/pdf/protect's PDF restriction flags.
// Print = "none" | "low" | "full" (default "full").
type PdfProtectPermissions struct {
	Print    string `json:"print,omitempty"`
	Modify   *bool  `json:"modify,omitempty"`
	Copy     *bool  `json:"copy,omitempty"`
	Annotate *bool  `json:"annotate,omitempty"`
}

// PdfProtectParams configures /v1/pdf/protect. At least one of
// UserPassword / OwnerPassword must be set.
type PdfProtectParams struct {
	PDF           string                 `json:"pdf"`
	UserPassword  string                 `json:"user_password,omitempty"`
	OwnerPassword string                 `json:"owner_password,omitempty"`
	Permissions   *PdfProtectPermissions `json:"permissions,omitempty"`
	Output        string                 `json:"output,omitempty"`
}

// PdfProtectResponse is returned by /v1/pdf/protect.
type PdfProtectResponse struct {
	URL        string `json:"url,omitempty"`
	Data       string `json:"data,omitempty"`
	FileSize   int64  `json:"file_size"`
	Encrypted  bool   `json:"encrypted"`
	Encryption string `json:"encryption"`
}

// --------------------------------------------------------------------------
// Marketplace + starter templates
// --------------------------------------------------------------------------

// MarketplaceTemplate is a public template returned by /v1/marketplace.
type MarketplaceTemplate struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Version   int    `json:"version"`
	UserID    string `json:"user_id"`
	IsPublic  bool   `json:"is_public"`
	CreatedAt string `json:"created_at"`
	UpdatedAt string `json:"updated_at"`
}

// MarketplaceListResponse wraps the /v1/marketplace listing.
type MarketplaceListResponse struct {
	Data    []MarketplaceTemplate `json:"data"`
	HasMore bool                  `json:"has_more"`
}

// CloneTemplateResponse is the response from cloning a marketplace or
// starter template.
type CloneTemplateResponse struct {
	ID        string `json:"id"`
	Name      string `json:"name"`
	Version   int    `json:"version"`
	CreatedAt string `json:"created_at"`
}

// StarterTemplate is a pre-built template returned by /v1/starter-templates.
type StarterTemplate struct {
	Slug        string                 `json:"slug"`
	Name        string                 `json:"name"`
	Description string                 `json:"description"`
	Category    string                 `json:"category"`
	SampleData  map[string]interface{} `json:"sample_data,omitempty"`
	HTMLContent string                 `json:"html_content,omitempty"`
}

// StarterTemplatesListResponse wraps the starter-templates listing.
type StarterTemplatesListResponse struct {
	Data    []StarterTemplate `json:"data"`
	HasMore bool              `json:"has_more"`
}

// --------------------------------------------------------------------------
// AI template generation
// --------------------------------------------------------------------------

// AiGenerateTemplateParams is the request shape for /v1/ai/generate-template.
type AiGenerateTemplateParams struct {
	Prompt    string   `json:"prompt"`
	Type      string   `json:"type,omitempty"`
	Style     string   `json:"style,omitempty"`
	Variables []string `json:"variables,omitempty"`
}

// AiGenerateTemplateResponse is the response from the AI endpoint. The
// HTML field is server-sanitized.
type AiGenerateTemplateResponse struct {
	HTML        string   `json:"html"`
	HTMLContent string   `json:"html_content"`
	Variables   []string `json:"variables"`
	Type        string   `json:"type,omitempty"`
	Style       string   `json:"style,omitempty"`
}

// --------------------------------------------------------------------------
// Template versions
// --------------------------------------------------------------------------

// TemplateVersion is one row in a template's version history.
type TemplateVersion struct {
	ID          string                 `json:"id"`
	Version     int                    `json:"version"`
	CreatedAt   string                 `json:"created_at"`
	HTMLContent string                 `json:"html_content,omitempty"`
	Schema      map[string]interface{} `json:"schema,omitempty"`
}

// TemplateVersionsResponse is the response from /v1/templates/:id/versions.
type TemplateVersionsResponse struct {
	CurrentVersion int               `json:"current_version"`
	Data           []TemplateVersion `json:"data"`
}
