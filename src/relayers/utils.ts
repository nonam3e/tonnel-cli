import { toNano } from "@ton/core";
import { PoolConfig, PoolTypes } from "../pools/config";
import { GramPools, TonPools, TonnelPools } from "../pools/list";
import { PrivateKey } from "../zk/depositHelpers";
import { UIProvider } from "../ui/UIProvider";
import fs from "fs";

export async function readPrivateKey(ui: UIProvider) {
  let pre_secret: null|string = null;
  let key_file= "";
  fs.readdirSync("key").forEach(file => {
    if (pre_secret !== null) return;
    if (file.startsWith("PrivateKey") || file.startsWith("privatekeydocument")) {
      if (file.endsWith(".txt")) {
        pre_secret = fs.readFileSync("key/" + file, 'utf-8');
        console.log("Selected key from file " + file);
        key_file = file;
      }
    }
  });
  const secret = (pre_secret != null ? pre_secret :
    await ui.inputSecret("Paste your Secret Key")).split("_");
  const privateKey: PrivateKey = {
    secret: BigInt(secret[2]),
    nullifier: BigInt(secret[3]),
  };
  let poolConfig: PoolConfig;
  switch (secret[0]) {
    case PoolTypes.TON:
      poolConfig = TonPools.find((pool) => pool.value == toNano(secret[1]))!!;
      break;
    case PoolTypes.TONNEL:
      poolConfig = TonnelPools.find(
        (pool) => pool.value == toNano(secret[1]),
      )!!;
      break;
    case PoolTypes.GRAM:
      poolConfig = GramPools.find((pool) => pool.value == toNano(secret[1]))!!;
      break;
    default:
      throw new Error("Unknown pool");
  }
  return { privateKey, poolConfig, key_file };
}
