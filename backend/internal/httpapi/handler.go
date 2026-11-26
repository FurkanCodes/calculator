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
// one line to logger.
func NewHandler(logger *slog.Logger) http.Handler {
	s := &server{logger: logger}
	mux := http.NewServeMux()
	// Health checks bypass endpoint, so they are not logged: Compose and load
	// balancers call them every few seconds.
	s.route(mux, http.MethodGet, "/healthz", http.HandlerFunc(healthz))
	s.route(mux, http.MethodPost, "/api/v1/calculate", s.endpoint(calculate))
	mux.Handle("/", s.endpoint(notFound))
	return withRequestID(mux)
}

// route registers h for method on path, together with a JSON 405 for every
// other method on that path, so no route can be added without one. Go's
// router would otherwise answer a wrong method in plain text.
func (s *server) route(mux *http.ServeMux, method, path string, h http.Handler) {
	mux.Handle(method+" "+path, h)
	allow := method
	if method == http.MethodGet {
		allow += ", " + http.MethodHead // a GET pattern also serves HEAD
	}
	notAllowed := s.endpoint(methodNotAllowed)
	mux.Handle(path, http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Allow", allow)
		notAllowed.ServeHTTP(w, r)
	}))
}

func healthz(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, struct {
		Status string `json:"status"`
	}{"ok"})
}

func methodNotAllowed(r *http.Request) (any, *apiError) {
	return nil, &apiError{code: codeMethodNotAllowed,
		message: fmt.Sprintf("%s is not allowed on %s.", r.Method, r.URL.Path)}
}

func notFound(r *http.Request) (any, *apiError) {
	return nil, &apiError{code: codeNotFound,
		message: fmt.Sprintf("There is nothing at %s.", r.URL.Path)}
}
