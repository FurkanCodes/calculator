package httpapi

import (
	"go/ast"
	"go/constant"
	"go/importer"
	"go/parser"
	"go/token"
	"go/types"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
)

// parseSources parses the non-test Go files matching pattern.
func parseSources(t *testing.T, fset *token.FileSet, pattern string, mode parser.Mode) []*ast.File {
	t.Helper()
	paths, err := filepath.Glob(pattern)
	if err != nil {
		t.Fatal(err)
	}
	var files []*ast.File
	for _, path := range paths {
		if strings.HasSuffix(path, "_test.go") {
			continue
		}
		file, err := parser.ParseFile(fset, path, nil, mode)
		if err != nil {
			t.Fatalf("parsing %s: %v", path, err)
		}
		files = append(files, file)
	}
	if len(files) == 0 {
		t.Fatalf("no source files match %s", pattern)
	}
	return files
}

// TestTransportDoesNoArithmetic enforces the package boundary: httpapi handles
// HTTP and leaves every number to calc, so it never imports the decimal library.
func TestTransportDoesNoArithmetic(t *testing.T) {
	for _, file := range parseSources(t, token.NewFileSet(), "*.go", parser.ImportsOnly) {
		for _, imp := range file.Imports {
			if p, _ := strconv.Unquote(imp.Path.Value); p == "github.com/shopspring/decimal" {
				t.Errorf("%s imports %s; arithmetic belongs in calc", file.Name.Name, p)
			}
		}
	}
}

// TestEveryCalcCodeHasAStatus type-checks calc's source and collects every
// constant of type calc.Code, however it is written, so a code added there
// fails here until statuses has an entry for it.
func TestEveryCalcCodeHasAStatus(t *testing.T) {
	fset := token.NewFileSet()
	files := parseSources(t, fset, filepath.Join("..", "calc", "*.go"), 0)
	conf := types.Config{Importer: importer.ForCompiler(fset, "source", nil)}
	pkg, err := conf.Check("calc", fset, files, nil)
	if err != nil {
		t.Fatalf("type-checking calc: %v", err)
	}
	codeType := pkg.Scope().Lookup("Code").Type()

	var codes []string
	for _, name := range pkg.Scope().Names() {
		if c, ok := pkg.Scope().Lookup(name).(*types.Const); ok && types.Identical(c.Type(), codeType) {
			codes = append(codes, constant.StringVal(c.Val()))
		}
	}
	if len(codes) == 0 {
		t.Fatal("found no Code constants in calc")
	}
	for _, code := range codes {
		if _, ok := statuses[code]; !ok {
			t.Errorf("calc code %s has no HTTP status in statuses", code)
		}
	}
}
