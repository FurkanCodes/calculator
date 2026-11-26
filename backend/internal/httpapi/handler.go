// Package httpapi is the calculator's HTTP transport: routing, JSON decoding
// and encoding, request shape checks, and mapping errors to statuses. It never
// does arithmetic and never imports the decimal library; that is calc's job.
package httpapi

import "net/http"

// NewHandler returns the service's HTTP handler.
func NewHandler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /healthz", healthz)
	return mux
}

var healthyBody = []byte(`{"status":"ok"}` + "\n")

// healthz reports that the process is up. It is not logged: Compose and load
// balancers call it every few seconds.
func healthz(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	_, _ = w.Write(healthyBody) // a failed write means the client left; nothing to do
}
