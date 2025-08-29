import type { Hex } from "viem";
import { useENS } from "./useENS";
import { usePlayerName } from "./usePlayerName";
import { TruncatedHex } from "./TruncatedHex";

export type Props = {
  address: Hex;
};

export function AccountName({ address }: Props) {
  const playerName = usePlayerName(address);
  const { data: ens } = useENS(address);
  return (
    <span className="font-medium">
      {playerName ?? ens?.name ?? <TruncatedHex hex={address} />}
    </span>
  );
}
