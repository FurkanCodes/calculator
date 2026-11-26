// Command calculator runs the calculator HTTP service.
//
// It listens on PORT (default 8081) and shuts down gracefully on SIGINT or
// SIGTERM. With -healthcheck it instead calls /healthz on the local server and
// exits 0 if it is healthy, for container health checks in an image that has
// no shell or curl.
package main

import (
	"context"
	"errors"
	"flag"
	"fmt"
	"io"
	"log/slog"
	"net"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/FurkanCodes/calculator/backend/internal/httpapi"
)

const (
	defaultPort = "8081"

	// shutdownTimeout stays under Docker's 10-second stop grace period, so
	// in-flight requests finish before Docker would kill the process.
	shutdownTimeout = 5 * time.Second

	healthcheckTimeout = 2 * time.Second
)

func main() {
	if err := run(context.Background(), os.Args[1:], os.Getenv, os.Stdout); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}

// run holds everything main does, with its inputs passed in so tests can drive it.
func run(ctx context.Context, args []string, getenv func(string) string, stdout io.Writer) error {
	flags := flag.NewFlagSet("calculator", flag.ContinueOnError)
	healthcheck := flags.Bool("healthcheck", false, "call /healthz on the local server and exit 0 if it is healthy")
	if err := flags.Parse(args); err != nil {
		return err
	}

	port := getenv("PORT")
	if port == "" {
		port = defaultPort
	}
	if *healthcheck {
		return checkHealth(ctx, "http://127.0.0.1:"+port+"/healthz")
	}

	// After the first signal, restore the default behaviour, so a second
	// Ctrl+C stops a shutdown that is stuck.
	ctx, stop := signal.NotifyContext(ctx, os.Interrupt, syscall.SIGTERM)
	defer stop()
	context.AfterFunc(ctx, stop)

	ln, err := net.Listen("tcp", ":"+port)
	if err != nil {
		return fmt.Errorf("listen: %w", err)
	}
	logger := slog.New(slog.NewJSONHandler(stdout, nil))
	return serve(ctx, newServer(httpapi.NewHandler(logger)), ln, logger)
}

// newServer sets every timeout, so a slow or idle client cannot hold a
// connection open indefinitely.
func newServer(handler http.Handler) *http.Server {
	return &http.Server{
		Handler:           handler,
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       10 * time.Second,
		WriteTimeout:      10 * time.Second,
		IdleTimeout:       60 * time.Second,
	}
}

// serve runs srv on ln until ctx is done, then shuts down gracefully: it stops
// accepting connections and waits up to shutdownTimeout for in-flight requests.
func serve(ctx context.Context, srv *http.Server, ln net.Listener, logger *slog.Logger) error {
	serveErr := make(chan error, 1)
	go func() { serveErr <- srv.Serve(ln) }()
	logger.Info("calculator listening", "addr", ln.Addr().String())

	select {
	case err := <-serveErr:
		return fmt.Errorf("serve: %w", err)
	case <-ctx.Done():
	}

	logger.Info("shutting down", "timeout", shutdownTimeout.String())
	shutdownCtx, cancel := context.WithTimeout(context.Background(), shutdownTimeout)
	defer cancel()
	if err := srv.Shutdown(shutdownCtx); err != nil {
		return fmt.Errorf("shutdown: %w", err)
	}
	logger.Info("server stopped")
	return nil
}

// checkHealth calls url and succeeds only on a 200 response.
func checkHealth(ctx context.Context, url string) error {
	ctx, cancel := context.WithTimeout(ctx, healthcheckTimeout)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return fmt.Errorf("health check: %w", err)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return fmt.Errorf("health check: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return errors.New("health check: status " + resp.Status)
	}
	return nil
}
