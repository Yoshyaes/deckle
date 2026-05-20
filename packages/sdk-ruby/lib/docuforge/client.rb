# frozen_string_literal: true

require "faraday"
require "json"

module DocuForge
  class Client
    attr_reader :templates

    # Status codes that are safe to retry.
    RETRYABLE_STATUS_CODES = [429, 500, 502, 503, 504].freeze

    # Create a new DocuForge client.
    #
    # @param api_key [String] Your DocuForge API key.
    # @param base_url [String] API base URL.
    # @param timeout [Integer] Request timeout in seconds.
    # @param max_retries [Integer] Maximum number of retries for failed requests (default 3).
    def initialize(api_key:, base_url: "https://api.getdocuforge.dev", timeout: 30, max_retries: 3)
      raise ArgumentError, "DocuForge API key is required" if api_key.nil? || api_key.empty?

      @api_key = api_key
      @base_url = base_url.chomp("/")
      @timeout = timeout
      @max_retries = max_retries

      @conn = Faraday.new(url: @base_url) do |f|
        f.options.timeout = @timeout
        f.options.open_timeout = @timeout
        f.headers["Authorization"] = "Bearer #{@api_key}"
        f.headers["Content-Type"] = "application/json"
        f.headers["User-Agent"] = "docuforge-ruby/#{DocuForge::VERSION}"
        f.adapter Faraday.default_adapter
      end

      @templates = Templates.new(self)
    end

    # Generate a PDF from raw HTML.
    #
    # @param html [String] HTML string to convert to PDF.
    # @param options [Hash, nil] PDF rendering options (format, margin, orientation, etc.).
    # @param output [String] Output format - "url" or "base64".
    # @param webhook [String, nil] URL to POST when generation completes.
    # @return [Hash] Generation response with id, status, url, etc.
    def generate(html:, options: nil, output: "url", webhook: nil, watermark: nil)
      body = { "html" => html, "output" => output }
      body["options"] = options if options
      body["webhook"] = webhook if webhook
      body["watermark"] = watermark if watermark

      request(:post, "/v1/generate", body: body)
    end

    # Generate a PDF from a saved template with dynamic data.
    #
    # @param template [String] Template ID (tmpl_xxx).
    # @param data [Hash] Data to merge into the template.
    # @param options [Hash, nil] PDF rendering options.
    # @param output [String] Output format - "url" or "base64".
    # @return [Hash] Generation response.
    def from_template(template:, data:, options: nil, output: "url", webhook: nil)
      body = { "template" => template, "data" => data, "output" => output }
      body["options"] = options if options
      body["webhook"] = webhook if webhook

      request(:post, "/v1/generate", body: body)
    end

    # Generate a PDF from a React component string.
    #
    # @param react [String] JSX/TSX component source with default export.
    # @param data [Hash, nil] Props to pass to the component.
    # @param styles [String, nil] CSS styles to inject.
    # @param options [Hash, nil] PDF rendering options.
    # @param output [String] Output format - "url" or "base64".
    # @return [Hash] Generation response.
    def from_react(react:, data: nil, styles: nil, options: nil, output: "url", webhook: nil)
      body = { "react" => react, "output" => output }
      body["data"] = data if data
      body["styles"] = styles if styles
      body["options"] = options if options
      body["webhook"] = webhook if webhook

      request(:post, "/v1/generate", body: body)
    end

    # Submit a batch of PDF generation jobs for async processing.
    #
    # @param items [Array<Hash>] List of generation requests.
    # @param webhook [String, nil] URL to POST when the batch completes.
    # @return [Hash] Batch response with batch_id, total, and generation IDs.
    def batch(items:, webhook: nil)
      body = { "items" => items }
      body["webhook"] = webhook if webhook

      request(:post, "/v1/generate/batch", body: body)
    end

    # Get a generation by ID.
    #
    # @param id [String] Generation ID.
    # @return [Hash] Generation details.
    def get_generation(id)
      request(:get, "/v1/generations/#{id}")
    end

    # List recent generations.
    #
    # @param limit [Integer] Maximum number of results (default 50).
    # @param offset [Integer] Offset for pagination (default 0).
    # @return [Hash] List response with data array.
    def list_generations(limit: 50, offset: 0)
      request(:get, "/v1/generations?limit=#{limit}&offset=#{offset}")
    end

    # Get usage statistics for the current billing period.
    #
    # @return [Hash] Usage statistics.
    def get_usage
      request(:get, "/v1/usage")
    end

    # ── PDF tools ──────────────────────────────────────────────────
    #
    # NOTE: `sign_annotation` returns `signature_annotation_added: true`
    # (not `signed:`) so it's clear that this is a visual annotation,
    # not a cryptographic signature. `protect` uses real AES-256
    # encryption via qpdf server-side.

    # Merge multiple base64-encoded PDFs into one. Requires >= 2 inputs.
    def pdf_merge(pdfs:, output: "url")
      request(:post, "/v1/pdf/merge", body: { "pdfs" => pdfs, "output" => output })
    end

    # Split a PDF by page ranges. Pass nil ranges to split every page.
    def pdf_split(pdf:, ranges: nil, output: "url")
      body = { "pdf" => pdf, "output" => output }
      body["ranges"] = ranges if ranges
      request(:post, "/v1/pdf/split", body: body)
    end

    # Get metadata about a PDF (page count, title, author, etc.).
    def pdf_info(pdf:)
      request(:post, "/v1/pdf/info", body: { "pdf" => pdf })
    end

    # Fill named form fields in an existing AcroForm PDF.
    def pdf_fill_form(pdf:, fields:, flatten: false, output: "url")
      request(:post, "/v1/pdf/forms/fill", body: {
        "pdf" => pdf,
        "fields" => fields,
        "flatten" => flatten,
        "output" => output
      })
    end

    # Add text / checkbox / dropdown form fields to a PDF.
    def pdf_add_form_fields(pdf:, fields:, output: "url")
      request(:post, "/v1/pdf/forms/add-fields", body: {
        "pdf" => pdf,
        "fields" => fields,
        "output" => output
      })
    end

    # List the form fields on a PDF.
    def pdf_list_form_fields(pdf:)
      request(:post, "/v1/pdf/forms/list-fields", body: { "pdf" => pdf })
    end

    # Convert a PDF to PDF/A-1b archival format.
    def pdf_to_pdfa(pdf:, title: nil, author: nil, subject: nil, output: "url")
      body = { "pdf" => pdf, "output" => output }
      body["title"] = title if title
      body["author"] = author if author
      body["subject"] = subject if subject
      request(:post, "/v1/pdf/pdfa", body: body)
    end

    # Sign a PDF.
    #
    # Without :signature → adds a VISUAL annotation only. Response has
    # signature_annotation_added=true and cryptographically_signed=false.
    #
    # With :signature → also embeds a real PAdES-B-B cryptographic
    # signature. :signature must be a hash with:
    #   :p12      base64-encoded PKCS#12 (P12/PFX) blob, max 100 KB decoded
    #   :password P12 passphrase ("" for unprotected P12s)
    # The P12 is sent over TLS and used ephemerally — never persisted.
    def pdf_sign_annotation(pdf:, name:, reason: nil, location: nil, contact: nil,
                            page: nil, x: nil, y: nil, width: nil, height: nil,
                            output: "url", signature: nil)
      body = { "pdf" => pdf, "name" => name, "output" => output }
      body["reason"]    = reason    unless reason.nil?
      body["location"]  = location  unless location.nil?
      body["contact"]   = contact   unless contact.nil?
      body["page"]      = page      unless page.nil?
      body["x"]         = x         unless x.nil?
      body["y"]         = y         unless y.nil?
      body["width"]     = width     unless width.nil?
      body["height"]    = height    unless height.nil?
      body["signature"] = signature unless signature.nil?
      request(:post, "/v1/pdf/sign", body: body)
    end

    # AES-256 encrypt a PDF. At least one of user_password / owner_password
    # must be set. If only one is supplied the other is mirrored on the
    # server so an empty owner password cannot be used to strip restrictions.
    #
    # permissions: hash with optional keys :print ("none" | "low" | "full"),
    # :modify (bool), :copy (bool), :annotate (bool).
    def pdf_protect(pdf:, user_password: nil, owner_password: nil,
                    permissions: nil, output: "url")
      if user_password.nil? && owner_password.nil?
        raise ArgumentError, "user_password or owner_password is required"
      end
      body = { "pdf" => pdf, "output" => output }
      body["user_password"]  = user_password  unless user_password.nil?
      body["owner_password"] = owner_password unless owner_password.nil?
      body["permissions"]    = permissions    unless permissions.nil?
      request(:post, "/v1/pdf/protect", body: body)
    end

    # ── Marketplace ────────────────────────────────────────────────

    def marketplace_list
      request(:get, "/v1/marketplace")
    end

    def marketplace_get(id)
      request(:get, "/v1/marketplace/#{id}")
    end

    def marketplace_clone(id)
      request(:post, "/v1/marketplace/#{id}/clone")
    end

    def marketplace_publish(id)
      request(:post, "/v1/marketplace/#{id}/publish")
    end

    def marketplace_unpublish(id)
      request(:post, "/v1/marketplace/#{id}/unpublish")
    end

    # Report a public marketplace template for moderator review.
    #
    # reason: one of "spam", "malicious", "copyright", "inappropriate",
    # "other". notes: optional, max 1000 chars.
    #
    # Returns { "report_id" => ..., "auto_actioned" => bool }.
    # auto_actioned is true when this report tripped the auto-hide
    # threshold (3 independent reports). Re-reporting the same template
    # from the same user yields a 409 (DocuForge::Error).
    def marketplace_report(id, reason:, notes: nil)
      body = { "reason" => reason }
      body["notes"] = notes unless notes.nil?
      request(:post, "/v1/marketplace/#{id}/report", body: body)
    end

    # ── Starter templates ──────────────────────────────────────────

    def starter_templates_list
      request(:get, "/v1/starter-templates")
    end

    def starter_templates_get(slug)
      request(:get, "/v1/starter-templates/#{slug}")
    end

    def starter_templates_clone(slug)
      request(:post, "/v1/starter-templates/#{slug}/clone")
    end

    # ── Template versions ─────────────────────────────────────────

    def list_template_versions(template_id)
      request(:get, "/v1/templates/#{template_id}/versions")
    end

    def get_template_version(template_id, version_id)
      request(:get, "/v1/templates/#{template_id}/versions/#{version_id}")
    end

    def restore_template_version(template_id, version_id)
      request(:post, "/v1/templates/#{template_id}/restore",
              body: { "version_id" => version_id })
    end

    # ── AI ────────────────────────────────────────────────────────

    # Generate a template from a natural-language prompt. The HTML
    # returned has been server-sanitized so it's safe to render.
    # Requires the server to be configured with ANTHROPIC_API_KEY.
    def generate_template_from_prompt(prompt:, variables: nil,
                                      template_type: "other", style: "professional")
      body = { "prompt" => prompt, "type" => template_type, "style" => style }
      body["variables"] = variables if variables
      request(:post, "/v1/ai/generate-template", body: body)
    end

    # Make an HTTP request and handle errors. Retries on 429/5xx with
    # exponential backoff.
    #
    # NOTE: this method is intentionally public so that Templates (a
    # separate class) can call `@client.request(...)`. Ruby's `protected`
    # keyword forbids cross-class invocations, which previously caused
    # every `templates.*` call to raise NoMethodError.
    #
    # @param method [Symbol] HTTP method (:get, :post, :put, :delete).
    # @param path [String] API path.
    # @param body [Hash, nil] Request body.
    # @return [Hash] Parsed JSON response.
    def request(method, path, body: nil)
      last_exception = nil

      (@max_retries + 1).times do |attempt|
        begin
          response = @conn.run_request(method, path, body ? JSON.generate(body) : nil, nil)
        rescue Faraday::ConnectionFailed, Faraday::TimeoutError => e
          last_exception = e
          if attempt < @max_retries
            sleep(2**attempt)
            next
          end
          raise
        end

        begin
          data = JSON.parse(response.body)
        rescue JSON::ParserError
          raise Error.new(
            "Non-JSON response from API (status #{response.status})",
            status_code: response.status,
            code: "INVALID_RESPONSE"
          )
        end

        # Retry on retryable status codes unless exhausted
        if RETRYABLE_STATUS_CODES.include?(response.status) && attempt < @max_retries
          delay = if response.status == 429
                    (response.headers["Retry-After"] || (2**attempt).to_s).to_f
                  else
                    2**attempt
                  end
          sleep(delay)
          next
        end

        if response.status == 401
          raise AuthenticationError, data.dig("error", "message") || "Unauthorized"
        end

        if response.status == 403
          raise UsageLimitError, data.dig("error", "message") || "Forbidden"
        end

        if response.status == 404
          raise NotFoundError, data.dig("error", "message") || "Not found"
        end

        if response.status == 429
          retry_after = (response.headers["Retry-After"] || "1").to_i
          raise RateLimitError.new(
            data.dig("error", "message") || "Rate limit exceeded",
            retry_after: retry_after
          )
        end

        unless response.success?
          error = data["error"] || {}
          raise Error.new(
            error["message"] || "Request failed",
            status_code: response.status,
            code: error["code"] || "UNKNOWN"
          )
        end

        return data
      end

      raise last_exception
    end
  end
end
