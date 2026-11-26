package httpapi

import (
	"encoding/json/jsontext"
	"encoding/json/v2"
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
// exactly the keys "operation" and "operands" (matched case-sensitively, each
// once), a string operation, and an array of string operands. What the
// operation and operands mean is calc's business.
//
// The whole body is read before parsing, so a body over the limit is always
// INPUT_TOO_LARGE, wherever its first syntax error is. encoding/json/v2 then
// rejects duplicate keys and anything after the object.
func decodeCalculateRequest(body io.Reader) (calculateRequest, *apiError) {
	data, err := io.ReadAll(body)
	if err != nil {
		return calculateRequest{}, decodeError(err)
	}
	var fields map[string]jsontext.Value
	if json.Unmarshal(data, &fields) != nil {
		return calculateRequest{}, errMalformed
	}

	var req calculateRequest
	var operands []jsontext.Value
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
func decodeAs(raw jsontext.Value, first byte, v any) bool {
	return len(raw) > 0 && raw[0] == first && json.Unmarshal(raw, v) == nil
}

// decodeError explains why the body could not be read.
func decodeError(err error) *apiError {
	var tooLarge *http.MaxBytesError
	if errors.As(err, &tooLarge) {
		return &apiError{code: string(calc.InputTooLarge),
			message: fmt.Sprintf("The request body is larger than %d bytes.", maxBodyBytes)}
	}
	return errMalformed
}
