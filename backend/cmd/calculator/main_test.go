package main

import (
	"bytes"
	"context"
	"io"
	"log/slog"
	"net"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"

	"github.com/FurkanCodes/calculator/backend/internal/httpapi"
)

func env(vars map[string]string) func(string) string {
	return func(key string) string { return vars[key] }
}

func TestServeFinishesInFlightRequestOnShutdown(t *testing.T) {
	entered, release, shutdownStarted := make(chan struct{}), make(chan struct{}), make(chan struct{})
	srv := newServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		close(entered)
		<-release
		_, _ = io.WriteString(w, "finished")
	}))
	srv.RegisterOnShutdown(func() { close(shutdownStarted) })

	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	ctx, cancel := context.WithCancel(context.Background())
	served := make(chan error, 1)
	go func() { served <- serve(ctx, srv, ln, slog.New(slog.DiscardHandler)) }()

	type response struct {
		body string
		err  error
	}
	responded := make(chan response, 1)
	go func() {
		resp, err := http.Get("http://" + ln.Addr().String())
		if err != nil {
			responded <- response{err: err}
			return
		}
		defer resp.Body.Close()
		body, err := io.ReadAll(resp.Body)
		responded <- response{string(body), err}
	}()

	<-entered         // the request is in flight
	cancel()          // the signal arrives
	<-shutdownStarted // the server is now shutting down
	close(release)    // only now does the handler finish

	if r := <-responded; r.err != nil || r.body != "finished" {
		t.Errorf("in-flight request got body %q, error %v; want it to finish", r.body, r.err)
	}
	if err := <-served; err != nil {
		t.Errorf("serve returned %v, want nil after a clean shutdown", err)
	}
}

func TestServeReportsListenerFailure(t *testing.T) {
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	ln.Close()
	err = serve(context.Background(), newServer(http.NotFoundHandler()), ln, slog.New(slog.DiscardHandler))
	if err == nil {
		t.Fatal("serve on a closed listener returned nil, want an error")
	}
}

func TestRunStartsAndStopsCleanly(t *testing.T) {
	ctx, cancel := context.WithCancel(context.Background())
	cancel() // already signalled, so run starts the server and shuts it down straight away
	var logs bytes.Buffer
	if err := run(ctx, nil, env(map[string]string{"PORT": "0"}), &logs); err != nil {
		t.Fatalf("run returned %v", err)
	}
	for _, msg := range []string{"calculator listening", "shutting down", "server stopped"} {
		if !strings.Contains(logs.String(), msg) {
			t.Errorf("logs do not contain %q:\n%s", msg, logs.String())
		}
	}
}

func TestRunRejectsBadPort(t *testing.T) {
	if err := run(context.Background(), nil, env(map[string]string{"PORT": "not-a-port"}), io.Discard); err == nil {
		t.Fatal("run with an invalid PORT returned nil, want an error")
	}
}

func TestRunHealthcheck(t *testing.T) {
	healthy := httptest.NewServer(httpapi.NewHandler())
	defer healthy.Close()
	unhealthy := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		w.WriteHeader(http.StatusServiceUnavailable)
	}))
	defer unhealthy.Close()
	stopped := httptest.NewServer(http.NotFoundHandler())
	stopped.Close()

	tests := []struct {
		name    string
		server  *httptest.Server
		healthy bool
	}{
		{"healthy server", healthy, true},
		{"server answering 503", unhealthy, false},
		{"no server listening", stopped, false},
	}
	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			u, err := url.Parse(tt.server.URL)
			if err != nil {
				t.Fatal(err)
			}
			err = run(context.Background(), []string{"-healthcheck"}, env(map[string]string{"PORT": u.Port()}), io.Discard)
			if (err == nil) != tt.healthy {
				t.Errorf("run -healthcheck error = %v, want healthy = %v", err, tt.healthy)
			}
		})
	}
}
