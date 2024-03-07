import { Address, toNano } from "@ton/core";
import { PoolConfigJetton, PoolConfigNative, PoolTypes } from "./config";

export const TonPools: PoolConfigNative[] = [
  {
    type: "native",
    coinType: PoolTypes.TON,
    value: toNano(5),
    fee: 30,
    address: Address.parse("EQBemaU1eAM-fJP7tSniJGEmltPjitgGnlrP6UaXI7nzmEuV"),
  },
  {
    type: "native",
    coinType: PoolTypes.TON,
    value: toNano(50),
    fee: 7,
    address: Address.parse("EQBZ0-2-isPEN_lIyg9eqXO_RFWrl_PWIJq5K6SVcUwne23W"),
  },
  {
    type: "native",
    coinType: PoolTypes.TON,
    value: toNano(250),
    fee: 5,
    address: Address.parse("EQBYpQiQMwGBMzhOlJ52e4yXmcKCB_5uTTJ7bVSGqr-8YANi"),
  },
  {
    type: "native",
    coinType: PoolTypes.TON,
    value: toNano(1000),
    fee: 3,
    address: Address.parse("EQB-s4WzIgGP9U6DNlFH_kSn0JuxhBCBXr_rKz2ztEiozTto"),
  },
];

export const TonnelPools: PoolConfigJetton[] = [
  {
    type: "jetton",
    coinType: PoolTypes.TONNEL,
    value: toNano(66),
    fee: 4,
    address: Address.parse("EQCNoApBzMacKKdTwcvi1iOx78e98bTSaN1Gx_nnmd3Ek5Yn"),
    jetton: Address.parse("EQDNDv54v_TEU5t26rFykylsdPQsv5nsSZaH_v7JSJPtMitv"),
  },
  {
    type: "jetton",
    coinType: PoolTypes.TONNEL,
    value: toNano(200),
    fee: 4,
    address: Address.parse("EQDzAhS3Ev8cxEBJ96MIqPjxyD_k0L3enzDWnQ3Z-4tUK1h5"),
    jetton: Address.parse("EQDNDv54v_TEU5t26rFykylsdPQsv5nsSZaH_v7JSJPtMitv"),
  },
  {
    type: "jetton",
    coinType: PoolTypes.TONNEL,
    value: toNano(1000),
    fee: 5,
    address: Address.parse("EQAgoyECSzCIFTFkMIvDLgdUE3D9RxGfYQQGfxy3lBBc_Ke_"),
    jetton: Address.parse("EQDNDv54v_TEU5t26rFykylsdPQsv5nsSZaH_v7JSJPtMitv"),
  },
  {
    type: "jetton",
    coinType: PoolTypes.TONNEL,
    value: toNano(10000),
    fee: 2,
    address: Address.parse("EQDTs-yjPLn7XzaRRq8pjp7H8Nw4y_OJ51Bk2dcrPlIYgwtV"),
    jetton: Address.parse("EQDNDv54v_TEU5t26rFykylsdPQsv5nsSZaH_v7JSJPtMitv"),
  },
];

export const GramPools: PoolConfigJetton[] = [
  {
    type: "jetton",
    coinType: PoolTypes.GRAM,
    value: toNano(500000),
    fee: 6,
    address: Address.parse("EQD7U_FPYRFTGgiqrpiKh8_giyrIQHZtokUKvz2EmWvlmViC"),
    jetton: Address.parse("EQC47093oX5Xhb0xuk2lCr2RhS8rj-vul61u4W2UH5ORmG_O"),
  },
];
