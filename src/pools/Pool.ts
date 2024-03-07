import {
  Address,
  OpenedContract,
  Sender,
  Transaction,
  TransactionComputeVm,
  TransactionDescriptionGeneric,
  beginCell,
  fromNano,
  storeTransaction,
  toNano,
} from "@ton/core";
import MerkleTree from "fixed-merkle-tree";
import { Opcodes, Tonnel } from "../contracts/Tonnel";
import { TonnelJetton } from "../contracts/TonnelJetton";
import { JettonMaster, TonClient } from "@ton/ton";
import chalk from "chalk";
import { PrivateKey } from "../zk/depositHelpers";
import { groth16, mimcHash2, parseG1Func, parseG2Func } from "../zk/circuit";
import {
  CACHE_DIR,
  wasmPath,
  wasmPathInsert,
  zkeyPath,
  zkeyPathInsert,
} from "../paths";
import { Groth16Proof } from "snarkjs";
import { JettonWallet } from "../contracts/JettonWallet";
import { PoolConfig, PoolConfigNative, PoolConfigJetton } from "./config";
import { FSStorage } from "../storage/FSStorage";
import path from "path";

export interface DepositProof {
  commitment: bigint;
  newRoot: bigint;
  oldRoot: bigint;
  proof: Groth16Proof;
}

export interface WithdrawProof {
  root: bigint;
  nullifierHash: bigint;
  recipient: Address;
  fee: bigint;
  proof: Groth16Proof;
}

