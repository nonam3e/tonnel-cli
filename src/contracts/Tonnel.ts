import {
  Address,
  beginCell,
  Cell,
  Contract,
  ContractProvider,
  DictionaryValue,
  Sender,
  SendMode,
  storeTransaction,
  Transaction,
  TransactionComputeVm,
  TransactionDescriptionGeneric,
} from "@ton/core";
import { TupleItemSlice } from "@ton/core/dist/tuple/tuple";
import { TonClient } from "@ton/ton";
import { MerkleTree } from "fixed-merkle-tree";
import { mimcHash2 } from "../zk/circuit";

export const Opcodes = {
  deposit: 0x888,
  continue: 0x00,
  withdraw: 0x777,
  changeConfig: 0x999,
  stuck_remove: 0x111,
};

export const ERRORS = {
  verify_failed_root: 106,
  verify_failed_double_spend: 107,
  unknown_op: 101,
  access_denied: 102,
  fund: 103,
  verify_failed: 104,
  verify_failed_fee: 105,
};

export const CellRef: DictionaryValue<Cell> = {
  serialize: (src, builder) => {
    builder.storeSlice(src.beginParse());
  },
  parse: (src) => src.asCell(),
};

export class Tonnel implements Contract {
  constructor(
    readonly address: Address,
    readonly init?: { code: Cell; data: Cell },
  ) {}

  static createFromAddress(address: Address) {
    return new Tonnel(address);
  }

  async sendDeposit(
    provider: ContractProvider,
    via: Sender,
    opts: {
      value: bigint;
      queryID?: number;
      commitment: bigint;
      newRoot: bigint;
      oldRoot: bigint;
      payload: Cell;
    },
  ) {
    await provider.internal(via, {
      value: opts.value,
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell()
        .storeUint(Opcodes.deposit, 32)
        .storeUint(opts.queryID ?? 0, 64)
        .storeRef(
          beginCell()
            .storeUint(opts.commitment, 256)
            .storeUint(opts.newRoot, 256)
            .storeUint(opts.oldRoot, 256)
            .storeRef(opts.payload)
            .endCell(),
        )
        .endCell(),
    });
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
    return  beginCell()
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
    const inputCell = Tonnel.buildWithdrawCell(opts)
    const check = await this.getCheckVerify(provider, inputCell);
    console.log(check);
    if (check !== 1) {
      throw new Error(`Withdraw check failed: ${check}`);
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
  async getRootKnown(provider: ContractProvider, root: bigint) {
    const result = await provider.get("get_root_known", [
      { type: "int", value: root },
    ]);
    return result.stack.readNumber();
  }
  async getCheckVerify(provider: ContractProvider, cell: Cell) {
    const result = await provider.get("check_verify", [
      { type: "slice", cell: cell } as TupleItemSlice,
    ]);
    console.log(result.stack);
    return result.stack.readNumber();
  }

  async getMinStuck(provider: ContractProvider) {
    const result = await provider.get("get_min_stuck", []);
    console.log(result.stack);
    return result.stack.readNumber();
  }

  async getBalance(provider: ContractProvider) {
    const result = await provider.getState();
    return result.balance;
  }
  

}
