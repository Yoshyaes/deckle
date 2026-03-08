# frozen_string_literal: true

require_relative "lib/docuforge/version"

Gem::Specification.new do |spec|
  spec.name = "docuforge"
  spec.version = DocuForge::VERSION
  spec.authors = ["DocuForge"]
  spec.email = ["support@docuforge.dev"]

  spec.summary = "Ruby SDK for the DocuForge PDF generation API"
  spec.description = "Generate PDFs from HTML, templates, and React components using the DocuForge API."
  spec.homepage = "https://docuforge.dev"
  spec.license = "MIT"
  spec.required_ruby_version = ">= 3.0"

  spec.metadata["homepage_uri"] = spec.homepage
  spec.metadata["source_code_uri"] = "https://github.com/docuforge/docuforge-ruby"

  spec.files = Dir["lib/**/*.rb", "LICENSE", "README.md"]
  spec.require_paths = ["lib"]

  spec.add_dependency "faraday", "~> 2.0"
end
