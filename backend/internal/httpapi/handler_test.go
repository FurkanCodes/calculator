package httpapi

import (
	"bytes"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"regexp"
	"strings"
	"testing"
	"testing/iotest"
)

const calculatePath = "/api/v1/calculate"

type logLine map[string]any

// send runs one request through the full handler and returns the response and
// the log lines it produced.
func send(t *testing.T, method, path, body string, header http.Header) (*httptest.ResponseRecorder, []logLine) {
	t.Helper()
	var logs bytes.Buffer
	handler := NewHandler(slog.New(slog.NewJSONHandler(&logs, nil)))
	req := httptest.NewRequest(method, path, strings.NewReader(body))
	for key, values := range header {
		req.Header[key] = values
	}
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, req)
	return rec, parseLogs(t, &logs)
}

func parseLogs(t *testing.T, logs *bytes.Buffer) []logLine {
	t.Helper()
	var lines []logLine
	for _, raw := range bytes.Split(bytes.TrimSpace(logs.Bytes()), []byte("\n")) {
		if len(raw) == 0 {
			continue
		}
		var line logLine
		if err := json.Unmarshal(raw, &line); err != nil {
			t.Fatalf("log line is not JSON: %s", raw)
		}
		lines = append(lines, line)
	}
	return lines
}

// errorCode decodes an error response and returns its code, failing the test
// if the body is not in the error format.
func errorCode(t *testing.T, rec *httptest.ResponseRecorder) string {
	t.Helper()
	var resp errorResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil || resp.Error.Message == "" {
		t.Fatalf("body is not the error format: %s", rec.Body)
	}
	return resp.Error.Code
}

func TestHealthz(t *testing.T) {
	rec, logs := send(t, http.MethodGet, "/healthz", "", nil)

	if rec.Code != http.StatusOK {
		t.Errorf("status = %d, want %d", rec.Code, http.StatusOK)
	}
	if got := rec.Header().Get("Content-Type"); got != "application/json" {
		t.Errorf("Content-Type = %q, want application/json", got)
	}
	if got, want := rec.Body.String(), `{"status":"ok"}`+"\n"; got != want {
		t.Errorf("body = %q, want %q", got, want)
	}
	if len(logs) != 0 {
		t.Errorf("health check wrote %d log lines, want none: %v", len(logs), logs)
	}
}

func TestCalculate(t *testing.T) {
	tests := []struct {
		name string
		body string
		want string
	}{
		{"exact result", `{"operation": "add", "operands": ["0.1", "0.2"]}`, `{"result":"0.3","exact":true}`},
		{"rounded result", `{"operation": "divide", "operands": ["1", "3"]}`,
			`{"result":"0.3333333333333333333333333333333333","exact":false}`},
		{"keys in any order, whitespace after", "{\"operands\": [\"1.5\", \"4\"], \"operation\": \"multiply\"}\n  ",
			`{"result":"6","exact":true}`},
		{"percentage", `{"operation": "percentage", "operands": ["12.5", "80"]}`, `{"result":"10","exact":true}`},
		{"power", `{"operation": "power", "operands": ["2", "-3"]}`, `{"result":"0.125","exact":true}`},
		{"one-operand square root", `{"operation": "sqrt", "operands": ["2"]}`,
			`{"result":"1.414213562373095048801688724209698","exact":false}`},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rec, logs := send(t, http.MethodPost, calculatePath, tt.body, nil)

			if rec.Code != http.StatusOK {
				t.Fatalf("status = %d, want 200; body %s", rec.Code, rec.Body)
			}
			if got := rec.Header().Get("Content-Type"); got != "application/json" {
				t.Errorf("Content-Type = %q, want application/json", got)
			}
			if got := rec.Body.String(); got != tt.want+"\n" {
				t.Errorf("body = %s, want %s", got, tt.want)
			}
			if len(logs) != 1 || logs[0]["status"] != float64(http.StatusOK) || logs[0]["level"] != "INFO" {
				t.Errorf("logs = %v, want one INFO line with status 200", logs)
			}
		})
	}
}

