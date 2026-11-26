package calc

import (
	"regexp"

	"github.com/shopspring/decimal"
)

// README.md documents the same limits, so change both together.
const (
	// Precision is the number of significant digits a result keeps.
	Precision = 34

	// MaxLength is an operand's limit in bytes, checked before any parsing.
	MaxLength = 256

	maxMagnitude = 100

	// maxExponent bounds |n| in power.
	maxExponent = 1000
)

// NumberPattern is the plain decimal format every operand must match. It is
// exported, like MaxLength, so a test can check the API description against it.
const NumberPattern = `^-?[0-9]+(\.[0-9]+)?$`

var numberPattern = regexp.MustCompile(NumberPattern)

// parseOperand applies the number rules. position is 1-based, for error messages.
func parseOperand(position int, s string) (decimal.Decimal, error) {
	if len(s) > MaxLength {
		return decimal.Decimal{}, newError(InputTooLarge,
			"Operand %d is longer than %d bytes.", position, MaxLength)
	}
	if !numberPattern.MatchString(s) {
		return decimal.Decimal{}, newError(InvalidNumber,
			`Operand %d is not a valid number. Use a plain decimal such as "-12.5".`, position)
	}
	// FuzzNumberPattern checks that NewFromString accepts whatever numberPattern does.
	d, _ := decimal.NewFromString(s)
	if significantDigits(d) > Precision {
		return decimal.Decimal{}, newError(InputTooLarge,
			"Operand %d has more than %d significant digits.", position, Precision)
	}
	if !inRange(d) {
		return decimal.Decimal{}, newError(OutOfRange,
			"Operand %d is outside the supported range of 1e-%d to 1e%d.", position, maxMagnitude, maxMagnitude)
	}
	return d, nil
}

// magnitude is where a non-zero d's leading digit sits relative to the point.
// 123.4 has 3, 1 has 1 and 0.05 has -1.
func magnitude(d decimal.Decimal) int32 {
	return int32(d.NumDigits()) + d.Exponent()
}

// significantDigits ignores leading and trailing zeros, so "1.000" has one.
func significantDigits(d decimal.Decimal) int {
	return d.Normalize().NumDigits()
}

// inRange reports whether d is zero, or has 1e-maxMagnitude <= |d| < 1e+maxMagnitude.
func inRange(d decimal.Decimal) bool {
	if d.IsZero() {
		return true
	}
	abs := d.Abs()
	return abs.Cmp(decimal.New(1, -maxMagnitude)) >= 0 && abs.Cmp(decimal.New(1, maxMagnitude)) < 0
}
