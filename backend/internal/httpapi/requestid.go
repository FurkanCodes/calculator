package httpapi

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"net/http"
	"regexp"
)

type requestIDKey struct{}

// validRequestID limits incoming IDs so a client can't put arbitrary text in the logs.
var validRequestID = regexp.MustCompile(`^[A-Za-z0-9-]{1,64}$`)

// withRequestID sets X-Request-ID on the response and in the context. A valid
// incoming ID, such as a proxy's, is kept so logs match across services.
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
