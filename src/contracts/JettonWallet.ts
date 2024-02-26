import {
  Address,
  beginCell,
  Cell,
  Contract,
  contractAddress,
  ContractProvider,
  Sender,
  SendMode,
} from "@ton/core";

export class JettonWallet implements Contract {
  constructor(
    readonly address: Address,
    readonly init?: { code: Cell; data: Cell },
  ) {}

  static createFromAddress(address: Address) {
    return new JettonWallet(address);
  }

  async sendTransfer(
    provider: ContractProvider,
    via: Sender,
    opts: {
      value: bigint;
      toAddress: Address;
      queryId: number;
      fwdAmount: bigint;
      jettonAmount: bigint;
      fwdPayload: Cell;
    },
  ) {
    await provider.internal(via, {
      value: opts.value,
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell()
        .storeUint(0xf8a7ea5, 32)
        .storeUint(opts.queryId, 64)
        .storeCoins(opts.jettonAmount)
        .storeAddress(opts.toAddress)
        .storeAddress(via.address)
        .storeUint(0, 1)
        .storeCoins(opts.fwdAmount)
        .storeUint(0, 1)
        .storeRef(opts.fwdPayload)
        .endCell(),
    });
  }

  async getBalance(provider: ContractProvider) {
    try {
      const result = await provider.get("get_wallet_data", []);
      return result.stack.readBigNumber();
    } catch (e) {
      return BigInt(0);
    }
  }
}
