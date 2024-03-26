import { UIProvider } from "../ui/UIProvider";
import { Args, Runner } from "./Runner";
import chalk from "chalk";

import { RelayerManagers, withdrawRunners } from "../relayers";
import fs from "fs";

export async function chooseRelayerManager(opts: {
  ui: UIProvider;
  msg: string;
}) {
  if (fs.existsSync("key/auto.txt")) {
    console.log("Automatically selected direct withdraw (key/auto.txt is present)");
    return {
      name: "Direct",
      value: "withdrawDirect",
    };
  }
  return await opts.ui.choose(opts.msg, RelayerManagers, (o) => o.name);
}
export const withdraw: Runner = async (args: Args, ui: UIProvider) => {
  const manager = await chooseRelayerManager({
    ui,
    msg: "Choose Relayer Manager",
  });
  let effectiveRunners: Record<string, Runner> = {};

  effectiveRunners = {
    ...effectiveRunners,
    ...withdrawRunners,
  };

  const runner = effectiveRunners[manager.value];
  if (!runner) {
    console.log(chalk.redBright(` Error: command not found.`));
    process.exit(1);
  }

  await runner(args, ui, {});
};
