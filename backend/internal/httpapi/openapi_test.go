package httpapi

// openapi.json is written by hand. These tests compare it with the code it
// describes, so neither can change without the other.

import (
	"bytes"
	"encoding/json"
	"log/slog"
	"maps"
	"net/http"
	"net/http/httptest"
	"reflect"
	"regexp"
	"slices"
	"strconv"
	"strings"
	"testing"

	"github.com/FurkanCodes/calculator/backend/internal/calc"
)

type object = map[string]any

// loadSpec keeps numbers as json.Number so an example like [0.1, 0.2] is sent
// exactly as written.
func loadSpec(t *testing.T) object {
	t.Helper()
	dec := json.NewDecoder(bytes.NewReader(openapiSpec))
	dec.UseNumber()
	var spec object
	if err := dec.Decode(&spec); err != nil {
		t.Fatalf("openapi.json is not valid JSON: %v", err)
	}
	if dec.More() {
		t.Fatal("openapi.json has data after the document")
	}
	return spec
}

// get walks keys from v through any $ref, failing on a missing key or non-object.
func get(t *testing.T, spec object, v any, keys ...string) any {
	t.Helper()
	for _, key := range keys {
		m := deref(t, spec, v)
		next, ok := m[key]
		if !ok {
			t.Fatalf("openapi.json: missing %q in %v", key, keysOf(m))
		}
		v = next
	}
	return v
}

func getObject(t *testing.T, spec object, v any, keys ...string) object {
	t.Helper()
	return deref(t, spec, get(t, spec, v, keys...))
}

func deref(t *testing.T, spec object, v any) object {
	t.Helper()
	m, ok := v.(object)
	if !ok {
		t.Fatalf("openapi.json: %v is not an object", v)
	}
	for {
		ref, ok := m["$ref"].(string)
		if !ok {
			return m
		}
		path, ok := strings.CutPrefix(ref, "#/")
		if !ok {
			t.Fatalf("openapi.json: $ref %q is not local", ref)
		}
		m = getObject(t, spec, spec, strings.Split(path, "/")...)
	}
}

func keysOf(m object) []string { return slices.Sorted(maps.Keys(m)) }

func stringList(t *testing.T, v any) []string {
	t.Helper()
	list, ok := v.([]any)
	if !ok {
		t.Fatalf("openapi.json: %v is not an array", v)
	}
	out := make([]string, len(list))
	for i, item := range list {
		if out[i], ok = item.(string); !ok {
			t.Fatalf("openapi.json: %v is not a string", item)
		}
	}
	return out
}

type specOperation struct {
	method, path string
	op           object
}

func specOperations(t *testing.T, spec object) []specOperation {
	t.Helper()
	var ops []specOperation
	paths := getObject(t, spec, spec, "paths")
	for _, path := range keysOf(paths) {
		item := deref(t, spec, paths[path])
		for _, method := range keysOf(item) {
			ops = append(ops, specOperation{strings.ToUpper(method), path, deref(t, spec, item[method])})
		}
	}
	return ops
}

type specResponse struct {
	where    string // for messages
	status   int    // 0 for a shared response under components.responses
	response object
}

func specResponses(t *testing.T, spec object) []specResponse {
	t.Helper()
	var out []specResponse
	for _, op := range specOperations(t, spec) {
		responses := getObject(t, spec, op.op, "responses")
		for _, key := range keysOf(responses) {
			status, err := strconv.Atoi(key)
			if err != nil {
				t.Fatalf("%s %s: response key %q is not a status", op.method, op.path, key)
			}
			out = append(out, specResponse{op.method + " " + op.path + " " + key, status, deref(t, spec, responses[key])})
		}
	}
	shared := getObject(t, spec, spec, "components", "responses")
	for _, name := range keysOf(shared) {
		out = append(out, specResponse{"components.responses." + name, 0, deref(t, spec, shared[name])})
	}
	return out
}

var errorSchemaStatus = regexp.MustCompile(`^Error([0-9]{3})$`)

// documentedCodes maps each code in an ErrorNNN schema to NNN.
func documentedCodes(t *testing.T, spec object) map[string]int {
	t.Helper()
	codes := map[string]int{}
	schemas := getObject(t, spec, spec, "components", "schemas")
	for _, name := range keysOf(schemas) {
		m := errorSchemaStatus.FindStringSubmatch(name)
		if m == nil {
			continue
		}
		status, _ := strconv.Atoi(m[1])
		for _, code := range codeEnum(t, spec, schemas[name]) {
			if other, ok := codes[code]; ok {
				t.Errorf("openapi.json lists %s under both %d and %d", code, other, status)
			}
			codes[code] = status
		}
	}
	return codes
}

