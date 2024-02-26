import { Address, Cell } from "@ton/core";
import { UIProvider } from "./ui/UIProvider";

export const tonDeepLink = (
  address: Address,
  amount: bigint,
  body?: Cell,
  stateInit?: Cell,
) =>
  `ton://transfer/${address.toString({
    urlSafe: true,
    bounceable: true,
  })}?amount=${amount.toString()}${body ? "&bin=" + body.toBoc().toString("base64url") : ""}${
    stateInit ? "&init=" + stateInit.toBoc().toString("base64url") : ""
  }`;

export function sleep(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function oneOrZeroOf<T extends { [k: string]: boolean | undefined }>(
  options: T,
): keyof T | undefined {
  let opt: keyof T | undefined = undefined;
  for (const k in options) {
    if (options[k]) {
      if (opt === undefined) {
        opt = k;
      } else {
        throw new Error(
          `Please pick only one of the options: ${Object.keys(options).join(", ")}`,
        );
      }
    }
  }
  return opt;
}

export async function selectOption(
  options: { name: string; value: string }[],
  opts: {
    ui: UIProvider;
    msg: string;
    hint?: string;
  },
) {
  if (opts.hint) {
    const found = options.find((o) => o.value === opts.hint);
    if (found === undefined) {
      throw new Error(`Could not find option '${opts.hint}'`);
    }
    return found;
  } else {
    return await opts.ui.choose(opts.msg, options, (o) => o.name);
  }
}

export async function selectFile(
  files: { name: string; path: string }[],
  opts: {
    ui: UIProvider;
    hint?: string;
    import?: boolean;
  },
) {
  let selected: { name: string; path: string };

  if (opts.hint) {
    const found = files.find(
      (f) => f.name.toLowerCase() === opts.hint?.toLowerCase(),
    );
    if (found === undefined) {
      throw new Error(`Could not find file with name '${opts.hint}'`);
    }
    selected = found;
    opts.ui.write(`Using file: ${selected.name}`);
  } else {
    if (files.length === 1) {
      selected = files[0];
      opts.ui.write(`Using file: ${selected.name}`);
    } else {
      selected = await opts.ui.choose(
        "Choose file to use",
        files,
        (f) => f.name,
      );
    }
  }

  return {
    ...selected,
    module: opts.import !== false ? await import(selected.path) : undefined,
  };
}

export function getExplorerLink(
  address: string,
  network: string,
  explorer: string,
) {
  const networkPrefix = network === "testnet" ? "testnet." : "";

  switch (explorer) {
    case "tonscan":
      return `https://${networkPrefix}tonscan.org/address/${address}`;

    case "tonviewer":
      return `https://${networkPrefix}tonviewer.com/${address}`;

    case "toncx":
      return `https://${networkPrefix}ton.cx/address/${address}`;

    case "dton":
      return `https://${networkPrefix}dton.io/a/${address}`;

    default:
      return `https://${networkPrefix}tonscan.org/address/${address}`;
  }
}

export function toPercentString(input: number | bigint) {
  return `${(BigInt(input) / 10n).toString()}.${(BigInt(input) % 10n).toString()}%`;
}
