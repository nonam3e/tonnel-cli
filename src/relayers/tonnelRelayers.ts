import { Address, fromNano, toNano } from "@ton/core";
import { Args, argSpec } from "../cli/Runner";
import { UIProvider } from "../ui/UIProvider";
import { PrivateKey } from "../zk/depositHelpers";
import arg from "arg";
import {
  createNetworkProvider,
  createTonClient,
} from "../network/createNetworkProvider";
import { PoolProvider } from "../pools/Pool";
import { toPercentString } from "../utils";
import axios from "axios";
import { mimcHash2 } from "../zk/circuit";
import { readPrivateKey } from "./utils";

export const TonnelRelayerFees: RelayerFee[] = [
  {
    name: "Slow",
    fee: 20,
  },
  {
    name: "Normal",
    fee: 50,
  },
  {
    name: "Fast",
    fee: 100,
  },
];

export type RelayerFee = {
  name: string;
  fee: number;
};

export async function chooseWithdrawFee(
  fees: RelayerFee[],
  opts: {
    ui: UIProvider;
    msg: string;
  },
) {
  return await opts.ui.choose(
    opts.msg,
    fees,
    (o) => `${o.name} - ${toPercentString(o.fee)}`,
  );
}

export async function withdrawTonnel(args: Args, ui: UIProvider) {
  const fee = (
    await chooseWithdrawFee(TonnelRelayerFees, {
      ui,
      msg: "Choose Relayer Fee",
    })
  ).fee;

  const { privateKey, poolConfig } = await readPrivateKey(ui);

  const recipient = await ui.inputAddress("Paste recipient address");

  const provider = await createTonClient();
  const pool = new PoolProvider(provider, poolConfig);
  const proof = await pool.pool.proofWithdraw(privateKey, recipient, fee);
  await submitProof(
    (Number(fromNano(poolConfig.value)) * fee) / 1000,
    mimcHash2(privateKey.nullifier, privateKey.nullifier),
    poolConfig.address.toString(),
    pool.pool.buildWithdrawCell(proof).toBoc().toString("base64"),
  );
}

async function submitProof(
  fee: number,
  nullifier_hash: string,
  pool: string,
  transaction: string,
) {
  await axios.post(
    "https://api.tonnel.network/tree/submitProof",
    { fee, nullifier_hash, transaction, pool },
    { headers: { "Content-Type": "application/json" } },
  );
}
