package httpapi

import (
	_ "embed"
	"encoding/json"
	"net/http"
)

// openapiSpec is the API's OpenAPI 3.1 description, written by hand. The
// contract tests in openapi_test.go fail when it and the code disagree: the
// operations, the error codes and their statuses, the number rules, the
// routes, and every example request and response.
//
//go:embed openapi.json
var openapiSpec []byte

// openapi serves the API description. writeJSON re-encodes it compactly; the
// content is the same document.
func openapi(*http.Request) (any, *apiError) {
	return json.RawMessage(openapiSpec), nil
}
