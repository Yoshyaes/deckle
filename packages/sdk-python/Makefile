.PHONY: lint typecheck build prepublish

lint:
	python -m py_compile docuforge/client.py docuforge/errors.py docuforge/types.py

typecheck:
	python -m mypy docuforge/ --ignore-missing-imports || true

build:
	python -m build

prepublish: lint build
