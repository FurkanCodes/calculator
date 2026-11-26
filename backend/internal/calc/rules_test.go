package calc

import (
	"go/ast"
	"go/parser"
	"go/token"
	"path/filepath"
	"strings"
	"testing"
)

// bannedIdentifiers enforces ground rules 1 and 3: no binary floating point,
// and no shopspring helper that rounds on its own terms or panics.
var bannedIdentifiers = map[string]string{
	"float32":                  "binary floating point",
	"float64":                  "binary floating point",
	"ParseFloat":               "binary floating point",
	"NewFromFloat":             "binary floating point",
	"NewFromFloat32":           "binary floating point",
	"NewFromFloatWithExponent": "binary floating point",
	"Float64":                  "binary floating point",
	"InexactFloat64":           "binary floating point",
	"Div":                      "rounds to a fixed number of decimal places",
	"DivRound":                 "rounds to a fixed number of decimal places",
	"DivisionPrecision":        "a package-wide rounding setting",
	"Round":                    "rounds half away from zero; the policy uses RoundBank",
	"Sqrt":                     "rounds to a fixed number of decimal places",
	"SqrtRound":                "rounds to a fixed number of decimal places",
	"Root":                     "rounds to a fixed number of decimal places",
	"RootRound":                "rounds to a fixed number of decimal places",
	"Pow":                      "rounds to a fixed number of decimal places",
	"PowWithPrecision":         "rounds to a fixed number of decimal places",
	"PowInt32":                 "rounds to a fixed number of decimal places",
	"PowBigInt":                "rounds to a fixed number of decimal places",
	"Ln":                       "rounds to a fixed number of decimal places",
	"RequireFromString":        "panics on bad input",
}

// bannedUses lists every banned identifier in a parsed file.
func bannedUses(fset *token.FileSet, file *ast.File) []string {
	var uses []string
	ast.Inspect(file, func(n ast.Node) bool {
		if id, ok := n.(*ast.Ident); ok {
			if reason, banned := bannedIdentifiers[id.Name]; banned {
				uses = append(uses, fset.Position(id.Pos()).String()+": "+id.Name+" ("+reason+")")
			}
		}
		return true
	})
	return uses
}

func TestPackageUsesNoFloatsOrSelfRoundingCalls(t *testing.T) {
	paths, err := filepath.Glob("*.go")
	if err != nil {
		t.Fatal(err)
	}
	fset := token.NewFileSet()
	checked := 0
	for _, path := range paths {
		if strings.HasSuffix(path, "_test.go") {
			continue
		}
		file, err := parser.ParseFile(fset, path, nil, 0)
		if err != nil {
			t.Fatalf("parsing %s: %v", path, err)
		}
		for _, use := range bannedUses(fset, file) {
			t.Error(use)
		}
		checked++
	}
	if checked == 0 {
		t.Fatal("no source files were checked")
	}
}

// TestBannedUsesDetectsViolations makes sure the check above cannot pass by
// finding nothing.
func TestBannedUsesDetectsViolations(t *testing.T) {
	const src = `package sample
var ratio float64
func f(a, b T) T { return a.Div(b) }`
	fset := token.NewFileSet()
	file, err := parser.ParseFile(fset, "sample.go", src, 0)
	if err != nil {
		t.Fatal(err)
	}
	if got := len(bannedUses(fset, file)); got != 2 {
		t.Errorf("found %d banned uses, want 2 (float64 and Div)", got)
	}
}
