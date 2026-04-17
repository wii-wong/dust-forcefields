import { type MUDChain } from "@latticexyz/common/chains";

export const dustChain = {
  id: 55378,
  name: "DUST Mainnet",
  nativeCurrency: {
    decimals: 18,
    name: "Ether",
    symbol: "ETH",
  },
  rpcUrls: {
    default: {
      http: ["https://rpc.dustproject.org"],
      webSocket: ["wss://rpc.dustproject.org"],
    },
  },
  blockExplorers: {
    default: {
      name: "DUST Explorer",
      url: "https://explorer.dustproject.org",
    },
  },
  indexerUrl: "https://indexer.alpha.dustproject.org",
} satisfies MUDChain;
