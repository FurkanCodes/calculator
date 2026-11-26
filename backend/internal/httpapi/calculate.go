package httpapi

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/FurkanCodes/calculator/backend/internal/calc"
)

// calculateRequest holds operands as strings, never as numbers: a JSON number
// would already be binary floating point in most clients.
type calculateRequest struct {
	Operation string   `json:"operation"`
	Operands  []string `json:"operands"`
}

type calculateResponse struct {
	Result string `json:"result"`
	Exact  bool   `json:"exact"`
}

var errMalformed = &apiError{http.StatusBadRequest, "INVALID_REQUEST",
	`The body must be one JSON object with "operation" (a string) and "operands" (an array of strings).`}

func calculate(w http.ResponseWriter, r *http.Request) *apiError {
	req, apiErr := decodeCalculateRequest(r.Body)
	if apiErr != nil {
		return apiErr
	}
	result, err := calc.Calculate(req.Operation, req.Operands)
	if err != nil {
		return fromCalc(err)
	}
	writeJSON(w, http.StatusOK, calculateResponse{Result: result.Value, Exact: result.Exact})
	return nil
}

// decodeCalculateRequest checks the request's shape only: one JSON object,
// no unknown fields, both fields present, and operands as strings. What the
// operation and operands mean is calc's business.
func decodeCalculateRequest(body io.Reader) (calculateRequest, *apiError) {
	dec := json.NewDecoder(body)
	dec.DisallowUnknownFields()
	var req calculateRequest
	if err := dec.Decode(&req); err != nil {
		return req, decodeError(err)
	}
	// Anything after the object, other than whitespace, is a second value.
	if err := dec.Decode(&struct{}{}); !errors.Is(err, io.EOF) {
		return req, decodeError(err)
	}
	if req.Operation == "" || req.Operands == nil {
		return req, errMalformed
	}
	return req, nil
}

// decodeError explains why the body could not be decoded. A nil error means a
// second JSON value followed the first.
func decodeError(err error) *apiError {
	var tooLarge *http.MaxBytesError
	var wrongType *json.UnmarshalTypeError
	switch {
	case errors.As(err, &tooLarge):
		return codeError(calc.InputTooLarge, fmt.Sprintf("The request body is larger than %d bytes.", maxBodyBytes))
	case errors.As(err, &wrongType) && strings.HasPrefix(wrongType.Field, "operands"):
		return codeError(calc.InvalidNumber, `Operands must be strings, for example "0.1".`)
	default:
		return errMalformed
	}
}
