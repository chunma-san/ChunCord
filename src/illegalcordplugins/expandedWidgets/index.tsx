/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import { Devs } from "../_support/constants";
import definePlugin from "@utils/types";

export default definePlugin({
    name: "ExpandedWidgets",
    enabledByDefault: false,
    required: false,
    description: "Enables setting multiple of the same tags for a game in your profile",
    tags: ["Chat","Appearance"],
    authors: [
        Devs.sadie
    ],
    patches: [
        {
            find: "BETTER_THAN_YOU]:{",
            replacement: {
                match: /(type:)"radio"/,
                replace: "$1\"checkbox\""
            }
        }
    ]
});
