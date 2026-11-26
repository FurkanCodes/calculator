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

// allowedAPIs is every name calc may use from other packages, methods
// included. It enforces ground rules 1, 3 and 4: no binary floating point, no
// shopspring function that rounds or formats on its own terms (Div, Avg,
// Round, Sqrt, the formatting globals and the rest), nothing that does I/O,
// reads the clock or logs, and no method that changes a value in place (such
// as regexp's Longest). Adding a name here is a deliberate decision, not a
// side effect.
var allowedAPIs = map[string][]string{
	"fmt":  {"Sprintf"},
	"maps": {"Keys"},
	"math/big": {
		"Bit",
		// Int.Sqrt is the exact integer square root ⌊√x⌋, not shopspring's
		// rounding Sqrt: squareRoot keeps the remainder and rounds once
		// itself. It panics only on a negative x, which applySqrt rejects
		// first. It writes into its receiver, and squareRoot only calls it on
		// the fresh copy BigInt returns, so no decimal's value changes.
		"Sqrt",
	},
	"regexp":  {"MatchString", "MustCompile"},
	"slices":  {"Sorted"},
	"strings": {"Join"},
	"github.com/shopspring/decimal": {
		"Abs", "Add", "BigInt", "Cmp", "Decimal", "Equal", "Exponent", "IsZero", "Mul", "Neg",
		"New", "NewFromString", "Normalize", "NumDigits", "QuoRem", "RoundBank", "Shift", "Sign", "String", "Sub",
		// IntPart drops a fraction, but wholeExponent calls it only on values
		// of at most maxExponent and rejects any value it changed. It cannot panic.
		"IntPart",
		// NewFromBigInt copies an integer exactly. It cannot round or panic.
		"NewFromBigInt",
	},
}

// allowedGlobals lists calc's package-level variables. Both are set once at
// start-up and only read after that. A new one is a deliberate decision.
var allowedGlobals = []string{"numberPattern", "operations"}

// violations type-checks files as one package and reports every break of the
// rules: an import or API outside allowedAPIs, a value of float or complex
// type (including untyped literals such as 0.5), a package-level variable
// outside allowedGlobals, or a direct write to one. A direct write is an
// assignment, ++ or --, delete or clear, or taking its address. Writes through
// an alias (m := operations; m["x"] = ...) are not caught; allowedGlobals
// keeps the variables that could be aliased few and reviewed.
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
	isGlobal := func(e ast.Expr) (*types.Var, bool) {
		v, ok := info.Uses[rootIdent(e)].(*types.Var)
		return v, ok && v.Parent() == pkg.Scope()
	}
	for _, name := range pkg.Scope().Names() {
		if v, ok := pkg.Scope().Lookup(name).(*types.Var); ok && !slices.Contains(allowedGlobals, name) {
			report(v.Pos(), "declares package-level variable %s, which is not on the allowlist", name)
		}
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
			switch node := n.(type) {
			case *ast.AssignStmt:
				targets = node.Lhs
			case *ast.IncDecStmt:
				targets = []ast.Expr{node.X}
			case *ast.RangeStmt:
				if node.Tok == token.ASSIGN {
					targets = []ast.Expr{node.Key, node.Value}
				}
			case *ast.UnaryExpr:
				if node.Op == token.AND {
					targets = []ast.Expr{node.X}
				}
			case *ast.CallExpr:
				if fn, ok := node.Fun.(*ast.Ident); ok && len(node.Args) > 0 {
					if b, ok := info.Uses[fn].(*types.Builtin); ok && (b.Name() == "delete" || b.Name() == "clear") {
						targets = node.Args[:1]
					}
				}
			}
			for _, target := range targets {
				if v, ok := isGlobal(target); ok {
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
		if !slices.Contains(allowedAPIs[obj.Pkg().Path()], obj.Name()) {
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
	for e != nil {
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
	return nil
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
	"regexp"
	"slices"
	_ "time"

	"github.com/shopspring/decimal"
)

var precision = 34

var half = 0.5

var table = map[string]int{"a": 1}

var list = []int{2, 1}

var pattern = regexp.MustCompile("a+")

func average(a, b decimal.Decimal) decimal.Decimal {
	decimal.UseScientificNotation = true
	precision++
	delete(table, "a")
	clear(list)
	slices.Sort(list)
	pattern.Longest()
	p := &precision
	*p = 0
	for _, list[0] = range list {
	}
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
		"sample.go:23:2: writes package-level variable precision", // ++
		"sample.go:24:9: writes package-level variable table",     // delete
		"sample.go:25:8: writes package-level variable list",      // clear
		"sample.go:28:8: writes package-level variable precision", // &
		"sample.go:30:9: writes package-level variable list",      // range assignment
		"uses slices.Sort, which is not on the allowlist",
		"uses regexp.Longest, which is not on the allowlist",
		"declares package-level variable half, which is not on the allowlist",
	} {
		if !strings.Contains(report, want) {
			t.Errorf("violations did not report %q; got:\n%s", want, report)
		}
	}
}
