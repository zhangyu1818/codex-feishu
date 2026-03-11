export type CliOptions = {
  configFilePath?: string;
};

export const parseCliOptions = (argv: string[]): CliOptions => {
  const options: CliOptions = {};

  for (let index = 0; index < argv.length; index += 1) {
    const current = argv[index];

    if (current === '-c' || current === '--config') {
      const value = argv[index + 1];

      if (!value) {
        throw new Error(`${current} requires a path to a config file.`);
      }

      options.configFilePath = value;
      index += 1;
      continue;
    }

    throw new Error(`Unknown argument: ${current}`);
  }

  return options;
};
