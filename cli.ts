export type Input = {
  stdin?: string;
  args: string[];
};

export type Output =
  | string
  | {
      stdout?: string;
      stderr?: string;
      code?: number;
    };