func TestErrorResponses(t *testing.T) {
	calculateBody := func(operation string, operands ...string) string {
		b, _ := json.Marshal(map[string]any{"operation": operation, "operands": operands})
		return string(b)
	}
	tests := []struct {
		name   string
		method string
		path   string
		body   string
		status int
		code   string
	}{
		{"empty body", http.MethodPost, calculatePath, "", 400, "INVALID_REQUEST"},
		{"not JSON", http.MethodPost, calculatePath, "add 1 2", 400, "INVALID_REQUEST"},
		{"JSON null", http.MethodPost, calculatePath, "null", 400, "INVALID_REQUEST"},
		{"JSON array", http.MethodPost, calculatePath, `["add", "1", "2"]`, 400, "INVALID_REQUEST"},
		{"unknown field", http.MethodPost, calculatePath, `{"operation": "add", "operands": ["1", "2"], "precision": 10}`, 400, "INVALID_REQUEST"},
		{"keys in the wrong case", http.MethodPost, calculatePath, `{"OPERATION": "add", "OPERANDS": ["1", "2"]}`, 400, "INVALID_REQUEST"},
		{"missing operation", http.MethodPost, calculatePath, `{"operands": ["1", "2"]}`, 400, "INVALID_REQUEST"},
		{"missing operands", http.MethodPost, calculatePath, `{"operation": "add"}`, 400, "INVALID_REQUEST"},
		{"operation is a number", http.MethodPost, calculatePath, `{"operation": 1, "operands": ["1", "2"]}`, 400, "INVALID_REQUEST"},
		{"operation is null", http.MethodPost, calculatePath, `{"operation": null, "operands": ["1", "2"]}`, 400, "INVALID_REQUEST"},
		{"operands is a string", http.MethodPost, calculatePath, `{"operation": "add", "operands": "1"}`, 400, "INVALID_REQUEST"},
		{"operands is an object", http.MethodPost, calculatePath, `{"operation": "add", "operands": {"a": "1"}}`, 400, "INVALID_REQUEST"},
		{"operands is null", http.MethodPost, calculatePath, `{"operation": "add", "operands": null}`, 400, "INVALID_REQUEST"},
		{"second JSON value", http.MethodPost, calculatePath, `{"operation": "add", "operands": ["1", "2"]} 5`, 400, "INVALID_REQUEST"},
		{"duplicate operation key", http.MethodPost, calculatePath, `{"operation": "add", "operation": "divide", "operands": ["1", "4"]}`, 400, "INVALID_REQUEST"},
		{"duplicate operands key", http.MethodPost, calculatePath, `{"operation": "add", "operands": ["1", "2"], "operands": ["3", "4"]}`, 400, "INVALID_REQUEST"},
		{"operands are JSON numbers", http.MethodPost, calculatePath, `{"operation": "add", "operands": [0.1, 0.2]}`, 400, "INVALID_NUMBER"},
		{"an operand is null", http.MethodPost, calculatePath, `{"operation": "add", "operands": ["1", null]}`, 400, "INVALID_NUMBER"},
		{"operand is not a number", http.MethodPost, calculatePath, calculateBody("add", "1", "abc"), 400, "INVALID_NUMBER"},
		{"one operand too few", http.MethodPost, calculatePath, calculateBody("add", "1"), 400, "WRONG_OPERAND_COUNT"},
		{"empty operands", http.MethodPost, calculatePath, `{"operation": "add", "operands": []}`, 400, "WRONG_OPERAND_COUNT"},
		{"unsupported operation", http.MethodPost, calculatePath, calculateBody("modulo", "1", "2"), 400, "UNSUPPORTED_OPERATION"},
		{"body over 4 KiB", http.MethodPost, calculatePath, calculateBody("add", "1", strings.Repeat("1", 5000)), 413, "INPUT_TOO_LARGE"},
		{"non-JSON body over 4 KiB", http.MethodPost, calculatePath, strings.Repeat("x", 10000), 413, "INPUT_TOO_LARGE"},
		{"valid object then 4 KiB of junk", http.MethodPost, calculatePath, calculateBody("add", "1", "2") + strings.Repeat("x", 10000), 413, "INPUT_TOO_LARGE"},
		{"operand over 34 digits", http.MethodPost, calculatePath, calculateBody("add", "1", "12345678901234567890123456789012345"), 413, "INPUT_TOO_LARGE"},
		{"division by zero", http.MethodPost, calculatePath, calculateBody("divide", "10", "0"), 422, "DIVISION_BY_ZERO"},
		{"zero to a negative power", http.MethodPost, calculatePath, calculateBody("power", "0", "-1"), 422, "DIVISION_BY_ZERO"},
		{"negative square root", http.MethodPost, calculatePath, calculateBody("sqrt", "-4"), 422, "NEGATIVE_SQUARE_ROOT"},
		{"fractional exponent", http.MethodPost, calculatePath, calculateBody("power", "4", "0.5"), 422, "INVALID_EXPONENT"},
		{"exponent over 1000", http.MethodPost, calculatePath, calculateBody("power", "1", "1001"), 422, "INVALID_EXPONENT"},
		{"power out of range", http.MethodPost, calculatePath, calculateBody("power", "10", "100"), 422, "OUT_OF_RANGE"},
		{"square root with two operands", http.MethodPost, calculatePath, calculateBody("sqrt", "4", "9"), 400, "WRONG_OPERAND_COUNT"},
		{"result out of range", http.MethodPost, calculatePath, calculateBody("multiply", "1"+strings.Repeat("0", 99), "10"), 422, "OUT_OF_RANGE"},
		{"unknown path", http.MethodGet, "/api/v2/calculate", "", 404, "NOT_FOUND"},
		{"root path", http.MethodGet, "/", "", 404, "NOT_FOUND"},
		{"double slash in path", http.MethodPost, "/api/v1//calculate", calculateBody("add", "1", "2"), 404, "NOT_FOUND"},
		{"dot segment in path", http.MethodPost, "/api/v1/./calculate", calculateBody("add", "1", "2"), 404, "NOT_FOUND"},
		{"trailing slash", http.MethodPost, calculatePath + "/", calculateBody("add", "1", "2"), 404, "NOT_FOUND"},
		{"GET on calculate", http.MethodGet, calculatePath, "", 405, "METHOD_NOT_ALLOWED"},
		{"POST on healthz", http.MethodPost, "/healthz", "", 405, "METHOD_NOT_ALLOWED"},
		{"DELETE on healthz", http.MethodDelete, "/healthz", "", 405, "METHOD_NOT_ALLOWED"},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			rec, logs := send(t, tt.method, tt.path, tt.body, nil)

			if rec.Code != tt.status {
				t.Errorf("status = %d, want %d", rec.Code, tt.status)
			}
			if got := rec.Header().Get("Content-Type"); got != "application/json" {
				t.Errorf("Content-Type = %q, want application/json", got)
			}
			if code := errorCode(t, rec); code != tt.code {
				t.Errorf("code = %s, want %s", code, tt.code)
			}
			// Request errors are logged once, at info level, with their code
			// and the same request ID the client received.
			if len(logs) != 1 {
				t.Fatalf("got %d log lines, want 1: %v", len(logs), logs)
			}
			line := logs[0]
			if line["level"] != "INFO" || line["code"] != tt.code || line["status"] != float64(tt.status) ||
				line["request_id"] != rec.Header().Get("X-Request-ID") {
				t.Errorf("log line = %v, want INFO with code %s, status %d and the response's request ID", line, tt.code, tt.status)
			}
		})
	}
}

