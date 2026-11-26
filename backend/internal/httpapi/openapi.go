package httpapi

import (
	_ "embed"
	"encoding/json"
	"net/http"
)

// openapiSpec is written by hand. The tests in openapi_test.go fail when it
// and the code disagree, examples included.
//
//go:embed openapi.json
var openapiSpec []byte

// openapi serves the spec. writeJSON re-encodes it compactly.
func openapi(*http.Request) (any, *apiError) {
	return json.RawMessage(openapiSpec), nil
}
