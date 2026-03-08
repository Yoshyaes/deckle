from docuforge.client import DocuForge
from docuforge.types import (
    PDFOptions,
    GenerateParams,
    GenerateResponse,
    Generation,
    TemplateParams,
    ReactParams,
    BatchItem,
    BatchResponse,
    ListResponse,
    Template,
    CreateTemplateParams,
    UsageStats,
)
from docuforge.errors import (
    DocuForgeError,
    AuthenticationError,
    RateLimitError,
    ValidationError,
)

__all__ = [
    "DocuForge",
    "PDFOptions",
    "GenerateParams",
    "GenerateResponse",
    "Generation",
    "TemplateParams",
    "ReactParams",
    "BatchItem",
    "BatchResponse",
    "ListResponse",
    "Template",
    "CreateTemplateParams",
    "UsageStats",
    "DocuForgeError",
    "AuthenticationError",
    "RateLimitError",
    "ValidationError",
]

__version__ = "0.1.0"
