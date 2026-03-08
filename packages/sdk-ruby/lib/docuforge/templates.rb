# frozen_string_literal: true

module DocuForge
  class Templates
    def initialize(client)
      @client = client
    end

    # Create a new template.
    #
    # @param name [String] Template name.
    # @param html_content [String] HTML content of the template.
    # @param schema [Hash, nil] JSON schema for template data validation.
    # @param is_public [Boolean] Whether the template is publicly accessible.
    # @return [Hash] Created template.
    def create(name:, html_content:, schema: nil, is_public: false)
      body = { "name" => name, "html_content" => html_content, "is_public" => is_public }
      body["schema"] = schema if schema

      @client.request(:post, "/v1/templates", body: body)
    end

    # List all templates.
    #
    # @return [Hash] List response with data array.
    def list
      @client.request(:get, "/v1/templates")
    end

    # Get a template by ID.
    #
    # @param id [String] Template ID.
    # @return [Hash] Template details.
    def get(id)
      @client.request(:get, "/v1/templates/#{id}")
    end

    # Update a template.
    #
    # @param id [String] Template ID.
    # @param name [String, nil] New template name.
    # @param html_content [String, nil] New HTML content.
    # @param schema [Hash, nil] New JSON schema.
    # @param is_public [Boolean, nil] New public visibility setting.
    # @return [Hash] Updated template.
    def update(id, name: nil, html_content: nil, schema: nil, is_public: nil)
      body = {}
      body["name"] = name unless name.nil?
      body["html_content"] = html_content unless html_content.nil?
      body["schema"] = schema unless schema.nil?
      body["is_public"] = is_public unless is_public.nil?

      @client.request(:put, "/v1/templates/#{id}", body: body)
    end

    # Delete a template.
    #
    # @param id [String] Template ID.
    # @return [Hash] Deletion confirmation.
    def delete(id)
      @client.request(:delete, "/v1/templates/#{id}")
    end
  end
end
