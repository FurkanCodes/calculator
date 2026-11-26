package httpapi

import (
	"encoding/json"
	"fmt"
	"log/slog"
	"net/http"
	"runtime/debug"
	"time"
)

const maxBodyBytes = 4 << 10

type server struct {
	logger *slog.Logger
}

// handlerFunc returns a body or an error and leaves the writing to endpoint,
// so endpoint always knows the status it sent.
type handlerFunc func(r *http.Request) (any, *apiError)

// endpoint adds the body limit, panic recovery, JSON response and log line.
func (s *server) endpoint(h handlerFunc) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		r.Body = http.MaxBytesReader(w, r.Body, maxBodyBytes)

		body, apiErr := runRecovered(h, r)
		status := http.StatusOK
		if apiErr != nil {
			status, apiErr = resolve(apiErr)
			body = errorResponse{Error: errorBody{Code: apiErr.code, Message: apiErr.message}}
		}
		writeJSON(w, status, body)
		s.logRequest(r, start, status, apiErr)
	})
}

// runRecovered turns a panic into INTERNAL_ERROR and logs the value and stack.
// http.ErrAbortHandler is re-raised, as net/http expects.
func runRecovered(h handlerFunc, r *http.Request) (body any, apiErr *apiError) {
	defer func() {
		p := recover()
		if p == nil {
			return
		}
		if p == http.ErrAbortHandler {
			panic(p)
		}
		body, apiErr = nil, internalError(fmt.Errorf("panic: %v\n%s", p, debug.Stack()))
	}()
	return h(r)
}

// resolve finds the status for e's code. A missing code is a bug, so it
// becomes INTERNAL_ERROR with the original error logged as the cause.
func resolve(e *apiError) (int, *apiError) {
	if status, ok := statuses[e.code]; ok {
		return status, e
	}
	internal := internalError(fmt.Errorf("error code %q has no HTTP status; message: %s", e.code, e.message))
	return statuses[codeInternal], internal
}

// logRequest logs client errors at info level. Only a 5xx is an error.
func (s *server) logRequest(r *http.Request, start time.Time, status int, apiErr *apiError) {
	attrs := []slog.Attr{
		slog.String("request_id", requestID(r.Context())),
		slog.String("method", r.Method),
		slog.String("path", r.URL.Path),
		slog.Int("status", status),
		slog.Int64("duration_us", time.Since(start).Microseconds()),
	}
	level := slog.LevelInfo
	if apiErr != nil {
		attrs = append(attrs, slog.String("code", apiErr.code))
		if apiErr.cause != nil {
			attrs = append(attrs, slog.String("cause", apiErr.cause.Error()))
		}
	}
	if status >= http.StatusInternalServerError {
		level = slog.LevelError
	}
	s.logger.LogAttrs(r.Context(), level, "request", attrs...)
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v) // a failed write means the client left; nothing to do
}