// codeEnum returns an ErrorNNN schema's code enum. The schema is allOf the
// shared Error schema and a narrower code.
func codeEnum(t *testing.T, spec object, schema any) []string {
	t.Helper()
	var codes []string
	parts, _ := get(t, spec, schema, "allOf").([]any)
	for _, part := range parts {
		if p, _ := part.(object); p["$ref"] != nil {
			continue // the shared Error schema
		}
		codes = append(codes, stringList(t, get(t, spec, part, "properties", "error", "properties", "code", "enum"))...)
	}
	if len(codes) == 0 {
		t.Fatalf("openapi.json: error schema %v lists no codes", schema)
	}
	return codes
}

// nginx in the web container sends this code. The calculator never does.
const codeServiceUnavailable = "SERVICE_UNAVAILABLE"

func TestSpecIsOpenAPI31(t *testing.T) {
	spec := loadSpec(t)
	if v := get(t, spec, spec, "openapi"); v != "3.1.0" {
		t.Errorf("openapi = %v, want 3.1.0", v)
	}
	// "Try it out" must call the origin that served the document.
	servers, _ := get(t, spec, spec, "servers").([]any)
	if len(servers) != 1 || get(t, spec, servers[0], "url") != "/" {
		t.Errorf(`servers = %v, want exactly [{"url": "/"}]`, servers)
	}
}

func TestSpecOperationsMatchCalc(t *testing.T) {
	spec := loadSpec(t)
	operation := get(t, spec, spec, "components", "schemas", "CalculateRequest", "properties", "operation")
	got := slices.Sorted(slices.Values(stringList(t, get(t, spec, operation, "enum"))))
	if want := calc.Operations(); !slices.Equal(got, want) {
		t.Errorf("operation enum = %v, want calc's operations %v", got, want)
	}
}

// Without a success example, an operation's operand count would go untested.
func TestSpecHasASuccessExampleForEveryOperation(t *testing.T) {
	spec := loadSpec(t)
	calculate := get(t, spec, spec, "paths", "/api/v1/calculate", "post")
	requests := getObject(t, spec, calculate, "requestBody", "content", "application/json", "examples")
	successes := getObject(t, spec, calculate, "responses", "200", "content", "application/json", "examples")
	var covered []string
	for name := range successes {
		covered = append(covered, get(t, spec, requests[name], "value", "operation").(string))
	}
	slices.Sort(covered)
	if want := calc.Operations(); !slices.Equal(slices.Compact(covered), want) {
		t.Errorf("operations with a success example = %v, want every one of %v", covered, want)
	}
}

func TestSpecNumberRulesMatchCalc(t *testing.T) {
	spec := loadSpec(t)
	number := getObject(t, spec, spec, "components", "schemas", "Number")
	if got := number["pattern"]; got != calc.NumberPattern {
		t.Errorf("Number pattern = %v, want calc's %s", got, calc.NumberPattern)
	}
	if got := number["maxLength"]; got != json.Number(strconv.Itoa(calc.MaxLength)) {
		t.Errorf("Number maxLength = %v, want calc's %d", got, calc.MaxLength)
	}
	for _, ref := range []string{"parameters", "headers"} {
		pattern := get(t, spec, spec, "components", ref, "RequestId", "schema", "pattern")
		if pattern != validRequestID.String() {
			t.Errorf("components.%s.RequestId pattern = %v, want %s", ref, pattern, validRequestID)
		}
	}
}

func TestSpecErrorCodesMatchStatuses(t *testing.T) {
	documented := documentedCodes(t, loadSpec(t))
	for code, status := range statuses {
		if got, ok := documented[code]; !ok {
			t.Errorf("%s (status %d) is missing from openapi.json", code, status)
		} else if got != status {
			t.Errorf("openapi.json lists %s under %d, but it is sent with %d", code, got, status)
		}
	}
	for code, status := range documented {
		if _, ok := statuses[code]; ok {
			continue
		}
		if code != codeServiceUnavailable || status != http.StatusServiceUnavailable {
			t.Errorf("openapi.json lists %s under %d, but the service has no such code", code, status)
		}
	}
	if documented[codeServiceUnavailable] != http.StatusServiceUnavailable {
		t.Errorf("openapi.json does not list nginx's %s under 503", codeServiceUnavailable)
	}
}

