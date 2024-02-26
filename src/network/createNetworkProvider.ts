import { oneOrZeroOf, sleep, getExplorerLink } from "../utils";
import arg from "arg";
import { TonConnectProvider } from "./send/TonConnectProvider";
import {
  Address,
  Cell,
  comment,
  Contract,
  ContractProvider,
  openContract,
  OpenedContract,
  Sender,
  SenderArguments,
  SendMode,
  toNano,
  TupleItem,
} from "@ton/core";
import { TonClient } from "@ton/ton";
import { getHttpEndpoint } from "@orbs-network/ton-access";
import { UIProvider } from "../ui/UIProvider";
import { NetworkProvider } from "./NetworkProvider";
import { SendProvider } from "./send/SendProvider";
import { FSStorage } from "../storage/FSStorage";
import path from "path";
import { TEMP_DIR } from "../paths";
import { Config } from "../config/Config";

export const argSpec = {
  "--mainnet": Boolean,

  "--tonconnect": Boolean,

  "--tonviewer": Boolean,
};

export type Args = arg.Result<typeof argSpec>;

type Network = "mainnet";

type Explorer = "tonviewer";

class SendProviderSender implements Sender {
  #provider: SendProvider;
  readonly address?: Address;

  constructor(provider: SendProvider) {
    this.#provider = provider;
    this.address = provider.address();
  }

  async send(args: SenderArguments): Promise<void> {
    if (
      !(
        args.sendMode === undefined ||
        args.sendMode === SendMode.PAY_GAS_SEPARATELY
      )
    ) {
      throw new Error(
        "Sender does not support `sendMode` other than `PAY_GAS_SEPARATELY`",
      );
    }

    await this.#provider.sendTransaction(
      args.to,
      args.value,
      args.body ?? undefined,
      args.init ?? undefined,
    );
  }
}

class WrappedContractProvider implements ContractProvider {
  #address: Address;
  #provider: ContractProvider;
  #init?: { code?: Cell; data?: Cell };

  constructor(
    address: Address,
    provider: ContractProvider,
    init?: { code?: Cell; data?: Cell },
  ) {
    this.#address = address;
    this.#provider = provider;
    this.#init = init;
  }

  async getState() {
    return await this.#provider.getState();
  }

  async get(name: string, args: TupleItem[]) {
    return await this.#provider.get(name, args);
  }

  async external(message: Cell) {
    return await this.#provider.external(message);
  }

  async internal(
    via: Sender,
    args: {
      value: string | bigint;
      bounce: boolean | undefined | null;
      sendMode?: SendMode;
      body: string | Cell | undefined | null;
    },
  ) {
    const init =
      this.#init && (await this.getState()).state.type !== "active"
        ? this.#init
        : undefined;

    return await via.send({
      to: this.#address,
      value: typeof args.value === "string" ? toNano(args.value) : args.value,
      sendMode: args.sendMode,
      bounce: args.bounce,
      init,
      body: typeof args.body === "string" ? comment(args.body) : args.body,
    });
  }
}

class NetworkProviderImpl implements NetworkProvider {
  #tc: TonClient;
  #sender: Sender;
  #network: Network;
  #explorer: Explorer;
  #ui: UIProvider;

  constructor(
    tc: TonClient,
    sender: Sender,
    network: Network,
    explorer: Explorer,
    ui: UIProvider,
  ) {
    this.#tc = tc;
    this.#sender = sender;
    this.#network = network;
    this.#explorer = explorer;
    this.#ui = ui;
  }

  network(): "mainnet" {
    return this.#network;
  }

  explorer(): "tonviewer" {
    return this.#explorer;
  }

  sender(): Sender {
    return this.#sender;
  }

  api(): TonClient {
    return this.#tc;
  }

