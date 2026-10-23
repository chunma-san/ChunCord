/*
 * Vencord, a Discord client mod
 * Copyright (c) 2024 Cooper/coopeeo, Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { TestcordDevs } from "../_support/constants";
import definePlugin from "@utils/types";

import { Connection } from "./connection-types";

export default definePlugin({
    name: "AllConnectionsEnabled",
    enabledByDefault: false,
    required: false,
    description: "Enables all connections",
    tags: ["Utility","Customisation"],
    authors: [TestcordDevs.x2b],
    patches: [
        {
            find: "getPlatformUserUrl:",
            replacement: {
                match: /(let \i=)(\[.*?\])(,\i=\i.{0,40},\i=.{0,30}?;)/,
                replace: "$1$self.changeConnections($2)$3"
            }
        }
    ],
    changeConnections(connections: Connection[]) {
        connections
            .filter(connection => connection.enabled === !1)
            .forEach(connection => {
                connection.enabled = true;
                console.log(`Enabled connection ${connection.name}`);
                connection.name += " (Disabled)";
            });
        return connections;
    }
});