export abstract class Pool {
  config: PoolConfig;
  provider: TonClient;
  abstract tonnel: OpenedContract<Tonnel | TonnelJetton>;
  constructor(provider: TonClient, conf: PoolConfig) {
    this.provider = provider;
    this.config = conf;
  }
  async getCache(): Promise<{ to_lt?: string; leafs: string[] }> {
    const storage = new FSStorage(
      path.join(CACHE_DIR, this.config.address.toString() + ".json"),
    );
    return {
      to_lt: (await storage.getItem("to_lt")) ?? undefined,
      leafs: (await storage.getArray("leafs")) ?? [],
    };
  }
  async setCache(to_lt: string | undefined, leafs: string[]) {
    const storage = new FSStorage(
      path.join(CACHE_DIR, this.config.address.toString() + ".json"),
    );
    await storage.setItem("to_lt", to_lt ?? null);
    await storage.setItem("leafs", leafs);
  }
  async buildTree(): Promise<MerkleTree> {
    let { to_lt, leafs } = await this.getCache();
    let transactions = await this.getAllTransactions(to_lt);
    if (transactions.length > 0) {
      to_lt = transactions[0].lt.toString();
      leafs = leafs.concat(this.filterLeafs(transactions));
      await this.setCache(to_lt, leafs);
    }
    return new MerkleTree(20, leafs, {
      hashFunction: mimcHash2,
      zeroElement:
        "21663839004416932945382355908790599225266501822907911457504978515578255421292",
    });
  }
  abstract balanceInfo(via: Sender): Promise<string>;
  abstract sendDeposit(via: Sender, opts: DepositProof): Promise<void>;
  abstract filterLeafs(transactions: Transaction[]): string[];
  abstract isEnoughTokens(via: Sender): Promise<boolean>;
  async buildTreeWrapped() {
    process.stdout.write(chalk.green("Building a tree ... "));
    let time = Date.now();
    const tree = await this.buildTree();
    console.log(
      chalk.green(`Completed (${(Date.now() - time) / 1000} seconds)`),
    );
    const tonnel_root = await this.tonnel.getLastRoot();
    if (tree.root != tonnel_root?.toString()) {
      throw new Error("Tree roots don't match");
    }
    console.log(chalk.green("Tree roots match"));
    return tree;
  }
  async calculateDepositProofWrapped(tree: MerkleTree, secretKey: PrivateKey) {
    process.stdout.write(chalk.green("Starting proof computation ... "));
    const time = Date.now();
    const proof = await this.calculateDepositProof(tree, secretKey);
    console.log(
      chalk.green(`Completed (${(Date.now() - time) / 1000} seconds)`),
    );
    return proof;
  }
  async calculateWithdrawProofWrapped(
    tree: MerkleTree,
    secretKey: PrivateKey,
    recipient: Address,
    fee: number,
  ) {
    process.stdout.write(chalk.green("Starting proof computation ... "));
    const time = Date.now();
    const proof = await this.calculateWithdrawProof(
      tree,
      secretKey,
      recipient,
      fee,
    );
    console.log(
      chalk.green(`Completed (${(Date.now() - time) / 1000} seconds)`),
    );
    return proof;
  }
  async sendWithdraw(via: Sender, opts: WithdrawProof): Promise<void> {
    const B_x = opts.proof.pi_b[0].map((num: string) => BigInt(num));
    const B_y = opts.proof.pi_b[1].map((num: string) => BigInt(num));

    await this.tonnel.sendWithdraw(via, {
      value: toNano("0.3".toString()),
      root: opts.root,
      nullifierHash: opts.nullifierHash,
      recipient: opts.recipient,
      fee: opts.fee,
      a: parseG1Func(
        opts.proof.pi_a.slice(0, 2).map((num: string) => BigInt(num)),
      ),
      b: parseG2Func(B_x[0], B_x[1], B_y),
      c: parseG1Func(
        opts.proof.pi_c.slice(0, 2).map((num: string) => BigInt(num)),
      ),
    });
  }
  async proofSendDeposit(via: Sender, secretKey: PrivateKey) {
    console.log(await this.balanceInfo(via));
    if (!(await this.isEnoughTokens(via))) {
      console.log(chalk.red("Not enough tokens to continue"));
      process.exit(0);
    }

    await this.sendDeposit(
      via,
      await this.calculateDepositProofWrapped(
        await this.buildTreeWrapped(),
        secretKey,
      ),
    );
  }
  async proofWithdraw(secretKey: PrivateKey, recipient: Address, fee: number) {
    return await this.calculateWithdrawProofWrapped(
      await this.buildTreeWrapped(),
      secretKey,
      recipient,
      fee,
    );
  }
  buildWithdrawCell(opts: WithdrawProof) {
    const B_x = opts.proof.pi_b[0].map((num: string) => BigInt(num));
    const B_y = opts.proof.pi_b[1].map((num: string) => BigInt(num));
    return Tonnel.buildWithdrawCell({
      root: opts.root,
      nullifierHash: opts.nullifierHash,
      recipient: opts.recipient,
      fee: opts.fee,
      a: parseG1Func(
        opts.proof.pi_a.slice(0, 2).map((num: string) => BigInt(num)),
      ),
      b: parseG2Func(B_x[0], B_x[1], B_y),
      c: parseG1Func(
        opts.proof.pi_c.slice(0, 2).map((num: string) => BigInt(num)),
      ),
    });
  }
  async getAllTransactions(to_lt?: string) {
    const limit = 100;
    let transactions: Transaction[] = await this.provider.getTransactions(
      this.tonnel.address,
      { limit, to_lt, inclusive: false },
    );
    if (transactions.length == 0) {
      return [];
    }
    let last = transactions[transactions.length - 1].lt;
    let prev_length = transactions.length;
    do {
      last = transactions[transactions.length - 1].lt;
      let hash = beginCell()
        .store(storeTransaction(transactions[transactions.length - 1]))
        .endCell()
        .hash();
      prev_length = transactions.length;
      transactions = transactions.concat(
        await this.provider.getTransactions(this.tonnel.address, {
          lt: last.toString(),
          hash: hash.toString("base64"),
          limit,
          to_lt,
          inclusive: false,
        }),
      );
    } while (
      last != transactions[transactions.length - 1].lt &&
      transactions.length - prev_length == limit
    );

    return transactions;
  }
  async calculateWithdrawProof(
    tree: MerkleTree,
    secretKey: PrivateKey,
    recipient: Address,
    fee: number,
  ): Promise<WithdrawProof> {
    const commitment = mimcHash2(secretKey.secret, secretKey.nullifier);
    let cell_recipient_address = beginCell().storeAddress(recipient).endCell();
    const merkleProof = tree.proof(commitment);
    const input = {
      root: tree.root,
      secret: secretKey.secret,
      nullifier: secretKey.nullifier,
      nullifierHash: mimcHash2(
        secretKey.nullifier.toString(),
        secretKey.nullifier.toString(),
      ),
      fee,
      recipient: cell_recipient_address.beginParse().loadUintBig(256),

      pathElements: merkleProof.pathElements,
      pathIndices: merkleProof.pathIndices,
    };
    let { proof, publicSignals } = await groth16.fullProve(
      input,
      wasmPath,
      zkeyPath,
    );
    return {
      root: BigInt(publicSignals[0]),
      nullifierHash: BigInt(publicSignals[1]),
      fee: BigInt(publicSignals[3]),
      recipient,
      proof,
    };
  }
  async calculateDepositProof(
    tree: MerkleTree,
    secretKey: PrivateKey,
  ): Promise<DepositProof> {
    const commitment = mimcHash2(secretKey.secret, secretKey.nullifier);

    const old_root = tree.root;
    tree.insert(commitment);
    const root = tree.root;
    const { pathElements, pathIndices } = tree.path(tree.elements.length - 1);

    let input = {
      oldRoot: old_root,
      newRoot: root,
      leaf: commitment,
      pathIndices: tree.elements.length - 1,
      pathElements: pathElements,
    };
    let { proof, publicSignals } = await groth16.fullProve(
      input,
      wasmPathInsert,
      zkeyPathInsert,
    );
    return {
      commitment,
      newRoot: BigInt(root),
      oldRoot: BigInt(old_root),
      proof,
    };
  }
}

