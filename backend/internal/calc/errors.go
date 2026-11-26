package calc

import "fmt"

// Code says why a calculation was rejected. Each one maps to one HTTP status.
type Code string

const (
	UnsupportedOperation Code = "UNSUPPORTED_OPERATION"
	WrongOperandCount    Code = "WRONG_OPERAND_COUNT"
	InvalidNumber        Code = "INVALID_NUMBER"
	InputTooLarge        Code = "INPUT_TOO_LARGE"
	OutOfRange           Code = "OUT_OF_RANGE"
	DivisionByZero       Code = "DIVISION_BY_ZERO"
	InvalidExponent      Code = "INVALID_EXPONENT"
	NegativeSquareRoot   Code = "NEGATIVE_SQUARE_ROOT"
)

// Error is a calculation rejected because of its input. It never signals a bug.
type Error struct {
	Code    Code
	Message string
}

func (e *Error) Error() string {
	return string(e.Code) + ": " + e.Message
}

func newError(code Code, format string, args ...any) *Error {
	return &Error{Code: code, Message: fmt.Sprintf(format, args...)}
}