func TestWrongMethodListsAllowedMethods(t *testing.T) {
	tests := []struct{ method, path, allow string }{
		{http.MethodPut, calculatePath, "POST"},
		{http.MethodPost, "/healthz", "GET, HEAD"},
	}
	for _, tt := range tests {
		rec, _ := send(t, tt.method, tt.path, "", nil)
		if got := rec.Header().Get("Allow"); got != tt.allow {
			t.Errorf("%s %s: Allow = %q, want %q", tt.method, tt.path, got, tt.allow)
		}
	}
}

func TestBodyLimitIsExactly4KiB(t *testing.T) {
	body := `{"operation": "add", "operands": ["1", "2"]}`
	atLimit := body + strings.Repeat(" ", maxBodyBytes-len(body))

	if rec, _ := send(t, http.MethodPost, calculatePath, atLimit, nil); rec.Code != http.StatusOK {
		t.Errorf("a %d-byte body got status %d, want 200", len(atLimit), rec.Code)
	}
	rec, _ := send(t, http.MethodPost, calculatePath, atLimit+" ", nil)
	if rec.Code != http.StatusRequestEntityTooLarge || errorCode(t, rec) != "INPUT_TOO_LARGE" {
		t.Errorf("a %d-byte body got status %d, want 413 INPUT_TOO_LARGE", len(atLimit)+1, rec.Code)
	}
}

