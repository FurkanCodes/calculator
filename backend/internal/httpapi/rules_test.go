package httpapi

import (
	"go/parser"
	"go/token"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
)

// TestTransportDoesNoArithmetic enforces the package boundary: httpapi handles
// HTTP and leaves every number to calc, so it never imports the decimal library.
func TestTransportDoesNoArithmetic(t *testing.T) {
	paths, err := filepath.Glob("*.go")
	if err != nil {
		t.Fatal(err)
	}
	fset := token.NewFileSet()
	for _, path := range paths {
		if strings.HasSuffix(path, "_test.go") {
			continue
		}
		file, err := parser.ParseFile(fset, path, nil, parser.ImportsOnly)
		if err != nil {
			t.Fatalf("parsing %s: %v", path, err)
		}
		for _, imp := range file.Imports {
			if p, _ := strconv.Unquote(imp.Path.Value); p == "github.com/shopspring/decimal" {
				t.Errorf("%s imports %s; arithmetic belongs in calc", path, p)
			}
		}
	}
}
