package calc

import "github.com/shopspring/decimal"

// Every result is rounded once, to Precision significant digits, half to even.
// shopspring's Div, Round, Sqrt and Pow round to fixed decimal places and turn
// small results into zero, so rules_test.go keeps them out of this package.
// Each operation keeps an exact value or remainder for that one rounding.

// roundExact rounds an exactly computed d and reports whether it was unchanged.
func roundExact(d decimal.Decimal) (decimal.Decimal, bool) {
	if d.IsZero() {
		return d, true
	}
	rounded := d.RoundBank(Precision - magnitude(d))
	return rounded, rounded.Equal(d)
}

// divide returns a ÷ b for a non-zero b, and whether it is exact. QuoRem
// truncates at Precision digits and the exact remainder decides the last one.
func divide(a, b decimal.Decimal) (decimal.Decimal, bool) {
	if a.IsZero() {
		return a, true
	}
	negative := a.Sign() != b.Sign()
	a, b = a.Abs(), b.Abs()

	// The leading digit is at magnitude(a) - magnitude(b) or one place higher.
	// Try the lower one, and drop a place if that gives a digit too many.
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

// roundsUp reports whether half-even rounding bumps the truncated, non-negative
// quotient q. r is the non-zero remainder, and the dropped part r / b is over
// half a unit when 2r > b × unit.
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

// power returns base^n and whether it is exact, for |n| <= maxExponent and a
// non-zero base when n < 0. base^|n| is exact, at most 34 000 digits, and is
// rounded once, by divide for n < 0. Calculate checks the range afterwards.
func power(base decimal.Decimal, n int64) (decimal.Decimal, bool) {
	if n < 0 {
		return divide(decimal.New(1, 0), exactPower(base, -n))
	}
	return roundExact(exactPower(base, n))
}

// exactPower squares repeatedly, and base^0 is 1 even for 0^0. Normalizing
// first keeps the trailing zeros of an operand like "1.000" from piling up.
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

// squareRoot returns √x for x >= 0, and whether it is exact. x is scaled by an
// even power of ten to a whole number N of 67 or 68 digits, so q = ⌊√N⌋ is √x
// truncated to Precision digits. √N - q > 1/2 exactly when N - q² > q, and it
// is never exactly 1/2 for a whole N, so there is no tie to break.
func squareRoot(x decimal.Decimal) (decimal.Decimal, bool) {
	if x.IsZero() {
		return x, true
	}
	shift := 2*Precision - magnitude(x) // N would have 68 digits
	if shift%2 != 0 {
		shift-- // keep the shift even; N then has 67
	}
	// x has at most Precision significant digits, so after the shift N is whole.
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
