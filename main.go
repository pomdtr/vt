package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"

	"github.com/mattn/go-isatty"
	"github.com/spf13/cobra"
)

const (
	tokenEnv = "VALTOWN_TOKEN"
	apiRoot  = "https://api.val.town/v1"
)

func NewCmdApi() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "api <endpoint>",
		Args:  cobra.ExactArgs(1),
		Short: "Makes an authenticated HTTP request to the Val Town API and prints the response.",
		RunE: func(cmd *cobra.Command, args []string) error {
			var input []byte
			if !isatty.IsTerminal(os.Stdin.Fd()) {
				b, err := io.ReadAll(os.Stdin)
				if err != nil {
					return err
				}
				input = b
			}

			var method string
			if cmd.Flags().Changed("method") {
				method, _ = cmd.Flags().GetString("method")
			} else if len(input) > 0 {
				method = http.MethodPost
			} else {
				method = http.MethodGet
			}

			if method == "GET" && len(input) > 0 {
				return fmt.Errorf("cannot specify request body for GET request")
			}

			target, err := url.Parse(args[0])
			if err != nil {
				return err
			}

			if target.Scheme == "" {
				target.Scheme = "https"
				target.Host = "api.val.town"
				if !strings.HasPrefix(target.Path, "/") {
					target.Path = "/" + target.Path
				}

				if !strings.HasPrefix(target.Path, "/v1") {
					target.Path = "/v1" + target.Path
				}
			}

			req, err := http.NewRequest(method, target.String(), bytes.NewReader(input))
			if err != nil {
				return err
			}

			req.Header.Set("Authorization", "Bearer "+os.Getenv(tokenEnv))

			resp, err := http.DefaultClient.Do(req)
			if err != nil {
				return err
			}
			defer resp.Body.Close()

			if resp.StatusCode != http.StatusOK {
				return fmt.Errorf("request failed: %s", resp.Status)
			}

			var output any
			if err := json.NewDecoder(resp.Body).Decode(&output); err != nil && err != io.EOF {
				return err
			}

			encoder := json.NewEncoder(os.Stdout)
			encoder.SetEscapeHTML(false)
			encoder.SetIndent("", "  ")
			if err := encoder.Encode(output); err != nil {
				return err
			}

			return nil
		},
	}

	cmd.Flags().String("method", "", "http method")

	return cmd
}

func parseArg(input string) any {
	if input == "" {
		return nil
	}

	var parsed any
	if err := json.Unmarshal([]byte(input), &parsed); err == nil {
		return parsed
	}

	return input
}

type RunPayload struct {
	Args []any `json:"args"`
}

func NewCmdRun() *cobra.Command {
	runCmd := &cobra.Command{
		Use:   "run [val] [args...]",
		Short: "Runs a Val Town function and prints the result.",
		Args:  cobra.MinimumNArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			payload := RunPayload{
				Args: make([]any, 0),
			}

			for _, arg := range args[1:] {
				payload.Args = append(payload.Args, parseArg(arg))
			}

			body, err := json.Marshal(payload)
			if err != nil {
				return err
			}

			val := strings.TrimPrefix(args[0], "@")
			req, err := http.NewRequest(http.MethodPost, fmt.Sprintf("%s/run/%s", apiRoot, val), bytes.NewReader(body))
			if err != nil {
				return err
			}

			token, err := cmd.Flags().GetString("token")
			if err != nil {
				return err
			}

			if token == "" {
				token = os.Getenv(tokenEnv)
			}

			if token != "" {
				req.Header.Set("Authorization", "Bearer "+token)
			}

			resp, err := http.DefaultClient.Do(req)
			if err != nil {
				return err
			}
			defer resp.Body.Close()

			if resp.StatusCode != http.StatusOK {
				return fmt.Errorf("request failed: %s", resp.Status)
			}

			var output any
			if err := json.NewDecoder(resp.Body).Decode(&output); err != nil && err != io.EOF {
				return err
			}

			encoder := json.NewEncoder(os.Stdout)
			encoder.SetEscapeHTML(false)
			encoder.SetIndent("", "  ")
			if err := encoder.Encode(output); err != nil {
				return err
			}

			return nil
		},
	}

	return runCmd
}

type EvalPayload struct {
	Code string `json:"code"`
	Args []any  `json:"args,omitempty"`
}

func NewCmdEval() *cobra.Command {
	rootCmd := &cobra.Command{
		Use:   "eval [expression]",
		Short: "Evaluates a Val Town expression and prints the result.",
		Args:  cobra.MaximumNArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			var expression string
			if len(args) > 0 {
				expression = args[0]
			} else if !isatty.IsTerminal(os.Stdin.Fd()) {
				bs, err := io.ReadAll(os.Stdin)
				if err != nil {
					return err
				}

				expression = string(bs)
			} else {
				return fmt.Errorf("expression required")
			}

			body, err := json.Marshal(EvalPayload{
				Code: expression,
			})
			if err != nil {
				return err
			}

			token, err := cmd.Flags().GetString("token")
			if err != nil {
				return err
			}

			if token == "" {
				token = os.Getenv(tokenEnv)
			}

			req, err := http.NewRequest(http.MethodPost, fmt.Sprintf("%s/eval", apiRoot), bytes.NewReader(body))
			if err != nil {
				return err
			}

			if token != "" {
				req.Header.Set("Authorization", "Bearer "+token)
			}
			req.Header.Set("Content-Type", "application/json")

			resp, err := http.DefaultClient.Do(req)
			if err != nil {
				return err
			}
			defer resp.Body.Close()

			if resp.StatusCode != http.StatusOK {
				return fmt.Errorf("error: %s", resp.Status)
			}

			var output any
			if err := json.NewDecoder(resp.Body).Decode(&output); err != nil && err != io.EOF {
				return err
			}

			encoder := json.NewEncoder(os.Stdout)
			encoder.SetEscapeHTML(false)
			encoder.SetIndent("", "  ")
			if err := encoder.Encode(output); err != nil {
				return err
			}

			return nil
		},
	}

	return rootCmd
}

func Execute() error {
	rootCmd := &cobra.Command{
		Use:          "vt",
		SilenceUsage: true,
	}

	rootCmd.AddCommand(
		NewCmdEval(),
		NewCmdRun(),
		NewCmdApi(),
	)

	rootCmd.PersistentFlags().String("token", "", "api token")

	return rootCmd.Execute()
}

func main() {
	if err := Execute(); err != nil {
		os.Exit(1)
	}
}
