from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional, Union
from pydantic import BaseModel, Field


class CustomFormat(BaseModel):
    width: str
    height: str


class MarginObject(BaseModel):
    top: Optional[str] = None
    right: Optional[str] = None
    bottom: Optional[str] = None
    left: Optional[str] = None


class PDFOptions(BaseModel):
    format: Optional[Union[Literal["A4", "Letter", "Legal"], CustomFormat]] = None
    margin: Optional[Union[str, MarginObject]] = None
    orientation: Optional[Literal["portrait", "landscape"]] = None
    header: Optional[str] = None
    footer: Optional[str] = None
    print_background: Optional[bool] = None

    class Config:
        populate_by_name = True


class WatermarkOptions(BaseModel):
    text: Optional[str] = None
    color: Optional[str] = None
    opacity: Optional[float] = None
    angle: Optional[float] = None
    fontSize: Optional[float] = None


class GenerateParams(BaseModel):
    html: str
    options: Optional[PDFOptions] = None
    output: str = "url"
    webhook: Optional[str] = None
    watermark: Optional[WatermarkOptions] = None


class TemplateParams(BaseModel):
    template: str
    data: Dict[str, Any]
    options: Optional[PDFOptions] = None
    output: str = "url"
    webhook: Optional[str] = None


class ReactParams(BaseModel):
    react: str
    data: Optional[Dict[str, Any]] = None
    styles: Optional[str] = None
    options: Optional[PDFOptions] = None
    output: str = "url"
    webhook: Optional[str] = None


class BatchItem(BaseModel):
    html: Optional[str] = None
    react: Optional[str] = None
    template: Optional[str] = None
    data: Optional[Dict[str, Any]] = None
    styles: Optional[str] = None
    options: Optional[PDFOptions] = None
    output: str = "url"


class BatchResponse(BaseModel):
    batch_id: str
    total: int
    generations: List[Dict[str, Any]]
    status: str


class GenerateResponse(BaseModel):
    id: str
    status: Literal["completed", "failed"]
    url: Optional[str] = None
    data: Optional[str] = None
    pages: int
    file_size: int
    generation_time_ms: int


class Generation(BaseModel):
    id: str
    template_id: Optional[str] = None
    input_type: str
    status: Literal["queued", "processing", "completed", "failed"]
    url: Optional[str] = None
    pages: Optional[int] = None
    file_size: Optional[int] = None
    generation_time_ms: Optional[int] = None
    error: Optional[str] = None
    created_at: str


class Template(BaseModel):
    id: str
    name: str
    html_content: Optional[str] = None
    schema_: Optional[Dict[str, Any]] = Field(None, alias="schema")
    version: int
    is_public: bool
    created_at: str
    updated_at: str

    class Config:
        populate_by_name = True


class CreateTemplateParams(BaseModel):
    name: str
    html_content: str
    schema_: Optional[Dict[str, Any]] = Field(None, alias="schema")
    is_public: bool = False

    class Config:
        populate_by_name = True


class UsageStats(BaseModel):
    period_start: str
    period_end: str
    generation_count: int
    total_pages: int
    total_bytes: int
    plan: str
    limit: int


class ListResponse(BaseModel):
    data: List[Any]
    has_more: bool = False
