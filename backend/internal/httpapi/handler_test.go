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

	"github.com/FurkanCodes/calculator/backend/internal/calc"
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
		{"whitespace after the object", "{\"operation\": \"multiply\", \"operands\": [\"1.5\", \"4\"]}\n  ",
			`{"result":"6","exact":true}`},
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
		{"JSON array", http.MethodPost, calculatePath, `["add", "1", "2"]`, 400, "INVALID_REQUEST"},
		{"unknown field", http.MethodPost, calculatePath, `{"operation": "add", "operands": ["1", "2"], "precision": 10}`, 400, "INVALID_REQUEST"},
		{"missing operation", http.MethodPost, calculatePath, `{"operands": ["1", "2"]}`, 400, "INVALID_REQUEST"},
		{"missing operands", http.MethodPost, calculatePath, `{"operation": "add"}`, 400, "INVALID_REQUEST"},
		{"operation is a number", http.MethodPost, calculatePath, `{"operation": 1, "operands": ["1", "2"]}`, 400, "INVALID_REQUEST"},
		{"second JSON value", http.MethodPost, calculatePath, `{"operation": "add", "operands": ["1", "2"]} {}`, 400, "INVALID_REQUEST"},
		{"operands are JSON numbers", http.MethodPost, calculatePath, `{"operation": "add", "operands": [0.1, 0.2]}`, 400, "INVALID_NUMBER"},
		{"operand is not a number", http.MethodPost, calculatePath, calculateBody("add", "1", "abc"), 400, "INVALID_NUMBER"},
		{"one operand too few", http.MethodPost, calculatePath, calculateBody("add", "1"), 400, "WRONG_OPERAND_COUNT"},
		{"empty operands", http.MethodPost, calculatePath, `{"operation": "add", "operands": []}`, 400, "WRONG_OPERAND_COUNT"},
		{"unsupported operation", http.MethodPost, calculatePath, calculateBody("modulo", "1", "2"), 400, "UNSUPPORTED_OPERATION"},
		{"body over 4 KiB", http.MethodPost, calculatePath, calculateBody("add", "1", strings.Repeat("1", 5000)), 413, "INPUT_TOO_LARGE"},
		{"operand over 34 digits", http.MethodPost, calculatePath, calculateBody("add", "1", "12345678901234567890123456789012345"), 413, "INPUT_TOO_LARGE"},
		{"division by zero", http.MethodPost, calculatePath, calculateBody("divide", "10", "0"), 422, "DIVISION_BY_ZERO"},
		{"result out of range", http.MethodPost, calculatePath, calculateBody("multiply", "1"+strings.Repeat("0", 99), "10"), 422, "OUT_OF_RANGE"},
		{"unknown path", http.MethodGet, "/api/v2/calculate", "", 404, "NOT_FOUND"},
		{"root path", http.MethodGet, "/", "", 404, "NOT_FOUND"},
		{"wrong method", http.MethodGet, calculatePath, "", 405, "METHOD_NOT_ALLOWED"},
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
			var resp errorResponse
			if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil {
				t.Fatalf("body is not the error format: %s", rec.Body)
			}
			if resp.Error.Code != tt.code || resp.Error.Message == "" {
				t.Errorf("error = %+v, want code %s and a message", resp.Error, tt.code)
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

func TestWrongMethodListsAllowedMethod(t *testing.T) {
	rec, _ := send(t, http.MethodPut, calculatePath, "", nil)
	if got := rec.Header().Get("Allow"); got != http.MethodPost {
		t.Errorf("Allow = %q, want POST", got)
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

func TestPanicBecomesInternalError(t *testing.T) {
	var logs bytes.Buffer
	s := &server{logger: slog.New(slog.NewJSONHandler(&logs, nil))}
	handler := withRequestID(s.endpoint(func(http.ResponseWriter, *http.Request) *apiError {
		panic("boom")
	}))
	rec := httptest.NewRecorder()
	handler.ServeHTTP(rec, httptest.NewRequest(http.MethodPost, calculatePath, nil))

	var resp errorResponse
	if err := json.Unmarshal(rec.Body.Bytes(), &resp); err != nil || rec.Code != 500 || resp.Error.Code != "INTERNAL_ERROR" {
		t.Errorf("got status %d, body %s; want 500 with INTERNAL_ERROR", rec.Code, rec.Body)
	}
	lines := parseLogs(t, &logs)
	if len(lines) != 2 {
		t.Fatalf("got %d log lines, want a panic line and a request line: %v", len(lines), lines)
	}
	panicLine, requestLine := lines[0], lines[1]
	if panicLine["level"] != "ERROR" || panicLine["panic"] != "boom" || panicLine["stack"] == "" ||
		panicLine["request_id"] != rec.Header().Get("X-Request-ID") {
		t.Errorf("panic log line = %v, want ERROR with the panic value, stack and request ID", panicLine)
	}
	if requestLine["level"] != "ERROR" || requestLine["code"] != "INTERNAL_ERROR" {
		t.Errorf("request log line = %v, want ERROR with INTERNAL_ERROR", requestLine)
	}
}

func TestAbortHandlerPanicIsReraised(t *testing.T) {
	s := &server{logger: slog.New(slog.DiscardHandler)}
	handler := s.endpoint(func(http.ResponseWriter, *http.Request) *apiError {
		panic(http.ErrAbortHandler)
	})
	defer func() {
		if p := recover(); p != http.ErrAbortHandler {
			t.Errorf("recovered %v, want http.ErrAbortHandler to reach net/http", p)
		}
	}()
	handler.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest(http.MethodPost, calculatePath, nil))
	t.Error("the panic was swallowed")
}

func TestEveryCalcCodeHasAStatus(t *testing.T) {
	codes := []calc.Code{
		calc.UnsupportedOperation, calc.WrongOperandCount, calc.InvalidNumber,
		calc.InputTooLarge, calc.OutOfRange, calc.DivisionByZero,
	}
	for _, code := range codes {
		if _, ok := calcStatuses[code]; !ok {
			t.Errorf("calc code %s has no HTTP status", code)
		}
	}
}

func TestUnexpectedCalcErrorsAreInternal(t *testing.T) {
	for _, err := range []error{errors.New("not a calc error"), &calc.Error{Code: "SOMETHING_NEW"}} {
		if got := fromCalc(err); got != errInternal {
			t.Errorf("fromCalc(%v) = %+v, want INTERNAL_ERROR", err, got)
		}
	}
}
