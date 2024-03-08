import {
  Address,
  beginCell,
  Cell,
  Contract,
  ContractProvider,
  Sender,
  SendMode,
  toNano,
} from "@ton/core";
import { TupleItemSlice } from "@ton/core/dist/tuple/tuple";

export const Opcodes = {
  deposit: 0x888,
  continue: 0x00,
  withdraw: 0x777,
  changeConfig: 0x999,
  claimFee: 0x222,
  stuck_remove: 0x111,
};

export class TonnelJetton implements Contract {
  constructor(
    readonly address: Address,
    readonly init?: { code: Cell; data: Cell },
  ) {}

  static createFromAddress(address: Address) {
    return new TonnelJetton(address);
  }

  static buildWithdrawCell(opts: {
    queryID?: number;
    a: Cell;
    b: Cell;
    c: Cell;
    root: bigint;
    nullifierHash: bigint;
    recipient: Address;
    fee: bigint;
  }) {
    return beginCell()
      .storeUint(Opcodes.withdraw, 32)
      .storeUint(opts.queryID ?? 0, 64)
      .storeRef(
        beginCell()
          .storeUint(opts.root, 256)
          .storeUint(opts.nullifierHash, 256)
          .storeUint(opts.fee, 10)
          .storeRef(beginCell().storeAddress(opts.recipient).endCell())
          .storeRef(opts.a)
          .storeRef(opts.b)
          .storeRef(opts.c)
          .endCell(),
      )
      .endCell();
  }

  async sendWithdraw(
    provider: ContractProvider,
    via: Sender,
    opts: {
      value: bigint;
      queryID?: number;
      a: Cell;
      b: Cell;
      c: Cell;
      root: bigint;
      nullifierHash: bigint;
      recipient: Address;
      fee: bigint;
    },
  ) {
    const inputCell = TonnelJetton.buildWithdrawCell(opts);
    const check = await this.getCheckVerify(provider, inputCell);
    if (check !== 1) {
      throw new Error(`Withdraw check failed`);
    }
    await provider.internal(via, {
      value: opts.value,
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: inputCell,
    });
  }
  async getLastRoot(provider: ContractProvider) {
    const result = await provider.get("get_last_root", []);
    return result.stack.readBigNumberOpt();
  }

  async getBalance(provider: ContractProvider) {
    const result = await provider.getState();
    return result.balance;
  }

  async getCheckVerify(provider: ContractProvider, cell: Cell) {
    try {
      const result = await provider.get("check_verify", [
        { type: "slice", cell: cell } as TupleItemSlice,
      ]);
      console.log(result.stack);
      return result.stack.readNumber();
    } catch (e) {
      return 0;
    }
  }

  async sendChangeConfig(
    provider: ContractProvider,
    via: Sender,
    opts: {
      value: bigint;
      queryID?: number;
      new_fee_per_thousand: number;
      new_tonnel_mint_amount_deposit: number;
      new_tonnel_mint_amount_relayer: number;
      deposit_fee: string;
    },
  ) {
    await provider.internal(via, {
      value: opts.value,
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell()
        .storeUint(Opcodes.changeConfig, 32)
        .storeUint(opts.queryID ?? 0, 64)
        .storeAddress(via.address)
        .storeUint(opts.new_fee_per_thousand, 16)
        .storeUint(opts.new_tonnel_mint_amount_deposit, 32)
        .storeUint(opts.new_tonnel_mint_amount_relayer, 32)
        .storeCoins(toNano(opts.deposit_fee))
        .endCell(),
    });
  }

  async getRootKnown(provider: ContractProvider, root: bigint) {
    const result = await provider.get("get_root_known", [
      { type: "int", value: root },
    ]);
    return result.stack.readNumber();
  }
  async getMinStuck(provider: ContractProvider) {
    const result = await provider.get("get_min_stuck", []);
    console.log(result.stack);
    return result.stack.readBigNumber();
  }
}
