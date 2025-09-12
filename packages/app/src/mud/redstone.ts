import {
  redstone as redstoneChain,
  type MUDChain,
} from "@latticexyz/common/chains";

export const redstone = {
  ...redstoneChain,
  rpcUrls: {
    ...redstoneChain.rpcUrls,
    wiresaw: {
      http: ["https://wiresaw.redstonechain.com"],
      webSocket: ["wss://wiresaw.redstonechain.com"],
    },
  },
  indexerUrl: "https://indexer.alpha.dustproject.org",
} satisfies MUDChain;
