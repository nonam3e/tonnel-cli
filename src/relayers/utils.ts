import { toNano } from "@ton/core";
import { PoolConfig, PoolTypes } from "../pools/config";
import { TonPools, TonnelPools } from "../pools/list";
import { PrivateKey } from "../zk/depositHelpers";
import { UIProvider } from "../ui/UIProvider";

export async function readPrivateKey(ui: UIProvider) {
  const secret = (await ui.inputSecret("Paste your Secret Key")).split("_");
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
    default:
      throw new Error("Unknown pool");
  }
  return { privateKey, poolConfig };
}
