"""DocuForge Python SDK — request shape, error mapping, and the post-Sprint-17
namespace coverage. Mirrors packages/sdk-typescript/src/client.test.ts.

Real network is never touched: httpx requests are intercepted by respx
and matched by URL + method.
"""

from __future__ import annotations

import json

import httpx
import pytest
import respx

from docuforge import DocuForge
from docuforge.errors import AuthenticationError, DocuForgeError, RateLimitError


BASE_URL = "https://api.test.local"


def client(**kwargs) -> DocuForge:
    """Construct a client pointed at the mock transport with retries
    off so tests don't burn wall-clock time on backoff sleeps."""
    return DocuForge(api_key="df_live_test", base_url=BASE_URL, max_retries=0, **kwargs)


def usage_payload(**overrides):
    """Full UsageStats payload — Pydantic rejects missing fields."""
    return {
        "period_start": "2026-01-01",
        "period_end": "2026-01-31",
        "generation_count": 0,
        "total_pages": 0,
        "total_bytes": 0,
        "plan": "free",
        "limit": 1000,
        **overrides,
    }


# ── Constructor ─────────────────────────────────────────────────────────────


class TestConstructor:
    def test_refuses_empty_api_key(self):
        with pytest.raises(ValueError, match="required"):
            DocuForge(api_key="")

    @respx.mock
    def test_normalizes_trailing_slash_on_base_url(self):
        # respx matches by full URL — the trailing slash bug would yield
        # api.example.com//v1/usage and miss the mock.
        route = respx.get("https://api.example.com/v1/usage").mock(
            return_value=httpx.Response(200, json=usage_payload())
        )
        c = DocuForge(api_key="k", base_url="https://api.example.com/", max_retries=0)
        c.get_usage()
        assert route.called


# ── Request shape ───────────────────────────────────────────────────────────


class TestRequestShape:
    @respx.mock
    def test_sends_bearer_auth_and_json_content_type(self):
        route = respx.post(f"{BASE_URL}/v1/generate").mock(
            return_value=httpx.Response(
                200,
                json={
                    "id": "gen_1",
                    "status": "completed",
                    "url": "https://x",
                    "pages": 1,
                    "file_size": 1,
                    "generation_time_ms": 1,
                },
            )
        )
        client().generate(html="<h1>hi</h1>")
        assert route.called
        req = route.calls[0].request
        assert req.method == "POST"
        assert req.headers["authorization"] == "Bearer df_live_test"
        assert req.headers["content-type"] == "application/json"
        body = json.loads(req.content)
        assert body["html"] == "<h1>hi</h1>"

    @respx.mock
    def test_get_generation_uses_correct_path(self):
        route = respx.get(f"{BASE_URL}/v1/generations/gen_42").mock(
            return_value=httpx.Response(
                200,
                json={
                    "id": "gen_42",
                    "input_type": "html",
                    "status": "completed",
                    "created_at": "2026-01-01T00:00:00Z",
                },
            )
        )
        client().get_generation("gen_42")
        assert route.called

    @respx.mock
    def test_list_generations_propagates_limit_and_offset(self):
        route = respx.get(f"{BASE_URL}/v1/generations").mock(
            return_value=httpx.Response(200, json={"data": [], "has_more": False})
        )
        client().list_generations(limit=10, offset=20)
        assert route.called
        url = route.calls[0].request.url
        assert url.params["limit"] == "10"
        assert url.params["offset"] == "20"


# ── Error handling ──────────────────────────────────────────────────────────


class TestErrorHandling:
    @respx.mock
    def test_raises_authentication_error_on_401(self):
        respx.get(f"{BASE_URL}/v1/usage").mock(
            return_value=httpx.Response(
                401, json={"error": {"code": "UNAUTHORIZED", "message": "bad key"}}
            )
        )
        with pytest.raises(AuthenticationError):
            client().get_usage()

    @respx.mock
    def test_raises_rate_limit_error_with_retry_after(self):
        respx.get(f"{BASE_URL}/v1/usage").mock(
            return_value=httpx.Response(
                429,
                headers={"Retry-After": "11"},
                json={"error": {"code": "RATE_LIMITED", "message": "slow down"}},
            )
        )
        with pytest.raises(RateLimitError) as info:
            client().get_usage()
        assert info.value.retry_after == 11

    @respx.mock
    def test_raises_docuforge_error_on_generic_4xx(self):
        respx.post(f"{BASE_URL}/v1/generate").mock(
            return_value=httpx.Response(
                400, json={"error": {"code": "VALIDATION_ERROR", "message": "bad input"}}
            )
        )
        with pytest.raises(DocuForgeError) as info:
            client().generate(html="")
        assert info.value.status_code == 400
        assert info.value.code == "VALIDATION_ERROR"

    @respx.mock
    def test_does_not_retry_when_max_retries_is_zero(self):
        route = respx.get(f"{BASE_URL}/v1/usage").mock(
            return_value=httpx.Response(500, json={"error": {}})
        )
        with pytest.raises(DocuForgeError):
            client().get_usage()
        # Exactly one call — no retries because we set max_retries=0.
        assert route.call_count == 1


