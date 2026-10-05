import process from "node:process";

import "dotenv/config";

import { executeDevelopmentSeed } from "./seed-runner.js";

void executeDevelopmentSeed(process.env).then((exitCode) => {
  process.exitCode = exitCode;
});
