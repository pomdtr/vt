package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"

	"github.com/mattn/go-isatty"
	"github.com/spf13/cobra"
)

const (
	apiRoot = "https://api.val.town/v1"
)

func NewCmdPrint() *cobra.Command {
	cmd := &cobra.Command{
		Use: "print",
	}

	cmd.AddCommand(NewCmdPrintToken())
	cmd.AddCommand(NewCmdPrintVal())

	return cmd
}

func NewCmdPrintToken() *cobra.Command {
	return &cobra.Command{
		Use:  "token",
		Args: cobra.NoArgs,
		RunE: func(cmd *cobra.Command, args []string) error {
			token, err := cmd.Flags().GetString("token")
			if err != nil {
				return err
			}

			fmt.Println(token)
			return nil
		},
	}
}

type ValResponse struct {
	Code string `json:"code"`
}

func NewCmdPrintVal() *cobra.Command {
	return &cobra.Command{
		Use:  "val <val>",
		Args: cobra.ExactArgs(1),
		RunE: func(cmd *cobra.Command, args []string) error {
			token, err := cmd.Flags().GetString("token")
			if err != nil {
				return err
			}

			val := strings.TrimPrefix(args[0], "@")
			parts := strings.Split(val, ".")
			if len(parts) != 2 {
				return fmt.Errorf("invalid val: %s", val)
			}

			req, err := http.NewRequest(http.MethodGet, fmt.Sprintf("%s/alias/%s/%s", apiRoot, parts[0], parts[1]), nil)
			if err != nil {
				return err
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

			var output ValResponse
			if err := json.NewDecoder(resp.Body).Decode(&output); err != nil && err != io.EOF {
				return err
			}

			fmt.Println(output.Code)
			return nil
		},
	}
}

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

			token, err := cmd.Flags().GetString("token")
			if err != nil {
				return err
			}

			cmd.Printf("token: %s\n", token)

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
		Use: "vt",
		PersistentPreRunE: func(cmd *cobra.Command, args []string) error {
			if cmd.Flags().Changed("token") {
				return nil
			}

			if env, ok := os.LookupEnv("VALTOWN_TOKEN"); ok {
				if err := cmd.Flags().Set("token", env); err != nil {
					return err
				}

				return nil
			}

			homeDir, err := os.UserHomeDir()
			if err != nil {
				return fmt.Errorf("failed to get home directory: %w", err)
			}

			tokenFile := filepath.Join(homeDir, ".config", "vt", "api_token")
			if _, err := os.Stat(tokenFile); err == nil {
				bs, err := os.ReadFile(tokenFile)
				if err != nil {
					return fmt.Errorf("failed to read token file: %w", err)
				}

				if err := cmd.Flags().Set("token", strings.TrimSpace(string(bs))); err != nil {
					return err
				}

				return nil
			}

			return nil
		},

		SilenceUsage: true,
	}

	rootCmd.AddCommand(
		NewCmdEval(),
		NewCmdRun(),
		NewCmdApi(),
		NewCmdPrint(),
	)

	rootCmd.PersistentFlags().String("token", "", "api token")

	return rootCmd.Execute()
}

func main() {
	if err := Execute(); err != nil {
		os.Exit(1)
	}
}
