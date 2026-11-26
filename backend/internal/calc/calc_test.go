package calc

import (
	"errors"
	"maps"
	"math/big"
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
	// For power, Python computes the exact power at a higher precision and
	// rounds it once (dividing 1 by it for a negative exponent). To recompute
	// this table and TestCalculateErrors' codes, run this from this directory:
	//
	//	python3 testdata/reference.py
	//
	// It reads both tables from this file and reports any row that differs.
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

		// percentage
		{"percent of a whole number", "percentage", []string{"50", "200"}, Result{"100", true}},
		{"fractional percent", "percentage", []string{"12.5", "80"}, Result{"10", true}},
		{"negative percent", "percentage", []string{"-10", "50"}, Result{"-5", true}},
		{"zero percent", "percentage", []string{"0", "5"}, Result{"0", true}},
		{"percent of zero", "percentage", []string{"5", "0"}, Result{"0", true}},
		{"percentage operands swapped", "percentage", []string{"200", "50"}, Result{"100", true}},
		{"one percent of one", "percentage", []string{"1", "1"}, Result{"0.01", true}},
		{"percent over a hundred", "percentage", []string{"150", "40"}, Result{"60", true}},
		{"long percentage rounds", "percentage", []string{maxDigits, maxDigits}, Result{"9999999999999999999999999999999998" + zeros(32), false}},
		{"percentage keeps a long fraction", "percentage", []string{"1234567890123456789012345678901235", "5"}, Result{"61728394506172839450617283945061.75", true}},
		{"percentage tie rounds to even", "percentage", []string{"1234567890123456789012345678901235", "25"}, Result{"308641972530864197253086419725308.8", false}},
		{"percentage tie keeps even digit", "percentage", []string{"1234567890123456789012345678901233", "25"}, Result{"308641972530864197253086419725308.2", false}},
		{"percentage reaches 1e-100", "percentage", []string{tenPowMinus99, "10"}, Result{"0." + zeros(99) + "1", true}},
		{"percentage just under 1e100", "percentage", []string{maxDigits + zeros(66), "100"}, Result{maxDigits + zeros(66), true}},

		// power
		{"whole power", "power", []string{"2", "10"}, Result{"1024", true}},
		{"decimal base", "power", []string{"1.5", "2"}, Result{"2.25", true}},
		{"negative base, odd exponent", "power", []string{"-2", "3"}, Result{"-8", true}},
		{"negative base, even exponent", "power", []string{"-2", "4"}, Result{"16", true}},
		{"negative exponent", "power", []string{"2", "-3"}, Result{"0.125", true}},
		{"negative base, negative exponent", "power", []string{"-2", "-3"}, Result{"-0.125", true}},
		{"reciprocal is rounded", "power", []string{"3", "-1"}, Result{"0.3333333333333333333333333333333333", false}},
		{"zero to the zero", "power", []string{"0", "0"}, Result{"1", true}},
		{"negative zero to the zero", "power", []string{"-0.0", "0"}, Result{"1", true}},
		{"zero to a positive power", "power", []string{"0", "5"}, Result{"0", true}},
		{"anything to the zero", "power", []string{"123.456", "0"}, Result{"1", true}},
		{"exponent negative zero", "power", []string{"7", "-0"}, Result{"1", true}},
		{"exponent written 1.0", "power", []string{"7.25", "1.0"}, Result{"7.25", true}},
		{"exponent written 2.000", "power", []string{"1.1", "2.000"}, Result{"1.21", true}},
		{"exponent 1000", "power", []string{"1.001", "1000"}, Result{"2.716923932235892457383088121947577", false}},
		{"exponent -1000", "power", []string{"1.001", "-1000"}, Result{"0.3680633042887770634421946933557242", false}},
		{"one to the 1000", "power", []string{"1", "1000"}, Result{"1", true}},
		{"minus one to the -1000", "power", []string{"-1", "-1000"}, Result{"1", true}},
		{"minus one to the 999", "power", []string{"-1", "999"}, Result{"-1", true}},
		{"base with trailing zeros", "power", []string{"1." + zeros(40), "1000"}, Result{"1", true}},
		{"34-digit base to the 1000", "power", []string{"1." + zeros(32) + "1", "1000"}, Result{"1." + zeros(29) + "1", false}},
		{"34-digit base to the -1000", "power", []string{"1." + zeros(32) + "1", "-1000"}, Result{"0.999999999999999999999999999999", false}},
		{"half to the 332", "power", []string{"0.5", "332"}, Result{"0." + zeros(99) + "1142987391282274982215783548305341", false}},
		{"two to the 332", "power", []string{"2", "332"}, Result{"8749002899132047697490008908470485" + zeros(66), false}},
		{"ten to the 99", "power", []string{"10", "99"}, Result{tenPow99, true}},
		{"tenth to the 100 is 1e-100", "power", []string{"0.1", "100"}, Result{"0." + zeros(99) + "1", true}},
		{"ten to the -100 is 1e-100", "power", []string{"10", "-100"}, Result{"0." + zeros(99) + "1", true}},
		{"tenth to the -99", "power", []string{"0.1", "-99"}, Result{tenPow99, true}},
		{"reciprocal of the largest operand rounds to 1e-100", "power", []string{maxDigits + zeros(66), "-1"}, Result{"0." + zeros(99) + "1", false}},
		{"reciprocal just over the smallest", "power", []string{"0." + zeros(99) + "1222222222222222222222222222222222", "-1"}, Result{"8181818181818181818181818181818183" + zeros(66), false}},
		{"power just under 1e100", "power", []string{"183298.0710832435936412899930401845", "19"}, Result{"9999999999999999999999999999999896" + zeros(66), false}},
		{"tiny base squared", "power", []string{"0." + zeros(49) + "1", "2"}, Result{"0." + zeros(99) + "1", true}},
		{"power tie keeps even digit", "power", []string{"5", "50"}, Result{"88817841970012523233890533447265620", false}},
		{"power tie rounds to even", "power", []string{"1.5", "29"}, Result{"127834.0394885893911123275756835938", false}},
		{"negative power tie keeps even digit", "power", []string{"2", "-50"}, Result{"0." + zeros(15) + "8881784197001252323389053344726562", false}},
		{"exponent 1000.0", "power", []string{"1", "1000.0"}, Result{"1", true}},

		// sqrt
		{"square root of zero", "sqrt", []string{"0"}, Result{"0", true}},
		{"square root of negative zero", "sqrt", []string{"-0"}, Result{"0", true}},
		{"square root of one", "sqrt", []string{"1"}, Result{"1", true}},
		{"exact whole root", "sqrt", []string{"144"}, Result{"12", true}},
		{"exact decimal root", "sqrt", []string{"2.25"}, Result{"1.5", true}},
		{"exact small root", "sqrt", []string{"0.0004"}, Result{"0.02", true}},
		{"root of 0.01", "sqrt", []string{"0.01"}, Result{"0.1", true}},
		{"root of 0.1", "sqrt", []string{"0.1"}, Result{"0.3162277660168379331998893544432719", false}},
		{"root of two", "sqrt", []string{"2"}, Result{"1.414213562373095048801688724209698", false}},
		{"root of ten", "sqrt", []string{"10"}, Result{"3.162277660168379331998893544432719", false}},
		{"root of 1e-100", "sqrt", []string{"0." + zeros(99) + "1"}, Result{"0." + zeros(49) + "1", true}},
		{"root of 1e-99", "sqrt", []string{tenPowMinus99}, Result{"0." + zeros(49) + "3162277660168379331998893544432719", false}},
		{"root of 1e99", "sqrt", []string{tenPow99}, Result{"3162277660168379331998893544432719" + zeros(16), false}},
		{"root of the largest operand", "sqrt", []string{maxDigits + zeros(66)}, Result{maxDigits + zeros(16), false}},
		{"root of 34 nines", "sqrt", []string{maxDigits}, Result{"99999999999999999.99999999999999999", false}},
		{"root of a 33-digit square", "sqrt", []string{"152415787532388345526596755677489"}, Result{"12345678901234567", true}},
		{"root of a 34-digit non-square", "sqrt", []string{"152415787532388345526596755677490"}, Result{"12345678901234567." + zeros(16) + "4", false}},
		{"root of a tiny 34-digit number", "sqrt", []string{"0." + zeros(99) + "1222222222222222222222222222222222"}, Result{"0." + zeros(49) + "1105541596785133283038310912223562", false}},
		{"root just under 100", "sqrt", []string{"99.99999999999999999999999999999999"}, Result{"9.999999999999999999999999999999999", false}},
		{"root of an operand with trailing zeros", "sqrt", []string{"16." + zeros(42)}, Result{"4", true}},
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

		// percentage
		{"percentage below 1e-100", "percentage", []string{tenPowMinus99, "1"}, OutOfRange},
		{"percentage reaches 1e100", "percentage", []string{tenPow99, "1000"}, OutOfRange},
		{"percentage with one operand", "percentage", []string{"4"}, WrongOperandCount},

		// power
		{"reciprocal of the smallest operand", "power", []string{"0." + zeros(99) + "1", "-1"}, OutOfRange},
		{"power reaches 1e100", "power", []string{"10", "100"}, OutOfRange},
		{"power rounds up to 1e100", "power", []string{"183298.0710832435936412899930401846", "19"}, OutOfRange},
		{"negative power rounds up to 1e100", "power", []string{"0.7186674531056621319704583753764317", "-697"}, OutOfRange},
		{"power below 1e-100", "power", []string{"0.1", "101"}, OutOfRange},
		{"negative power below 1e-100", "power", []string{"10", "-101"}, OutOfRange},
		{"negative power reaches 1e100", "power", []string{"0.1", "-100"}, OutOfRange},
		{"huge base to the 1000", "power", []string{maxDigits, "1000"}, OutOfRange},
		{"tiny base to the 1000", "power", []string{tenPowMinus99, "1000"}, OutOfRange},
		{"huge base to the -1000", "power", []string{maxDigits, "-1000"}, OutOfRange},
		{"tiny base to the -1000", "power", []string{tenPowMinus99, "-1000"}, OutOfRange},
		{"half to the 1000", "power", []string{"0.5", "1000"}, OutOfRange},
		{"exponent 1001", "power", []string{"2", "1001"}, InvalidExponent},
		{"exponent -1001", "power", []string{"2", "-1001"}, InvalidExponent},
		{"fractional exponent", "power", []string{"4", "2.5"}, InvalidExponent},
		{"small fractional exponent", "power", []string{"4", "0.5"}, InvalidExponent},
		{"exponent just over 1000", "power", []string{"1", "1000." + zeros(29) + "1"}, InvalidExponent},
		{"huge exponent", "power", []string{"1", tenPow99}, InvalidExponent},
		{"zero to a negative power", "power", []string{"0", "-1"}, DivisionByZero},
		{"zero to the -1000", "power", []string{"-0.00", "-1000"}, DivisionByZero},
		{"invalid exponent number", "power", []string{"2", "1e3"}, InvalidNumber},

		// sqrt
		{"negative square root", "sqrt", []string{"-1"}, NegativeSquareRoot},
		{"tiny negative square root", "sqrt", []string{"-0." + zeros(99) + "1"}, NegativeSquareRoot},
		{"sqrt with two operands", "sqrt", []string{"4", "2"}, WrongOperandCount},
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
		{"modulo", []string{"1", "2"}, `Unsupported operation "modulo". Supported operations: add, divide, multiply, percentage, power, sqrt, subtract.`},
		{"add", []string{"1"}, `"add" expects 2 operands, got 1.`},
		{"add", []string{"1", "x"}, `Operand 2 is not a valid number. Use a plain decimal such as "-12.5".`},
		{"divide", []string{"1", "0"}, "Cannot divide by zero."},
		{"sqrt", []string{"4", "9"}, `"sqrt" expects 1 operand, got 2.`},
		{"sqrt", []string{"-4"}, "Cannot take the square root of a negative number."},
		{"power", []string{"2", "0.5"}, "The exponent must be a whole number from -1000 to 1000."},
		{"power", []string{"0", "-2"}, "Cannot raise zero to a negative power."},
		{"power", []string{"10", "100"}, "The result is outside the supported range of 1e-100 to 1e100."},
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

// inverses maps each operation that has an inverse to the one that undoes it.
var inverses = map[string]string{
	"add": "subtract", "subtract": "add", "multiply": "divide", "divide": "multiply",
}

// reference computes name(a, b) exactly with math/big, an implementation
// independent of shopspring, then rounds it with roundReference. It returns
// the rounded value and whether rounding changed it. b must not be zero for
// divide.
func reference(name, a, b string) (decimal.Decimal, bool) {
	x, _ := new(big.Rat).SetString(a)
	y, _ := new(big.Rat).SetString(b)
	exact := map[string]func(x, y *big.Rat) *big.Rat{
		"add":      new(big.Rat).Add,
		"subtract": new(big.Rat).Sub,
		"multiply": new(big.Rat).Mul,
		"divide":   new(big.Rat).Quo,
		"percentage": func(x, y *big.Rat) *big.Rat {
			return new(big.Rat).Quo(new(big.Rat).Mul(x, y), big.NewRat(100, 1))
		},
	}[name](x, y)
	return roundReference(exact)
}

// referencePower computes a^b like reference: exactly with math/big, as
// num^|n| / den^|n| for a = num/den, inverted for a negative n, then rounded
// with roundReference. When Calculate must refuse instead, it returns that
// error code: b is not a whole number from -maxExponent to maxExponent, or a
// is zero and b negative. a and b must be valid operands.
func referencePower(a, b string) (decimal.Decimal, bool, Code) {
	x, _ := new(big.Rat).SetString(a)
	y, _ := new(big.Rat).SetString(b)
	if !y.IsInt() || y.Num().CmpAbs(big.NewInt(maxExponent)) > 0 {
		return decimal.Decimal{}, false, InvalidExponent
	}
	n := y.Num().Int64()
	if x.Sign() == 0 && n < 0 {
		return decimal.Decimal{}, false, DivisionByZero
	}
	k := big.NewInt(n)
	k.Abs(k)
	num, den := new(big.Int).Exp(x.Num(), k, nil), new(big.Int).Exp(x.Denom(), k, nil)
	if n < 0 {
		num, den = den, num
	}
	value, exact := roundReference(new(big.Rat).SetFrac(num, den))
	return value, exact, ""
}

// roundReference rounds an exact value to Precision significant digits, half
// to even, by integer division, and reports whether rounding left it unchanged.
func roundReference(exact *big.Rat) (decimal.Decimal, bool) {
	if exact.Sign() == 0 {
		return decimal.Zero, true
	}

	// Find k so that 10^(Precision-1) <= |exact| × 10^k < 10^Precision, then
	// q = |exact| × 10^k truncated is the result's Precision digits.
	abs := new(big.Rat).Abs(exact)
	pow10 := func(n int) *big.Int { return new(big.Int).Exp(big.NewInt(10), big.NewInt(int64(n)), nil) }
	k := Precision - (len(abs.Num().String()) - len(abs.Denom().String()))
	scaled := func() (num, den *big.Int) {
		if k >= 0 {
			return new(big.Int).Mul(abs.Num(), pow10(k)), abs.Denom()
		}
		return abs.Num(), new(big.Int).Mul(abs.Denom(), pow10(-k))
	}
	for {
		num, den := scaled()
		q := new(big.Int).Quo(num, den)
		switch {
		case q.Cmp(pow10(Precision-1)) < 0:
			k++
		case q.Cmp(pow10(Precision)) >= 0:
			k--
		default:
			_, r := new(big.Int).QuoRem(num, den, new(big.Int))
			twice := new(big.Int).Lsh(r, 1)
			if c := twice.Cmp(den); c > 0 || (c == 0 && q.Bit(0) == 1) {
				q.Add(q, big.NewInt(1))
			}
			if exact.Sign() < 0 {
				q.Neg(q)
			}
			return decimal.NewFromBigInt(q, int32(-k)), r.Sign() == 0
		}
	}
}

// FuzzCalculate checks properties that hold for any input: Calculate never
// panics, every error is an *Error, every result is a valid operand and
// matches the math/big reference in value and exactness, and an exact result
// undone by the inverse operation gives back the first operand. It fuzzes the
// operations with an inverse, plus percentage, which has no inverse and so
// skips that last check. power and sqrt have their own fuzz tests.
func FuzzCalculate(f *testing.F) {
	names := append(slices.Sorted(maps.Keys(inverses)), "percentage")
	seeds := []struct {
		op   uint8
		a, b string
	}{
		{0, "0.1", "0.2"}, {1, "1", "4"}, {1, "1", "3"}, {1, "1", "0"},
		{2, "-12.5", "8"}, {2, tenPow99, tenPowMinus99}, {3, "x", "1"},
		{1, "2", "3"}, {1, "-1", "7"}, {1, "1", "8"}, {2, "0.5", "0.5"},
		{0, "1234567890123456789012345678901234", "0.5"}, // a tie that rounds to even
		{0, "1234567890123456789012345678901235", "0.5"},
		{2, "9999999999999999999999999999999999", "9999999999999999999999999999999999"},
		{1, "3000000000000000000000000000000001", "2"}, // quotient ties at the 35th digit
		{1, "3000000000000000000000000000000003", "2"},
		{4, "10", "50"}, {4, "33.3", "1"}, {4, "1234567890123456789012345678901235", "0.5"}, // percentage
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
		gotValue, _ := decimal.NewFromString(got.Value)
		if want, wantExact := reference(name, a, b); !gotValue.Equal(want) || got.Exact != wantExact {
			t.Fatalf("%s(%q, %q) = %q exact=%v, but math/big gives %s exact=%v",
				name, a, b, got.Value, got.Exact, want, wantExact)
		}
		divisor, _ := decimal.NewFromString(b)
		inverse, ok := inverses[name]
		if !ok || !got.Exact || (name == "multiply" && divisor.IsZero()) {
			return // only exact results can be undone, and multiplying by zero never can
		}
		back, err := Calculate(inverse, []string{got.Value, b})
		if err != nil {
			t.Fatalf("%s(%q, %q) undoing %s(%q, %q) failed: %v", inverses[name], got.Value, b, name, a, b, err)
		}
		want, _ := decimal.NewFromString(a)
		if gotBack, _ := decimal.NewFromString(back.Value); !gotBack.Equal(want) {
			t.Fatalf("%s(%q, %q) = %q exactly, but %s gives back %q", name, a, b, got.Value, inverses[name], back.Value)
		}
	})
}