func TestRequestID(t *testing.T) {
	generated := regexp.MustCompile(`^[0-9a-f]{16}$`)
	tests := []struct {
		name     string
		incoming string
		keep     bool
	}{
		{"none sent", "", false},
		{"well-formed ID from a proxy", "4f2a9c1e-77b0", true},
		{"ID with spaces", "not a valid id", false},
		{"ID that is too long", strings.Repeat("a", 65), false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			header := http.Header{}
			if tt.incoming != "" {
				header.Set("X-Request-ID", tt.incoming)
			}
			rec, _ := send(t, http.MethodGet, "/healthz", "", header)
			got := rec.Header().Get("X-Request-ID")
			if tt.keep && got != tt.incoming {
				t.Errorf("X-Request-ID = %q, want the incoming %q", got, tt.incoming)
			}
			if !tt.keep && !generated.MatchString(got) {
				t.Errorf("X-Request-ID = %q, want a new 16-character hex ID", got)
			}
		})
	}

	first, _ := send(t, http.MethodGet, "/healthz", "", nil)
	second, _ := send(t, http.MethodGet, "/healthz", "", nil)
	if first.Header().Get("X-Request-ID") == second.Header().Get("X-Request-ID") {
		t.Error("two requests got the same generated ID")
	}
}

// serveWith runs h through endpoint and the request-ID middleware, returning
// the response and the single log line it must produce.
func serveWith(t *testing.T, h handlerFunc) (*httptest.ResponseRecorder, logLine) {
	t.Helper()
	var logs bytes.Buffer
	s := &server{logger: slog.New(slog.NewJSONHandler(&logs, nil))}
	rec := httptest.NewRecorder()
	withRequestID(s.endpoint(h)).ServeHTTP(rec, httptest.NewRequest(http.MethodPost, calculatePath, nil))
	lines := parseLogs(t, &logs)
	if len(lines) != 1 {
		t.Fatalf("got %d log lines, want 1: %v", len(lines), lines)
	}
	return rec, lines[0]
}

func TestPanicBecomesInternalError(t *testing.T) {
	rec, line := serveWith(t, func(*http.Request) (any, *apiError) { panic("boom") })

	if rec.Code != http.StatusInternalServerError || errorCode(t, rec) != "INTERNAL_ERROR" {
		t.Errorf("got status %d, body %s; want 500 INTERNAL_ERROR", rec.Code, rec.Body)
	}
	cause, _ := line["cause"].(string)
	if line["level"] != "ERROR" || line["request_id"] != rec.Header().Get("X-Request-ID") ||
		!strings.Contains(cause, "panic: boom") || !strings.Contains(cause, "goroutine ") {
		t.Errorf("log line = %v, want ERROR with the request ID, the panic value and its stack", line)
	}
	if strings.Contains(rec.Body.String(), "boom") {
		t.Errorf("response leaks the panic value: %s", rec.Body)
	}
}

func TestAbortHandlerPanicIsReraised(t *testing.T) {
	s := &server{logger: slog.New(slog.DiscardHandler)}
	handler := s.endpoint(func(*http.Request) (any, *apiError) { panic(http.ErrAbortHandler) })
	defer func() {
		if p := recover(); p != http.ErrAbortHandler {
			t.Errorf("recovered %v, want http.ErrAbortHandler to reach net/http", p)
		}
	}()
	handler.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodPost, calculatePath, nil))
	t.Error("the panic was swallowed")
}

func TestCodeWithoutStatusBecomesInternalError(t *testing.T) {
	rec, line := serveWith(t, func(*http.Request) (any, *apiError) {
		return nil, &apiError{code: "SOMETHING_NEW", message: "a new kind of failure"}
	})

	if rec.Code != http.StatusInternalServerError || errorCode(t, rec) != "INTERNAL_ERROR" {
		t.Errorf("got status %d, body %s; want 500 INTERNAL_ERROR", rec.Code, rec.Body)
	}
	if cause, _ := line["cause"].(string); line["level"] != "ERROR" || !strings.Contains(cause, "SOMETHING_NEW") {
		t.Errorf("log line = %v, want ERROR with the unmapped code in the cause", line)
	}
}

func TestNonCalcErrorBecomesInternalError(t *testing.T) {
	cause := errors.New("not a calc error")
	if got := fromCalc(cause); got.code != codeInternal || got.cause != cause {
		t.Errorf("fromCalc = %+v, want INTERNAL_ERROR keeping the cause", got)
	}
}

// A body that fails to read for any reason but its size, such as a client that
// disconnects mid-request, is reported as a malformed request.
func TestUnreadableBodyIsInvalidRequest(t *testing.T) {
	_, apiErr := decodeCalculateRequest(iotest.ErrReader(errors.New("connection reset")))
	if apiErr != errMalformed {
		t.Errorf("got %v, want errMalformed", apiErr)
	}
}