// Every response must carry X-Request-ID too, and each error example's code
// must be one its status can send.
func TestSpecResponsesUseTheirStatusSchema(t *testing.T) {
	spec := loadSpec(t)
	documented := documentedCodes(t, spec)
	used := map[string]bool{}
	for _, r := range specResponses(t, spec) {
		get(t, spec, r.response, "headers", "X-Request-ID")
		media := getObject(t, spec, r.response, "content")
		if got := keysOf(media); !slices.Equal(got, []string{"application/json"}) {
			t.Errorf("%s: content types %v, want only application/json", r.where, got)
		}
		content := getObject(t, spec, media, "application/json")
		schema, _ := get(t, spec, content, "schema").(object) // the reference itself, not its target
		ref, _ := schema["$ref"].(string)
		name, isError := strings.CutPrefix(ref, "#/components/schemas/")
		m := errorSchemaStatus.FindStringSubmatch(name)
		if !isError || m == nil {
			if r.status >= 400 || r.status == 0 {
				t.Errorf("%s: schema %q, want one of the ErrorNNN schemas", r.where, ref)
			}
			continue
		}
		used[name] = true
		status, _ := strconv.Atoi(m[1])
		if r.status != 0 && r.status != status {
			t.Errorf("%s: uses %s, want Error%d", r.where, name, r.status)
		}
		examples, _ := content["examples"].(object)
		for key, example := range examples {
			code := get(t, spec, example, "value", "error", "code").(string)
			if documented[code] != status {
				t.Errorf("%s example %s: code %s is not one sent with %d", r.where, key, code, status)
			}
		}
	}
	for name := range getObject(t, spec, spec, "components", "schemas") {
		if errorSchemaStatus.MatchString(name) && !used[name] {
			t.Errorf("no response uses %s", name)
		}
	}
}

func TestSpecDescribesEveryRoute(t *testing.T) {
	var registered, described []string
	for _, r := range (&server{}).routes() {
		registered = append(registered, r.method+" "+r.path)
	}
	for _, op := range specOperations(t, loadSpec(t)) {
		described = append(described, op.method+" "+op.path)
	}
	slices.Sort(registered)
	slices.Sort(described)
	if !slices.Equal(described, registered) {
		t.Errorf("openapi.json describes %v, but the handler registers %v", described, registered)
	}
}

// exchange is a request and the response the document promises for it.
type exchange struct {
	name         string // the example's name, or the method and path
	example      string // the response example's name, if there is one
	method, path string
	body         string
	status       int
	want         any // the documented body; nil to compare with openapi.json itself
}

// specExchanges pairs each request example with the response example of the
// same name. An operation with no request body gets one empty request.
func specExchanges(t *testing.T, spec object) []exchange {
	t.Helper()
	var out []exchange
	for _, op := range specOperations(t, spec) {
		responses := getObject(t, spec, op.op, "responses")
		if _, ok := op.op["requestBody"]; !ok {
			ex := exchange{name: op.method + " " + op.path, method: op.method, path: op.path, status: http.StatusOK}
			examples, _ := getObject(t, spec, responses, "200", "content", "application/json")["examples"].(object)
			switch len(examples) {
			case 0: // the document itself; want stays nil
			case 1:
				ex.example = keysOf(examples)[0]
				ex.want = get(t, spec, examples[ex.example], "value")
			default:
				t.Fatalf("%s has %d 200 examples for one request, want at most 1", ex.name, len(examples))
			}
			out = append(out, ex)
			continue
		}
		requests := getObject(t, spec, op.op, "requestBody", "content", "application/json", "examples")
		for _, name := range keysOf(requests) {
			body, err := json.Marshal(get(t, spec, requests[name], "value"))
			if err != nil {
				t.Fatal(err)
			}
			var matches []exchange
			for _, key := range keysOf(responses) {
				content, _ := getObject(t, spec, responses, key, "content", "application/json")["examples"].(object)
				if example, ok := content[name]; ok {
					status, _ := strconv.Atoi(key)
					matches = append(matches, exchange{name, name, op.method, op.path, string(body), status, get(t, spec, example, "value")})
				}
			}
			if len(matches) != 1 {
				t.Fatalf("request example %s has %d response examples of the same name, want 1", name, len(matches))
			}
			out = append(out, matches[0])
		}
	}
	return out
}

func TestSpecExamplesAreWhatTheServiceSends(t *testing.T) {
	spec := loadSpec(t)
	for _, ex := range specExchanges(t, spec) {
		t.Run(ex.name, func(t *testing.T) {
			rec, _ := send(t, ex.method, ex.path, ex.body, nil)
			assertDocumentedResponse(t, rec, ex.status, ex.want, spec)
		})
	}
}

