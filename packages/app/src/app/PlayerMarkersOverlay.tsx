import { useEffect, useState, useCallback, useMemo } from "react";
import { createPortal } from "react-dom";
import { useMap } from "react-leaflet";
import { PlayerMarker, type Player } from "./PlayerMarker";
import { useSyncStatus } from "../mud/useSyncStatus";
import { stash, tables } from "../mud/stash";
import {
  decodeEntityType,
  decodePlayer,
  decodePosition,
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
  showSleepingPlayers,
  onToggleSleepingPlayers,
  showAlivePlayers,
  onToggleAlivePlayers,
  showSettings,
  onToggleSettings,
}: {
  playerCount: number;
  showPlayers: boolean;
  onToggleVisibility: () => void;
  showDeadPlayers: boolean;
  onToggleDeadPlayers: () => void;
  showSleepingPlayers: boolean;
  onToggleSleepingPlayers: () => void;
  showAlivePlayers: boolean;
  onToggleAlivePlayers: () => void;
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
        <div className="px-3 py-2 border-t border-gray-300 space-y-2">
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
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-700">
              Show Sleeping Players:
            </span>
            <input
              type="checkbox"
              checked={showSleepingPlayers}
              onChange={onToggleSleepingPlayers}
              className="ml-2 cursor-pointer"
            />
          </div>
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-700">
              Show Alive Players:
            </span>
            <input
              type="checkbox"
              checked={showAlivePlayers}
              onChange={onToggleAlivePlayers}
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
  const [showSleepingPlayers, setShowSleepingPlayers] = useState(true);
  const [showAlivePlayers, setShowAlivePlayers] = useState(true);
  const [showSettings, setShowSettings] = useState(false);

  const updatePlayers = useCallback(() => {
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
        isSleeping: false,
      });
    }
    const sleepingEntities = stash.getKeys({
      table: tables.PlayerBed,
    });
    for (const { entityId } of Object.values(sleepingEntities)) {
      const sleepingRecord = stash.getRecord({
        table: tables.PlayerBed,
        key: { entityId },
      });
      if (!sleepingRecord) {
        continue;
      }
      const energy = stash.getRecord({
        table: tables.Energy,
        key: { entityId: sleepingRecord.entityId },
      });
      if (!energy?.energy) {
        continue;
      }
      newPlayers.push({
        address: decodePlayer(sleepingRecord.entityId),
        position: [...decodePosition(sleepingRecord.bedEntityId)],
        energy: energy.energy, //TODO: calc optimistic energy based on force field
        isSleeping: true,
      });
    }

    setPlayers((prevPlayers) => {
      // Only update if the data has actually changed
      if (prevPlayers.length !== newPlayers.length) {
        return newPlayers;
      }

      // Check if any player data has changed
      const hasChanged = newPlayers.some((newPlayer) => {
        const existingPlayer = prevPlayers.find(
          (p) => p.address === newPlayer.address
        );
        return (
          !existingPlayer ||
          existingPlayer.position[0] !== newPlayer.position[0] ||
          existingPlayer.position[1] !== newPlayer.position[1] ||
          existingPlayer.position[2] !== newPlayer.position[2] ||
          existingPlayer.energy !== newPlayer.energy ||
          existingPlayer.isSleeping !== newPlayer.isSleeping
        );
      });

      return hasChanged ? newPlayers : prevPlayers;
    });
  }, []);

  const filteredPlayers = useMemo(
    () =>
      players.filter((player) => {
        // Filter by dead/alive status
        if (!showDeadPlayers && player.energy === 0n) return false;
        if (!showAlivePlayers && player.energy > 0n && !player.isSleeping)
          return false;
        if (!showSleepingPlayers && player.isSleeping) return false;

        return true;
      }),
    [players, showDeadPlayers, showAlivePlayers, showSleepingPlayers]
  );

  const handlePlayerSelect = useCallback(
    (playerAddress: string) => {
      if (
        selectedEntity?.type === "player" &&
        selectedEntity.id === playerAddress
      ) {
        onSelectEntity(null);
      } else {
        onSelectEntity({ type: "player", id: playerAddress });
      }
    },
    [selectedEntity, onSelectEntity]
  );

  const handleClose = useCallback(() => {
    onSelectEntity(null);
  }, [onSelectEntity]);

  useEffect(() => {
    if (!syncStatus.isLive) return;
    updatePlayers();

    // call updatePlayers every 5 seconds
    const interval = setInterval(updatePlayers, 5000);
    return () => clearInterval(interval);
  }, [syncStatus, updatePlayers]);

  if (!syncStatus.isLive) {
    return null;
  }

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
            onSelect={() => handlePlayerSelect(player.address)}
            onClose={handleClose}
          />
        ))}
      <PlayerMenu
        playerCount={filteredPlayers.length}
        showPlayers={showPlayers}
        onToggleVisibility={() => setShowPlayers(!showPlayers)}
        showDeadPlayers={showDeadPlayers}
        onToggleDeadPlayers={() => setShowDeadPlayers(!showDeadPlayers)}
        showSleepingPlayers={showSleepingPlayers}
        onToggleSleepingPlayers={() =>
          setShowSleepingPlayers(!showSleepingPlayers)
        }
        showAlivePlayers={showAlivePlayers}
        onToggleAlivePlayers={() => setShowAlivePlayers(!showAlivePlayers)}
        showSettings={showSettings}
        onToggleSettings={() => setShowSettings(!showSettings)}
      />
    </>
  );
}
