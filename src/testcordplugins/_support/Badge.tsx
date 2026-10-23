/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import { Span } from "@components/Span";
import type { ComponentProps } from "react";

export function Badge({ color, children, text, variant, ...props }: ComponentProps<typeof Span> & { color?: string; text?: string; variant?: string; }) {
    return <Span {...props} style={{ ...props.style, color }}>{text ?? children}</Span>;
}
