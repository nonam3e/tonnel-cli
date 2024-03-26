import { Args } from "../cli/Runner";
import { createNetworkProvider } from "../network/createNetworkProvider";
import { PoolProvider } from "../pools/Pool";
import { UIProvider } from "../ui/UIProvider";
import { readPrivateKey } from "./utils";
import {Address} from "@ton/core";
import fs from "fs";

export async function withdrawDirect(args: Args, ui: UIProvider) {
  const { privateKey, poolConfig, key_file } = await readPrivateKey(ui);
  const recipient = fs.existsSync("key/address.txt") ?
    Address.parse(fs.readFileSync("key/address.txt", "utf-8").trim()) :
    await ui.inputAddress("Paste recipient address");

  const networkProvider = await createNetworkProvider(ui, args);
  const pool = new PoolProvider(networkProvider.api(), poolConfig);
  const proof = await pool.pool.proofWithdraw(privateKey, recipient, 0);
  await pool.pool.sendWithdraw(networkProvider.sender(), proof);

  if (key_file != "") {
    fs.unlinkSync("key/" + key_file);
    console.log("Key file " + key_file + " deleted");
  }
}
