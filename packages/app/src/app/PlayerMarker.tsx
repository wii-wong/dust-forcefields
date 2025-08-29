import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Marker, useMap } from "react-leaflet";
import { Icon, type LatLngExpression } from "leaflet";
import { worldToMapCoordinates } from "../config";
import {
  encodeBlock,
  encodePlayer,
  objectsById,
  type Vec3,
} from "@dust/world/internal";
import type { Hex } from "viem";
import { AccountName } from "../common/AccountName";
import { useDustClient } from "../common/useDustClient";
import { TruncatedHex } from "../common/TruncatedHex";

export type Player = {
  address: Hex;
  energy: bigint;
  position: Vec3;
  inventory: {
    objectType: number;
    amount: number;
    slot: number;
  }[];
  isSleeping: boolean;
};

interface PlayerMarkerProps {
  player: Player;
  isSelected: boolean;
  showInfo: boolean;
  onSelect: () => void;
  onClose: () => void;
}

const createPlayerIcon = (player: Player, isSelected: boolean) => {
  const size = isSelected ? 30 : 24;
  const circleRadius = isSelected ? 13 : 10;
  const fontSize = isSelected ? 14 : 11;

  return new Icon({
    iconUrl: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`
    <svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
      <circle cx="${size / 2}" cy="${size / 2}" r="${circleRadius}" fill="white" stroke="#333" stroke-width="${isSelected ? 2 : 1}" opacity="0.9"/>
      <text x="${size / 2 + 1.5}" y="${size / 2 + fontSize / 4}" text-anchor="middle" dominant-baseline="middle" font-size="${fontSize}">
        ${player.isSleeping ? "🛏️" : player.energy > 0 ? "👤" : "💀"}
      </text>
    </svg>
  `)}`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
    popupAnchor: [0, -size / 2],
  });
};

const maxPlayerEnergy = 817600000000000000n;

function InventoryModal({
  player,
  onClose,
}: {
  player: Player;
  onClose: () => void;
}) {
  const map = useMap();
  const [controlElement, setControlElement] = useState<HTMLDivElement | null>(
    null
  );

  useEffect(() => {
    if (!map) return;

    const control = new (window as any).L.Control({ position: "topleft" });

    control.onAdd = function () {
      const div = (window as any).L.DomUtil.create("div", "");
      div.style.position = "fixed";
      div.style.top = "50%";
      div.style.left = "50%";
      div.style.transform = "translate(-50%, -50%)";
      div.style.zIndex = "1000";
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

  const inventory = {
    owner: player.address,
    items: player.inventory,
  };

  return createPortal(
    <div className="relative bg-white rounded-lg shadow-xl max-w-xl w-full mx-4 border-2 border-gray-300">
      <div className="flex justify-between items-center p-3 border-b">
        <h2 className="text-lg font-semibold">Player Inventory</h2>
        <button
          onClick={onClose}
          className="w-8 h-8 flex items-center justify-center hover:bg-gray-100 rounded text-gray-500 hover:text-gray-700"
        >
          ✕
        </button>
      </div>
      <div className="p-3">
        <div className="grid *:col-start-1 *:row-start-1">
          <div
            key={inventory.owner}
            className="inline-grid grid-cols-9 gap-1.5 p-3 bg-slate-950/30 rounded"
          >
            {inventory.items.map((item) => (
              <div
                key={item.slot}
                className="aspect-square rounded inline-grid *:col-start-1 *:row-start-1 border border-gray-400 bg-gray-100"
                title={
                  item.objectType > 0
                    ? `${objectsById[item.objectType]?.name}`
                    : "Empty slot"
                }
              >
                {item.objectType > 0 && (
                  <>
                    <img
                      src={`https://alpha.dustproject.org/api/assets/objects/${item.objectType}/icon`}
                      className="size-full"
                      alt={`Object ${item.objectType}`}
                    />
                    <span className="place-self-end text-sm leading-none backdrop-blur bg-black/20 px-1 py-0.5 rounded overflow-hidden">
                      {item.amount}
                    </span>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>,
    controlElement
  );
}

