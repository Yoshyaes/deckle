.PHONY: vet build prepublish

vet:
	go vet ./...

build:
	go build ./...

prepublish: vet build