# ── Namespace + new method coverage ─────────────────────────────────────────


class TestPdfNamespace:
    """The PDF tools / marketplace / starter-templates / new pdf_protect /
    pdf_sign_annotation methods added in the SDK 0.2 → 0.4 work. We don't
    care about the response shape — just that the method dispatches to
    the right URL and method, since the API already has its own tests."""

    @respx.mock
    def test_pdf_merge_posts_to_v1_pdf_merge(self):
        route = respx.post(f"{BASE_URL}/v1/pdf/merge").mock(
            return_value=httpx.Response(200, json={"url": "x", "file_size": 1})
        )
        client().pdf_merge(pdfs=["a", "b"])
        assert route.called

    @respx.mock
    def test_pdf_split_passes_ranges(self):
        route = respx.post(f"{BASE_URL}/v1/pdf/split").mock(
            return_value=httpx.Response(200, json={"parts": [], "total": 0})
        )
        client().pdf_split(pdf="abc", ranges=[[1, 3]])
        body = json.loads(route.calls[0].request.content)
        assert body["ranges"] == [[1, 3]]

    def test_pdf_protect_requires_a_password(self):
        # pdf_protect raises BEFORE any HTTP call — no respx needed.
        with pytest.raises(ValueError, match="password"):
            client().pdf_protect(pdf="abc")

    @respx.mock
    def test_pdf_protect_forwards_passwords_and_permissions(self):
        route = respx.post(f"{BASE_URL}/v1/pdf/protect").mock(
            return_value=httpx.Response(
                200,
                json={"url": "x", "file_size": 1, "encrypted": True, "encryption": "AES-256"},
            )
        )
        client().pdf_protect(
            pdf="abc",
            user_password="reader",
            owner_password="owner",
            permissions={"print": "low", "modify": False, "copy": True},
        )
        body = json.loads(route.calls[0].request.content)
        assert body["user_password"] == "reader"
        assert body["owner_password"] == "owner"
        assert body["permissions"]["print"] == "low"

    @respx.mock
    def test_pdf_sign_annotation_forwards_signature_material(self):
        route = respx.post(f"{BASE_URL}/v1/pdf/sign").mock(
            return_value=httpx.Response(
                200,
                json={
                    "url": "x",
                    "file_size": 1,
                    "signature_annotation_added": True,
                    "cryptographically_signed": True,
                    "signature_type": "PAdES-B-B",
                },
            )
        )
        client().pdf_sign_annotation(
            pdf="abc",
            name="Test Signer",
            signature={"p12": "base64-blob", "password": "pw"},
        )
        body = json.loads(route.calls[0].request.content)
        assert body["signature"] == {"p12": "base64-blob", "password": "pw"}

    @respx.mock
    def test_marketplace_list_hits_v1_marketplace(self):
        route = respx.get(f"{BASE_URL}/v1/marketplace").mock(
            return_value=httpx.Response(200, json={"data": []})
        )
        client().marketplace_list()
        assert route.called

    @respx.mock
    def test_marketplace_report_posts_reason_and_notes(self):
        route = respx.post(f"{BASE_URL}/v1/marketplace/tmpl_xyz/report").mock(
            return_value=httpx.Response(
                201, json={"report_id": "rep_1", "auto_actioned": False}
            )
        )
        result = client().marketplace_report(
            "tmpl_xyz", reason="spam", notes="repetitive nonsense"
        )
        assert result == {"report_id": "rep_1", "auto_actioned": False}
        body = json.loads(route.calls[0].request.content)
        assert body == {"reason": "spam", "notes": "repetitive nonsense"}

    @respx.mock
    def test_starter_templates_list_hits_v1_starter_templates(self):
        route = respx.get(f"{BASE_URL}/v1/starter-templates").mock(
            return_value=httpx.Response(200, json={"data": []})
        )
        client().starter_templates_list()
        assert route.called

    @respx.mock
    def test_generate_template_from_prompt_posts_to_ai_endpoint(self):
        route = respx.post(f"{BASE_URL}/v1/ai/generate-template").mock(
            return_value=httpx.Response(200, json={"html_content": "<div>"})
        )
        client().generate_template_from_prompt(prompt="an invoice")
        assert route.called
