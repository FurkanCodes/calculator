package calc

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"testing"
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
