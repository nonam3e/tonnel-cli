import { rbuffer, toBigIntLE } from "./circuit";

export interface PrivateKey {
  secret: bigint;
  nullifier: bigint;
}

export function generatePrivateKey(): PrivateKey {
  const randomBuf = rbuffer(31);
  const randomBuf2 = rbuffer(31);
  const nullifier = toBigIntLE(randomBuf2);
  const secret = toBigIntLE(randomBuf);

  return { nullifier, secret };
}
