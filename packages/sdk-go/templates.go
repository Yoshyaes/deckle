package docuforge

import (
	"context"
	"net/http"
)

// Templates provides methods for managing PDF templates.
//
// Access it through the Client.Templates field:
//
//	client := docuforge.NewClient("df_live_...")
//	tmpl, err := client.Templates.Create(ctx, docuforge.CreateTemplateParams{
//	    Name:        "Invoice",
//	    HTMLContent: "<h1>Invoice for {{name}}</h1>",
//	})
type Templates struct {
	client *Client
}

// Create creates a new template.
func (t *Templates) Create(ctx context.Context, params CreateTemplateParams) (*Template, error) {
	var result Template
	if err := t.client.doRequest(ctx, http.MethodPost, "/v1/templates", params, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// List returns all templates owned by the authenticated user.
func (t *Templates) List(ctx context.Context) ([]Template, error) {
	var result struct {
		Data []Template `json:"data"`
	}
	if err := t.client.doRequest(ctx, http.MethodGet, "/v1/templates", nil, &result); err != nil {
		return nil, err
	}
	return result.Data, nil
}

// Get retrieves a single template by its ID.
func (t *Templates) Get(ctx context.Context, id string) (*Template, error) {
	var result Template
	if err := t.client.doRequest(ctx, http.MethodGet, "/v1/templates/"+id, nil, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Update modifies an existing template. Only the fields set in params will be
// changed; omitted fields remain unchanged.
func (t *Templates) Update(ctx context.Context, id string, params UpdateTemplateParams) (*Template, error) {
	var result Template
	if err := t.client.doRequest(ctx, http.MethodPut, "/v1/templates/"+id, params, &result); err != nil {
		return nil, err
	}
	return &result, nil
}

// Delete permanently removes a template by its ID.
func (t *Templates) Delete(ctx context.Context, id string) error {
	return t.client.doRequest(ctx, http.MethodDelete, "/v1/templates/"+id, nil, nil)
}
