import { Address } from "@ton/core";

export type PoolConfig = PoolConfigNative | PoolConfigJetton;

export type PoolConfigNative = {
  type: "native";
  coinType: PoolTypes;
  value: bigint;
  address: Address;
  fee: number | bigint;
};

export type PoolConfigJetton = {
  type: "jetton";
  coinType: PoolTypes;
  value: bigint;
  address: Address;
  fee: number | bigint;
  jetton: Address;
};

export enum PoolTypes {
  TON = "TON",
  TONNEL = "TONNEL",
  // "DFC"
}
