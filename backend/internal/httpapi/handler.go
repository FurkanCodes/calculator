// Package httpapi is the calculator's HTTP transport. It does no arithmetic
// and never imports the decimal library; that stays in calc.
package httpapi

import (
	"fmt"
	"log/slog"
	"net/http"
	"path"
)

// NewHandler returns the service's handler, which logs each API request to logger.
func NewHandler(logger *slog.Logger) http.Handler {
	s := &server{logger: logger}
	mux := http.NewServeMux()
	for _, r := range s.routes() {
		s.route(mux, r.method, r.path, r.handler)
	}
	mux.Handle("/", s.endpoint(notFound))
	return withRequestID(s.canonicalPathsOnly(mux))
}

type routeDef struct {
	method, path string
	handler      http.Handler
}

// routes must match openapi.json, which TestSpecDescribesEveryRoute checks.
func (s *server) routes() []routeDef {
	return []routeDef{
		// Not logged, because Compose and load balancers call it every few seconds.
		{http.MethodGet, "/healthz", http.HandlerFunc(healthz)},
		{http.MethodPost, "/api/v1/calculate", s.endpoint(calculate)},
		// Logged like any API request, since a docs page fetches it only once per load.
		{http.MethodGet, "/api/v1/openapi.json", s.endpoint(openapi)},
	}
}

// canonicalPathsOnly answers an unclean path like /api/v1//calculate with the
// JSON 404. Go's router would send a plain-text redirect that is never logged.
func (s *server) canonicalPathsOnly(next http.Handler) http.Handler {
	notFound := s.endpoint(notFound)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != path.Clean(r.URL.Path) {
			notFound.ServeHTTP(w, r)
			return
		}
		next.ServeHTTP(w, r)
	})
}

// route also registers a JSON 405 for every other method on path, so no route
// can miss one. Go's router would answer a wrong method in plain text.
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
