import "server-only";
import { parseServerEnv } from "./env-schema";

// Importing this module from a Client Component fails the build,
// so secrets can never be bundled into browser JavaScript.
export const serverEnv = parseServerEnv(process.env);
