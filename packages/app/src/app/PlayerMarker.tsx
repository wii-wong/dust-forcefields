import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Marker, useMap } from "react-leaflet";
import { Icon, LatLngExpression } from "leaflet";
import { worldToMapCoordinates, type Vec2 } from "../config";
import { encodeBlock, encodePlayer, type Vec3 } from "@dust/world/internal";
import type { Hex } from "viem";
import { AccountName } from "../common/AccountName";
import { useDustClient } from "../common/useDustClient";
import { TruncatedHex } from "../common/TruncatedHex";

export type Player = {
  address: Hex;
  energy: bigint;
  position: Vec3;
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
      <circle cx="${size/2}" cy="${size/2}" r="${circleRadius}" fill="white" stroke="#333" stroke-width="${isSelected ? 2 : 1}" opacity="0.9"/>
      <text x="${size/2 + 1.5}" y="${size/2 + fontSize/4}" text-anchor="middle" dominant-baseline="middle" font-size="${fontSize}">
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

function PlayerInfo({
  player,
  onClose,
}: {
  player: Player | null;
  onClose: () => void;
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
  const mapCoordinates = worldToMapCoordinates(
    player.position
  ) as LatLngExpression;

  return (
    <>
      <Marker
        position={mapCoordinates}
        icon={createPlayerIcon(player, isSelected)}
        eventHandlers={{
          click: onSelect,
        }}
      />
      {showInfo && <PlayerInfo player={player} onClose={onClose} />}
    </>
  );
}
