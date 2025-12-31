.PHONY: build dev test lint format clean

build:
	python3 build.py

dev:
	# Run a simple HTTP server to view the docs
	cd docs && python3 -m http.server 8000

test:
	# Add tests here when suites are ready
	pytest

lint:
	ruff check .

format:
	ruff format .

clean:
	rm -rf docs/
