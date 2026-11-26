package calc

import (
	"errors"
	"maps"
	"slices"
	"strings"
	"testing"

	"github.com/shopspring/decimal"
)

func zeros(n int) string { return strings.Repeat("0", n) }

var (
	tenPow99      = "1" + zeros(99)        // 1e99
	tenPowMinus99 = "0." + zeros(98) + "1" // 1e-99
	maxDigits     = "9999999999999999999999999999999999"
)

func TestCalculate(t *testing.T) {
	// Expected values come from Python's decimal module set to 34 digits and
	// half-even rounding: an independent implementation of the same policy.
	tests := []struct {
		name      string
		operation string
		operands  []string
		want      Result
	}{
		{"decimal addition is exact", "add", []string{"0.1", "0.2"}, Result{"0.3", true}},
		{"sum of opposites is zero", "add", []string{"-5", "5"}, Result{"0", true}},
		{"subtraction below zero", "subtract", []string{"5", "7.5"}, Result{"-2.5", true}},
		{"multiplication drops trailing zeros", "multiply", []string{"1.5", "4"}, Result{"6", true}},
		{"negative product", "multiply", []string{"-0.1", "0.1"}, Result{"-0.01", true}},
		{"terminating quotient", "divide", []string{"1", "4"}, Result{"0.25", true}},
		{"quotient above one", "divide", []string{"10", "4"}, Result{"2.5", true}},
		{"whole quotient", "divide", []string{"9", "3"}, Result{"3", true}},
		{"zero dividend", "divide", []string{"0", "5"}, Result{"0", true}},
		{"one third", "divide", []string{"1", "3"}, Result{"0." + strings.Repeat("3", 34), false}},
		{"two thirds rounds up", "divide", []string{"2", "3"}, Result{"0." + strings.Repeat("6", 33) + "7", false}},
		{"negative dividend", "divide", []string{"-2", "3"}, Result{"-0." + strings.Repeat("6", 33) + "7", false}},
		{"negative divisor", "divide", []string{"2", "-3"}, Result{"-0." + strings.Repeat("6", 33) + "7", false}},
		{"both negative", "divide", []string{"-2", "-3"}, Result{"0." + strings.Repeat("6", 33) + "7", false}},
		{"one seventh", "divide", []string{"1", "7"}, Result{"0.1428571428571428571428571428571429", false}},
		{"small quotient keeps 34 digits", "divide", []string{"0.000000000000000001", "3"},
			Result{"0." + zeros(18) + strings.Repeat("3", 34), false}},
		{"large quotient", "divide", []string{"2", "0.0000000000000000000000000000000003"},
			Result{strings.Repeat("6", 33) + "7", false}},
		{"quotient tie keeps even digit", "divide", []string{"1234567890123456789012345678901234", "0.8"},
			Result{"1543209862654320986265432098626542", false}},
		{"quotient tie rounds to even", "divide", []string{"1234567890123456789012345678901238", "0.8"},
			Result{"1543209862654320986265432098626548", false}},
		{"negative quotient tie", "divide", []string{"-1234567890123456789012345678901238", "0.8"},
			Result{"-1543209862654320986265432098626548", false}},
		{"sum tie keeps even digit", "add", []string{"1234567890123456789012345678901234", "0.5"},
			Result{"1234567890123456789012345678901234", false}},
		{"sum tie rounds to even", "add", []string{"1234567890123456789012345678901235", "0.5"},
			Result{"1234567890123456789012345678901236", false}},
		{"negative sum tie", "add", []string{"-1234567890123456789012345678901235", "-0.5"},
			Result{"-1234567890123456789012345678901236", false}},
		{"rounding carries into a new digit", "add", []string{maxDigits, "0.5"}, Result{"1" + zeros(34), false}},
		{"tiny addend is rounded away", "add", []string{tenPow99, tenPowMinus99}, Result{tenPow99, false}},
		{"long product keeps 34 digits", "multiply",
			[]string{"1234567890123456789012345678901234", "1234567890123456789012345678901234"},
			Result{"1524157875323883675049535156256667" + zeros(33), false}},
		{"smallest supported result", "multiply", []string{tenPowMinus99, "0.1"}, Result{"0." + zeros(99) + "1", true}},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := Calculate(tt.operation, tt.operands)
			if err != nil {
				t.Fatalf("Calculate(%q, %q) returned error: %v", tt.operation, tt.operands, err)
			}
			if got != tt.want {
				t.Errorf("Calculate(%q, %q) = %+v, want %+v", tt.operation, tt.operands, got, tt.want)
			}
			// Ground rule: every result is a valid operand.
			if _, err := parseOperand(1, got.Value); err != nil {
				t.Errorf("result %q is not a valid operand: %v", got.Value, err)
			}
		})
	}
}