  provider(
    address: Address,
    init?: { code?: Cell; data?: Cell },
  ): ContractProvider {
    return new WrappedContractProvider(
      address,
      this.#tc.provider(address, {
        code: init?.code ?? new Cell(),
        data: init?.data ?? new Cell(),
      }),
      init,
    );
  }

  async isContractDeployed(address: Address): Promise<boolean> {
    return (await this.#tc.getContractState(address)).state === "active";
  }

  async waitForDeploy(
    address: Address,
    attempts: number = 10,
    sleepDuration: number = 2000,
  ) {
    if (attempts <= 0) {
      throw new Error("Attempt number must be positive");
    }

    for (let i = 1; i <= attempts; i++) {
      this.#ui.setActionPrompt(
        `Awaiting contract deployment... [Attempt ${i}/${attempts}]`,
      );
      const isDeployed = await this.isContractDeployed(address);
      if (isDeployed) {
        this.#ui.clearActionPrompt();
        this.#ui.write(`Contract deployed at address ${address.toString()}`);
        this.#ui.write(
          `You can view it at ${getExplorerLink(address.toString(), this.#network, this.#explorer)}`,
        );
        return;
      }
      await sleep(sleepDuration);
    }

    this.#ui.clearActionPrompt();
    throw new Error(
      "Contract was not deployed. Check your wallet's transactions",
    );
  }

  /**
   * @deprecated
   *
   * Use your Contract's `sendDeploy` method (or similar) together with `waitForDeploy` instead.
   */
  async deploy(
    contract: Contract,
    value: bigint,
    body?: Cell,
    waitAttempts: number = 10,
  ) {
    const isDeployed = await this.isContractDeployed(contract.address);
    if (isDeployed) {
      throw new Error("Contract is already deployed!");
    }

    if (!contract.init) {
      throw new Error("Contract has no init!");
    }

    await this.#sender.send({
      to: contract.address,
      value,
      body,
      init: contract.init,
    });

    if (waitAttempts <= 0) return;

    await this.waitForDeploy(contract.address, waitAttempts);
  }

  open<T extends Contract>(contract: T): OpenedContract<T> {
    return openContract(contract, (params) =>
      this.provider(params.address, params.init ?? undefined),
    );
  }

  ui(): UIProvider {
    return this.#ui;
  }
}

class NetworkProviderBuilder {
  constructor(
    private args: Args,
    private ui: UIProvider,
    private config?: Config,
    private allowCustom = true,
  ) {}

  async chooseNetwork(): Promise<Network> {
    return "mainnet";
  }

  chooseExplorer(): Explorer {
    return "tonviewer";
  }

  async chooseSendProvider(network: Network): Promise<SendProvider> {
    let deployUsing = oneOrZeroOf({
      tonconnect: this.args["--tonconnect"],
    });

    if (!deployUsing) {
      deployUsing = "tonconnect";
    }

    const storagePath = path.join(TEMP_DIR, network, deployUsing! + ".json");

    let provider: SendProvider;
    switch (deployUsing) {
      case "tonconnect":
        provider = new TonConnectProvider(new FSStorage(storagePath), this.ui);
        break;
      default:
        throw new Error("Unknown deploy option");
    }

    return provider;
  }

  async build(): Promise<NetworkProvider> {
    let network = await this.chooseNetwork();
    const explorer = this.chooseExplorer();

    let tc = new TonClient({
      endpoint: await getHttpEndpoint({ network }),
    });

    const sendProvider = await this.chooseSendProvider(network);

    try {
      await sendProvider.connect();
    } catch (e) {
      console.error("Unable to connect to wallet.");
      process.exit(1);
    } finally {
      this.ui.setActionPrompt("");
    }

    const sender = new SendProviderSender(sendProvider);

    return new NetworkProviderImpl(tc, sender, network, explorer, this.ui);
  }
}

export async function createNetworkProvider(
  ui: UIProvider,
  args: Args,
  config?: Config,
  allowCustom = true,
): Promise<NetworkProvider> {
  return await new NetworkProviderBuilder(
    args,
    ui,
    config,
    allowCustom,
  ).build();
}

export async function createTonClient(network: Network = "mainnet") {
  return new TonClient({
    endpoint: await getHttpEndpoint({ network }),
  });
}