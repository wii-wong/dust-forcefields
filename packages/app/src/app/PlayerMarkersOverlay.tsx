import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useMap } from "react-leaflet";
import { PlayerMarker, type Player } from "./PlayerMarker";
import { useSyncStatus } from "../mud/useSyncStatus";
import { stash, tables } from "../mud/stash";
import {
  decodeEntityType,
  decodePlayer,
  EntityTypes,
} from "@dust/world/internal";
import { zeroHash } from "viem";
import { getOptimisticEnergy } from "../common/getOptimisticEnergy";

function PlayerMenu({
  playerCount,
  showPlayers,
  onToggleVisibility,
  showDeadPlayers,
  onToggleDeadPlayers,
  showSettings,
  onToggleSettings,
}: {
  playerCount: number;
  showPlayers: boolean;
  onToggleVisibility: () => void;
  showDeadPlayers: boolean;
  onToggleDeadPlayers: () => void;
  showSettings: boolean;
  onToggleSettings: () => void;
}) {
  const map = useMap();
  const [controlElement, setControlElement] = useState<HTMLDivElement | null>(
    null
  );

  useEffect(() => {
    if (!map) return;

    const control = new (window as any).L.Control({ position: "topleft" });

    control.onAdd = function () {
      const div = (window as any).L.DomUtil.create("div", "leaflet-control");
      (window as any).L.DomEvent.disableClickPropagation(div);
      (window as any).L.DomEvent.disableScrollPropagation(div);
      setControlElement(div);
      return div;
    };

    control.addTo(map);

    return () => {
      if (controlElement) {
        setControlElement(null);
      }
      map.removeControl(control);
    };
  }, [map]);

  if (!controlElement) return null;

  return createPortal(
    <div className="leaflet-bar bg-white">
      <div className="flex items-center">
        <div className="px-3 py-2 text-sm font-medium text-gray-700 border-r border-gray-300">
          Players: {playerCount}
        </div>
        <button
          onClick={onToggleVisibility}
          className="w-8 h-8 flex items-center justify-center cursor-pointer hover:bg-gray-50 border-r border-gray-300"
          title={showPlayers ? "Hide Players" : "Show Players"}
        >
          {showPlayers ? "👁️" : "🙈"}
        </button>
        <button
          onClick={onToggleSettings}
          className="w-8 h-8 flex items-center justify-center cursor-pointer hover:bg-gray-50"
          title={showSettings ? "Hide Settings" : "Show Settings"}
        >
          ⚙️
        </button>
      </div>
      {showSettings && (
        <div className="px-3 py-2 border-t border-gray-300">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-700">
              Show Dead Players:
            </span>
            <input
              type="checkbox"
              checked={showDeadPlayers}
              onChange={onToggleDeadPlayers}
              className="ml-2 cursor-pointer"
            />
          </div>
        </div>
      )}
    </div>,
    controlElement
  );
}

interface PlayerMarkersOverlayProps {
  selectedEntity: {
    type: "player" | "forcefield";
    id: string;
  } | null;
  onSelectEntity: (
    entity: {
      type: "player" | "forcefield";
      id: string;
    } | null
  ) => void;
}

export function PlayerMarkersOverlay({
  selectedEntity,
  onSelectEntity,
}: PlayerMarkersOverlayProps) {
  const syncStatus = useSyncStatus();
  const [players, setPlayers] = useState<Player[]>([]);
  const [showPlayers, setShowPlayers] = useState(true);
  const [showDeadPlayers, setShowDeadPlayers] = useState(true);
  const [showSettings, setShowSettings] = useState(false);

  const updatePlayers = () => {
    const moveableEntities = stash.getKeys({
      table: tables.ReverseMovablePosition,
    });
    const newPlayers: Player[] = [];
    for (const { x, y, z } of Object.values(moveableEntities)) {
      const moveableRecord = stash.getRecord({
        table: tables.ReverseMovablePosition,
        key: { x, y, z },
      });
      if (!moveableRecord || moveableRecord.entityId === zeroHash) {
        continue;
      }
      const entityType = decodeEntityType(moveableRecord.entityId);
      if (entityType !== EntityTypes.Player) {
        continue;
      }
      const energy = stash.getRecord({
        table: tables.Energy,
        key: { entityId: moveableRecord.entityId },
      });
      if (!energy?.energy) {
        continue;
      }
      newPlayers.push({
        address: decodePlayer(moveableRecord.entityId),
        position: [x, y, z],
        energy: getOptimisticEnergy(energy) ?? 0n,
      });
    }
    setPlayers(newPlayers);
  };

  useEffect(() => {
    if (!syncStatus.isLive) return;
    updatePlayers();

    // call updatePlayers every 10 seconds
    const interval = setInterval(updatePlayers, 10000);
    return () => clearInterval(interval);
  }, [syncStatus]);

  if (!syncStatus.isLive) {
    return null;
  }

  const filteredPlayers = showDeadPlayers
    ? players
    : players.filter((player) => player.energy > 0);

  return (
    <>
      {showPlayers &&
        filteredPlayers.map((player) => (
          <PlayerMarker
            key={player.address}
            player={player}
            isSelected={
              selectedEntity?.type === "player" &&
              selectedEntity.id === player.address
            }
            showInfo={
              selectedEntity?.type === "player" &&
              selectedEntity.id === player.address
            }
            onSelect={() => {
              if (
                selectedEntity?.type === "player" &&
                selectedEntity.id === player.address
              ) {
                onSelectEntity(null);
              } else {
                onSelectEntity({ type: "player", id: player.address });
              }
            }}
            onClose={() => onSelectEntity(null)}
          />
        ))}
      <PlayerMenu
        playerCount={filteredPlayers.length}
        showPlayers={showPlayers}
        onToggleVisibility={() => setShowPlayers(!showPlayers)}
        showDeadPlayers={showDeadPlayers}
        onToggleDeadPlayers={() => setShowDeadPlayers(!showDeadPlayers)}
        showSettings={showSettings}
        onToggleSettings={() => setShowSettings(!showSettings)}
      />
    </>
  );
}
