import { Args } from "../cli/Runner";
import {
  createNetworkProvider,
} from "../network/createNetworkProvider";
import { PoolProvider } from "../pools/Pool";
import { UIProvider } from "../ui/UIProvider";
import { readPrivateKey } from "./utils";

export async function withdrawDirect(args: Args, ui: UIProvider) {
  const { privateKey, poolConfig } = await readPrivateKey(ui);
  const recipient = await ui.inputAddress("Paste recipient address");

  const networkProvider = await createNetworkProvider(ui, args);
  const pool = new PoolProvider(networkProvider.api(), poolConfig);
  const proof = await pool.pool.proofWithdraw(privateKey, recipient, 0);
  await pool.pool.sendWithdraw(networkProvider.sender(), proof);
}
