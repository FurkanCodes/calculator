package calc

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"testing"

	"github.com/shopspring/decimal"
)

// TestSharedNumberCases runs the number rules against testdata/numbers.json,
// the same cases the frontend's Zod schema is tested against.
func TestSharedNumberCases(t *testing.T) {
	raw, err := os.ReadFile(filepath.Join("..", "..", "..", "testdata", "numbers.json"))
	if err != nil {
		t.Fatalf("reading shared number cases: %v", err)
	}
	var cases struct {
		Accepted []string          `json:"accepted"`
		Rejected map[Code][]string `json:"rejected"`
	}
	if err := json.Unmarshal(raw, &cases); err != nil {
		t.Fatalf("parsing shared number cases: %v", err)
	}
	if len(cases.Accepted) == 0 || len(cases.Rejected) == 0 {
		t.Fatal("shared number cases are empty")
	}

	for _, s := range cases.Accepted {
		if _, err := parseOperand(1, s); err != nil {
			t.Errorf("parseOperand(%.40q) = %v, want accepted", s, err)
		}
	}
	for code, inputs := range cases.Rejected {
		for _, s := range inputs {
			_, err := parseOperand(1, s)
			var calcErr *Error
			if !errors.As(err, &calcErr) || calcErr.Code != code {
				t.Errorf("parseOperand(%.40q) error = %v, want code %s", s, err, code)
			}
		}
	}
}

// FuzzNumberPattern checks what parseOperand relies on when it ignores
// NewFromString's error: every string numberPattern accepts also parses.
func FuzzNumberPattern(f *testing.F) {
	for _, s := range []string{"0", "-12.5", "007", "0.001", "1." + zeros(254)} {
		f.Add(s)
	}
	f.Fuzz(func(t *testing.T, s string) {
		if !numberPattern.MatchString(s) {
			return
		}
		if _, err := decimal.NewFromString(s); err != nil {
			t.Fatalf("numberPattern accepts %q, but NewFromString rejects it: %v", s, err)
		}
	})
}
