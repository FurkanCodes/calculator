package calc

import (
	"errors"
	"testing"

	"github.com/shopspring/decimal"
)

// FuzzPower checks power on any input: it never panics, every error is an
// *Error, and for valid operands the result, its exact flag and any refusal
// match referencePower and the range rule. Every result is a valid operand.
// It also undoes exact results where an exact inverse exists: an exact
// reciprocal taken again gives back the base, and the square root of an exact
// square gives back |base|.
func FuzzPower(f *testing.F) {
	seeds := []struct{ base, exponent string }{
		{"2", "10"}, {"1.5", "2"}, {"-3", "2"}, {"-2", "3"}, {"0.25", "-1"}, {"3", "-1"}, {"0", "-1"},
		{"0", "0"}, {"10", "100"}, {"1.001", "-1000"}, {"2", "2.5"}, {"9.99", "-1001"}, {maxDigits, "3"},
		{"5", "50"}, {"1.5", "29"}, {"2", "-50"}, {"x", "2"},
	}
	for _, s := range seeds {
		f.Add(s.base, s.exponent)
	}
	f.Fuzz(func(t *testing.T, a, b string) {
		got, err := Calculate("power", []string{a, b})
		var calcErr *Error
		if err != nil && !errors.As(err, &calcErr) {
			t.Fatalf("error %v is not an *Error", err)
		}
		_, errA := parseOperand(1, a)
		_, errB := parseOperand(2, b)
		if errA != nil || errB != nil {
			return // the number rules have their own tests
		}

		want, wantExact, wantCode := referencePower(a, b)
		if wantCode == "" && !inRange(want) {
			wantCode = OutOfRange
		}
		if wantCode != "" {
			if err == nil || calcErr.Code != wantCode {
				t.Fatalf("power(%q, %q) = %+v, %v; want error %s", a, b, got, err, wantCode)
			}
			return
		}
		if err != nil {
			t.Fatalf("power(%q, %q) failed: %v; want %s", a, b, err, want)
		}
		if !mustParse(got.Value).Equal(want) || got.Exact != wantExact {
			t.Fatalf("power(%q, %q) = %q (exact %t), reference gives %s (exact %t)", a, b, got.Value, got.Exact, want, wantExact)
		}
		if _, err := parseOperand(1, got.Value); err != nil {
			t.Fatalf("result %q of power(%q, %q) is not a valid operand: %v", got.Value, a, b, err)
		}
		if !got.Exact {
			return
		}
		base, exponent := mustParse(a), mustParse(b)
		switch {
		case exponent.Equal(decimal.New(-1, 0)):
			back, err := Calculate("power", []string{got.Value, "-1"})
			if err != nil || !back.Exact || !mustParse(back.Value).Equal(base) {
				t.Fatalf("power(%q, -1) = %q exactly, but taking it again gives %+v, %v", a, got.Value, back, err)
			}
		case exponent.Equal(decimal.New(2, 0)):
			back, err := Calculate("sqrt", []string{got.Value})
			if err != nil || !back.Exact || !mustParse(back.Value).Equal(base.Abs()) {
				t.Fatalf("power(%q, 2) = %q exactly, but its square root is %+v, %v", a, got.Value, back, err)
			}
		}
	})
}

// FuzzSqrt checks sqrt on any input: it never panics, every error is an
// *Error, and every result is a valid operand. A rounded root r is not
// exactly √x, so squaring it does not give x back. What is true is that r is
// within half a unit in its last place of √x, so x lies between the squares
// of r minus and plus that half unit. And the result is exact exactly when
// r² is x, in which case power(r, 2) gives x back.
func FuzzSqrt(f *testing.F) {
	for _, s := range []string{
		"0", "-0", "2", "2.25", "0.1", "-4", "x", tenPowMinus99, maxDigits, maxDigits + zeros(66),
		"152415787532388345526596755677489",
	} {
		f.Add(s)
	}
	f.Fuzz(func(t *testing.T, s string) {
		got, err := Calculate("sqrt", []string{s})
		if err != nil {
			var calcErr *Error
			if !errors.As(err, &calcErr) {
				t.Fatalf("error %v is not an *Error", err)
			}
			return
		}
		if _, err := parseOperand(1, got.Value); err != nil {
			t.Fatalf("result %q of sqrt(%q) is not a valid operand: %v", got.Value, s, err)
		}
		x, root := mustParse(s), mustParse(got.Value)
		if square := root.Mul(root); got.Exact != square.Equal(x) {
			t.Fatalf("sqrt(%q) = %q with exact %t, but its square is %s", s, got.Value, got.Exact, square)
		}
		if !root.IsZero() {
			half := decimal.New(5, magnitude(root)-Precision-1)
			low, high := root.Sub(half), root.Add(half)
			if x.Cmp(low.Mul(low)) < 0 || x.Cmp(high.Mul(high)) > 0 {
				t.Fatalf("sqrt(%q) = %q is more than half a unit in the last place from the root", s, got.Value)
			}
		}
		if got.Exact {
			back, err := Calculate("power", []string{got.Value, "2"})
			if err != nil || !back.Exact || !mustParse(back.Value).Equal(x) {
				t.Fatalf("sqrt(%q) = %q exactly, but squaring it gives %+v, %v", s, got.Value, back, err)
			}
		}
	})
}

// mustParse converts a string the tests already know is a number.
func mustParse(s string) decimal.Decimal {
	d, err := decimal.NewFromString(s)
	if err != nil {
		panic(err)
	}
	return d
}
