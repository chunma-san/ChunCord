/*
 * Vencord, a Discord client mod
 * Copyright (c) 2026 Vendicated and contributors
 * SPDX-License-Identifier: GPL-3.0-or-later
 */
import { Divider } from "@components/Divider";
import { Heading } from "@components/Heading";
import { Forms as EquicordForms, Modal as EquicordModal, showToast as showEquicordToast } from "@webpack/common";
import type { ComponentProps, HTMLAttributes, ReactNode } from "react";

export * from "@webpack/common";
type ToastOptions = Parameters<typeof showEquicordToast>[0];
type LegacyToastType = number | string;
interface LegacyToastOptions { position?: number | string; duration?: number; }
export function showToast(text: string | ToastOptions, type: LegacyToastType = 0, options: LegacyToastOptions = {}) {
    if (typeof text !== "string") return showEquicordToast(text);
    showEquicordToast({
        text,
        variant: type === 1 || type === "success" ? "success" : type === 2 || type === "failure" ? "critical" : "default",
        position: options.position === 0 || options.position === "top" ? "top" : "bottom",
        duration: options.duration
    });
}
export const Toasts = {
    Type: { MESSAGE: "default", SUCCESS: "success", FAILURE: "failure" } as const,
    Position: { TOP: 0, BOTTOM: 1 },
    genId: () => crypto.randomUUID(),
    show(data: { message: string; type?: LegacyToastType; id?: string; options?: LegacyToastOptions; }) {
        showToast(data.message, data.type, data.options);
    }
};
interface FormSectionProps extends Omit<HTMLAttributes<HTMLElement>, "title"> { title?: ReactNode; }
function FormSection({ title, children, ...props }: FormSectionProps) {
    return <section {...props}>{title && <Heading>{title}</Heading>}{children}</section>;
}
export const Forms = { ...EquicordForms, FormSection, FormDivider: Divider };
type ModernModalProps = ComponentProps<typeof EquicordModal> & { className?: string; style?: React.CSSProperties; };
export function Modal({ className, style, children, ...props }: ModernModalProps) {
    return <EquicordModal {...props}><div className={className} style={style}>{children}</div></EquicordModal>;
}
