package calc

import "github.com/shopspring/decimal"

// The precision policy: every result keeps Precision significant digits,
// rounded half to even, in a single rounding step. Nothing else in this
// package rounds. shopspring's own rounding helpers (Div, Round, Sqrt, Pow)
// work to a fixed number of decimal places, so small results become zero;
// rules_test.go bans them here. Each operation computes its result exactly,
// or keeps the exact remainder of a truncated result, so the one rounding
// step always knows which way to go.

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

// power returns base^n under the policy, and whether the result is exact.
// base is not zero, and n is a non-zero whole number with |n| <= maxExponent.
// base^|n| is computed exactly: with at most Precision significant digits in
// base, that is at most 34 000 digits. A positive power is then rounded once;
// a negative one goes through divide, which rounds 1 ÷ base^|n| once.
func power(base decimal.Decimal, n int64) (decimal.Decimal, bool) {
	if n < 0 {
		return divide(decimal.New(1, 0), exactPower(base, -n))
	}
	return roundExact(exactPower(base, n))
}

// exactPower returns base^k exactly for k >= 1, by repeated squaring. base is
// normalized first, so trailing zeros in an operand such as "1.000" are not
// multiplied k times.
func exactPower(base decimal.Decimal, k int64) decimal.Decimal {
	result := decimal.New(1, 0)
	square := base.Normalize()
	for {
		if k%2 == 1 {
			result = result.Mul(square)
		}
		k /= 2
		if k == 0 {
			return result
		}
		square = square.Mul(square)
	}
}

// powerOutOfRange reports that base^n is certainly out of range, so the
// exact power need not be computed. base is not zero.
//
// With m = magnitude(base), 10^(m-1) <= |base| < 10^m, so |base^n| lies
// between 10^(n(m-1)) and 10^(nm), bounds included. If the lower bound is at
// least 10^maxMagnitude, the result is too large. If the upper bound is at
// most 10^-(maxMagnitude+1), the result is too small. Rounding never crosses
// a power of ten, because a power of ten is itself a 34-digit number, so the
// rounded result is out of range too. Every other power is computed and
// Calculate checks the rounded result, so this never rejects one in range.
func powerOutOfRange(base decimal.Decimal, n int64) bool {
	m := int64(magnitude(base))
	low, high := n*(m-1), n*m
	if n < 0 {
		low, high = high, low
	}
	return low >= maxMagnitude || high <= -(maxMagnitude+1)
}

// squareRoot returns √x under the policy, and whether the root is exact. x
// must not be negative.
//
// x is scaled by an even power of ten, 10^shift, to a whole number N with 67
// or 68 digits. Then q = ⌊√N⌋ has exactly Precision digits: it is √x
// truncated to Precision significant digits, scaled by 10^(shift/2). The exact
// remainder N - q² decides the last digit. √N = q + f with 0 <= f < 1, and
// f > 1/2 exactly when N > q² + q + 1/4, which for whole numbers means
// N - q² > q. f is never exactly 1/2, because then N would not be a whole
// number, so a square root never has a tie to break.
func squareRoot(x decimal.Decimal) (decimal.Decimal, bool) {
	if x.IsZero() {
		return x, true
	}
	shift := 2*Precision - magnitude(x) // N would have 68 digits
	if shift%2 != 0 {
		shift-- // keep the shift even; N then has 67
	}
	// N is a whole number: x has at most Precision significant digits, and
	// after the shift the last of them is at least 33 places left of the
	// decimal point.
	n := x.Shift(shift)
	root := n.BigInt() // a copy, so computing in place leaves n unchanged
	root.Sqrt(root)
	q := decimal.NewFromBigInt(root, 0)
	remainder := n.Sub(q.Mul(q))
	if remainder.Cmp(q) > 0 {
		q = q.Add(decimal.New(1, 0))
	}
	return q.Shift(-shift / 2), remainder.IsZero()
}
