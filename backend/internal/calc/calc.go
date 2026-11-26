// Package calc runs calculator operations on decimal strings under one
// precision policy (see precision.go). It is pure: no I/O, logging, clock or
// mutable state, so the same input always gives the same output.
package calc

import (
	"maps"
	"slices"
	"strings"

	"github.com/shopspring/decimal"
)

// Result is a successful calculation.
type Result struct {
	// Value is a plain decimal string that is itself a valid operand.
	Value string
	// Exact is false when the precision policy rounded the result.
	Exact bool
}

type operation struct {
	operands int
	apply    func(args []decimal.Decimal) (value decimal.Decimal, exact bool, err error)
}

// operations is the full set of supported operations. Adding one means adding
// a row here and its tests; nothing else changes.
var operations = map[string]operation{
	"add":      exactBinary(decimal.Decimal.Add),
	"subtract": exactBinary(decimal.Decimal.Sub),
	"multiply": exactBinary(decimal.Decimal.Mul),
	"divide":   {operands: 2, apply: applyDivide},
}

// exactBinary adapts a two-operand operation that shopspring computes exactly.
// The policy then rounds the exact result once.
func exactBinary(f func(a, b decimal.Decimal) decimal.Decimal) operation {
	return operation{operands: 2, apply: func(args []decimal.Decimal) (decimal.Decimal, bool, error) {
		value, exact := roundExact(f(args[0], args[1]))
		return value, exact, nil
	}}
}

func applyDivide(args []decimal.Decimal) (decimal.Decimal, bool, error) {
	if args[1].IsZero() {
		return decimal.Decimal{}, false, newError(DivisionByZero, "Cannot divide by zero.")
	}
	value, exact := divide(args[0], args[1])
	return value, exact, nil
}

// Calculate runs the named operation on the operand strings. Every error it
// returns is an *Error.
func Calculate(name string, operands []string) (Result, error) {
	op, ok := operations[name]
	if !ok {
		supported := strings.Join(slices.Sorted(maps.Keys(operations)), ", ")
		return Result{}, newError(UnsupportedOperation,
			"Unsupported operation %q. Supported operations: %s.", name, supported)
	}
	if len(operands) != op.operands {
		return Result{}, newError(WrongOperandCount,
			"%q expects %d operands, got %d.", name, op.operands, len(operands))
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
		return Result{}, newError(OutOfRange, "The result is outside the supported range of 1e-100 to 1e100.")
	}
	return Result{Value: value.String(), Exact: exact}, nil
}
