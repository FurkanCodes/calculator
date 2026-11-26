package httpapi

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"

	"github.com/FurkanCodes/calculator/backend/internal/calc"
)

type calculateRequest struct {
	operation string
	operands  []string
}

type calculateResponse struct {
	Result string `json:"result"`
	Exact  bool   `json:"exact"`
}

var (
	errMalformed = &apiError{code: codeInvalidRequest,
		message: `The body must be one JSON object with exactly two keys: "operation" (a string) and "operands" (an array of strings).`}
	errOperandNotString = &apiError{code: string(calc.InvalidNumber),
		message: `Operands must be strings, for example "0.1".`}
)

func calculate(r *http.Request) (any, *apiError) {
	req, apiErr := decodeCalculateRequest(r.Body)
	if apiErr != nil {
		return nil, apiErr
	}
	result, err := calc.Calculate(req.operation, req.operands)
	if err != nil {
		return nil, fromCalc(err)
	}
	return calculateResponse{Result: result.Value, Exact: result.Exact}, nil
}

// decodeCalculateRequest checks the request's shape only: one JSON object with
// exactly the keys "operation" and "operands" (matched case-sensitively), a
// string operation, and an array of string operands. What the operation and
// operands mean is calc's business.
func decodeCalculateRequest(body io.Reader) (calculateRequest, *apiError) {
	dec := json.NewDecoder(body)
	var fields map[string]json.RawMessage
	if err := dec.Decode(&fields); err != nil {
		return calculateRequest{}, decodeError(err)
	}
	var extra json.RawMessage
	switch err := dec.Decode(&extra); {
	case errors.Is(err, io.EOF): // only whitespace after the object
	case err != nil:
		return calculateRequest{}, decodeError(err)
	default:
		return calculateRequest{}, errMalformed // a second JSON value
	}

	var req calculateRequest
	var operands []json.RawMessage
	if len(fields) != 2 ||
		!decodeAs(fields["operation"], '"', &req.operation) ||
		!decodeAs(fields["operands"], '[', &operands) {
		return calculateRequest{}, errMalformed
	}
	req.operands = make([]string, len(operands))
	for i, raw := range operands {
		if !decodeAs(raw, '"', &req.operands[i]) {
			return calculateRequest{}, errOperandNotString
		}
	}
	return req, nil
}

// decodeAs unmarshals raw into v only when raw is the JSON kind that starts
// with first: '"' for a string, '[' for an array. Checking the first byte
// also rejects null, which json.Unmarshal would otherwise accept silently.
func decodeAs(raw json.RawMessage, first byte, v any) bool {
	return len(raw) > 0 && raw[0] == first && json.Unmarshal(raw, v) == nil
}

// decodeError explains why the body could not be read as one JSON object.
func decodeError(err error) *apiError {
	var tooLarge *http.MaxBytesError
	if errors.As(err, &tooLarge) {
		return &apiError{code: string(calc.InputTooLarge),
			message: fmt.Sprintf("The request body is larger than %d bytes.", maxBodyBytes)}
	}
	return errMalformed
}
