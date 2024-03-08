import { createNetworkProvider } from "../network/createNetworkProvider";
import { UIProvider } from "../ui/UIProvider";
import { Args, Runner, argSpec } from "./Runner";
import chalk from "chalk";
import { fromNano } from "@ton/core";
import { PrivateKey, generatePrivateKey } from "../zk/depositHelpers";
import { PoolProvider } from "../pools/Pool";
import { PoolConfig, PoolTypes } from "../pools/config";
import { GramPools, TonPools, TonnelPools } from "../pools/list";
import { toPercentString } from "../utils";

export function chalkPoolTypes(type: PoolTypes) {
  switch (type) {
    case PoolTypes.TON:
      return chalk.blueBright(type);
    case PoolTypes.TONNEL:
      return chalk.hex("#ce7f33")(type);
    case PoolTypes.GRAM:
      return chalk.gray(type);
  }
}

export async function choosePoolType(opts: {
  ui: UIProvider;
  msg: string;
  hint?: string;
}) {
  return await opts.ui.choose(opts.msg, Object.values(PoolTypes), (o) =>
    chalkPoolTypes(o),
  );
}

export async function choosePool(
  type: PoolTypes,
  opts: {
    ui: UIProvider;
    msg: string;
    hint?: string;
  },
) {
  let options: PoolConfig[];
  switch (type) {
    case PoolTypes.TON:
      options = TonPools;
      break;
    case PoolTypes.TONNEL:
      options = TonnelPools;
      break;
    case PoolTypes.GRAM:
      options = GramPools;
      break;
  }
  return await opts.ui.choose(
    opts.msg,
    options,
    (o) =>
      `${chalkPoolTypes(o.coinType)} ${fromNano(o.value)} Fee: ${fromNano((o.value * BigInt(o.fee)) / 1000n)} (${toPercentString(o.fee)})`,
  );
}

export const printSecretKey = (pool: PoolConfig, privateKey: PrivateKey) => {
  console.log(chalk.bgRedBright("SAVE YOUR SECRET KEY!!!"));
  console.log(
    chalk.red(
      `${pool.coinType}_${fromNano(pool.value)}_${privateKey.secret}_${privateKey.nullifier}`,
    ),
  );
};

export const deposit: Runner = async (args: Args, ui: UIProvider) => {
  const clearLastLine = () => {
    for (let i = 0; i < 4; i++) {
      process.stdout.moveCursor(0, -1); // up one line
      process.stdout.clearLine(1); // from cursor to end
    }
  };
  const type = await choosePoolType({ ui, msg: "SELECT POOL TYPE" });
  const poolConfig = await choosePool(type, { ui, msg: "SELECT POOL" });
  // console.log(pool)

  const privateKey = generatePrivateKey();
  printSecretKey(poolConfig, privateKey);
  const saved = await ui.prompt(chalk.yellow("I saved my Secret Key"));
  if (!saved) {
    console.log(chalk.red("Aborting"));
    process.exit(0);
  }
  clearLastLine();

  const networkProvider = await createNetworkProvider(ui, args);
  const pool = new PoolProvider(networkProvider.api(), poolConfig);
  await pool.pool.proofSendDeposit(networkProvider.sender(), privateKey);
};
