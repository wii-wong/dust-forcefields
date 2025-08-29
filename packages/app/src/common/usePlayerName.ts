import { useRecord } from "@latticexyz/stash/react";
import { getAddress, hexToString, zeroHash, type Address } from "viem";
import { stash, tables } from "../mud/stash";

export function usePlayerName(player: Address | undefined = zeroHash) {
  const playerName = useRecord({
    stash,
    table: tables.PlayerName,
    key: { player: getAddress(player) },
  });
  const name = hexToString(playerName?.name ?? "0x").replace(/\0+$/, "");
  return name !== "" ? name : undefined;
}
