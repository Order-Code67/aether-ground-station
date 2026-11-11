import { useState } from "react";
import { DevicesPanel } from "./DevicesPanel";
import { SerialPanel } from "@/modules/serial/SerialPanel";
import { UsbPanel } from "@/modules/usb/UsbPanel";
import { NetworkPanel } from "@/modules/network/NetworkPanel";
import { HidView } from "@/modules/hid";

type HubTab = "all" | "serial" | "usb" | "network" | "hid";

/**
 * GS-6: единый Device Manager hub — вкладки вместо отдельных primary-пунктов.
 */
export function DevicesView() {
  const [tab, setTab] = useState<HubTab>("all");

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap gap-1 border-b border-ags-border-subtle px-3 py-2">
        {(
          [
            ["all", "Все устройства"],
            ["serial", "COM / UART"],
            ["usb", "USB"],
            ["network", "Сеть"],
            ["hid", "HID"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={
              tab === id
                ? "rounded bg-ags-elevated px-2 py-1 text-xs text-ags-accent"
                : "rounded px-2 py-1 text-xs text-ags-muted"
            }
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        {tab === "all" && <DevicesPanel />}
        {tab === "serial" && <SerialPanel />}
        {tab === "usb" && <UsbPanel />}
        {tab === "network" && <NetworkPanel />}
        {tab === "hid" && <HidView />}
      </div>
    </div>
  );
}

export { DevicesPanel } from "./DevicesPanel";
