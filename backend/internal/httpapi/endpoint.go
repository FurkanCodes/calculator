package httpapi

import (
	"encoding/json"
	"log/slog"
	"net/http"
	"runtime/debug"
	"time"
)

// maxBodyBytes caps every API request body.
const maxBodyBytes = 4 << 10

type server struct {
	logger *slog.Logger
}

// handlerFunc is an API endpoint. It writes its own success response and
// returns any failure, which endpoint writes and logs.
type handlerFunc func(w http.ResponseWriter, r *http.Request) *apiError

// endpoint runs an API handler with what every API request needs: a body size
// limit, panic recovery, the JSON error response, and one log line carrying
// the request ID, status and error code. Errors caused by the request are
// logged at info level; only a 500 is logged at error level.
func (s *server) endpoint(h handlerFunc) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		r.Body = http.MaxBytesReader(w, r.Body, maxBodyBytes)

		status, code := http.StatusOK, ""
		if apiErr := s.runRecovered(h, w, r); apiErr != nil {
			writeJSON(w, apiErr.status, errorResponse{Error: errorBody{Code: apiErr.code, Message: apiErr.message}})
			status, code = apiErr.status, apiErr.code
		}

		level := slog.LevelInfo
		if status >= http.StatusInternalServerError {
			level = slog.LevelError
		}
		s.logger.LogAttrs(r.Context(), level, "request",
			slog.String("request_id", requestID(r.Context())),
			slog.String("method", r.Method),
			slog.String("path", r.URL.Path),
			slog.Int("status", status),
			slog.String("code", code),
			slog.Int64("duration_us", time.Since(start).Microseconds()),
		)
	})
}

// runRecovered calls h and turns a panic into INTERNAL_ERROR, logging the panic
// and its stack. http.ErrAbortHandler is re-raised, as net/http expects.
func (s *server) runRecovered(h handlerFunc, w http.ResponseWriter, r *http.Request) (apiErr *apiError) {
	defer func() {
		p := recover()
		if p == nil {
			return
		}
		if p == http.ErrAbortHandler {
			panic(p)
		}
		s.logger.LogAttrs(r.Context(), slog.LevelError, "panic",
			slog.String("request_id", requestID(r.Context())),
			slog.Any("panic", p),
			slog.String("stack", string(debug.Stack())),
		)
		apiErr = errInternal
	}()
	return h(w, r)
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v) // a failed write means the client left; nothing to do
}
