/* SPDX-License-Identifier: GPL-3.0-or-later */
import type { JSHandle } from "puppeteer-core";

// Console events already carry these values. Reading remote properties can
// block while Discord is busy; never ask CDP to evaluate the logged object.
export function consoleValue(handle: Pick<JSHandle, "remoteObject"> | undefined) {
    const remote = handle?.remoteObject();
    if (!remote) return undefined;
    return "value" in remote ? remote.value : remote.unserializableValue ?? remote.description;
}

export function consoleError(handle: Pick<JSHandle, "remoteObject"> | undefined): string | undefined {
    const remote = handle?.remoteObject();
    return remote?.subtype === "error" ? remote.description : undefined;
}