function PlayerInfo({
  player,
  onClose,
  onViewInventory,
}: {
  player: Player | null;
  onClose: () => void;
  onViewInventory: () => void;
}) {
  const { data: dustClient } = useDustClient();
  const map = useMap();
  const [controlElement, setControlElement] = useState<HTMLDivElement | null>(
    null
  );

  useEffect(() => {
    if (!map || !player) return;

    const control = new (window as any).L.Control({ position: "topright" });

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
  }, [map, player]);

  if (!player || !controlElement) return null;

  return createPortal(
    <div className="bg-white border border-gray-300 rounded shadow-lg p-4 max-w-sm">
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-bold mr-1" style={{ fontSize: "1rem" }}>
          {player.isSleeping ? "🛏️" : player.energy > 0 ? "👤" : "💀"}{" "}
          <span
            className={`${dustClient ? "cursor-pointer hover:text-blue-600" : ""}`}
            onClick={() => {
              if (!dustClient) {
                return;
              }

              dustClient.provider.request({
                method: "setWaypoint",
                params: {
                  entity: encodeBlock(player.position),
                  label: "Player",
                },
              });
            }}
          >
            ({player.position.join(", ")})
          </span>
        </h3>
        <button
          onClick={onClose}
          className="w-6 h-6 flex items-center justify-center cursor-pointer hover:bg-gray-100 rounded text-gray-500 hover:text-gray-700"
          title="Close"
        >
          ✕
        </button>
      </div>
      <div className="space-y-2 text-sm">
        <div>
          <span className="font-medium">Name:</span>
          <div className="font-mono text-xs break-all select-text cursor-text">
            <AccountName address={player.address} />
          </div>
        </div>
        <div>
          <span className="font-medium">Address:</span>
          <div className="font-mono text-xs break-all select-text cursor-text">
            <TruncatedHex hex={player.address} />
          </div>
        </div>
        <div>
          <span className="font-medium">Entity Id:</span>
          <div className="font-mono text-xs break-all select-text cursor-text">
            <TruncatedHex hex={encodePlayer(player.address)} />
          </div>
        </div>
        <div>
          <span className="font-medium">Energy:</span>
          <div className="font-mono text-xs break-all select-text cursor-text">
            {(player.energy / BigInt(10 ** 14)).toLocaleString()} (
            {(player.energy * 100n) / maxPlayerEnergy}%)
          </div>
        </div>
        <div className="pt-2 border-t border-gray-200">
          <button
            onClick={onViewInventory}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white text-sm py-2 px-3 rounded font-medium"
          >
            View Inventory
          </button>
        </div>
      </div>
    </div>,
    controlElement
  );
}

export function PlayerMarker({
  player,
  isSelected,
  showInfo,
  onSelect,
  onClose,
}: PlayerMarkerProps) {
  const [showInventory, setShowInventory] = useState(false);
  const mapCoordinates = worldToMapCoordinates(
    player.position
  ) as LatLngExpression;

  const handleViewInventory = () => {
    setShowInventory(true);
  };

  const handleCloseInventory = () => {
    setShowInventory(false);
  };

  // Close inventory when this player is no longer selected
  useEffect(() => {
    if (!showInfo && showInventory) {
      setShowInventory(false);
    }
  }, [showInfo, showInventory]);

  return (
    <>
      <Marker
        position={mapCoordinates}
        icon={createPlayerIcon(player, isSelected)}
        eventHandlers={{
          click: onSelect,
        }}
      />
      {showInfo && (
        <PlayerInfo
          player={player}
          onClose={onClose}
          onViewInventory={handleViewInventory}
        />
      )}
      {showInventory && (
        <InventoryModal player={player} onClose={handleCloseInventory} />
      )}
    </>
  );
}
