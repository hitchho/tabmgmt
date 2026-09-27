.PHONY: build clean test

# Get version from manifest.json using jq
VERSION := $(shell jq -r '.version' manifest.json)

# Extension payload shared by both build targets
FILES := manifest.json background.js domains.js popup.html popup.js README.md LICENSE icons/

# Run the unit tests for the pure logic in domains.js
test:
	node --test

# Build the extension into a ZIP file
build:
	@echo "Building extension version $(VERSION) from manifest.json..."
	zip -r tabmgmt-v$(VERSION).zip $(FILES)

# Build with a specific version (overrides manifest version)
build-version:
	@echo "Building extension version $(version)..."
	zip -r tabmgmt-v$(version).zip $(FILES)

# Clean up build artifacts
clean:
	@echo "Cleaning up build artifacts..."
	rm -f *.zip
