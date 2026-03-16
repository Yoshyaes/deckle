from __future__ import annotations

import time
from typing import Any, Dict, List, Optional, Union

import httpx

from docuforge.types import (
    PDFOptions,
    GenerateResponse,
    Generation,
    Template,
    CreateTemplateParams,
    UsageStats,
    ListResponse,
    BatchItem,
    BatchResponse,
)
from docuforge.errors import (
    DocuForgeError,
    AuthenticationError,
    RateLimitError,
)


class _Templates:
    def __init__(self, client: "DocuForge"):
        self._client = client

    def create(
        self,
        name: str,
        html_content: str,
        schema: Optional[Dict[str, Any]] = None,
        is_public: bool = False,
    ) -> Template:
        """Create a new template."""
        data = {"name": name, "html_content": html_content, "is_public": is_public}
        if schema:
            data["schema"] = schema
        resp = self._client._request("POST", "/v1/templates", json=data)
        return Template(**resp)

    def list(self) -> ListResponse:
        """List all templates."""
        resp = self._client._request("GET", "/v1/templates")
        return ListResponse(
            data=[Template(**t) for t in resp.get("data", [])],
            has_more=resp.get("has_more", False),
        )

    def get(self, template_id: str) -> Template:
        """Get a template by ID."""
        resp = self._client._request("GET", f"/v1/templates/{template_id}")
        return Template(**resp)

    def update(
        self,
        template_id: str,
        name: Optional[str] = None,
        html_content: Optional[str] = None,
        schema: Optional[Dict[str, Any]] = None,
        is_public: Optional[bool] = None,
    ) -> Template:
        """Update a template."""
        data: Dict[str, Any] = {}
        if name is not None:
            data["name"] = name
        if html_content is not None:
            data["html_content"] = html_content
        if schema is not None:
            data["schema"] = schema
        if is_public is not None:
            data["is_public"] = is_public
        resp = self._client._request("PUT", f"/v1/templates/{template_id}", json=data)
        return Template(**resp)

    def delete(self, template_id: str) -> bool:
        """Delete a template."""
        resp = self._client._request("DELETE", f"/v1/templates/{template_id}")
        return resp.get("deleted", False)


