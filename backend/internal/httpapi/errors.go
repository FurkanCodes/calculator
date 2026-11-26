package httpapi

import (
	"errors"
	"net/http"

	"github.com/FurkanCodes/calculator/backend/internal/calc"
)

// Error codes the transport owns. The rest come from calc.
const (
	codeInvalidRequest   = "INVALID_REQUEST"
	codeNotFound         = "NOT_FOUND"
	codeMethodNotAllowed = "METHOD_NOT_ALLOWED"
	codeInternal         = "INTERNAL_ERROR"
)

// statuses matches the README's error table. TestEveryCalcCodeHasAStatus
// reads calc's source and fails until every calc code is listed here.
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

// apiError has no status field, so a code always gets its status from statuses.
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

// internalError reports a bug. The cause goes to the log, never the client.
func internalError(cause error) *apiError {
	return &apiError{code: codeInternal, message: "An unexpected error occurred.", cause: cause}
}

// fromCalc treats anything other than a *calc.Error as a bug.
func fromCalc(err error) *apiError {
	var calcErr *calc.Error
	if !errors.As(err, &calcErr) {
		return internalError(err)
	}
	return &apiError{code: string(calcErr.Code), message: calcErr.Message}
}
