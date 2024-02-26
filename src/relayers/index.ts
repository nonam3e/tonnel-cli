import { Runner } from "../cli/Runner";
import { withdrawTonnel } from "./tonnelRelayers";

export const withdrawRunners: Record<string, Runner> = {
  withdrawTonnel,
};

export const RelayerManagers: { name: string; value: string }[] = [
  {
    name: "Tonnel",
    value: "withdrawTonnel",
  },
];
