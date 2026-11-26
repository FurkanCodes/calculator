// Package httpapi is the calculator's HTTP transport: routing, JSON decoding
// and encoding, request shape checks, and mapping errors to statuses. It never
// does arithmetic and never imports the decimal library; that is calc's job.
package httpapi

import (
	"fmt"
	"log/slog"
	"net/http"
)

// NewHandler returns the service's HTTP handler. Each API request is logged as
// one line to logger. Health checks are not logged, because Compose and load
// balancers call them every few seconds.
func NewHandler(logger *slog.Logger) http.Handler {
	s := &server{logger: logger}
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", healthz)
	mux.Handle("POST /api/v1/calculate", s.endpoint(calculate))
	mux.Handle("/api/v1/calculate", s.endpoint(calculateMethodNotAllowed))
	mux.Handle("/", s.endpoint(notFound))
	return withRequestID(mux)
}

func healthz(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, struct {
		Status string `json:"status"`
	}{"ok"})
}

// calculateMethodNotAllowed answers any method other than POST on the
// calculate path. Go's router would otherwise answer in plain text.
func calculateMethodNotAllowed(w http.ResponseWriter, r *http.Request) *apiError {
	w.Header().Set("Allow", http.MethodPost)
	return &apiError{http.StatusMethodNotAllowed, "METHOD_NOT_ALLOWED",
		fmt.Sprintf("Use POST for %s.", r.URL.Path)}
}

// notFound answers every unknown path. Go's router would otherwise answer in
// plain text.
func notFound(_ http.ResponseWriter, r *http.Request) *apiError {
	return &apiError{http.StatusNotFound, "NOT_FOUND",
		fmt.Sprintf("There is nothing at %s.", r.URL.Path)}
}
