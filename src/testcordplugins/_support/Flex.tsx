/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import { Flex as EquicordFlex, type FlexProps } from "@components/Flex";
import type { CSSProperties } from "react";

interface LegacyFlexProps extends FlexProps {
    direction?: CSSProperties["flexDirection"];
    justify?: CSSProperties["justifyContent"];
    align?: CSSProperties["alignItems"];
    wrap?: CSSProperties["flexWrap"];
    grow?: CSSProperties["flexGrow"];
    shrink?: CSSProperties["flexShrink"];
    basis?: CSSProperties["flexBasis"];
}
function LegacyFlex({ direction, justify, align, wrap, grow, shrink, basis, style, ...props }: LegacyFlexProps) {
    return <EquicordFlex flexDirection={direction} justifyContent={justify} alignItems={align} flexWrap={wrap}
        style={{ flexGrow: grow, flexShrink: shrink, flexBasis: basis, ...style }} {...props} />;
}
export const Flex = Object.assign(LegacyFlex, {
    Direction: { HORIZONTAL: "row", VERTICAL: "column", HORIZONTAL_REVERSE: "row-reverse" },
    Justify: { START: "flex-start", END: "flex-end", CENTER: "center", BETWEEN: "space-between", AROUND: "space-around" },
    Align: { START: "flex-start", END: "flex-end", CENTER: "center", STRETCH: "stretch" },
    Wrap: { NO_WRAP: "nowrap", WRAP: "wrap" }
} as const);