// No request example produces these responses, so each is triggered directly.
// TestEveryResponseExampleIsChecked fails if one is missed.
func TestSpecResponseOnlyExamples(t *testing.T) {
	spec := loadSpec(t)
	example := func(keys ...string) any {
		return get(t, spec, spec, append(keys, "value")...)
	}
	calculateExample := func(status, name string) any {
		return example("paths", "/api/v1/calculate", "post", "responses", status, "content", "application/json", "examples", name)
	}
	sharedExample := func(response, name string) any {
		return example("components", "responses", response, "content", "application/json", "examples", name)
	}

	rec, _ := send(t, http.MethodPost, calculatePath, strings.Repeat(" ", maxBodyBytes+1), nil)
	assertDocumentedResponse(t, rec, http.StatusRequestEntityTooLarge, calculateExample("413", "bodyTooLarge"), spec)

	rec, _ = send(t, http.MethodGet, "/api/v2/calculate", "", nil)
	assertDocumentedResponse(t, rec, http.StatusNotFound, sharedExample("NotFound", "unknownPath"), spec)

	rec, _ = send(t, http.MethodGet, calculatePath, "", nil)
	assertDocumentedResponse(t, rec, http.StatusMethodNotAllowed, sharedExample("MethodNotAllowed", "getCalculate"), spec)

	rec, _ = serveWith(t, func(*http.Request) (any, *apiError) { panic("a bug") })
	assertDocumentedResponse(t, rec, http.StatusInternalServerError, sharedExample("InternalError", "internalError"), spec)
}

// responseOnly lists the examples TestSpecResponseOnlyExamples produces, plus
// nginx's, which only the Compose smoke test can produce.
var responseOnly = []string{"bodyTooLarge", "unknownPath", "getCalculate", "internalError", "serviceUnavailable"}

func TestEveryResponseExampleIsChecked(t *testing.T) {
	spec := loadSpec(t)
	checked := slices.Clone(responseOnly)
	for _, ex := range specExchanges(t, spec) {
		checked = append(checked, ex.example)
	}
	for _, r := range specResponses(t, spec) {
		examples, _ := getObject(t, spec, r.response, "content", "application/json")["examples"].(object)
		for name := range examples {
			if !slices.Contains(checked, name) {
				t.Errorf("%s: response example %s is not sent by any test", r.where, name)
			}
		}
	}
}

// assertDocumentedResponse treats a nil want as openapi.json itself.
func assertDocumentedResponse(t *testing.T, rec *httptest.ResponseRecorder, status int, want any, spec object) {
	t.Helper()
	resp := rec.Result()
	if resp.StatusCode != status {
		t.Errorf("status = %d, want the documented %d", resp.StatusCode, status)
	}
	if got := resp.Header.Get("Content-Type"); got != "application/json" {
		t.Errorf("Content-Type = %q, want application/json", got)
	}
	if resp.Header.Get("X-Request-ID") == "" {
		t.Error("no X-Request-ID header")
	}
	dec := json.NewDecoder(resp.Body)
	dec.UseNumber()
	var got any
	if err := dec.Decode(&got); err != nil {
		t.Fatalf("body is not JSON: %v", err)
	}
	if want == nil {
		want = any(spec)
	}
	if !reflect.DeepEqual(got, want) {
		gotJSON, _ := json.Marshal(got)
		wantJSON, _ := json.Marshal(want)
		t.Errorf("body = %s\nwant the documented %s", gotJSON, wantJSON)
	}
}

func TestServesSpec(t *testing.T) {
	var logs bytes.Buffer
	handler := NewHandler(slog.New(slog.NewJSONHandler(&logs, nil)))
	for _, method := range []string{http.MethodGet, http.MethodHead} {
		logs.Reset()
		rec := httptest.NewRecorder()
		handler.ServeHTTP(rec, httptest.NewRequest(method, "/api/v1/openapi.json", nil))
		if rec.Code != http.StatusOK || rec.Header().Get("Content-Type") != "application/json" {
			t.Errorf("%s: status %d, Content-Type %q; want 200 application/json", method, rec.Code, rec.Header().Get("Content-Type"))
		}
		if lines := parseLogs(t, &logs); len(lines) != 1 || lines[0]["status"] != float64(http.StatusOK) {
			t.Errorf("%s: logs = %v, want one line with status 200", method, lines)
		}
	}
}
