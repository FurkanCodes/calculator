// Package calc runs calculator operations on decimal strings. It has no I/O,
// logging, clock or state. The rounding rules are in precision.go.
package calc

import (
	"maps"
	"slices"
	"strings"

	"github.com/shopspring/decimal"
)

// Result is a successful calculation.
type Result struct {
	// Value is a plain decimal string, valid as an operand.
	Value string
	// Exact is false when the result was rounded.
	Exact bool
}

type operation struct {
	operands int
	apply    func(args []decimal.Decimal) (value decimal.Decimal, exact bool, err error)
}

// Adding an operation means a row here plus tests. A new error Code also needs
// an HTTP status in httpapi, and a test there fails until it has one.
var operations = map[string]operation{
	"add":        exactBinary(decimal.Decimal.Add),
	"subtract":   exactBinary(decimal.Decimal.Sub),
	"multiply":   exactBinary(decimal.Decimal.Mul),
	"divide":     {operands: 2, apply: applyDivide},
	"percentage": exactBinary(percentOf),
	"power":      {operands: 2, apply: applyPower},
	"sqrt":       {operands: 1, apply: applySqrt},
}

// exactBinary wraps an operation shopspring computes exactly, then rounds once.
func exactBinary(f func(a, b decimal.Decimal) decimal.Decimal) operation {
	return operation{operands: 2, apply: func(args []decimal.Decimal) (decimal.Decimal, bool, error) {
		value, exact := roundExact(f(args[0], args[1]))
		return value, exact, nil
	}}
}

// percentOf is a% of b. Dividing by 100 only moves the point, so it stays exact.
func percentOf(a, b decimal.Decimal) decimal.Decimal {
	return a.Mul(b).Shift(-2)
}

func applyDivide(args []decimal.Decimal) (decimal.Decimal, bool, error) {
	if args[1].IsZero() {
		return decimal.Decimal{}, false, newError(DivisionByZero, "Cannot divide by zero.")
	}
	value, exact := divide(args[0], args[1])
	return value, exact, nil
}

func applyPower(args []decimal.Decimal) (decimal.Decimal, bool, error) {
	base := args[0]
	n, ok := wholeExponent(args[1])
	if !ok {
		return decimal.Decimal{}, false, newError(InvalidExponent,
			"The exponent must be a whole number from -%d to %d.", maxExponent, maxExponent)
	}
	if base.IsZero() && n < 0 {
		return decimal.Decimal{}, false, newError(DivisionByZero, "Cannot raise zero to a negative power.")
	}
	value, exact := power(base, n)
	return value, exact, nil
}

// wholeExponent compares values, so "1.0" is 1 and "-0" is 0, as for any operand.
func wholeExponent(d decimal.Decimal) (int64, bool) {
	if d.Abs().Cmp(decimal.New(maxExponent, 0)) > 0 {
		return 0, false
	}
	n := d.IntPart()
	return n, decimal.New(n, 0).Equal(d)
}

func applySqrt(args []decimal.Decimal) (decimal.Decimal, bool, error) {
	if args[0].Sign() < 0 {
		return decimal.Decimal{}, false, newError(NegativeSquareRoot, "Cannot take the square root of a negative number.")
	}
	value, exact := squareRoot(args[0])
	return value, exact, nil
}

// Operations returns the supported operation names, sorted, in a new slice.
func Operations() []string {
	return slices.Sorted(maps.Keys(operations))
}

// Calculate runs the named operation. Every error it returns is an *Error.
func Calculate(name string, operands []string) (Result, error) {
	op, ok := operations[name]
	if !ok {
		supported := strings.Join(Operations(), ", ")
		return Result{}, newError(UnsupportedOperation,
			"Unsupported operation %q. Supported operations: %s.", name, supported)
	}
	if len(operands) != op.operands {
		noun := "operands"
		if op.operands == 1 {
			noun = "operand"
		}
		return Result{}, newError(WrongOperandCount,
			"%q expects %d %s, got %d.", name, op.operands, noun, len(operands))
	}

	args := make([]decimal.Decimal, len(operands))
	for i, s := range operands {
		d, err := parseOperand(i+1, s)
		if err != nil {
			return Result{}, err
		}
		args[i] = d
	}

	value, exact, err := op.apply(args)
	if err != nil {
		return Result{}, err
	}
	if !inRange(value) {
		return Result{}, newError(OutOfRange,
			"The result is outside the supported range of 1e-%d to 1e%d.", maxMagnitude, maxMagnitude)
	}
	return Result{Value: value.String(), Exact: exact}, nil
}
