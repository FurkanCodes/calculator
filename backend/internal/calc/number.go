package calc

import (
	"regexp"

	"github.com/shopspring/decimal"
)

// Limits on every operand and every result. README.md documents the same values.
const (
	// Precision is the number of significant digits a result keeps.
	Precision = 34

	// MaxLength caps an operand string before any parsing work is done.
	MaxLength = 256

	// maxMagnitude bounds the range: a number is zero, or has
	// 1e-maxMagnitude <= |x| < 1e+maxMagnitude.
	maxMagnitude = 100

	// maxExponent bounds the exponent of power: a whole number from
	// -maxExponent to maxExponent.
	maxExponent = 1000
)

// NumberPattern is a plain decimal: an optional minus sign, ASCII digits and
// an optional fraction. It has no plus sign, exponent, spaces or bare point.
// It is exported, with MaxLength, so the API description can be checked
// against it.
const NumberPattern = `^-?[0-9]+(\.[0-9]+)?$`

var numberPattern = regexp.MustCompile(NumberPattern)

// parseOperand converts an operand string to a decimal and enforces the number
// rules. position is the operand's 1-based position, for error messages.
func parseOperand(position int, s string) (decimal.Decimal, error) {
	if len(s) > MaxLength {
		return decimal.Decimal{}, newError(InputTooLarge,
			"Operand %d is longer than %d bytes.", position, MaxLength)
	}
	if !numberPattern.MatchString(s) {
		return decimal.Decimal{}, newError(InvalidNumber,
			`Operand %d is not a valid number. Use a plain decimal such as "-12.5".`, position)
	}
	// NewFromString accepts every string numberPattern does; FuzzNumberPattern
	// checks that, so the error is always nil here.
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

// magnitude is the position of a non-zero number's leading digit relative to
// the decimal point: 123.4 has magnitude 3, 1 has 1, and 0.05 has -1.
func magnitude(d decimal.Decimal) int32 {
	return int32(d.NumDigits()) + d.Exponent()
}

// significantDigits counts the digits from the first non-zero digit to the last.
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