class TonPool extends Pool {
  readonly deposit_fee = toNano("0.2");
  readonly withdraw_fee = toNano("0.3");
  tonnel: OpenedContract<Tonnel>;
  constructor(provider: TonClient, conf: PoolConfigNative) {
    super(provider, conf);
    this.tonnel = provider.open(Tonnel.createFromAddress(conf.address));
  }
  async sendDeposit(via: Sender, opts: DepositProof): Promise<void> {
    let B_x = opts.proof.pi_b[0].map((num: string) => BigInt(num));
    let B_y = opts.proof.pi_b[1].map((num: string) => BigInt(num));
    await this.tonnel.sendDeposit(via, {
      value:
        this.deposit_fee +
        (this.config.value * (1000n + BigInt(this.config.fee))) / 1000n,
      commitment: opts.commitment,
      newRoot: opts.newRoot,
      oldRoot: opts.oldRoot,
      payload: beginCell()
        .storeRef(
          parseG1Func(
            opts.proof.pi_a.slice(0, 2).map((num: string) => BigInt(num)),
          ),
        )
        .storeRef(parseG2Func(B_x[0], B_x[1], B_y))
        .storeRef(
          parseG1Func(
            opts.proof.pi_c.slice(0, 2).map((num: string) => BigInt(num)),
          ),
        )
        .endCell(),
    });
  }

  async isEnoughTokens(via: Sender): Promise<boolean> {
    return (
      (await this.provider.getBalance(via.address!!)) >
      this.deposit_fee +
        (this.config.value * (1000n + BigInt(this.config.fee))) / 1000n
    );
  }
  async balanceInfo(via: Sender): Promise<string> {
    return `${fromNano(await this.provider.getBalance(via.address!!))} TON`;
  }
  filterLeafs(transactions: Transaction[]) {
    return transactions
      .filter((tr) => {
        try {
          return (
            (tr.inMessage?.body.asSlice().loadUint(32) == Opcodes.deposit ||
              tr.inMessage?.body.asSlice().loadUint(32) ==
                Opcodes.stuck_remove) &&
            (
              (tr.description as TransactionDescriptionGeneric)
                .computePhase as TransactionComputeVm
            ).exitCode == 0 &&
            tr.outMessages
              .values()
              .find((mes) => mes.info.type == "external-out")!!
          );
        } catch (error) {
          return false;
        }
      })
      .reverse()
      .map((t) =>
        t.outMessages
          .values()
          .find((mes) => mes.info.type == "external-out")!!
          .body.asSlice()
          .skip(8)
          .loadUintBig(256)
          .toString(),
      );
  }
}

