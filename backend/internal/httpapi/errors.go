package httpapi

import (
	"errors"
	"net/http"

	"github.com/FurkanCodes/calculator/backend/internal/calc"
)

// apiError is an error response: a code from the list in README.md, and the
// one HTTP status that code always has.
type apiError struct {
	status  int
	code    string
	message string
}

type errorResponse struct {
	Error errorBody `json:"error"`
}

type errorBody struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

var errInternal = &apiError{http.StatusInternalServerError, "INTERNAL_ERROR", "An unexpected error occurred."}

// calcStatuses gives each calc error code its HTTP status.
var calcStatuses = map[calc.Code]int{
	calc.UnsupportedOperation: http.StatusBadRequest,
	calc.WrongOperandCount:    http.StatusBadRequest,
	calc.InvalidNumber:        http.StatusBadRequest,
	calc.InputTooLarge:        http.StatusRequestEntityTooLarge,
	calc.OutOfRange:           http.StatusUnprocessableEntity,
	calc.DivisionByZero:       http.StatusUnprocessableEntity,
}

// codeError builds a response for a calc error code, with that code's status.
func codeError(code calc.Code, message string) *apiError {
	status, ok := calcStatuses[code]
	if !ok {
		return errInternal
	}
	return &apiError{status, string(code), message}
}

// fromCalc converts an error from calc.Calculate. Calculate only returns a
// *calc.Error with a known code, so anything else is a bug and becomes a 500.
func fromCalc(err error) *apiError {
	var calcErr *calc.Error
	if !errors.As(err, &calcErr) {
		return errInternal
	}
	return codeError(calcErr.Code, calcErr.Message)
}
