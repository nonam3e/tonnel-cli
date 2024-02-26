import path from "path";

export const WRAPPERS = "wrappers";
export const TEMP = "temp";

export const WRAPPERS_DIR = path.join(process.cwd(), WRAPPERS);
export const TEMP_DIR = path.join(process.cwd(), TEMP);

export const CACHE_DIR = path.join(process.cwd(), TEMP, "cache")

export const wasmPath = path.join(__dirname, "../build/withdraw/circuit.wasm");
export const zkeyPath = path.join(
  __dirname,
  "../build/withdraw/circuit_final.zkey",
);
export const vkeyWithdrawPath = path.join(
  __dirname,
  "../build/withdraw/verification_key.json",
);
export const vkeyWithdraw = require(vkeyWithdrawPath);

export const wasmPathInsert = path.join(
  __dirname,
  "../build/insert/circuit.wasm",
);
export const zkeyPathInsert = path.join(
  __dirname,
  "../build/insert/circuit_final.zkey",
);
export const vkeyInsertPath = path.join(
  __dirname,
  "../build/insert/verification_key.json",
);
