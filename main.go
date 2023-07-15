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
	TOKEN_ENV = "VALTOWN_TOKEN"
	EVAL_URL  = "https://api.val.town/v1/eval"
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

			req.Header.Set("Authorization", "Bearer "+os.Getenv(TOKEN_ENV))

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

func NewCmdEval() *cobra.Command {
	rootCmd := &cobra.Command{
		Use:          "val [expression]",
		Args:         cobra.MaximumNArgs(1),
		SilenceUsage: true,
		PreRunE: func(cmd *cobra.Command, args []string) error {
			if len(args) == 0 && isatty.IsTerminal(os.Stdin.Fd()) {
				return fmt.Errorf("expression required")
			}

			return nil
		},
		RunE: func(cmd *cobra.Command, args []string) error {
			var expression string
			if len(args) > 0 {
				expression = args[0]
			} else {
				b, err := io.ReadAll(os.Stdin)
				if err != nil {
					return err
				}
				expression = string(b)
			}

			payload, err := json.Marshal(map[string]string{
				"code": expression,
			})
			if err != nil {
				return err
			}

			token, err := cmd.Flags().GetString("token")
			if err != nil {
				return err
			}

			if token == "" {
				token = os.Getenv(TOKEN_ENV)
			}

			req, err := http.NewRequest(http.MethodPost, EVAL_URL, bytes.NewReader(payload))
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

			if output == nil {
				return nil
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

	rootCmd.PersistentFlags().StringP("token", "t", "", "token to use for authentication")
	return rootCmd
}

func Execute() error {
	rootCmd := &cobra.Command{
		Use:          "vt",
		SilenceUsage: true,
	}

	rootCmd.AddCommand(
		NewCmdEval(),
		NewCmdApi(),
	)

	return rootCmd.Execute()
}

func main() {
	if err := Execute(); err != nil {
		os.Exit(1)
	}
}