class JettonPool extends Pool {
  readonly deposit_fee = toNano("0.2");
  readonly withdraw_fee = toNano("0.3");
  readonly jetton_transfer_price = toNano("0.05");
  tonnel: OpenedContract<TonnelJetton>;
  jettonRoot: OpenedContract<JettonMaster>;
  constructor(provider: TonClient, conf: PoolConfigJetton) {
    super(provider, conf);
    this.tonnel = provider.open(TonnelJetton.createFromAddress(conf.address));
    this.jettonRoot = provider.open(JettonMaster.create(conf.jetton));
  }
  async isEnoughTokens(via: Sender): Promise<boolean> {
    let jettonWallet = this.provider.open(
      JettonWallet.createFromAddress(
        await this.jettonRoot.getWalletAddress(via.address!!),
      ),
    );
    return (
      (await jettonWallet.getBalance()) >
        (this.config.value * (1000n + BigInt(this.config.fee))) / 1000n &&
      (await this.provider.getBalance(via.address!!)) >
        this.deposit_fee + this.jetton_transfer_price
    );
  }

  async balanceInfo(via: Sender): Promise<string> {
    let jettonWallet = this.provider.open(
      JettonWallet.createFromAddress(
        await this.jettonRoot.getWalletAddress(via.address!!),
      ),
    );
    return `${fromNano(await this.provider.getBalance(via.address!!))} TON    ${fromNano(await jettonWallet.getBalance())} TONNEL`;
  }

  async sendDeposit(via: Sender, opts: DepositProof): Promise<void> {
    let B_x = opts.proof.pi_b[0].map((num: string) => BigInt(num));
    let B_y = opts.proof.pi_b[1].map((num: string) => BigInt(num));

    let jettonWallet = this.provider.open(
      JettonWallet.createFromAddress(
        await this.jettonRoot.getWalletAddress(via.address!!),
      ),
    );

    const payload = beginCell()
      .storeRef(
        parseG1Func(
          opts.proof.pi_a.slice(0, 2).map((num: string) => BigInt(num)),
        ),
      )
      .storeRef(parseG2Func(B_x[0], B_x[1], B_y))
      .storeRef(
        parseG1Func(
          opts.proof.pi_c.slice(0, 2).map((num: string) => BigInt(num)),
        ),
      )
      .endCell();

    const fwdPayload = beginCell()
      .storeUint(opts.commitment, 256)
      .storeUint(opts.newRoot, 256)
      .storeUint(opts.oldRoot, 256)
      .storeRef(payload)
      .endCell();

    await jettonWallet.sendTransfer(via, {
      value: this.deposit_fee + this.jetton_transfer_price,
      toAddress: this.tonnel.address,
      queryId: Date.now(),
      fwdAmount: this.deposit_fee,
      jettonAmount:
        (this.config.value * (1000n + BigInt(this.config.fee))) / 1000n,
      fwdPayload,
    });
  }
  filterLeafs(transactions: Transaction[]) {
    return transactions
      .filter((tr) => {
        try {
          return (
            (tr.inMessage?.body.asSlice().loadUint(32) == 0x7362d09c ||
              tr.inMessage?.body.asSlice().loadUint(32) ==
                Opcodes.stuck_remove) &&
            (
              (tr.description as TransactionDescriptionGeneric)
                .computePhase as TransactionComputeVm
            ).exitCode == 0 &&
            tr.outMessages
              .values()
              .find((mes) => mes.info.type == "external-out")!!
          );
        } catch (error) {
          return false;
        }
      })
      .reverse()
      .map((t) =>
        t.outMessages
          .values()
          .find((mes) => mes.info.type == "external-out")!!
          .body.asSlice()
          .skip(8)
          .loadUintBig(256)
          .toString(),
      );
  }
}

export class PoolProvider {
  pool: TonPool | JettonPool;
  constructor(provider: TonClient, conf: PoolConfig) {
    switch (conf.type) {
      case "native":
        this.pool = new TonPool(provider, conf);
        break;
      case "jetton":
        this.pool = new JettonPool(provider, conf);
        break;
      default:
        throw new Error("Unknown PoolType");
    }
  }
}
