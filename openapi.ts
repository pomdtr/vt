export default {
  openapi: "3.1.0",
  info: {
    title: "Val Town API",
    description:
      "The Val Town API provides services to evaluate JavaScript and TypeScript expressions, run vals as APIs, either as functions or Express handlers.\n\nLearn more at [https://docs.val.town](https://docs.val.town)\n",
    version: "1.5.1",
  },
  servers: [{ url: "https://api.val.town", description: "Val Town API v1" }],
  components: {
    securitySchemes: {
      bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "API Key" },
    },
    schemas: {
      JSON: {
        oneOf: [
          { type: "string" },
          { type: "number" },
          { type: "object" },
          { type: "array", items: {} },
          { type: "boolean" },
        ],
        description:
          "Can be anything: string, number, array, object, etc., including `null`",
      },
      Relationship: { type: "string", enum: ["received", "given", "any"] },
      User: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          username: { description: "The user's username", type: "string" },
          bio: { description: "The user's bio", type: ["string", "null"] },
          profileImageUrl: {
            description: "The url for the user's profile picture",
            type: ["string", "null"],
          },
        },
      },
      BaseVal: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          author: {
            type: "object",
            properties: {
              id: { description: "The id of the val's author", type: "string" },
              username: {
                description: "The username of the val's author",
                type: "string",
              },
            },
          },
          name: { type: "string" },
          code: { type: "string" },
          public: { type: "boolean" },
          version: { type: "integer", format: "int32" },
          runEndAt: { type: "string", format: "date-time" },
          runStartAt: { type: "string", format: "date-time" },
        },
      },
      FullVal: {
        type: "object",
        allOf: [{ $ref: "#/components/schemas/BaseVal" }],
        properties: {
          logs: { type: "array", items: {} },
          output: { type: "object" },
          error: { type: "object" },
          readme: { type: "string" },
          likeCount: { type: "number" },
          referenceCount: { type: "number" },
        },
      },
      ValInput: { type: "object", properties: { code: { type: "string" } } },
      PaginatedList: {
        type: "object",
        properties: {
          data: { type: "array" },
          links: {
            type: "object",
            properties: {
              self: {
                description: "The URL of the current page of results",
                type: "string",
                format: "uri",
              },
              next: {
                description: "The URL of the next page of results",
                type: "string",
                format: "uri",
              },
              prev: {
                description: "The URL of the previous page of results",
                type: "string",
                format: "uri",
              },
            },
          },
        },
      },
      ValList: {
        type: "object",
        allOf: [{ $ref: "#/components/schemas/PaginatedList" }],
        properties: {
          data: {
            type: "array",
            items: { $ref: "#/components/schemas/BaseVal" },
          },
        },
      },
      ValRef: {
        type: "object",
        properties: {
          id: { description: "The id of the val", type: "string" },
          name: { description: "The name of the val", type: "string" },
          author_id: {
            description: "The id of the val's author",
            type: "string",
          },
          username: {
            description: "The username of the val's author",
            type: "string",
          },
          public: { type: "boolean" },
          version: { type: "integer", format: "int32" },
        },
      },
      BaseRun: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          error: {},
          parentId: { type: "string", format: "uuid" },
          runEndAt: { type: "string", format: "date-time" },
          runStartAt: { type: "string", format: "date-time" },
          author: { type: "object", properties: null },
          val: { $ref: "#/components/schemas/ValRef" },
        },
      },
      FullRun: {
        type: "object",
        allOf: [{ $ref: "#/components/schemas/BaseRun" }],
        properties: {
          emails: { type: "array", items: {} },
          logs: { type: "array", items: {} },
          returnValue: {},
          args: { type: "array", items: {} },
        },
      },
      RunList: {
        type: "object",
        allOf: [{ $ref: "#/components/schemas/PaginatedList" }],
        properties: {
          data: {
            type: "array",
            items: { $ref: "#/components/schemas/BaseRun" },
          },
        },
      },
      Comment: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          author: {
            type: "object",
            properties: {
              id: {
                description: "The id of the comment's author",
                type: "string",
              },
              username: {
                description: "The username of the comment's author",
                type: "string",
              },
            },
          },
          comment: {
            description: "The contents of the comment",
            type: "string",
          },
          createdAt: { type: "string", format: "date-time" },
          val: { $ref: "#/components/schemas/ValRef" },
        },
      },
      CommentList: {
        type: "object",
        allOf: [{ $ref: "#/components/schemas/PaginatedList" }],
        properties: {
          data: {
            type: "array",
            items: { $ref: "#/components/schemas/Comment" },
          },
        },
      },
    },
    parameters: {
      expression: {
        in: "path",
        name: "expression",
        required: true,
        description:
          "The JavaScript or TypeScript expression to be evaluated.\nThis should be a single expression, like a single function\ncall, assignment operation, or calculation. If you need\nto execute multiple expressions, wrap them in a function.\n",
        schema: { type: "string" },
        examples: {
          simpleAddition: { value: "1+1", summary: "Simple addition" },
          functionCall: {
            value: "@stevekrouse.addOne(@stevekrouse.example1)",
            summary: "Calling a user's val function",
          },
        },
      },
      user_id: {
        name: "user_id",
        in: "path",
        required: true,
        description: "id of the user",
        schema: { type: "string", format: "uuid" },
        examples: {
          stevekrouse: { value: "a0bf3b31-15a5-4d5c-880e-4b1e22c9bc18" },
        },
      },
      username: {
        name: "username",
        in: "path",
        required: true,
        description:
          "The username of the val owner, *not* including the `@` symbol.\n",
        schema: { type: "string" },
        examples: {
          stevekrouse: {
            value: "stevekrouse",
            summary: "Steve Krouse's username",
          },
        },
      },
      val_id: {
        name: "val_id",
        in: "path",
        required: true,
        description: "id of the val",
        schema: { type: "string", format: "uuid" },
        examples: { hello: { value: "eb4a2ace-b6c8-4393-85e0-4813b3f04e12" } },
      },
      val_name: {
        name: "val_name",
        in: "path",
        required: true,
        description: "The name of the val.",
        schema: { type: "string" },
        examples: {
          id: {
            value: "id",
            summary: "id",
            description:
              "This val is a function that returns its arguments. It is useful for testing how the API handles the arguments passed to it.\n\nView the val at [https://val.town/v/stevekrouse.id](https://val.town/v/stevekrouse.id)\n",
          },
        },
      },
      version: {
        name: "version",
        in: "path",
        required: true,
        description: "val version",
        schema: { type: "number" },
      },
      run_id: {
        name: "run_id",
        in: "path",
        required: true,
        description: "id of the log",
        schema: { type: "string", format: "uuid" },
        examples: { hello: { value: "cd0653ac-aede-4d0d-8c8e-21c7ef763eb2" } },
      },
      offset: {
        name: "offset",
        in: "query",
        description: "Pagination offset",
        schema: { type: "integer", default: 0, minimum: 0 },
      },
      limit: {
        name: "limit",
        in: "query",
        description: "Pagination limit",
        schema: { type: "integer", default: 20, minimum: 1, maximum: 100 },
      },
      comments_since: {
        name: "since",
        in: "query",
        description: "Return runs where `createdAt > since` (non-inclusive)",
        schema: { type: "string" },
        examples: { isostring: { $ref: "#/components/examples/isostring" } },
      },
      comments_until: {
        name: "until",
        in: "query",
        description: "Return runs where `createdAt <= until` (inclusive)",
        schema: { type: "string" },
        examples: { isostring: { $ref: "#/components/examples/isostring" } },
      },
      relationship: {
        name: "relationship",
        in: "query",
        schema: { $ref: "#/components/schemas/Relationship" },
      },
      runs_since: {
        name: "since",
        in: "query",
        description: "Return runs where `runStartAt > since` (non-inclusive)",
        schema: { type: "string" },
        examples: { isostring: { $ref: "#/components/examples/isostring" } },
      },
      runs_until: {
        name: "until",
        in: "query",
        description: "Return runs where `runStartAt <= until` (inclusive)",
        schema: { type: "string" },
        examples: { isostring: { $ref: "#/components/examples/isostring" } },
      },
      runs_source: {
        name: "source",
        in: "query",
        description:
          "Only return runs that were triggered by one of the specified sources. It accepts a single source (`ui`) or multiple sources joined by commas (`api,email`). The available sources are: ui, api, interval, email",
        schema: { type: "string" },
        examples: {
          one_source: {
            value: "ui",
            description: "Return runs triggered by the app ui",
          },
          multiple_source: {
            value: "api,interval",
            description:
              "Returns runs triggered by either the api, or an interval",
          },
        },
      },
      runs_error: {
        name: "error",
        in: "query",
        description:
          "Filter by whether a run had an error. \\ true - Returns runs that resulted in an error \\ false - Returns runs that succeeded \\ omit the query param to return any run",
        schema: { type: "boolean" },
      },
    },
    examples: {
      user_stevekrouse: {
        value: {
          id: "a0bf3b31-15a5-4d5c-880e-4b1e22c9bc18",
          username: "@stevekrouse",
          bio: "mayor of val town\nhttps://stevekrouse.com",
          profileImageUrl:
            "https://images.clerk.dev/uploaded/img_2PqHa2Gsy93xQrjh2w78Xu0cChW.jpeg",
        },
      },
      val_hello: {
        value: {
          id: "eb4a2ace-b6c8-4393-85e0-4813b3f04e12",
          author: {
            id: "a0bf3b31-15a5-4d5c-880e-4b1e22c9bc18",
            username: "@stevekrouse",
          },
          name: "hello",
          code: 'let hello = "Hello World";',
          public: false,
          version: 0,
          runStartAt: "2023-07-12T15:22:01.000Z",
          runEndAt: "2023-07-12T15:22:02.000Z",
          logs: [],
          output: { type: "string", value: "Hello World" },
          error: null,
          readme: "# Hello",
          likeCount: 0,
          referenceCount: 0,
        },
      },
      val_hello_v1: {
        value: {
          id: "eb4a2ace-b6c8-4393-85e0-4813b3f04e12",
          author: {
            id: "a0bf3b31-15a5-4d5c-880e-4b1e22c9bc18",
            username: "@stevekrouse",
          },
          name: "hello",
          code: 'let hello = "Hello World 2";',
          public: false,
          version: 1,
          runStartAt: "2023-07-12T15:23:01.000Z",
          runEndAt: "2023-07-12T15:23:02.000Z",
          logs: [],
          output: { type: "string", value: "Hello World 2" },
          error: null,
          readme: "# Hello",
          likeCount: 0,
          referenceCount: 0,
        },
      },
      isostring: { value: "2023-07-26T03:28:00.000Z", summary: "ISO String" },
    },
    responses: {
      ExpressionResult: {
        description:
          "The returned result of executing the passed expression successfully. The result can be of any JSON type. It will not include any logs that were generated during execution.",
        content: {
          "application/json": {
            schema: {
              oneOf: [
                { type: "string" },
                { type: "number" },
                { type: "object" },
                { type: "array", items: {} },
                { type: "boolean" },
              ],
            },
            examples: {
              simpleAddition: { value: 2, summary: "Simple addition result" },
              functionCall: { value: 42, summary: "Calling a function result" },
            },
          },
        },
      },
    },
  },
  security: [{ bearerAuth: [] }, {}],
  paths: {
    "/v1/me": {
      get: {
        summary: "Get profile information for the current user",
        tags: ["Me"],
        responses: {
          "200": {
            description: "OK",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/User" },
                examples: {
                  stevekrouse: {
                    $ref: "#/components/examples/user_stevekrouse",
                  },
                },
              },
            },
          },
          "401": { description: "Unauthorized" },
        },
      },
    },
    "/v1/me/runs": {
      get: {
        summary: "Get runs by the current user",
        tags: ["Me"],
        parameters: [
          { $ref: "#/components/parameters/offset" },
          { $ref: "#/components/parameters/limit" },
          { $ref: "#/components/parameters/runs_since" },
          { $ref: "#/components/parameters/runs_until" },
          { $ref: "#/components/parameters/runs_source" },
          { $ref: "#/components/parameters/runs_error" },
        ],
        responses: {
          "200": {
            description: "OK",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/RunList" },
              },
            },
          },
          "401": { description: "Unauthorized" },
        },
      },
    },
    "/v1/me/likes": {
      get: {
        summary: "Get vals liked by the current user",
        tags: ["Me"],
        parameters: [
          { $ref: "#/components/parameters/offset" },
          { $ref: "#/components/parameters/limit" },
        ],
        responses: {
          "200": {
            description: "OK",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ValList" },
              },
            },
          },
          "401": { description: "Unauthorized" },
        },
      },
    },
    "/v1/me/comments": {
      get: {
        summary:
          "Get comments related to current user, either given or received",
        tags: ["Me"],
        parameters: [
          { $ref: "#/components/parameters/offset" },
          { $ref: "#/components/parameters/limit" },
          { $ref: "#/components/parameters/comments_since" },
          { $ref: "#/components/parameters/comments_until" },
          { $ref: "#/components/parameters/relationship" },
        ],
        responses: {
          "200": {
            description: "OK",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/CommentList" },
              },
            },
          },
          "401": { description: "Unauthorized" },
        },
      },
    },
    "/v1/vals": {
      post: {
        summary: "Create a new val",
        tags: ["Vals"],
        requestBody: {
          description: "Code of the new val to be run.",
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ValInput" },
              examples: {
                increment: { value: { code: 'let hello = "Hello World";' } },
              },
            },
            "text/plain": {
              schema: { type: "string" },
              examples: { increment: { value: 'let hello = "Hello World";' } },
            },
            "text/javascript": {
              schema: { type: "string" },
              examples: { increment: { value: 'let hello = "Hello World";' } },
            },
            "application/javascript": {
              schema: { type: "string" },
              examples: { increment: { value: 'let hello = "Hello World";' } },
            },
          },
        },
        responses: {
          "200": {
            description: "OK",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/FullVal" },
                examples: {
                  hello: { $ref: "#/components/examples/val_hello" },
                },
              },
            },
          },
          "401": { description: "Unauthorized" },
        },
      },
    },
    "/v1/vals/{val_id}": {
      get: {
        summary: "Get val by id",
        tags: ["Vals"],
        parameters: [{ $ref: "#/components/parameters/val_id" }],
        responses: {
          "200": {
            description: "OK",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/FullVal" },
                examples: {
                  hello: { $ref: "#/components/examples/val_hello" },
                },
              },
            },
          },
          "404": { description: "Val not found" },
        },
      },
      delete: {
        summary: "Delete a val",
        tags: ["Vals"],
        parameters: [{ $ref: "#/components/parameters/val_id" }],
        responses: { "204": { description: "No Content" } },
      },
    },
    "/v1/vals/{val_id}/versions": {
      post: {
        summary: "Create a new version of a val",
        tags: ["Vals"],
        parameters: [{ $ref: "#/components/parameters/val_id" }],
        requestBody: {
          description: "Code of the new version to be run.",
          required: true,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/ValInput" },
              examples: {
                increment: { value: { code: 'let hello = "Hello World 2";' } },
              },
            },
            "text/plain": {
              schema: { type: "string" },
              examples: {
                increment: { value: 'let hello = "Hello World 2";' },
              },
            },
            "text/javascript": {
              schema: { type: "string" },
              examples: {
                increment: { value: 'let hello = "Hello World 2";' },
              },
            },
            "application/javascript": {
              schema: { type: "string" },
              examples: {
                increment: { value: 'let hello = "Hello World 2";' },
              },
            },
          },
        },
        responses: {
          "201": {
            description: "Created",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/FullVal" },
                examples: {
                  hello: { $ref: "#/components/examples/val_hello_v1" },
                },
              },
            },
          },
          "404": { description: "Val not found" },
        },
      },
    },
    "/v1/vals/{val_id}/versions/{version}": {
      delete: {
        summary: "Delete a val version",
        tags: ["Vals"],
        parameters: [
          { $ref: "#/components/parameters/val_id" },
          { $ref: "#/components/parameters/version" },
        ],
        responses: { "204": { description: "No Content" } },
      },
    },
    "/v1/vals/{val_id}/runs": {
      get: {
        summary: "Get runs of a val",
        tags: ["Vals"],
        parameters: [
          { $ref: "#/components/parameters/val_id" },
          { $ref: "#/components/parameters/offset" },
          { $ref: "#/components/parameters/limit" },
          { $ref: "#/components/parameters/runs_since" },
          { $ref: "#/components/parameters/runs_until" },
          { $ref: "#/components/parameters/runs_source" },
          { $ref: "#/components/parameters/runs_error" },
        ],
        responses: {
          "200": {
            description: "OK",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/RunList" },
              },
            },
          },
          "401": { description: "Unauthorized" },
        },
      },
    },
    "/v1/users/{user_id}": {
      get: {
        summary: "Get profile information",
        tags: ["Users"],
        parameters: [{ $ref: "#/components/parameters/user_id" }],
        responses: {
          "200": {
            description: "OK",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/User" },
                examples: {
                  stevekrouse: {
                    $ref: "#/components/examples/user_stevekrouse",
                  },
                },
              },
            },
          },
          "404": { description: "Not found" },
        },
      },
    },
    "/v1/users/{user_id}/vals": {
      get: {
        summary: "List a user's vals",
        tags: ["Users"],
        parameters: [
          { $ref: "#/components/parameters/user_id" },
          { $ref: "#/components/parameters/offset" },
          { $ref: "#/components/parameters/limit" },
        ],
        responses: {
          "200": {
            description: "OK",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ValList" },
              },
            },
          },
        },
      },
    },
    "/v1/runs/{run_id}": {
      get: {
        summary: "Get val run by id",
        tags: ["Runs"],
        parameters: [{ $ref: "#/components/parameters/run_id" }],
        responses: {
          "200": {
            description: "OK",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/FullRun" },
              },
            },
          },
          "401": { description: "Unauthorized" },
          "404": { description: "Not found" },
        },
      },
    },
    "/v1/alias/{username}": {
      get: {
        summary: "Get a user profile information by their username",
        tags: ["Alias"],
        parameters: [{ $ref: "#/components/parameters/username" }],
        responses: {
          "200": {
            description: "OK",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/User" },
                examples: {
                  stevekrouse: {
                    $ref: "#/components/examples/user_stevekrouse",
                  },
                },
              },
            },
          },
          "404": { description: "Not found" },
        },
      },
    },
    "/v1/alias/{username}/{val_name}": {
      get: {
        summary: "Get a val by the author's username and val name",
        tags: ["Alias"],
        parameters: [
          { $ref: "#/components/parameters/username" },
          { $ref: "#/components/parameters/val_name" },
        ],
        responses: {
          "200": {
            description: "OK",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/FullVal" },
              },
            },
          },
          "404": { description: "Not found" },
        },
      },
    },
    "/v1/search/vals": {
      get: {
        summary: "Search for vals across the platform",
        tags: ["Search"],
        parameters: [
          {
            name: "query",
            in: "query",
            description: "Search query",
            required: true,
            schema: { type: "string", minLength: 1, maxLength: 512 },
          },
          { $ref: "#/components/parameters/offset" },
          { $ref: "#/components/parameters/limit" },
        ],
        responses: {
          "200": {
            description: "OK",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/ValList" },
              },
            },
          },
        },
      },
    },
    "/v1/eval/{expression}": {
      get: {
        summary: "Evaluate a JavaScript or TypeScript expression",
        tags: ["Eval"],
        description:
          "Evaluates the JavaScript or TypeScript `{expression}` and responds with the returned result. \n\n### Unauthenticated\nUnauthenticated use will have read-only access to public vals. \n\n### Authenticated\nAuthenticated use will have read access to the authenticated user's private vals and secrets, write access to the authenticated user's vals, and the ability to send the authenticated user emails via `console.email`.\n\nVals generated via this API will *not* appear in the authenticated user's workspace.\n",
        parameters: [{ $ref: "#/components/parameters/expression" }],
        responses: {
          "200": { $ref: "#/components/responses/ExpressionResult" },
          "400": { description: "Bad request" },
          "404": { description: "Not found" },
          "500": { description: "Internal server error" },
          "502": { description: "Error thrown executing user expression" },
        },
      },
    },
    "/v1/eval": {
      post: {
        summary: "Evaluate a JavaScript or TypeScript expression",
        tags: ["Eval"],
        description:
          "Evaluates the JavaScript or TypeScript `{expression}` and responds with the returned result. \n\n### Unauthenticated\nUnauthenticated use will have read-only access to public vals. \n\n### Authenticated\nAuthenticated use will have read access to the authenticated user's private vals and secrets, write access to the authenticated user's vals, and the ability to send the authenticated user emails via `console.email`.\n\nVals generated via this API will *not* appear in the authenticated user's workspace.\n",
        requestBody: {
          description:
            "When used as a POST endpoint, the request body must contain the code to be run.",
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["code"],
                properties: {
                  code: { type: "string" },
                  args: {
                    type: "array",
                    items: { $ref: "#/components/schemas/JSON" },
                  },
                },
              },
              examples: {
                "Add two numbers": {
                  value: { code: "(a, b) => a + b", args: [1, 42] },
                },
              },
            },
          },
        },
        responses: {
          "200": { $ref: "#/components/responses/ExpressionResult" },
          "400": { description: "Bad request" },
          "404": { description: "Not found" },
          "500": { description: "Internal server error" },
          "502": { description: "Error thrown executing user expression" },
        },
      },
    },
    "/v1/run/{username}.{val_name}": {
      get: {
        summary: "Run a val as an API",
        tags: ["Run"],
        description:
          "This endpoint runs the specified user's val and returns the output.",
        parameters: [
          { $ref: "#/components/parameters/username" },
          { $ref: "#/components/parameters/val_name" },
          {
            in: "query",
            name: "args",
            schema: { type: "string" },
            description:
              "The args query parameter can provide arguments to the given val. The parameter needs to be a JSON-encoded array, in which each item in the array is passed to the val as a function parameter.",
            examples: {
              name: {
                value: '["Steve"]',
                summary: "Calling a function with a single string argument",
              },
              empty: { value: "" },
            },
          },
        ],
        responses: {
          "200": { $ref: "#/components/responses/ExpressionResult" },
          "400": { description: "Bad request" },
          "404": { description: "Not found" },
          "500": { description: "Internal server error" },
          "502": { description: "Error thrown executing user expression" },
        },
      },
      post: {
        summary: "Run a val as an API",
        tags: ["Run"],
        parameters: [
          { $ref: "#/components/parameters/username" },
          { $ref: "#/components/parameters/val_name" },
        ],
        requestBody: {
          required: false,
          description:
            "Provide arguments to the given val function by including a post body with your request.",
          content: {
            "application/json": {
              schema: {
                type: "object",
                additionalProperties: false,
                properties: {
                  args: {
                    type: "array",
                    items: { $ref: "#/components/schemas/JSON" },
                  },
                },
              },
            },
          },
        },
        responses: {
          "200": { $ref: "#/components/responses/ExpressionResult" },
          "400": { description: "Bad request" },
          "404": { description: "Not found" },
          "500": { description: "Internal server error" },
          "502": { description: "Error thrown executing user expression" },
        },
      },
    },
    "/": {
      servers: [
        {
          url: "https://{username}-{val_name}.express.val.run",
          description: "Val Town API v1",
          variables: {
            username: { default: "stevekrouse" },
            val: { default: "expressHTMLExample" },
          },
        },
      ],
      get: {
        summary: "Run a val as an API (as an Express handler)",
        tags: ["Express"],
        description:
          "Runs `@{username}.{val_name}` as an Express handler. \n\n`@{username}.{val_name}` must be a function. It is passed the Express [`req`](https://expressjs.com/en/4x/api.html#req) and [`res`](https://expressjs.com/en/4x/api.html#res) objects as its arguments. You can use `req` to pull out request data, and `res` to respond with any valid Express response. Learn more at the [Express docs](https://expressjs.com/en/4x/api.html).\n\nUnlike the other two APIs, the Express API is specified via subdomain and runs at `https://{username}-{val_name}.express.val.run`.\n\n### Unauthenticated\nUnauthenticated use will only be able to call public vals as Express handlers.\n\nThe val will be executed with `{username}`'s permissions (\"API Mode\"), so it will be able to read and write to `{username}`'s public and private vals, secrets, and use `console.email`.\n\n### Authenticated\nAuthenticated use is able to call private vals as Express handlers.\n",
        responses: {
          "200": {
            description: "Function executed successfully",
            content: {
              "*/*": {
                schema: {
                  type: "string",
                  description:
                    "The result of the executed function, in any media type",
                },
              },
            },
          },
          "400": { description: "Bad request" },
          "404": { description: "Not found" },
          "500": { description: "Internal server error" },
          "502": { description: "Error thrown executing user code" },
        },
      },
      post: {
        summary: "Run a val as an API (as an Express handler)",
        tags: ["Express"],
        description:
          "Runs `@{username}.{val_name}` as an Express handler. \n\n`@{username}.{val_name}` must be a function. It is passed the Express [`req`](https://expressjs.com/en/4x/api.html#req) and [`res`](https://expressjs.com/en/4x/api.html#res) objects as its arguments. You can use `req` to pull out request data, and `res` to respond with any valid Express response. Learn more at the [Express docs](https://expressjs.com/en/4x/api.html).\n\n### Unauthenticated\nUnauthenticated use will only be able to call public vals as Express handlers.\n\nThe val will be executed with `{username}`'s permissions (\"API Mode\"), so it will be able to read and write to `{username}`'s public and private vals, secrets, and use `console.email`.\n\n### Authenticated\nAuthenticated use is able to call private vals as Express handlers.\n",
        requestBody: {
          description:
            "The request body will be accessible to the val Express handler under the first argument, commonly called `req`, as `req.body`.\n",
          required: false,
          content: {
            "application/json": {
              schema: { $ref: "#/components/schemas/JSON" },
              examples: {
                name: {
                  value: '{"name": "Steve"}',
                  summary: "JSON object as the request body",
                },
              },
            },
          },
        },
        responses: {
          "200": {
            description: "Function executed successfully",
            content: {
              "*/*": {
                schema: {
                  type: "string",
                  description:
                    "The result of the executed function, in any media type",
                },
              },
            },
          },
          "400": { description: "Bad request" },
          "404": { description: "Not found" },
          "500": { description: "Internal server error" },
          "502": { description: "Error thrown executing user code" },
        },
      },
    },
  },
} as const;
