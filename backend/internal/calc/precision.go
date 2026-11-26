package calc

import "github.com/shopspring/decimal"

// The precision policy: every result keeps Precision significant digits,
// rounded half to even, in a single rounding step. Nothing else in this
// package rounds. shopspring's own rounding helpers (Div, Round, Sqrt, Pow)
// work to a fixed number of decimal places, so small results become zero;
// rules_test.go bans them here.

// roundExact applies the policy to a value that was computed exactly, and
// reports whether the value came through unchanged.
func roundExact(d decimal.Decimal) (decimal.Decimal, bool) {
	if d.IsZero() {
		return d, true
	}
	rounded := d.RoundBank(Precision - magnitude(d))
	return rounded, rounded.Equal(d)
}

// divide returns a ÷ b under the policy, and whether the quotient is exact.
// b must not be zero. Most quotients have no finite decimal form, so the
// quotient is truncated at Precision digits with QuoRem, and the exact
// remainder decides the last digit. That keeps it to one rounding step.
func divide(a, b decimal.Decimal) (decimal.Decimal, bool) {
	if a.IsZero() {
		return a, true
	}
	negative := a.Sign() != b.Sign()
	a, b = a.Abs(), b.Abs()

	// The quotient's leading digit sits at magnitude(a) - magnitude(b), or one
	// place higher. Try the lower position first; if that gives one digit too
	// many, keep one decimal place fewer.
	places := Precision - (magnitude(a) - magnitude(b))
	q, r := a.QuoRem(b, places)
	if q.NumDigits() > Precision {
		places--
		q, r = a.QuoRem(b, places)
	}

	exact := r.IsZero()
	if !exact && roundsUp(q, r, b, places) {
		q = q.Add(decimal.New(1, -places))
	}
	if negative {
		q = q.Neg()
	}
	return q, exact
}

// roundsUp reports whether half-even rounding adds one unit in the last place
// to the truncated, non-negative quotient q, where r is the non-zero remainder
// of dividing by b. The discarded part of the quotient is r / b, which is more
// than half a unit when 2r > b × unit, and exactly half when they are equal.
func roundsUp(q, r, b decimal.Decimal, places int32) bool {
	unit := decimal.New(1, -places)
	switch r.Add(r).Cmp(b.Mul(unit)) {
	case 1:
		return true
	case 0:
		return q.Shift(places).BigInt().Bit(0) == 1 // a tie goes to the even neighbour
	default:
		return false
	}
}
