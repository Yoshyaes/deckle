# frozen_string_literal: true

require "faraday"
require "json"

module DocuForge
  class Client
    attr_reader :templates

    # Create a new DocuForge client.
    #
    # @param api_key [String] Your DocuForge API key.
    # @param base_url [String] API base URL.
    # @param timeout [Integer] Request timeout in seconds.
    def initialize(api_key:, base_url: "https://api.docuforge.dev", timeout: 30)
      raise ArgumentError, "DocuForge API key is required" if api_key.nil? || api_key.empty?

      @api_key = api_key
      @base_url = base_url.chomp("/")
      @timeout = timeout

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

    protected

    # Make an HTTP request and handle errors.
    #
    # @param method [Symbol] HTTP method (:get, :post, :put, :delete).
    # @param path [String] API path.
    # @param body [Hash, nil] Request body.
    # @return [Hash] Parsed JSON response.
    def request(method, path, body: nil)
      response = @conn.run_request(method, path, body ? JSON.generate(body) : nil, nil)

      begin
        data = JSON.parse(response.body)
      rescue JSON::ParserError
        raise Error.new(
          "Non-JSON response from API (status #{response.status})",
          status_code: response.status,
          code: "INVALID_RESPONSE"
        )
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

      data
    end
  end
end
