package httpapi

import (
	"errors"
	"net/http"

	"github.com/FurkanCodes/calculator/backend/internal/calc"
)

// Error codes that belong to the transport. The rest come from calc.
const (
	codeInvalidRequest   = "INVALID_REQUEST"
	codeNotFound         = "NOT_FOUND"
	codeMethodNotAllowed = "METHOD_NOT_ALLOWED"
	codeInternal         = "INTERNAL_ERROR"
)

// statuses is the README's error table: every code the API can send, and the
// one HTTP status that code always has. TestEveryCalcCodeHasAStatus reads
// calc's source, so a new calc code fails the tests until it is added here.
var statuses = map[string]int{
	codeInvalidRequest:                http.StatusBadRequest,
	string(calc.InvalidNumber):        http.StatusBadRequest,
	string(calc.WrongOperandCount):    http.StatusBadRequest,
	string(calc.UnsupportedOperation): http.StatusBadRequest,
	codeNotFound:                      http.StatusNotFound,
	codeMethodNotAllowed:              http.StatusMethodNotAllowed,
	string(calc.InputTooLarge):        http.StatusRequestEntityTooLarge,
	string(calc.DivisionByZero):       http.StatusUnprocessableEntity,
	string(calc.NegativeSquareRoot):   http.StatusUnprocessableEntity,
	string(calc.InvalidExponent):      http.StatusUnprocessableEntity,
	string(calc.OutOfRange):           http.StatusUnprocessableEntity,
	codeInternal:                      http.StatusInternalServerError,
}

// apiError is a failed request. Its status comes from statuses, so a code can
// never be sent with a different status.
type apiError struct {
	code    string
	message string
	cause   error // logged, never sent to the client
}

type errorResponse struct {
	Error errorBody `json:"error"`
}

type errorBody struct {
	Code    string `json:"code"`
	Message string `json:"message"`
}

// internalError reports a bug. The client gets a generic message; the cause
// goes to the log.
func internalError(cause error) *apiError {
	return &apiError{code: codeInternal, message: "An unexpected error occurred.", cause: cause}
}

// fromCalc converts an error from calc.Calculate, which only returns
// *calc.Error. Anything else is a bug.
func fromCalc(err error) *apiError {
	var calcErr *calc.Error
	if !errors.As(err, &calcErr) {
		return internalError(err)
	}
	return &apiError{code: string(calcErr.Code), message: calcErr.Message}
}
