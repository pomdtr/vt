package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"

	"github.com/mattn/go-isatty"
	"github.com/spf13/cobra"
)

const (
	TOKEN_ENV = "VALTOWN_TOKEN"
)

func Execute() error {
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

			req, err := http.NewRequest(http.MethodPost, "https://api.val.town/v1/eval", bytes.NewReader(payload))
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
			encoder.SetIndent("", "  ")
			if err := encoder.Encode(output); err != nil {
				return err
			}

			return nil
		},
	}

	rootCmd.PersistentFlags().StringP("token", "t", "", "token to use for authentication")
	return rootCmd.Execute()
}

func main() {
	if err := Execute(); err != nil {
		os.Exit(1)
	}
}