func TestCalculateErrors(t *testing.T) {
	tests := []struct {
		name      string
		operation string
		operands  []string
		want      Code
	}{
		{"unknown operation", "modulo", []string{"1", "2"}, UnsupportedOperation},
		{"too few operands", "add", []string{"1"}, WrongOperandCount},
		{"too many operands", "add", []string{"1", "2", "3"}, WrongOperandCount},
		{"no operands", "add", nil, WrongOperandCount},
		{"invalid operand", "add", []string{"1", "abc"}, InvalidNumber},
		{"operand too long", "add", []string{"1", "1." + zeros(255)}, InputTooLarge},
		{"operand out of range", "add", []string{"1", "1" + zeros(100)}, OutOfRange},
		{"division by zero", "divide", []string{"1", "0"}, DivisionByZero},
		{"division by negative zero", "divide", []string{"1", "-0.0"}, DivisionByZero},
		{"zero divided by zero", "divide", []string{"0", "0"}, DivisionByZero},
		{"product reaches 1e100", "multiply", []string{tenPow99, "10"}, OutOfRange},
		{"sum reaches 1e100", "add", []string{maxDigits + zeros(66), "1" + zeros(66)}, OutOfRange},
		{"rounding reaches 1e100", "add", []string{maxDigits + zeros(66), "5" + zeros(65)}, OutOfRange},
		{"quotient reaches 1e100", "divide", []string{tenPow99, "0.1"}, OutOfRange},
		{"product below 1e-100", "multiply", []string{tenPowMinus99, "0.01"}, OutOfRange},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := Calculate(tt.operation, tt.operands)
			var calcErr *Error
			if !errors.As(err, &calcErr) {
				t.Fatalf("Calculate(%q, %.40q) error = %v, want an *Error with code %s", tt.operation, tt.operands, err, tt.want)
			}
			if calcErr.Code != tt.want {
				t.Errorf("Calculate(%q, %.40q) code = %s, want %s", tt.operation, tt.operands, calcErr.Code, tt.want)
			}
		})
	}
}

func TestErrorMessages(t *testing.T) {
	tests := []struct {
		operation string
		operands  []string
		want      string
	}{
		{"modulo", []string{"1", "2"}, `Unsupported operation "modulo". Supported operations: add, divide, multiply, subtract.`},
		{"add", []string{"1"}, `"add" expects 2 operands, got 1.`},
		{"add", []string{"1", "x"}, `Operand 2 is not a valid number. Use a plain decimal such as "-12.5".`},
		{"divide", []string{"1", "0"}, "Cannot divide by zero."},
	}
	for _, tt := range tests {
		_, err := Calculate(tt.operation, tt.operands)
		var calcErr *Error
		if !errors.As(err, &calcErr) || calcErr.Message != tt.want {
			t.Errorf("Calculate(%q, %q) error = %v, want message %q", tt.operation, tt.operands, err, tt.want)
		}
	}
	_, err := Calculate("divide", []string{"1", "0"})
	if got, want := err.Error(), "DIVISION_BY_ZERO: Cannot divide by zero."; got != want {
		t.Errorf("Error() = %q, want %q", got, want)
	}
}

// inverses maps each operation to the one that undoes it.
var inverses = map[string]string{
	"add": "subtract", "subtract": "add", "multiply": "divide", "divide": "multiply",
}

// FuzzCalculate checks properties that hold for any input: Calculate never
// panics, every error is an *Error, every result is a valid operand, and an
// exact result undone by the inverse operation gives back the first operand.
func FuzzCalculate(f *testing.F) {
	names := slices.Sorted(maps.Keys(operations))
	seeds := []struct {
		op   uint8
		a, b string
	}{
		{0, "0.1", "0.2"}, {1, "1", "4"}, {1, "1", "3"}, {1, "1", "0"},
		{2, "-12.5", "8"}, {2, tenPow99, tenPowMinus99}, {3, "x", "1"},
	}
	for _, s := range seeds {
		f.Add(s.op, s.a, s.b)
	}
	f.Fuzz(func(t *testing.T, op uint8, a, b string) {
		name := names[int(op)%len(names)]
		got, err := Calculate(name, []string{a, b})
		if err != nil {
			var calcErr *Error
			if !errors.As(err, &calcErr) {
				t.Fatalf("error %v is not an *Error", err)
			}
			return
		}
		if _, err := parseOperand(1, got.Value); err != nil {
			t.Fatalf("result %q of %s(%q, %q) is not a valid operand: %v", got.Value, name, a, b, err)
		}
		divisor, _ := decimal.NewFromString(b)
		if !got.Exact || (name == "multiply" && divisor.IsZero()) {
			return // only exact results can be undone, and multiplying by zero never can
		}
		back, err := Calculate(inverses[name], []string{got.Value, b})
		if err != nil {
			t.Fatalf("%s(%q, %q) undoing %s(%q, %q) failed: %v", inverses[name], got.Value, b, name, a, b, err)
		}
		want, _ := decimal.NewFromString(a)
		if gotBack, _ := decimal.NewFromString(back.Value); !gotBack.Equal(want) {
			t.Fatalf("%s(%q, %q) = %q exactly, but %s gives back %q", name, a, b, got.Value, inverses[name], back.Value)
		}
	})
}
