package httpapi

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"net/http"
	"regexp"
)

type requestIDKey struct{}

// validRequestID limits which incoming IDs are kept, so a client cannot put
// arbitrary text into the logs.
var validRequestID = regexp.MustCompile(`^[A-Za-z0-9-]{1,64}$`)

// withRequestID gives every request an ID, set in the X-Request-ID response
// header and in the request context for logging. A well-formed incoming
// X-Request-ID, such as one set by a proxy, is kept so that log lines can be
// matched across services.
func withRequestID(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		id := r.Header.Get("X-Request-ID")
		if !validRequestID.MatchString(id) {
			id = newRequestID()
		}
		w.Header().Set("X-Request-ID", id)
		next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), requestIDKey{}, id)))
	})
}

func requestID(ctx context.Context) string {
	id, _ := ctx.Value(requestIDKey{}).(string)
	return id
}

func newRequestID() string {
	var b [8]byte
	_, _ = rand.Read(b[:]) // crypto/rand.Read never returns an error as of Go 1.24
	return hex.EncodeToString(b[:])
}
