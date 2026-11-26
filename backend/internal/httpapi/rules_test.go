package httpapi

import (
	"go/ast"
	"go/parser"
	"go/token"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
)

// parseSources parses the non-test Go files matching pattern.
func parseSources(t *testing.T, pattern string, mode parser.Mode) []*ast.File {
	t.Helper()
	paths, err := filepath.Glob(pattern)
	if err != nil {
		t.Fatal(err)
	}
	fset := token.NewFileSet()
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
	for _, file := range parseSources(t, "*.go", parser.ImportsOnly) {
		for _, imp := range file.Imports {
			if p, _ := strconv.Unquote(imp.Path.Value); p == "github.com/shopspring/decimal" {
				t.Errorf("%s imports %s; arithmetic belongs in calc", file.Name.Name, p)
			}
		}
	}
}

// TestEveryCalcCodeHasAStatus reads every constant of type Code in calc's
// source, so a code added there fails here until statuses has an entry for it.
func TestEveryCalcCodeHasAStatus(t *testing.T) {
	var codes []string
	for _, file := range parseSources(t, filepath.Join("..", "calc", "*.go"), 0) {
		for _, decl := range file.Decls {
			gen, ok := decl.(*ast.GenDecl)
			if !ok || gen.Tok != token.CONST {
				continue
			}
			for _, spec := range gen.Specs {
				value := spec.(*ast.ValueSpec)
				if typ, ok := value.Type.(*ast.Ident); !ok || typ.Name != "Code" {
					continue
				}
				for _, v := range value.Values {
					if lit, ok := v.(*ast.BasicLit); ok {
						code, _ := strconv.Unquote(lit.Value)
						codes = append(codes, code)
					}
				}
			}
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
