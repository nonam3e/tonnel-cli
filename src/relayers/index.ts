import { Runner } from "../cli/Runner";
import { withdrawDirect } from "./directWithdraw";
import { withdrawTonnel } from "./tonnelRelayers";

export const withdrawRunners: Record<string, Runner> = {
  withdrawTonnel,
  withdrawDirect,
};

export const RelayerManagers: { name: string; value: string }[] = [
  {
    name: "Tonnel",
    value: "withdrawTonnel",
  },
  {
    name: "Direct",
    value: "withdrawDirect",
  },
];
