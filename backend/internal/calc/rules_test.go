package calc

import (
	"fmt"
	"go/ast"
	"go/importer"
	"go/parser"
	"go/token"
	"go/types"
	"path/filepath"
	"slices"
	"strconv"
	"strings"
	"testing"
)

// allowedAPIs is everything calc may use from other packages. It enforces
// ground rules 1, 3 and 4: no binary floating point, no shopspring function
// that rounds or formats on its own terms (Div, Avg, Round, Sqrt, the
// formatting globals and the rest), and nothing that does I/O, reads the
// clock or logs. A nil list allows the whole package, for packages that are
// pure. Adding a name here is a deliberate decision, not a side effect.
var allowedAPIs = map[string][]string{
	"maps":     nil,
	"regexp":   nil,
	"slices":   nil,
	"strings":  nil,
	"fmt":      {"Sprintf"},
	"math/big": {"Bit"},
	"github.com/shopspring/decimal": {
		"Abs", "Add", "BigInt", "Cmp", "Decimal", "Equal", "Exponent", "IsZero", "Mul", "Neg",
		"New", "NewFromString", "Normalize", "NumDigits", "QuoRem", "RoundBank", "Shift", "Sign", "String", "Sub",
	},
}

// violations type-checks files as one package and reports every break of the
// rules: an import or API outside allowedAPIs, a value of float or complex
// type (including untyped literals such as 0.5), or a write to a
// package-level variable.
func violations(fset *token.FileSet, files []*ast.File) ([]string, error) {
	info := &types.Info{
		Uses:  map[*ast.Ident]types.Object{},
		Types: map[ast.Expr]types.TypeAndValue{},
	}
	conf := types.Config{Importer: importer.ForCompiler(fset, "source", nil)}
	pkg, err := conf.Check("checked", fset, files, info)
	if err != nil {
		return nil, err
	}

	var found []string
	report := func(pos token.Pos, format string, args ...any) {
		found = append(found, fset.Position(pos).String()+": "+fmt.Sprintf(format, args...))
	}
	for _, file := range files {
		for _, imp := range file.Imports {
			path, _ := strconv.Unquote(imp.Path.Value)
			if _, ok := allowedAPIs[path]; !ok {
				report(imp.Pos(), "imports %q, which is not allowed", path)
			}
		}
		ast.Inspect(file, func(n ast.Node) bool {
			var targets []ast.Expr
			switch stmt := n.(type) {
			case *ast.AssignStmt:
				targets = stmt.Lhs
			case *ast.IncDecStmt:
				targets = []ast.Expr{stmt.X}
			}
			for _, target := range targets {
				if v, ok := info.Uses[rootIdent(target)].(*types.Var); ok && v.Parent() == pkg.Scope() {
					report(target.Pos(), "writes package-level variable %s", v.Name())
				}
			}
			return true
		})
	}
	for id, obj := range info.Uses {
		if obj.Pkg() == nil || obj.Pkg() == pkg {
			continue // built-ins, and the package's own names
		}
		allowed, ok := allowedAPIs[obj.Pkg().Path()]
		if !ok || (allowed != nil && !slices.Contains(allowed, obj.Name())) {
			report(id.Pos(), "uses %s.%s, which is not on the allowlist", obj.Pkg().Path(), obj.Name())
		}
	}
	for expr, tv := range info.Types {
		if basic, ok := tv.Type.Underlying().(*types.Basic); ok && basic.Info()&(types.IsFloat|types.IsComplex) != 0 {
			report(expr.Pos(), "has a value of type %s", tv.Type)
		}
	}
	slices.Sort(found)
	return found, nil
}

// rootIdent returns the variable an assignment target writes through:
// operations for operations["x"], d for d.field, nil for anything else.
func rootIdent(e ast.Expr) *ast.Ident {
	for {
		switch x := e.(type) {
		case *ast.Ident:
			return x
		case *ast.IndexExpr:
			e = x.X
		case *ast.SelectorExpr:
			e = x.X
		case *ast.StarExpr:
			e = x.X
		case *ast.ParenExpr:
			e = x.X
		default:
			return nil
		}
	}
}

func TestCalcFollowsGroundRules(t *testing.T) {
	paths, err := filepath.Glob("*.go")
	if err != nil {
		t.Fatal(err)
	}
	fset := token.NewFileSet()
	var files []*ast.File
	for _, path := range paths {
		if strings.HasSuffix(path, "_test.go") {
			continue
		}
		file, err := parser.ParseFile(fset, path, nil, 0)
		if err != nil {
			t.Fatalf("parsing %s: %v", path, err)
		}
		files = append(files, file)
	}
	if len(files) == 0 {
		t.Fatal("no source files were checked")
	}
	found, err := violations(fset, files)
	if err != nil {
		t.Fatalf("type-checking calc: %v", err)
	}
	for _, v := range found {
		t.Error(v)
	}
}

// TestViolationsCatchesBrokenRules makes sure the check above cannot pass by
// finding nothing: a sample that breaks each rule must be reported for each.
func TestViolationsCatchesBrokenRules(t *testing.T) {
	const src = `package sample

import (
	_ "time"

	"github.com/shopspring/decimal"
)

var precision = 34

var half = 0.5

func average(a, b decimal.Decimal) decimal.Decimal {
	decimal.UseScientificNotation = true
	precision++
	return decimal.Avg(a, b)
}
`
	fset := token.NewFileSet()
	file, err := parser.ParseFile(fset, "sample.go", src, 0)
	if err != nil {
		t.Fatal(err)
	}
	found, err := violations(fset, []*ast.File{file})
	if err != nil {
		t.Fatalf("type-checking the sample: %v", err)
	}
	report := strings.Join(found, "\n")
	for _, want := range []string{
		`imports "time"`,
		"has a value of type float64",
		"decimal.UseScientificNotation, which is not on the allowlist",
		"decimal.Avg, which is not on the allowlist",
		"writes package-level variable precision",
	} {
		if !strings.Contains(report, want) {
			t.Errorf("violations did not report %q; got:\n%s", want, report)
		}
	}
}