class DocuForge:
    """DocuForge Python SDK.

    Usage:
        df = DocuForge("df_live_...")
        pdf = df.generate("<h1>Hello</h1>")
        print(pdf.url)
    """

    # Status codes that are safe to retry.
    _RETRYABLE_STATUS_CODES = frozenset({429, 500, 502, 503, 504})

    def __init__(
        self,
        api_key: str,
        base_url: str = "https://api.getdocuforge.dev",
        timeout: float = 30.0,
        max_retries: int = 3,
    ):
        if not api_key:
            raise ValueError("DocuForge API key is required")
        self._api_key = api_key
        self._base_url = base_url.rstrip("/")
        self._max_retries = max_retries
        self._client = httpx.Client(
            base_url=self._base_url,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
                "User-Agent": "docuforge-python/0.1.0",
            },
            timeout=timeout,
        )
        self.templates = _Templates(self)

    def _request(self, method: str, path: str, **kwargs: Any) -> Any:
        last_exception: Optional[Exception] = None

        for attempt in range(self._max_retries + 1):
            try:
                resp = self._client.request(method, path, **kwargs)
            except httpx.TransportError as exc:
                # Network-level errors are retryable
                last_exception = exc
                if attempt < self._max_retries:
                    time.sleep(1.0 * (2 ** attempt))
                    continue
                raise

            try:
                data = resp.json()
            except Exception:
                if not resp.is_success:
                    raise DocuForgeError(
                        message=f"Non-JSON response from API (status {resp.status_code})",
                        status_code=resp.status_code,
                        code="INVALID_RESPONSE",
                    )
                data = {}

            # Retry on retryable status codes (unless we've exhausted attempts)
            if resp.status_code in self._RETRYABLE_STATUS_CODES and attempt < self._max_retries:
                if resp.status_code == 429:
                    delay = float(resp.headers.get("Retry-After", str(1.0 * (2 ** attempt))))
                else:
                    delay = 1.0 * (2 ** attempt)
                time.sleep(delay)
                continue

            if resp.status_code == 401:
                raise AuthenticationError(data.get("error", {}).get("message", "Unauthorized"))

            if resp.status_code == 429:
                retry_after = int(resp.headers.get("Retry-After", "1"))
                raise RateLimitError(
                    retry_after=retry_after,
                    message=data.get("error", {}).get("message", "Rate limited"),
                )

            if not resp.is_success:
                err = data.get("error", {})
                raise DocuForgeError(
                    message=err.get("message", "Request failed"),
                    status_code=resp.status_code,
                    code=err.get("code", "UNKNOWN"),
                )

            return data

        raise last_exception  # type: ignore[misc]

    def generate(
        self,
        html: str,
        options: Optional[Union[PDFOptions, Dict[str, Any]]] = None,
        output: str = "url",
        webhook: Optional[str] = None,
        watermark: Optional[dict] = None,
    ) -> GenerateResponse:
        """Generate a PDF from HTML.

        Args:
            html: HTML string to convert to PDF.
            options: PDF rendering options (format, margin, orientation, etc.).
            output: Output format - "url" or "base64".
            webhook: URL to POST when generation completes.
            watermark: Watermark options (text, color, opacity, angle, fontSize).

        Returns:
            GenerateResponse with id, status, url, pages, file_size, generation_time_ms.
        """
        data: Dict[str, Any] = {"html": html, "output": output}
        if options:
            data["options"] = options if isinstance(options, dict) else options.model_dump(exclude_none=True)
        if webhook:
            data["webhook"] = webhook
        if watermark:
            data["watermark"] = watermark
        resp = self._request("POST", "/v1/generate", json=data)
        return GenerateResponse(**resp)

    def from_template(
        self,
        template: str,
        data: Dict[str, Any],
        options: Optional[Union[PDFOptions, Dict[str, Any]]] = None,
        output: str = "url",
        webhook: Optional[str] = None,
    ) -> GenerateResponse:
        """Generate a PDF from a saved template.

        Args:
            template: Template ID (tmpl_xxx).
            data: Data to merge into the template.
            options: PDF rendering options.
            output: Output format - "url" or "base64".
            webhook: URL to POST when generation completes.
        """
        body: Dict[str, Any] = {"template": template, "data": data, "output": output}
        if options:
            body["options"] = options if isinstance(options, dict) else options.model_dump(exclude_none=True)
        if webhook:
            body["webhook"] = webhook
        resp = self._request("POST", "/v1/generate", json=body)
        return GenerateResponse(**resp)

    def from_react(
        self,
        react: str,
        data: Optional[Dict[str, Any]] = None,
        styles: Optional[str] = None,
        options: Optional[Union[PDFOptions, Dict[str, Any]]] = None,
        output: str = "url",
        webhook: Optional[str] = None,
    ) -> GenerateResponse:
        """Generate a PDF from a React component string.

        Args:
            react: JSX/TSX component source with default export.
            data: Props to pass to the component.
            styles: Optional CSS styles to inject.
            options: PDF rendering options.
            output: Output format - "url" or "base64".
            webhook: URL to POST when generation completes.
        """
        body: Dict[str, Any] = {"react": react, "output": output}
        if data:
            body["data"] = data
        if styles:
            body["styles"] = styles
        if options:
            body["options"] = options if isinstance(options, dict) else options.model_dump(exclude_none=True)
        if webhook:
            body["webhook"] = webhook
        resp = self._request("POST", "/v1/generate", json=body)
        return GenerateResponse(**resp)

    def batch(
        self,
        items: List[Dict[str, Any]],
        webhook: Optional[str] = None,
    ) -> BatchResponse:
        """Submit a batch of PDF generation jobs for async processing.

        Args:
            items: List of generation requests (each with html/react/template + options).
            webhook: URL to POST when the batch completes.

        Returns:
            BatchResponse with batch_id, total, and list of generation IDs.
        """
        body: Dict[str, Any] = {"items": items}
        if webhook:
            body["webhook"] = webhook
        resp = self._request("POST", "/v1/generate/batch", json=body)
        return BatchResponse(**resp)

    def get_generation(self, generation_id: str) -> Generation:
        """Get a generation by ID."""
        resp = self._request("GET", f"/v1/generations/{generation_id}")
        return Generation(**resp)

    def list_generations(
        self, limit: int = 50, offset: int = 0
    ) -> ListResponse:
        """List recent generations."""
        resp = self._request(
            "GET", f"/v1/generations?limit={limit}&offset={offset}"
        )
        return ListResponse(
            data=[Generation(**g) for g in resp.get("data", [])],
            has_more=resp.get("has_more", False),
        )

    def get_usage(self) -> UsageStats:
        """Get usage statistics for the current billing period."""
        resp = self._request("GET", "/v1/usage")
        return UsageStats(**resp)

    def close(self) -> None:
        """Close the HTTP client."""
        self._client.close()

    def __enter__(self) -> "DocuForge":
        return self

    def __exit__(self, *args: Any) -> None:
        self.close()
