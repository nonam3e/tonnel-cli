import arg from "arg";
import chalk from "chalk";
import { UIProvider } from "../ui/UIProvider";
import { selectOption } from "../utils";
import { Runner, Args, argSpec } from "./Runner";
import { deposit } from "./deposit";
import { wallet } from "./wallet";
import { withdraw } from "./withdraw";

export const exit: Runner = async (args: Args, ui: UIProvider) => {
  ui.write("Have a nice day");
  process.exit(0);
};

const runners: Record<string, Runner> = {
  deposit,
  withdraw,
  wallet,
  exit,
};

export const MainMenuTemplate: { name: string; value: string }[] = [
  {
    name: "Deposit",
    value: "deposit",
  },
  {
    name: "Withdraw",
    value: "withdraw",
  },
  {
    name: "Manage Wallet",
    value: "wallet",
  },
  {
    name: "Exit",
    value: "exit",
  },
];

export async function startup(ui: UIProvider) {
  while (true) {
    const args = arg(argSpec, {
      permissive: true,
    });

    if (args._.length === 0) {
      args._.push(
        (
          await selectOption(MainMenuTemplate, {
            ui,
            msg: "What do you want to do?",
          })
        ).value,
      );
    }

    let effectiveRunners: Record<string, Runner> = {};

    effectiveRunners = {
      ...effectiveRunners,
      ...runners,
    };

    const runner = effectiveRunners[args._[0]];
    if (!runner) {
      console.log(chalk.redBright(` Error: command not found.`));
      process.exit(1);
    }

    await runner(args, ui, {});
  }
}
