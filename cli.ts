export type Input = {
  name: string;
  args: string[];
  stdin?: string;
};

export type Output =
  | string
  | {
      stdout?: string;
      stderr?: string;
      code?: number;
    };
