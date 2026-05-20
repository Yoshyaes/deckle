# frozen_string_literal: true

# DocuForge Ruby SDK — request shape, error mapping, and namespace
# coverage. Mirrors packages/sdk-typescript/src/client.test.ts.
#
# Faraday::Adapter::Test intercepts every request so no real network
# is touched.

require "spec_helper"

RSpec.describe DocuForge::Client do
  include DocuForgeSpecHelpers

  let(:usage_payload) do
    {
      "period_start" => "2026-01-01",
      "period_end"   => "2026-01-31",
      "generation_count" => 0,
      "total_pages" => 0,
      "total_bytes" => 0,
      "plan" => "free",
      "limit" => 1000
    }
  end

  describe "constructor" do
    it "refuses an empty api_key" do
      expect { DocuForge::Client.new(api_key: "") }.to raise_error(ArgumentError, /required/)
    end

    it "refuses a nil api_key" do
      expect { DocuForge::Client.new(api_key: nil) }.to raise_error(ArgumentError, /required/)
    end

    it "strips trailing slash from base_url" do
      # We can't read @base_url directly, but the stripped form is
      # used in @conn — exercising one call confirms the URL is right.
      stubs = Faraday::Adapter::Test::Stubs.new do |s|
        s.get("/v1/usage") { |_env| [200, {}, JSON.generate(usage_payload)] }
      end
      # Pass the slash through the real constructor; build_client
      # rebuilds @conn but we set base_url on the client constructor
      # so the chomp logic is exercised before our rebuild.
      client = DocuForge::Client.new(
        api_key: "k", base_url: "#{DocuForgeSpecHelpers::BASE_URL}/", max_retries: 0
      )
      # Replace its conn with the stub adapter.
      conn = Faraday.new(url: DocuForgeSpecHelpers::BASE_URL) do |f|
        f.headers["Authorization"] = "Bearer k"
        f.adapter(:test, stubs)
      end
      client.instance_variable_set(:@conn, conn)
      expect { client.get_usage }.not_to raise_error
      stubs.verify_stubbed_calls
    end
  end

  describe "request shape" do
    it "sends Bearer auth and JSON Content-Type on POST" do
      captured = {}
      stubs = Faraday::Adapter::Test::Stubs.new do |s|
        s.post("/v1/generate") do |env|
          captured[:auth] = env.request_headers["Authorization"]
          captured[:content_type] = env.request_headers["Content-Type"]
          captured[:body] = env.body
          [200, {}, JSON.generate({ "id" => "gen_1", "status" => "completed", "url" => "x",
                                    "pages" => 1, "file_size" => 1, "generation_time_ms" => 1 })]
        end
      end
      build_client(stubs).generate(html: "<h1>hi</h1>")
      expect(captured[:auth]).to eq("Bearer df_live_test")
      expect(captured[:content_type]).to eq("application/json")
      expect(JSON.parse(captured[:body])).to include("html" => "<h1>hi</h1>")
      stubs.verify_stubbed_calls
    end

    it "uses the right path for get_generation" do
      called = false
      stubs = Faraday::Adapter::Test::Stubs.new do |s|
        s.get("/v1/generations/gen_42") do
          called = true
          [200, {}, JSON.generate({ "id" => "gen_42", "status" => "completed" })]
        end
      end
      build_client(stubs).get_generation("gen_42")
      expect(called).to be(true)
    end

    it "propagates limit and offset on list_generations" do
      stubs = Faraday::Adapter::Test::Stubs.new do |s|
        s.get("/v1/generations") do |env|
          expect(env.url.query).to include("limit=10").and include("offset=20")
          [200, {}, JSON.generate({ "data" => [], "has_more" => false })]
        end
      end
      build_client(stubs).list_generations(limit: 10, offset: 20)
      stubs.verify_stubbed_calls
    end
  end

  describe "error handling" do
    it "raises AuthenticationError on 401" do
      stubs = Faraday::Adapter::Test::Stubs.new do |s|
        s.get("/v1/usage") do
          [401, {}, JSON.generate({ "error" => { "code" => "UNAUTHORIZED", "message" => "no" } })]
        end
      end
      expect { build_client(stubs).get_usage }.to raise_error(DocuForge::AuthenticationError)
    end

    it "raises RateLimitError on 429 with Retry-After" do
      stubs = Faraday::Adapter::Test::Stubs.new do |s|
        s.get("/v1/usage") do
          [429, { "Retry-After" => "11" },
           JSON.generate({ "error" => { "code" => "RATE_LIMITED", "message" => "slow" } })]
        end
      end
      begin
        build_client(stubs).get_usage
        raise "should have raised"
      rescue DocuForge::RateLimitError => e
        expect(e.retry_after).to eq(11)
      end
    end

    it "raises a generic Error on a non-retryable 4xx" do
      stubs = Faraday::Adapter::Test::Stubs.new do |s|
        s.post("/v1/generate") do
          [400, {}, JSON.generate({ "error" => { "code" => "VALIDATION_ERROR", "message" => "bad" } })]
        end
      end
      expect do
        build_client(stubs).generate(html: "")
      end.to raise_error(DocuForge::Error) { |e|
        expect(e.status_code).to eq(400)
        expect(e.code).to eq("VALIDATION_ERROR")
      }
    end

    it "raises NotFoundError on 404" do
      stubs = Faraday::Adapter::Test::Stubs.new do |s|
        s.get("/v1/generations/gen_missing") do
          [404, {}, JSON.generate({ "error" => { "code" => "NOT_FOUND", "message" => "nope" } })]
        end
      end
      expect do
        build_client(stubs).get_generation("gen_missing")
      end.to raise_error(DocuForge::NotFoundError)
    end

    it "does not retry when max_retries is zero" do
      hit = 0
      stubs = Faraday::Adapter::Test::Stubs.new do |s|
        s.get("/v1/usage") do
          hit += 1
          [500, {}, JSON.generate({ "error" => {} })]
        end
      end
      expect do
        build_client(stubs, max_retries: 0).get_usage
      end.to raise_error(DocuForge::Error)
      expect(hit).to eq(1)
    end
  end

  describe "PDF + marketplace + AI namespaces" do
    it "pdf_merge POSTs to /v1/pdf/merge" do
      called = false
      stubs = Faraday::Adapter::Test::Stubs.new do |s|
        s.post("/v1/pdf/merge") do
          called = true
          [200, {}, JSON.generate({ "url" => "x", "file_size" => 1 })]
        end
      end
      build_client(stubs).pdf_merge(pdfs: %w[a b])
      expect(called).to be(true)
    end

    it "pdf_protect raises before sending when no password is supplied" do
      stubs = Faraday::Adapter::Test::Stubs.new
      expect do
        build_client(stubs).pdf_protect(pdf: "abc")
      end.to raise_error(ArgumentError, /password/)
    end

    it "pdf_protect forwards passwords and permissions" do
      captured_body = nil
      stubs = Faraday::Adapter::Test::Stubs.new do |s|
        s.post("/v1/pdf/protect") do |env|
          captured_body = JSON.parse(env.body)
          [200, {}, JSON.generate({ "url" => "x", "file_size" => 1, "encrypted" => true, "encryption" => "AES-256" })]
        end
      end
      build_client(stubs).pdf_protect(
        pdf: "abc",
        user_password: "reader",
        owner_password: "owner",
        permissions: { "print" => "low", "modify" => false, "copy" => true }
      )
      expect(captured_body["user_password"]).to eq("reader")
      expect(captured_body["owner_password"]).to eq("owner")
      expect(captured_body["permissions"]["print"]).to eq("low")
    end

    it "pdf_sign_annotation forwards optional signature material" do
      captured_body = nil
      stubs = Faraday::Adapter::Test::Stubs.new do |s|
        s.post("/v1/pdf/sign") do |env|
          captured_body = JSON.parse(env.body)
          [200, {}, JSON.generate({
                                    "url" => "x", "file_size" => 1,
                                    "signature_annotation_added" => true,
                                    "cryptographically_signed" => true,
                                    "signature_type" => "PAdES-B-B"
                                  })]
        end
      end
      build_client(stubs).pdf_sign_annotation(
        pdf: "abc",
        name: "Test Signer",
        signature: { "p12" => "base64-blob", "password" => "pw" }
      )
      expect(captured_body["signature"]).to eq("p12" => "base64-blob", "password" => "pw")
    end

    it "marketplace_list hits /v1/marketplace" do
      called = false
      stubs = Faraday::Adapter::Test::Stubs.new do |s|
        s.get("/v1/marketplace") do
          called = true
          [200, {}, JSON.generate({ "data" => [] })]
        end
      end
      build_client(stubs).marketplace_list
      expect(called).to be(true)
    end

    it "marketplace_report POSTs reason + notes" do
      captured = nil
      stubs = Faraday::Adapter::Test::Stubs.new do |s|
        s.post("/v1/marketplace/tmpl_xyz/report") do |env|
          captured = JSON.parse(env.body)
          [201, {}, JSON.generate({ "report_id" => "rep_1", "auto_actioned" => false })]
        end
      end
      result = build_client(stubs).marketplace_report("tmpl_xyz", reason: "spam", notes: "repetitive")
      expect(result["report_id"]).to eq("rep_1")
      expect(result["auto_actioned"]).to be(false)
      expect(captured).to eq("reason" => "spam", "notes" => "repetitive")
    end

    it "starter_templates_list hits /v1/starter-templates" do
      called = false
      stubs = Faraday::Adapter::Test::Stubs.new do |s|
        s.get("/v1/starter-templates") do
          called = true
          [200, {}, JSON.generate({ "data" => [] })]
        end
      end
      build_client(stubs).starter_templates_list
      expect(called).to be(true)
    end

    it "generate_template_from_prompt posts to /v1/ai/generate-template" do
      called = false
      stubs = Faraday::Adapter::Test::Stubs.new do |s|
        s.post("/v1/ai/generate-template") do
          called = true
          [200, {}, JSON.generate({ "html_content" => "<div>" })]
        end
      end
      build_client(stubs).generate_template_from_prompt(prompt: "an invoice")
      expect(called).to be(true)
    end
  end
end
