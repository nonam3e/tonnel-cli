import chalk from "chalk";
import { UIProvider } from "../ui/UIProvider";
import { selectOption } from "../utils";
import { Runner, Args, argSpec } from "./Runner";
import { TEMP_DIR } from "../paths";
import path from "path";
import { createNetworkProvider } from "../network/createNetworkProvider";
import { Address, fromNano } from "@ton/core";
import { TonClient } from "@ton/ton";



export const WalletMenuOptions = [{
    name: "Connect to the new Wallet (Deletes existing connection)",
    value: "reconnect",
}, {
    name: "Delete existing connection",
    value: "deleteWallet"
}, {
    name: "Show current Wallet",
    value: "showWallet"
}
]

export const reconnect: Runner = async (args: Args, ui: UIProvider) => {
    await deleteWallet(args, ui, {})
    await createNetworkProvider(ui, args);
}
export const deleteWallet: Runner = async (args: Args, ui: UIProvider) => {
    var fs = require('fs');
    try {
        fs.unlinkSync(path.join(TEMP_DIR, "mainnet", "tonconnect" + ".json"))
    } catch (e) {}
}
export const showWallet: Runner = async (args: Args, ui: UIProvider) => {
    let provider = await createNetworkProvider(ui, args);
    console.log(await balanceInfo(provider.api(), provider.sender().address!!))
}

const runners = {
    reconnect,
    deleteWallet,
    showWallet
}


async function balanceInfo(provider: TonClient, addr: Address): Promise<string> {
    return `${fromNano(await provider.getBalance(addr))} TON`;
}


export const wallet: Runner = async (args: Args, ui: UIProvider) => {
    let res = (await selectOption(WalletMenuOptions, {
          ui,
          msg: "Wallet menu",
        })).value


    let effectiveRunners: Record<string, Runner> = {};

    effectiveRunners = {
        ...effectiveRunners,
        ...runners,
    };

    const runner = effectiveRunners[res];
    if (!runner) {
        console.log(chalk.redBright(` Error: command not found.`));
        process.exit(1);
    }

    await runner(args, ui, {});
}