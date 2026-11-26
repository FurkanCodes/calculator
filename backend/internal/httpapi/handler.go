// Package httpapi is the calculator's HTTP transport: routing, JSON decoding
// and encoding, request shape checks, and mapping errors to statuses. It never
// does arithmetic and never imports the decimal library; that is calc's job.
package httpapi

import (
	"fmt"
	"log/slog"
	"net/http"
	"path"
)

// NewHandler returns the service's HTTP handler. Each API request is logged as
// one line to logger.
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

// routes is every route the service answers. openapi.json describes exactly
// these, and TestSpecDescribesEveryRoute fails when the two differ.
func (s *server) routes() []routeDef {
	return []routeDef{
		// Health checks bypass endpoint, so they are not logged: Compose and
		// load balancers call them every few seconds.
		{http.MethodGet, "/healthz", http.HandlerFunc(healthz)},
		{http.MethodPost, "/api/v1/calculate", s.endpoint(calculate)},
		// The API description is a static document, but it is an API request
		// like any other, so it goes through endpoint and is logged. A docs
		// page fetches it once per load, not every few seconds.
		{http.MethodGet, "/api/v1/openapi.json", s.endpoint(openapi)},
	}
}

// canonicalPathsOnly answers a path that is not in clean form, such as
// /api/v1//calculate, with the JSON 404. Go's router would otherwise send a
// plain-text redirect that skips endpoint, so it would not be logged either.
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
