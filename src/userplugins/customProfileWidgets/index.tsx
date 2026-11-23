/*
 * CustomProfileWidgets v5.8 Stable UI Polish
 * Vencord userplugin
 * SPDX-License-Identifier: GPL-3.0-or-later
 */

import "./style.css";

import { definePluginSettings } from "@api/Settings";
import { copyToClipboard } from "@utils/clipboard";
import { Margins } from "@utils/margins";
import definePlugin, { OptionType } from "@utils/types";
import {
    Button,
    createRoot,
    Forms,
    MaskedLink,
    TextArea,
    TextInput,
    useEffect,
    useRef,
    useState
} from "@webpack/common";

type MediaWidth = 25 | 50 | 75 | 100;
type MediaRatio = "auto" | "1:1" | "4:3" | "3:2" | "16:9" | "21:9";
type MediaFit = "contain" | "cover" | "fill";
type MediaAlign = "left" | "center" | "right";
type CaptionPosition = "below" | "side" | "overlay";
type OverlayPosition = "top-left" | "top-center" | "top-right" | "center" | "bottom-left" | "bottom-center" | "bottom-right";
type MainLayout = "top" | "side" | "overlay";
type MediaLayout = "grid" | "carousel";
type TextAlign = "left" | "center" | "right";
type WidgetAnimation = "none" | "fade" | "slide" | "zoom" | "glow";
type BackgroundFit = "cover" | "contain" | "fill";
type PresetName = "native" | "minimal" | "glass" | "anime";

interface WidgetButton {
    id: string;
    label: string;
    url: string;
    icon: string;
    color: string;
}

interface WidgetMediaItem {
    id: string;
    imageUrl: string;
    caption: string;
    width: MediaWidth;
    ratio: MediaRatio;
    fit: MediaFit;
    radius: number;
    captionPosition: CaptionPosition;
    overlayPosition: OverlayPosition;
}

interface CustomWidget {
    id: string;
    title: string;
    description: string;
    icon: string;
    enabled: boolean;

    imageUrl: string;
    mainMediaWidth: MediaWidth;
    mainMediaRatio: MediaRatio;
    mainMediaFit: MediaFit;
    mainMediaAlign: MediaAlign;
    mainMediaRadius: number;
    mainLayout: MainLayout;
    mainOverlayPosition: OverlayPosition;

    media: WidgetMediaItem[];
    mediaLayout: MediaLayout;
    carouselInterval: number;

    buttons: WidgetButton[];

    backgroundColor: string;
    backgroundImage: string;
    backgroundFit: BackgroundFit;
    backgroundPosition: string;
    backgroundBlur: number;

    useGradient: boolean;
    gradientStart: string;
    gradientEnd: string;
    gradientAngle: number;

    overlayOpacity: number;
    textColor: string;
    accentColor: string;

    borderRadius: number;
    borderWidth: number;
    shadowStrength: number;
    glowStrength: number;

    titleFontSize: number;
    descriptionFontSize: number;
    fontWeight: number;
    textAlign: TextAlign;

    animation: WidgetAnimation;
}

type NativeHeroSide = "left" | "right";
type NativeImageFit = "cover" | "contain" | "fill";
type NativeBackgroundMode = "profile" | "solid" | "gradient";

interface NativeWidgetItem {
    id: string;
    imageUrl: string;
    title: string;
    subtitle: string;

    imageFit: NativeImageFit;
    imageScale: number;
    imageBoxScale: number;
    imageOffsetX: number;
    imageOffsetY: number;
}

interface NativeWidget {
    id: string;
    enabled: boolean;

    headerIcon: string;
    headerText: string;

    heroTitle: string;
    heroSubtitle: string;
    heroImageUrl: string;
    heroSide: NativeHeroSide;
    heroImageFit: NativeImageFit;
    heroImageScale: number;
    heroImageBoxScale: number;
    heroImageOffsetX: number;
    heroImageOffsetY: number;

    headerTextColor: string;
    heroTitleColor: string;
    heroSubtitleColor: string;
    tileTitleColor: string;
    tileSubtitleColor: string;

    backgroundMode: NativeBackgroundMode;
    backgroundColor: string;
    gradientStart: string;
    gradientEnd: string;
    gradientAngle: number;

    borderColor: string;
    borderOpacity: number;
    borderWidth: number;

    items: NativeWidgetItem[];
}

const WIDGET_KEYS = ["widgets"] as const;
const NATIVE_KEYS = ["nativeWidgets"] as const;

let observer: MutationObserver | null = null;
let scanFrame: number | null = null;
let draggedWidgetId: string | null = null;
let draggedMedia: { widgetId: string; mediaId: string; } | null = null;
let draggedNativeWidgetId: string | null = null;
let draggedNativeItem: { widgetId: string; itemId: string; } | null = null;

const mountedRoots = new Map<HTMLElement, ReturnType<typeof createRoot>>();

function makeId() {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function cleanUrl(value?: string) {
    const url = value?.trim();
    if (!url) return undefined;

    // Local files selected in the editor are stored as image data URLs so they
    // survive Discord/Vencord restarts without needing an external host.
    if (/^data:image\/[a-z0-9.+-]+;base64,/i.test(url)) return url;

    try {
        const parsed = new URL(url);
        if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return undefined;
        return parsed.href;
    } catch {
        return undefined;
    }
}

function isLocalImageSource(value?: string) {
    return /^data:image\/[a-z0-9.+-]+;base64,/i.test(value?.trim() ?? "");
}

function elementText(element: Element | null) {
    return (element?.textContent ?? "").replace(/\s+/g, " ").trim();
}

function clamp(value: number, min: number, max: number) {
    if (!Number.isFinite(value)) return min;
    return Math.min(max, Math.max(min, value));
}

function ratioToCss(ratio: MediaRatio) {
    switch (ratio) {
        case "1:1": return "1 / 1";
        case "4:3": return "4 / 3";
        case "3:2": return "3 / 2";
        case "16:9": return "16 / 9";
        case "21:9": return "21 / 9";
        default: return undefined;
    }
}

function widthToGridSpan(width: MediaWidth) {
    switch (width) {
        case 25: return 3;
        case 50: return 6;
        case 75: return 9;
        default: return 12;
    }
}

function bgSize(fit: BackgroundFit) {
    return fit === "fill" ? "100% 100%" : fit;
}

function makeDefaultButton(): WidgetButton {
    return {
        id: makeId(),
        label: "open",
        url: "",
        icon: "",
        color: "#5865f2"
    };
}

function makeDefaultMedia(): WidgetMediaItem {
    return {
        id: makeId(),
        imageUrl: "",
        caption: "",
        width: 50,
        ratio: "auto",
        fit: "contain",
        radius: 10,
        captionPosition: "below",
        overlayPosition: "bottom-left"
    };
}

function normalizeButton(button: Partial<WidgetButton>): WidgetButton {
    return {
        id: button.id ?? makeId(),
        label: button.label ?? "open",
        url: button.url ?? "",
        icon: button.icon ?? "",
        color: button.color ?? "#5865f2"
    };
}

function normalizeMedia(item: Partial<WidgetMediaItem>): WidgetMediaItem {
    return {
        id: item.id ?? makeId(),
        imageUrl: item.imageUrl ?? "",
        caption: item.caption ?? "",
        width: item.width ?? 50,
        ratio: item.ratio ?? "auto",
        fit: item.fit ?? "contain",
        radius: clamp(item.radius ?? 10, 0, 40),
        captionPosition: item.captionPosition ?? "below",
        overlayPosition: item.overlayPosition ?? "bottom-left"
    };
}

function normalizeWidget(widget: Partial<CustomWidget> & { linkUrl?: string; buttonLabel?: string; }): CustomWidget {
    let buttons: WidgetButton[];

    if (Array.isArray(widget.buttons)) {
        buttons = widget.buttons.map(normalizeButton);
    } else if (widget.linkUrl || widget.buttonLabel) {
        buttons = [normalizeButton({
            label: widget.buttonLabel ?? "open",
            url: widget.linkUrl ?? "",
            color: widget.accentColor ?? "#5865f2"
        })];
    } else {
        buttons = [];
    }

    return {
        id: widget.id ?? makeId(),
        title: widget.title ?? "custom widget",
        description: widget.description ?? "write your description here",
        icon: widget.icon ?? "✨",
        enabled: widget.enabled ?? true,

        imageUrl: widget.imageUrl ?? "",
        mainMediaWidth: widget.mainMediaWidth ?? 100,
        mainMediaRatio: widget.mainMediaRatio ?? "auto",
        mainMediaFit: widget.mainMediaFit ?? "contain",
        mainMediaAlign: widget.mainMediaAlign ?? "center",
        mainMediaRadius: clamp(widget.mainMediaRadius ?? 0, 0, 40),
        mainLayout: widget.mainLayout ?? "top",
        mainOverlayPosition: widget.mainOverlayPosition ?? "bottom-left",

        media: Array.isArray(widget.media) ? widget.media.map(normalizeMedia) : [],
        mediaLayout: widget.mediaLayout ?? "grid",
        carouselInterval: clamp(widget.carouselInterval ?? 4, 1, 30),

        buttons,

        backgroundColor: widget.backgroundColor ?? "#2b2d31",
        backgroundImage: widget.backgroundImage ?? "",
        backgroundFit: widget.backgroundFit ?? "cover",
        backgroundPosition: widget.backgroundPosition ?? "center",
        backgroundBlur: clamp(widget.backgroundBlur ?? 0, 0, 30),

        useGradient: widget.useGradient ?? false,
        gradientStart: widget.gradientStart ?? "#5865f2",
        gradientEnd: widget.gradientEnd ?? "#eb459e",
        gradientAngle: clamp(widget.gradientAngle ?? 135, 0, 360),

        overlayOpacity: clamp(widget.overlayOpacity ?? 0, 0, 90),
        textColor: widget.textColor ?? "#ffffff",
        accentColor: widget.accentColor ?? "#5865f2",

        borderRadius: clamp(widget.borderRadius ?? 16, 0, 40),
        borderWidth: clamp(widget.borderWidth ?? 1, 0, 8),
        shadowStrength: clamp(widget.shadowStrength ?? 12, 0, 40),
        glowStrength: clamp(widget.glowStrength ?? 0, 0, 40),

        titleFontSize: clamp(widget.titleFontSize ?? 16, 10, 40),
        descriptionFontSize: clamp(widget.descriptionFontSize ?? 13, 9, 30),
        fontWeight: clamp(widget.fontWeight ?? 650, 300, 900),
        textAlign: widget.textAlign ?? "left",

        animation: widget.animation ?? "none"
    };
}

function makeDefaultWidget() {
    return normalizeWidget({ id: makeId() });
}

function getWidgets() {
    return (settings.store.widgets ?? []).map(normalizeWidget);
}

function writeWidgets(widgets: CustomWidget[]) {
    settings.store.widgets = widgets.map(normalizeWidget);
}

function updateWidget(id: string, patch: Partial<CustomWidget>) {
    writeWidgets(getWidgets().map(widget =>
        widget.id === id
            ? normalizeWidget({ ...widget, ...patch })
            : widget
    ));
}

function addWidget() {
    writeWidgets([...getWidgets(), makeDefaultWidget()]);
}

function removeWidget(id: string) {
    writeWidgets(getWidgets().filter(widget => widget.id !== id));
}

function duplicateWidget(id: string) {
    const widgets = getWidgets();
    const source = widgets.find(widget => widget.id === id);
    if (!source) return;

    const clone = normalizeWidget({
        ...source,
        id: makeId(),
        title: `${source.title} copy`,
        media: source.media.map(item => ({ ...item, id: makeId() })),
        buttons: source.buttons.map(button => ({ ...button, id: makeId() }))
    });

    const index = widgets.findIndex(widget => widget.id === id);
    widgets.splice(index + 1, 0, clone);
    writeWidgets(widgets);
}

function resetWidget(id: string) {
    const fresh = makeDefaultWidget();
    updateWidget(id, { ...fresh, id });
}

function moveWidget(id: string, direction: -1 | 1) {
    const widgets = [...getWidgets()];
    const index = widgets.findIndex(widget => widget.id === id);
    if (index === -1) return;

    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= widgets.length) return;

    [widgets[index], widgets[nextIndex]] = [widgets[nextIndex], widgets[index]];
    writeWidgets(widgets);
}

function reorderWidget(sourceId: string, targetId: string, after: boolean) {
    if (sourceId === targetId) return;

    const widgets = [...getWidgets()];
    const sourceIndex = widgets.findIndex(widget => widget.id === sourceId);
    if (sourceIndex === -1) return;

    const [source] = widgets.splice(sourceIndex, 1);
    let targetIndex = widgets.findIndex(widget => widget.id === targetId);
    if (targetIndex === -1) return;

    if (after) targetIndex++;
    widgets.splice(targetIndex, 0, source);
    writeWidgets(widgets);
}

function addMedia(widgetId: string) {
    const widget = getWidgets().find(widget => widget.id === widgetId);
    if (!widget || widget.media.length >= 4) return;

    updateWidget(widgetId, {
        media: [...widget.media, makeDefaultMedia()]
    });
}

function updateMedia(widgetId: string, mediaId: string, patch: Partial<WidgetMediaItem>) {
    const widget = getWidgets().find(widget => widget.id === widgetId);
    if (!widget) return;

    updateWidget(widgetId, {
        media: widget.media.map(item =>
            item.id === mediaId
                ? normalizeMedia({ ...item, ...patch })
                : item
        )
    });
}

function removeMedia(widgetId: string, mediaId: string) {
    const widget = getWidgets().find(widget => widget.id === widgetId);
    if (!widget) return;

    updateWidget(widgetId, {
        media: widget.media.filter(item => item.id !== mediaId)
    });
}

function moveMedia(widgetId: string, mediaId: string, direction: -1 | 1) {
    const widget = getWidgets().find(widget => widget.id === widgetId);
    if (!widget) return;

    const media = [...widget.media];
    const index = media.findIndex(item => item.id === mediaId);
    if (index === -1) return;

    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= media.length) return;

    [media[index], media[nextIndex]] = [media[nextIndex], media[index]];
    updateWidget(widgetId, { media });
}

function reorderMedia(widgetId: string, sourceMediaId: string, targetMediaId: string, after: boolean) {
    const widget = getWidgets().find(widget => widget.id === widgetId);
    if (!widget || sourceMediaId === targetMediaId) return;

    const media = [...widget.media];
    const sourceIndex = media.findIndex(item => item.id === sourceMediaId);
    if (sourceIndex === -1) return;

    const [source] = media.splice(sourceIndex, 1);
    let targetIndex = media.findIndex(item => item.id === targetMediaId);
    if (targetIndex === -1) return;

    if (after) targetIndex++;
    media.splice(targetIndex, 0, source);
    updateWidget(widgetId, { media });
}

function addButton(widgetId: string) {
    const widget = getWidgets().find(widget => widget.id === widgetId);
    if (!widget || widget.buttons.length >= 4) return;

    updateWidget(widgetId, {
        buttons: [...widget.buttons, makeDefaultButton()]
    });
}

function updateButton(widgetId: string, buttonId: string, patch: Partial<WidgetButton>) {
    const widget = getWidgets().find(widget => widget.id === widgetId);
    if (!widget) return;

    updateWidget(widgetId, {
        buttons: widget.buttons.map(button =>
            button.id === buttonId
                ? normalizeButton({ ...button, ...patch })
                : button
        )
    });
}

function removeButton(widgetId: string, buttonId: string) {
    const widget = getWidgets().find(widget => widget.id === widgetId);
    if (!widget) return;

    updateWidget(widgetId, {
        buttons: widget.buttons.filter(button => button.id !== buttonId)
    });
}

function applyPreset(id: string, preset: PresetName) {
    switch (preset) {
        case "native":
            updateWidget(id, {
                backgroundColor: "#2b2d31",
                backgroundImage: "",
                backgroundBlur: 0,
                useGradient: false,
                overlayOpacity: 0,
                textColor: "#ffffff",
                accentColor: "#5865f2",
                borderRadius: 16,
                borderWidth: 1,
                shadowStrength: 8,
                glowStrength: 0,
                mainMediaRadius: 0,
                animation: "none"
            });
            break;

        case "minimal":
            updateWidget(id, {
                backgroundColor: "#111214",
                backgroundImage: "",
                backgroundBlur: 0,
                useGradient: false,
                overlayOpacity: 0,
                textColor: "#f2f3f5",
                accentColor: "#b5bac1",
                borderRadius: 10,
                borderWidth: 0,
                shadowStrength: 0,
                glowStrength: 0,
                mainMediaRadius: 8,
                animation: "fade"
            });
            break;

        case "glass":
            updateWidget(id, {
                backgroundColor: "#1e1f22",
                backgroundBlur: 10,
                useGradient: true,
                gradientStart: "#5865f2",
                gradientEnd: "#eb459e",
                gradientAngle: 135,
                overlayOpacity: 28,
                textColor: "#ffffff",
                accentColor: "#ffffff",
                borderRadius: 20,
                borderWidth: 1,
                shadowStrength: 18,
                glowStrength: 8,
                mainMediaRadius: 14,
                animation: "zoom"
            });
            break;

        case "anime":
            updateWidget(id, {
                backgroundColor: "#1a101d",
                useGradient: true,
                gradientStart: "#ff73c6",
                gradientEnd: "#8b5cf6",
                gradientAngle: 125,
                overlayOpacity: 12,
                textColor: "#ffffff",
                accentColor: "#ff73c6",
                borderRadius: 22,
                borderWidth: 2,
                shadowStrength: 20,
                glowStrength: 16,
                mainMediaRadius: 16,
                animation: "glow"
            });
            break;
    }
}

function makeDefaultNativeItem(index = 0): NativeWidgetItem {
    const defaults = [
        ["Love", "Quinn"],
        ["Guinevere", "Beck"],
        ["Bellamy", "Marienne"],
        ["Lockwood", "Kate"]
    ];

    const [title, subtitle] = defaults[index] ?? ["Item", "Subtitle"];

    return {
        id: makeId(),
        imageUrl: "",
        title,
        subtitle,
        imageFit: "cover",
        imageScale: 100,
        imageBoxScale: 100,
        imageOffsetX: 0,
        imageOffsetY: 0
    };
}

function normalizeNativeItem(item: Partial<NativeWidgetItem>, index = 0): NativeWidgetItem {
    const fallback = makeDefaultNativeItem(index);

    return {
        id: item.id ?? fallback.id,
        imageUrl: item.imageUrl ?? "",
        title: item.title ?? fallback.title,
        subtitle: item.subtitle ?? fallback.subtitle,
        imageFit: item.imageFit ?? fallback.imageFit,
        imageScale: clamp(item.imageScale ?? fallback.imageScale, 50, 180),
        imageBoxScale: clamp(item.imageBoxScale ?? 100, 55, 100),
        imageOffsetX: clamp(item.imageOffsetX ?? fallback.imageOffsetX, -50, 50),
        imageOffsetY: clamp(item.imageOffsetY ?? fallback.imageOffsetY, -50, 50)
    };
}

function normalizeNativeWidget(widget: Partial<NativeWidget>): NativeWidget {
    const rawItems = Array.isArray(widget.items)
        ? widget.items
        : Array.from({ length: 4 }, (_, index) => makeDefaultNativeItem(index));

    return {
        id: widget.id ?? makeId(),
        enabled: widget.enabled ?? true,
        headerIcon: widget.headerIcon ?? "🖤",
        headerText: widget.headerText ?? "JoeGoldberg.exe",
        heroTitle: widget.heroTitle ?? "Hello, you",
        heroSubtitle: widget.heroSubtitle ?? "I'm watching over you",
        heroImageUrl: widget.heroImageUrl ?? "",
        heroSide: widget.heroSide ?? "right",
        heroImageFit: widget.heroImageFit ?? "cover",
        heroImageScale: clamp(widget.heroImageScale ?? 100, 50, 180),
        heroImageBoxScale: clamp(widget.heroImageBoxScale ?? 100, 55, 100),
        heroImageOffsetX: clamp(widget.heroImageOffsetX ?? 0, -50, 50),
        heroImageOffsetY: clamp(widget.heroImageOffsetY ?? 0, -50, 50),

        headerTextColor: widget.headerTextColor ?? "",
        heroTitleColor: widget.heroTitleColor ?? "",
        heroSubtitleColor: widget.heroSubtitleColor ?? "",
        tileTitleColor: widget.tileTitleColor ?? "",
        tileSubtitleColor: widget.tileSubtitleColor ?? "",

        backgroundMode: widget.backgroundMode ?? "profile",
        backgroundColor: widget.backgroundColor ?? "#2b2d31",
        gradientStart: widget.gradientStart ?? "#5865f2",
        gradientEnd: widget.gradientEnd ?? "#eb459e",
        gradientAngle: clamp(widget.gradientAngle ?? 135, 0, 360),

        borderColor: widget.borderColor ?? "#ffffff",
        borderOpacity: clamp(widget.borderOpacity ?? 32, 0, 100),
        borderWidth: clamp(widget.borderWidth ?? 1, 0, 8),

        items: rawItems.slice(0, 4).map((item, index) => normalizeNativeItem(item, index))
    };
}

function makeDefaultNativeWidget(): NativeWidget {
    return normalizeNativeWidget({ id: makeId() });
}

function getNativeWidgets() {
    return (settings.store.nativeWidgets ?? []).map(normalizeNativeWidget);
}

function writeNativeWidgets(widgets: NativeWidget[]) {
    settings.store.nativeWidgets = widgets.map(normalizeNativeWidget);
}

function updateNativeWidget(id: string, patch: Partial<NativeWidget>) {
    writeNativeWidgets(
        getNativeWidgets().map(widget =>
            widget.id === id
                ? normalizeNativeWidget({ ...widget, ...patch })
                : widget
        )
    );
}

function addNativeWidget() {
    writeNativeWidgets([...getNativeWidgets(), makeDefaultNativeWidget()]);
}

function removeNativeWidget(id: string) {
    writeNativeWidgets(getNativeWidgets().filter(widget => widget.id !== id));
}

function duplicateNativeWidget(id: string) {
    const widgets = getNativeWidgets();
    const source = widgets.find(widget => widget.id === id);
    if (!source) return;

    const clone = normalizeNativeWidget({
        ...source,
        id: makeId(),
        headerText: `${source.headerText} copy`,
        items: source.items.map(item => ({ ...item, id: makeId() }))
    });

    const index = widgets.findIndex(widget => widget.id === id);
    widgets.splice(index + 1, 0, clone);
    writeNativeWidgets(widgets);
}

function resetNativeWidget(id: string) {
    const fresh = makeDefaultNativeWidget();
    updateNativeWidget(id, { ...fresh, id });
}

function moveNativeWidget(id: string, direction: -1 | 1) {
    const widgets = [...getNativeWidgets()];
    const index = widgets.findIndex(widget => widget.id === id);
    if (index === -1) return;

    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= widgets.length) return;

    [widgets[index], widgets[nextIndex]] = [widgets[nextIndex], widgets[index]];
    writeNativeWidgets(widgets);
}

function reorderNativeWidget(sourceId: string, targetId: string, after: boolean) {
    if (sourceId === targetId) return;

    const widgets = [...getNativeWidgets()];
    const sourceIndex = widgets.findIndex(widget => widget.id === sourceId);
    if (sourceIndex === -1) return;

    const [source] = widgets.splice(sourceIndex, 1);
    let targetIndex = widgets.findIndex(widget => widget.id === targetId);
    if (targetIndex === -1) return;

    if (after) targetIndex++;

    widgets.splice(targetIndex, 0, source);
    writeNativeWidgets(widgets);
}

function addNativeItem(widgetId: string) {
    const widget = getNativeWidgets().find(widget => widget.id === widgetId);
    if (!widget || widget.items.length >= 4) return;

    updateNativeWidget(widgetId, {
        items: [...widget.items, makeDefaultNativeItem(widget.items.length)]
    });
}

function updateNativeItem(widgetId: string, itemId: string, patch: Partial<NativeWidgetItem>) {
    const widget = getNativeWidgets().find(widget => widget.id === widgetId);
    if (!widget) return;

    updateNativeWidget(widgetId, {
        items: widget.items.map((item, index) =>
            item.id === itemId
                ? normalizeNativeItem({ ...item, ...patch }, index)
                : item
        )
    });
}

function removeNativeItem(widgetId: string, itemId: string) {
    const widget = getNativeWidgets().find(widget => widget.id === widgetId);
    if (!widget) return;

    updateNativeWidget(widgetId, {
        items: widget.items.filter(item => item.id !== itemId)
    });
}

function reorderNativeItem(widgetId: string, sourceItemId: string, targetItemId: string, after: boolean) {
    const widget = getNativeWidgets().find(widget => widget.id === widgetId);
    if (!widget || sourceItemId === targetItemId) return;

    const items = [...widget.items];
    const sourceIndex = items.findIndex(item => item.id === sourceItemId);
    if (sourceIndex === -1) return;

    const [source] = items.splice(sourceIndex, 1);
    let targetIndex = items.findIndex(item => item.id === targetItemId);
    if (targetIndex === -1) return;

    if (after) targetIndex++;

    items.splice(targetIndex, 0, source);
    updateNativeWidget(widgetId, { items });
}

function WidgetIcon({ value, className = "" }: { value: string; className?: string; }) {
    if (!value) return null;

    const url = cleanUrl(value);

    if (url) {
        return <img className={`vc-cpwm-icon-image ${className}`} src={url} alt="" />;
    }

    return <span className={`vc-cpwm-icon-text ${className}`}>{value}</span>;
}

function getAlignmentStyle(align: MediaAlign) {
    if (align === "left") return { marginLeft: 0, marginRight: "auto" };
    if (align === "right") return { marginLeft: "auto", marginRight: 0 };
    return { marginLeft: "auto", marginRight: "auto" };
}

function getCardBackgroundStyle(widget: CustomWidget) {
    const imageUrl = cleanUrl(widget.backgroundImage);
    const layers: string[] = [];
    const sizes: string[] = [];
    const positions: string[] = [];
    const repeats: string[] = [];

    if (widget.useGradient) {
        layers.push(`linear-gradient(${widget.gradientAngle}deg, ${widget.gradientStart}, ${widget.gradientEnd})`);
        sizes.push("cover");
        positions.push("center");
        repeats.push("no-repeat");
    }

    if (imageUrl) {
        layers.push(`url("${imageUrl}")`);
        sizes.push(bgSize(widget.backgroundFit));
        positions.push(widget.backgroundPosition || "center");
        repeats.push("no-repeat");
    }

    return {
        backgroundColor: widget.backgroundColor,
        backgroundImage: layers.length ? layers.join(", ") : undefined,
        backgroundSize: sizes.length ? sizes.join(", ") : undefined,
        backgroundPosition: positions.length ? positions.join(", ") : undefined,
        backgroundRepeat: repeats.length ? repeats.join(", ") : undefined,
        filter: widget.backgroundBlur ? `blur(${widget.backgroundBlur}px)` : undefined,
        transform: widget.backgroundBlur ? "scale(1.05)" : undefined
    };
}

function getWidgetShadow(widget: CustomWidget) {
    const shadows: string[] = [];

    if (widget.shadowStrength > 0) {
        const alpha = Math.min(0.5, widget.shadowStrength / 80);
        shadows.push(`0 ${Math.max(2, Math.round(widget.shadowStrength / 3))}px ${Math.max(8, widget.shadowStrength)}px rgba(0,0,0,${alpha})`);
    }

    if (widget.glowStrength > 0) {
        shadows.push(`0 0 ${widget.glowStrength}px ${widget.accentColor}`);
    }

    return shadows.length ? shadows.join(", ") : undefined;
}

function MainMedia({ widget, overlayChildren }: { widget: CustomWidget; overlayChildren?: any; }) {
    const imageUrl = cleanUrl(widget.imageUrl);
    if (!imageUrl) return null;

    const ratio = ratioToCss(widget.mainMediaRatio);

    return (
        <div
            className={`vc-cpwm-main-media ${ratio ? "vc-cpwm-media-fixed" : "vc-cpwm-media-auto"}`}
            style={{
                width: `${widget.mainMediaWidth}%`,
                aspectRatio: ratio,
                borderRadius: `${widget.mainMediaRadius}px`,
                ...getAlignmentStyle(widget.mainMediaAlign)
            }}
        >
            <img
                className="vc-cpwm-main-image"
                src={imageUrl}
                alt=""
                style={{
                    objectFit: widget.mainMediaFit,
                    borderRadius: `${widget.mainMediaRadius}px`
                }}
            />

            {overlayChildren}
        </div>
    );
}

function HeadingBlock({ widget, overlay = false }: { widget: CustomWidget; overlay?: boolean; }) {
    return (
        <div
            className={`vc-cpwm-heading ${overlay ? "vc-cpwm-heading-overlay" : ""}`}
            style={{ textAlign: widget.textAlign }}
        >
            {!!widget.icon && <WidgetIcon value={widget.icon} className="vc-cpwm-heading-icon" />}

            <div className="vc-cpwm-heading-copy">
                {!!widget.title && (
                    <div
                        className="vc-cpwm-title"
                        style={{
                            color: widget.textColor,
                            fontSize: `${widget.titleFontSize}px`,
                            fontWeight: widget.fontWeight
                        }}
                    >
                        {widget.title}
                    </div>
                )}

                {!!widget.description && (
                    <div
                        className="vc-cpwm-description"
                        style={{
                            color: widget.textColor,
                            fontSize: `${widget.descriptionFontSize}px`,
                            textAlign: widget.textAlign
                        }}
                    >
                        {widget.description}
                    </div>
                )}
            </div>
        </div>
    );
}

function MediaTile({ widget, item, carousel = false }: { widget: CustomWidget; item: WidgetMediaItem; carousel?: boolean; }) {
    const mediaUrl = cleanUrl(item.imageUrl);
    if (!mediaUrl) return null;

    const ratio = ratioToCss(item.ratio);

    const media = (
        <div
            className={`vc-cpwm-extra-media ${ratio ? "vc-cpwm-media-fixed" : "vc-cpwm-media-auto"}`}
            style={{
                aspectRatio: ratio,
                borderRadius: `${item.radius}px`
            }}
        >
            <img
                className="vc-cpwm-extra-image"
                src={mediaUrl}
                alt=""
                style={{
                    objectFit: item.fit,
                    borderRadius: `${item.radius}px`
                }}
            />

            {item.captionPosition === "overlay" && !!item.caption && (
                <div
                    className={`vc-cpwm-media-caption vc-cpwm-overlay-pos-${item.overlayPosition}`}
                    style={{ color: widget.textColor }}
                >
                    {item.caption}
                </div>
            )}
        </div>
    );

    return (
        <div
            className={`vc-cpwm-media-item ${item.captionPosition === "side" ? "vc-cpwm-media-item-side" : "vc-cpwm-media-item-stack"} ${carousel ? "vc-cpwm-media-item-carousel" : ""}`}
            style={carousel ? undefined : { gridColumn: `span ${widthToGridSpan(item.width)}` }}
        >
            {media}

            {item.captionPosition !== "overlay" && !!item.caption && (
                <div className="vc-cpwm-media-caption-static" style={{ color: widget.textColor }}>
                    {item.caption}
                </div>
            )}
        </div>
    );
}

function MediaCarousel({ widget }: { widget: CustomWidget; }) {
    const usable = widget.media.filter(item => !!cleanUrl(item.imageUrl));
    const [index, setIndex] = useState(0);

    useEffect(() => {
        if (usable.length <= 1) return;

        const interval = window.setInterval(() => {
            setIndex(current => (current + 1) % usable.length);
        }, widget.carouselInterval * 1000);

        return () => window.clearInterval(interval);
    }, [usable.length, widget.carouselInterval]);

    useEffect(() => {
        if (index >= usable.length) setIndex(0);
    }, [index, usable.length]);

    if (!usable.length) return null;

    const current = usable[index] ?? usable[0];

    return (
        <div className="vc-cpwm-carousel">
            <MediaTile widget={widget} item={{ ...current, width: 100 }} carousel />

            {usable.length > 1 && (
                <>
                    <button
                        className="vc-cpwm-carousel-button vc-cpwm-carousel-prev"
                        onClick={() => setIndex(currentIndex => (currentIndex - 1 + usable.length) % usable.length)}
                    >
                        ‹
                    </button>

                    <button
                        className="vc-cpwm-carousel-button vc-cpwm-carousel-next"
                        onClick={() => setIndex(currentIndex => (currentIndex + 1) % usable.length)}
                    >
                        ›
                    </button>

                    <div className="vc-cpwm-carousel-dots">
                        {usable.map((item, dotIndex) => (
                            <button
                                key={item.id}
                                className={`vc-cpwm-carousel-dot ${dotIndex === index ? "vc-cpwm-carousel-dot-active" : ""}`}
                                onClick={() => setIndex(dotIndex)}
                            />
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}

function ExtraMedia({ widget }: { widget: CustomWidget; }) {
    if (!widget.media.length) return null;

    if (widget.mediaLayout === "carousel") return <MediaCarousel widget={widget} />;

    return (
        <div className="vc-cpwm-gallery">
            {widget.media.map(item => (
                <MediaTile key={item.id} widget={widget} item={item} />
            ))}
        </div>
    );
}

function WidgetButtons({ widget }: { widget: CustomWidget; }) {
    const buttons = widget.buttons.filter(button => !!cleanUrl(button.url));
    if (!buttons.length) return null;

    return (
        <div
            className="vc-cpwm-buttons"
            style={{
                justifyContent:
                    widget.textAlign === "left"
                        ? "flex-start"
                        : widget.textAlign === "right"
                            ? "flex-end"
                            : "center"
            }}
        >
            {buttons.map(button => {
                const link = cleanUrl(button.url);
                if (!link) return null;

                return (
                    <MaskedLink
                        key={button.id}
                        href={link}
                        className="vc-cpwm-button-link"
                        style={{ backgroundColor: button.color || widget.accentColor }}
                    >
                        {!!button.icon && <WidgetIcon value={button.icon} className="vc-cpwm-button-icon" />}
                        <span>{button.label || "open"}</span>
                    </MaskedLink>
                );
            })}
        </div>
    );
}

function WidgetHero({ widget }: { widget: CustomWidget; }) {
    const hasMainMedia = !!cleanUrl(widget.imageUrl);

    if (!hasMainMedia) return <HeadingBlock widget={widget} />;

    if (widget.mainLayout === "overlay") {
        return (
            <MainMedia
                widget={widget}
                overlayChildren={
                    <div className={`vc-cpwm-main-overlay-copy vc-cpwm-overlay-pos-${widget.mainOverlayPosition}`}>
                        <HeadingBlock widget={widget} overlay />
                    </div>
                }
            />
        );
    }

    if (widget.mainLayout === "side") {
        return (
            <div className="vc-cpwm-main-side">
                <MainMedia widget={widget} />
                <HeadingBlock widget={widget} />
            </div>
        );
    }

    return (
        <>
            <MainMedia widget={widget} />
            <HeadingBlock widget={widget} />
        </>
    );
}

function WidgetCard({ widget: rawWidget, compact = false, preview = false }: { widget: CustomWidget; compact?: boolean; preview?: boolean; }) {
    const widget = normalizeWidget(rawWidget);

    return (
        <section
            className={`vc-cpwm-widget vc-cpwm-anim-${widget.animation} ${compact ? "vc-cpwm-widget-compact" : ""} ${preview ? "vc-cpwm-preview-widget" : ""}`}
            style={{
                color: widget.textColor,
                borderColor: widget.accentColor,
                borderRadius: `${widget.borderRadius}px`,
                borderWidth: `${widget.borderWidth}px`,
                boxShadow: getWidgetShadow(widget)
            }}
        >
            <div className="vc-cpwm-card-background" style={getCardBackgroundStyle(widget)} />

            <div
                className="vc-cpwm-card-overlay"
                style={{ backgroundColor: `rgba(0,0,0,${widget.overlayOpacity / 100})` }}
            />

            <div className="vc-cpwm-card-inner">
                <WidgetHero widget={widget} />
                <ExtraMedia widget={widget} />
                <WidgetButtons widget={widget} />
            </div>
        </section>
    );
}

function nativeBorderColorWithOpacity(color: string, opacity: number) {
    const alpha = clamp(opacity, 0, 100) / 100;
    const value = color.trim();

    const shortHex = value.match(/^#([0-9a-f]{3})$/i);
    if (shortHex) {
        const [r, g, b] = shortHex[1]
            .split("")
            .map(char => parseInt(char + char, 16));

        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    const longHex = value.match(/^#([0-9a-f]{6})$/i);
    if (longHex) {
        const hex = longHex[1];
        const r = parseInt(hex.slice(0, 2), 16);
        const g = parseInt(hex.slice(2, 4), 16);
        const b = parseInt(hex.slice(4, 6), 16);

        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    /* Fallback for any valid CSS color typed manually. */
    return `color-mix(in srgb, ${value || "#ffffff"} ${clamp(opacity, 0, 100)}%, transparent)`;
}

function findDiscordNativeWidgetSurface(card: HTMLElement) {
    const host = card.closest<HTMLElement>(".vc-cpwm-board-host");
    const scope = host?.parentElement;
    if (!host || !scope) return null;

    /* Prefer a real Discord widget that is already rendered on the same Board.
     * We only use it as a color reference; nothing is moved or modified. */
    const anchors = Array.from(
        scope.querySelectorAll<HTMLElement>("div, span, h1, h2, h3, h4, h5, h6")
    ).filter(element => !host.contains(element));

    const anchor = anchors.find(element => {
        const text = elementText(element);
        return /^(favorite game|games i like|currently playing|want to play|games i've played)$/i.test(text);
    });

    if (!anchor) return null;

    const hostRect = host.getBoundingClientRect();
    let current: HTMLElement | null = anchor;

    for (let i = 0; current && i < 9; i++, current = current.parentElement) {
        if (current === scope) break;

        const style = getComputedStyle(current);
        const rect = current.getBoundingClientRect();
        const radius = Number.parseFloat(style.borderTopLeftRadius) || 0;
        const backgroundColor = style.backgroundColor;
        const backgroundImage = style.backgroundImage;
        const hasColor = backgroundColor && backgroundColor !== "transparent" && backgroundColor !== "rgba(0, 0, 0, 0)";
        const widthLooksLikeCard = rect.width >= hostRect.width * 0.72 && rect.width <= hostRect.width * 1.08;

        if (hasColor && widthLooksLikeCard && rect.height >= 70 && radius >= 8) {
            return backgroundImage && backgroundImage !== "none"
                ? `${backgroundImage}, ${backgroundColor}`
                : backgroundColor;
        }
    }

    return null;
}

function getNativeCardStyle(widget: NativeWidget, sampledDiscordSurface?: string | null) {
    /* If Discord already has a native widget (Favorite Game / Games I Like / etc.)
     * on this Board, use its actual computed surface color. This matches the
     * current profile theme much more closely than guessing from theme vars. */
    const profileSurface = sampledDiscordSurface
        || "color-mix(in srgb, var(--profile-gradient-primary-color, var(--profile-body-background-color, var(--background-secondary))) 90%, white 10%)";

    const background = widget.backgroundMode === "solid"
        ? widget.backgroundColor
        : widget.backgroundMode === "gradient"
            ? `linear-gradient(${widget.gradientAngle}deg, ${widget.gradientStart}, ${widget.gradientEnd})`
            : profileSurface;

    const borderWidth = clamp(widget.borderWidth, 0, 8);
    const borderColor = nativeBorderColorWithOpacity(
        widget.borderColor,
        widget.borderOpacity
    );

    return {
        background,
        /* Use the full inline border shorthand so the native CSS border cannot
         * override width/color/opacity independently. */
        border: `${borderWidth}px solid ${borderColor}`
    };
}

function NativeWidgetCard({ widget: rawWidget, compact = false, preview = false }: { widget: NativeWidget; compact?: boolean; preview?: boolean; }) {
    const widget = normalizeNativeWidget(rawWidget);
    const heroImage = cleanUrl(widget.heroImageUrl);
    const cardRef = useRef<HTMLElement | null>(null);
    const [discordSurface, setDiscordSurface] = useState<string | null>(null);

    useEffect(() => {
        if (widget.backgroundMode !== "profile" || compact || preview) {
            setDiscordSurface(null);
            return;
        }

        let sampledElement: HTMLElement | null = null;

        const syncSurface = () => {
            const card = cardRef.current;
            if (!card?.isConnected) return;

            /* Re-resolve when Discord re-renders the native widget while the
             * user changes profile colors/theme. */
            if (!sampledElement?.isConnected) {
                const host = card.closest<HTMLElement>(".vc-cpwm-board-host");
                const scope = host?.parentElement;
                if (!host || !scope) return;

                const anchors = Array.from(
                    scope.querySelectorAll<HTMLElement>("div, span, h1, h2, h3, h4, h5, h6")
                ).filter(element => !host.contains(element));

                const anchor = anchors.find(element => /^(favorite game|games i like|currently playing|want to play|games i've played)$/i.test(elementText(element)));
                if (anchor) {
                    const hostRect = host.getBoundingClientRect();
                    let current: HTMLElement | null = anchor;

                    for (let i = 0; current && i < 9; i++, current = current.parentElement) {
                        if (current === scope) break;

                        const style = getComputedStyle(current);
                        const rect = current.getBoundingClientRect();
                        const radius = Number.parseFloat(style.borderTopLeftRadius) || 0;
                        const bg = style.backgroundColor;
                        const widthLooksLikeCard = rect.width >= hostRect.width * 0.72 && rect.width <= hostRect.width * 1.08;

                        if (bg && bg !== "transparent" && bg !== "rgba(0, 0, 0, 0)" && widthLooksLikeCard && rect.height >= 70 && radius >= 8) {
                            sampledElement = current;
                            break;
                        }
                    }
                }
            }

            if (!sampledElement) {
                const fallback = findDiscordNativeWidgetSurface(card);
                if (fallback) setDiscordSurface(current => current === fallback ? current : fallback);
                return;
            }

            const style = getComputedStyle(sampledElement);
            const backgroundColor = style.backgroundColor;
            const backgroundImage = style.backgroundImage;
            const nextSurface = backgroundImage && backgroundImage !== "none"
                ? `${backgroundImage}, ${backgroundColor}`
                : backgroundColor;

            if (nextSurface && nextSurface !== "transparent" && nextSurface !== "rgba(0, 0, 0, 0)") {
                setDiscordSurface(current => current === nextSurface ? current : nextSurface);
            }
        };

        syncSurface();
        const timer = window.setInterval(syncSurface, 500);
        return () => window.clearInterval(timer);
    }, [widget.backgroundMode, compact, preview]);

    return (
        <section
            ref={cardRef}
            className={`vc-cpwm-native-card ${compact ? "vc-cpwm-native-card-compact" : ""} ${preview ? "vc-cpwm-native-card-preview" : ""}`}
            style={getNativeCardStyle(widget, discordSurface)}
        >
            <div className={`vc-cpwm-native-hero vc-cpwm-native-hero-${widget.heroSide}`}>
                <div className="vc-cpwm-native-header">
                    <WidgetIcon value={widget.headerIcon} className="vc-cpwm-native-header-icon" />
                    <span
                        className="vc-cpwm-native-header-text"
                        style={{ color: widget.headerTextColor || undefined }}
                    >
                        {widget.headerText}
                    </span>
                </div>

                <div className="vc-cpwm-native-hero-copy">
                    <div
                        className="vc-cpwm-native-hero-title"
                        style={{ color: widget.heroTitleColor || undefined }}
                    >
                        {widget.heroTitle}
                    </div>
                    <div
                        className="vc-cpwm-native-hero-subtitle"
                        style={{ color: widget.heroSubtitleColor || undefined }}
                    >
                        {widget.heroSubtitle}
                    </div>
                </div>

                {heroImage && (
                    <div
                        className="vc-cpwm-native-hero-image-wrap"
                        style={{
                            width: `${52 * widget.heroImageBoxScale / 100}%`,
                            height: `${widget.heroImageBoxScale}%`,
                            top: `${(100 - widget.heroImageBoxScale) / 2}%`,
                            bottom: "auto"
                        }}
                    >
                        <img
                            className="vc-cpwm-native-hero-image"
                            src={heroImage}
                            alt=""
                            style={{
                                objectFit: widget.heroImageFit,
                                /* Reposition the crop inside the fixed frame instead of moving the <img> box.
                                 * This prevents empty gaps when using cover/crop. */
                                objectPosition: `${50 + widget.heroImageOffsetX}% ${50 + widget.heroImageOffsetY}%`,
                                transform: `scale(${(widget.heroImageFit === "cover" ? Math.max(100, widget.heroImageScale) : widget.heroImageScale) / 100})`
                            }}
                        />
                    </div>
                )}
            </div>

            {!!widget.items.length && (
                <div className="vc-cpwm-native-grid">
                    {widget.items.map(item => {
                        const image = cleanUrl(item.imageUrl);

                        return (
                            <div
                                key={item.id}
                                className="vc-cpwm-native-grid-item"
                                style={{
                                    gridTemplateColumns: `${48 * item.imageBoxScale / 100}px minmax(0, 1fr)`
                                }}
                            >
                                <div
                                    className="vc-cpwm-native-grid-thumb"
                                    style={{
                                        width: `${48 * item.imageBoxScale / 100}px`,
                                        height: `${48 * item.imageBoxScale / 100}px`
                                    }}
                                >
                                    {image ? (() => {
                                        const tileScale = (item.imageFit === "cover"
                                            ? Math.max(100, item.imageScale)
                                            : item.imageScale) / 100;

                                        /* object-position handles the image's natural cover crop.
                                         * When crop zoom is above 100%, translate also uses the
                                         * extra zoomed area so left/right/up/down keeps working
                                         * without ever exposing an empty gap in the tile box. */
                                        const tileZoomOverflow = item.imageFit === "cover"
                                            ? Math.max(0, tileScale - 1)
                                            : 0;
                                        const tilePanX = -(item.imageOffsetX / 50) * tileZoomOverflow * 50;
                                        const tilePanY = -(item.imageOffsetY / 50) * tileZoomOverflow * 50;

                                        return (
                                            <img
                                                src={image}
                                                alt=""
                                                style={{
                                                    objectFit: item.imageFit,
                                                    objectPosition: `${50 + item.imageOffsetX}% ${50 + item.imageOffsetY}%`,
                                                    transform: `translate(${tilePanX}%, ${tilePanY}%) scale(${tileScale})`
                                                }}
                                            />
                                        );
                                    })() : (
                                        <div className="vc-cpwm-native-grid-placeholder">✦</div>
                                    )}
                                </div>

                                <div className="vc-cpwm-native-grid-copy">
                                    <div
                                        className="vc-cpwm-native-grid-title"
                                        style={{ color: widget.tileTitleColor || undefined }}
                                    >
                                        {item.title}
                                    </div>
                                    <div
                                        className="vc-cpwm-native-grid-subtitle"
                                        style={{ color: widget.tileSubtitleColor || undefined }}
                                    >
                                        {item.subtitle}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </section>
    );
}

function WidgetHost({ compact = false }: { compact?: boolean; }) {
    const { widgets: rawWidgets } = settings.use(WIDGET_KEYS);
    const { nativeWidgets: rawNativeWidgets } = settings.use(NATIVE_KEYS);

    const widgets = (rawWidgets ?? []).map(normalizeWidget).filter(widget => widget.enabled);
    const nativeWidgets = (rawNativeWidgets ?? []).map(normalizeNativeWidget).filter(widget => widget.enabled);

    if (!widgets.length && !nativeWidgets.length) return null;

    return (
        <div className={`vc-cpwm-profile-root ${compact ? "vc-cpwm-profile-root-compact" : ""}`}>
            {widgets.map(widget => (
                <WidgetCard key={`custom-${widget.id}`} widget={widget} compact={compact} />
            ))}

            {nativeWidgets.map(widget => (
                <NativeWidgetCard key={`native-${widget.id}`} widget={widget} compact={compact} />
            ))}
        </div>
    );
}

function SectionTitle({ children }: { children: any; }) {
    return (
        <Forms.FormTitle tag="h5" className={Margins.top8}>
            {children}
        </Forms.FormTitle>
    );
}

function SelectField({ label, value, children, onChange }: { label: string; value: string | number; children: any; onChange: (value: string) => void; }) {
    return (
        <div className="vc-cpwm-select-field">
            <div className="vc-cpwm-field-label">{label}</div>

            <select
                className="vc-cpwm-select"
                value={value}
                onChange={event => onChange(event.currentTarget.value)}
            >
                {children}
            </select>
        </div>
    );
}

function RangeField({ label, value, min, max, step = 1, suffix = "", onChange }: { label: string; value: number; min: number; max: number; step?: number; suffix?: string; onChange: (value: number) => void; }) {
    return (
        <div className="vc-cpwm-range-field">
            <div className="vc-cpwm-range-top">
                <span className="vc-cpwm-field-label">{label}</span>
                <span className="vc-cpwm-range-value">{value}{suffix}</span>
            </div>

            <input
                className="vc-cpwm-range"
                type="range"
                min={min}
                max={max}
                step={step}
                value={value}
                onChange={event => onChange(Number(event.currentTarget.value))}
            />
        </div>
    );
}

function ToggleField({ label, enabled, onChange }: { label: string; enabled: boolean; onChange: (value: boolean) => void; }) {
    return (
        <button
            className={`vc-cpwm-toggle-field ${enabled ? "vc-cpwm-toggle-field-enabled" : ""}`}
            onClick={() => onChange(!enabled)}
        >
            <span>{label}</span>
            <span className="vc-cpwm-toggle-pill"><span className="vc-cpwm-toggle-dot" /></span>
        </button>
    );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void; }) {
    const pickerValue = /^#[0-9a-f]{6}$/i.test(value) ? value : "#ffffff";

    return (
        <div className="vc-cpwm-color-field">
            <div className="vc-cpwm-field-label">{label}</div>

            <div className="vc-cpwm-color-row">
                <input
                    className="vc-cpwm-color-picker"
                    type="color"
                    value={pickerValue}
                    onChange={event => onChange(event.currentTarget.value)}
                />

                <TextInput value={value} placeholder="#ffffff" onChange={onChange} />
            </div>
        </div>
    );
}

function ImageSourceInput({
    value,
    placeholder = "https://...",
    onChange,
    allowText = false
}: {
    value: string;
    placeholder?: string;
    onChange: (value: string) => void;
    allowText?: boolean;
}) {
    const local = isLocalImageSource(value);

    const chooseFile = (file?: File) => {
        if (!file) return;
        if (!file.type.startsWith("image/")) return;

        const reader = new FileReader();
        reader.onload = () => {
            if (typeof reader.result === "string" && isLocalImageSource(reader.result)) {
                onChange(reader.result);
            }
        };
        reader.readAsDataURL(file);
    };

    return (
        <div className="vc-cpwm-source-field">
            <div className="vc-cpwm-source-row">
                <div className="vc-cpwm-source-text">
                    <TextInput
                        value={local ? "" : value}
                        placeholder={local ? "local image selected" : placeholder}
                        onChange={onChange}
                    />
                </div>

                <label className="vc-cpwm-file-button">
                    <span>choose file</span>
                    <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/gif,image/avif,image/bmp"
                        onChange={event => {
                            const input = event.currentTarget;
                            chooseFile(input.files?.[0]);
                            input.value = "";
                        }}
                    />
                </label>

                {local && (
                    <button className="vc-cpwm-file-clear" type="button" onClick={() => onChange("")}>
                        clear
                    </button>
                )}
            </div>

            <div className="vc-cpwm-source-hint">
                {local
                    ? "local file embedded in plugin settings"
                    : allowText
                        ? "emoji/text, image URL, or choose a local image/gif"
                        : "image URL or choose a local image/gif"}
            </div>
        </div>
    );
}

function PresetBar({ widgetId }: { widgetId: string; }) {
    return (
        <div className="vc-cpwm-preset-bar">
            <span className="vc-cpwm-field-label">presets</span>

            <div className="vc-cpwm-preset-buttons">
                <Button size={Button.Sizes.SMALL} onClick={() => applyPreset(widgetId, "native")}>native</Button>
                <Button size={Button.Sizes.SMALL} onClick={() => applyPreset(widgetId, "minimal")}>minimal</Button>
                <Button size={Button.Sizes.SMALL} onClick={() => applyPreset(widgetId, "glass")}>glass</Button>
                <Button size={Button.Sizes.SMALL} onClick={() => applyPreset(widgetId, "anime")}>anime</Button>
            </div>
        </div>
    );
}

function MainMediaEditor({ widget }: { widget: CustomWidget; }) {
    return (
        <div className="vc-cpwm-settings-section">
            <div className="vc-cpwm-settings-section-title">main image / gif</div>

            <ImageSourceInput
                value={widget.imageUrl}
                placeholder="https://..."
                onChange={value => updateWidget(widget.id, { imageUrl: value })}
            />

            <div className="vc-cpwm-control-grid">
                <SelectField label="layout" value={widget.mainLayout} onChange={value => updateWidget(widget.id, { mainLayout: value as MainLayout })}>
                    <option value="top">image top</option>
                    <option value="side">image side</option>
                    <option value="overlay">text on image</option>
                </SelectField>

                <SelectField label="width" value={widget.mainMediaWidth} onChange={value => updateWidget(widget.id, { mainMediaWidth: Number(value) as MediaWidth })}>
                    <option value="25">25%</option>
                    <option value="50">50%</option>
                    <option value="75">75%</option>
                    <option value="100">100%</option>
                </SelectField>

                <SelectField label="shape" value={widget.mainMediaRatio} onChange={value => updateWidget(widget.id, { mainMediaRatio: value as MediaRatio })}>
                    <option value="auto">original / auto</option>
                    <option value="1:1">1:1</option>
                    <option value="4:3">4:3</option>
                    <option value="3:2">3:2</option>
                    <option value="16:9">16:9</option>
                    <option value="21:9">21:9</option>
                </SelectField>

                <SelectField label="fit" value={widget.mainMediaFit} onChange={value => updateWidget(widget.id, { mainMediaFit: value as MediaFit })}>
                    <option value="contain">contain / full</option>
                    <option value="cover">cover / crop</option>
                    <option value="fill">stretch</option>
                </SelectField>

                <SelectField label="position" value={widget.mainMediaAlign} onChange={value => updateWidget(widget.id, { mainMediaAlign: value as MediaAlign })}>
                    <option value="left">left</option>
                    <option value="center">center</option>
                    <option value="right">right</option>
                </SelectField>

                {widget.mainLayout === "overlay" && (
                    <SelectField label="text on image" value={widget.mainOverlayPosition} onChange={value => updateWidget(widget.id, { mainOverlayPosition: value as OverlayPosition })}>
                        <option value="top-left">top left</option>
                        <option value="top-center">top center</option>
                        <option value="top-right">top right</option>
                        <option value="center">center</option>
                        <option value="bottom-left">bottom left</option>
                        <option value="bottom-center">bottom center</option>
                        <option value="bottom-right">bottom right</option>
                    </SelectField>
                )}
            </div>

            <RangeField
                label="image radius"
                value={widget.mainMediaRadius}
                min={0}
                max={40}
                suffix="px"
                onChange={value => updateWidget(widget.id, { mainMediaRadius: value })}
            />
        </div>
    );
}

function ExtraMediaEditor({ widget }: { widget: CustomWidget; }) {
    return (
        <div className="vc-cpwm-settings-section">
            <div className="vc-cpwm-section-header">
                <div>
                    <div className="vc-cpwm-settings-section-title">extra images / gifs</div>
                    <Forms.FormText>max 4. drag & drop works with the ⠿ handle.</Forms.FormText>
                </div>

                <Button
                    size={Button.Sizes.SMALL}
                    disabled={widget.media.length >= 4}
                    onClick={() => addMedia(widget.id)}
                >
                    + add media
                </Button>
            </div>

            <div className="vc-cpwm-control-grid vc-cpwm-control-grid-small">
                <SelectField label="display" value={widget.mediaLayout} onChange={value => updateWidget(widget.id, { mediaLayout: value as MediaLayout })}>
                    <option value="grid">grid</option>
                    <option value="carousel">carousel</option>
                </SelectField>

                {widget.mediaLayout === "carousel" && (
                    <RangeField
                        label="slide time"
                        value={widget.carouselInterval}
                        min={1}
                        max={30}
                        suffix="s"
                        onChange={value => updateWidget(widget.id, { carouselInterval: value })}
                    />
                )}
            </div>

            {widget.media.map((item, mediaIndex) => (
                <div
                    key={item.id}
                    className="vc-cpwm-sub-editor"
                    onDragOver={event => {
                        event.preventDefault();
                        event.dataTransfer.dropEffect = "move";
                    }}
                    onDrop={event => {
                        event.preventDefault();
                        if (!draggedMedia || draggedMedia.widgetId !== widget.id) return;

                        const rect = event.currentTarget.getBoundingClientRect();

                        reorderMedia(
                            widget.id,
                            draggedMedia.mediaId,
                            item.id,
                            event.clientY > rect.top + rect.height / 2
                        );

                        draggedMedia = null;
                    }}
                >
                    <div className="vc-cpwm-sub-editor-header">
                        <div className="vc-cpwm-sub-editor-title">
                            <span
                                className="vc-cpwm-drag-handle"
                                draggable
                                onDragStart={event => {
                                    draggedMedia = { widgetId: widget.id, mediaId: item.id };
                                    event.dataTransfer.effectAllowed = "move";
                                }}
                                onDragEnd={() => { draggedMedia = null; }}
                            >
                                ⠿
                            </span>

                            <strong>media #{mediaIndex + 1}</strong>
                        </div>

                        <div className="vc-cpwm-editor-actions">
                            <Button size={Button.Sizes.SMALL} disabled={mediaIndex === 0} onClick={() => moveMedia(widget.id, item.id, -1)}>↑</Button>
                            <Button size={Button.Sizes.SMALL} disabled={mediaIndex === widget.media.length - 1} onClick={() => moveMedia(widget.id, item.id, 1)}>↓</Button>
                            <Button size={Button.Sizes.SMALL} color={Button.Colors.RED} onClick={() => removeMedia(widget.id, item.id)}>remove</Button>
                        </div>
                    </div>

                    <SectionTitle>image / gif url</SectionTitle>
                    <ImageSourceInput value={item.imageUrl} placeholder="https://..." onChange={value => updateMedia(widget.id, item.id, { imageUrl: value })} />

                    <SectionTitle>caption</SectionTitle>
                    <TextInput value={item.caption} placeholder="e.g. tokyo 🌸" onChange={value => updateMedia(widget.id, item.id, { caption: value })} />

                    <div className="vc-cpwm-control-grid">
                        <SelectField label="width" value={item.width} onChange={value => updateMedia(widget.id, item.id, { width: Number(value) as MediaWidth })}>
                            <option value="25">25%</option>
                            <option value="50">50%</option>
                            <option value="75">75%</option>
                            <option value="100">100%</option>
                        </SelectField>

                        <SelectField label="shape" value={item.ratio} onChange={value => updateMedia(widget.id, item.id, { ratio: value as MediaRatio })}>
                            <option value="auto">original</option>
                            <option value="1:1">1:1</option>
                            <option value="4:3">4:3</option>
                            <option value="3:2">3:2</option>
                            <option value="16:9">16:9</option>
                            <option value="21:9">21:9</option>
                        </SelectField>

                        <SelectField label="fit" value={item.fit} onChange={value => updateMedia(widget.id, item.id, { fit: value as MediaFit })}>
                            <option value="contain">contain</option>
                            <option value="cover">cover</option>
                            <option value="fill">stretch</option>
                        </SelectField>

                        <SelectField label="caption" value={item.captionPosition} onChange={value => updateMedia(widget.id, item.id, { captionPosition: value as CaptionPosition })}>
                            <option value="below">below</option>
                            <option value="side">side</option>
                            <option value="overlay">on image</option>
                        </SelectField>

                        {item.captionPosition === "overlay" && (
                            <SelectField label="overlay position" value={item.overlayPosition} onChange={value => updateMedia(widget.id, item.id, { overlayPosition: value as OverlayPosition })}>
                                <option value="top-left">top left</option>
                                <option value="top-center">top center</option>
                                <option value="top-right">top right</option>
                                <option value="center">center</option>
                                <option value="bottom-left">bottom left</option>
                                <option value="bottom-center">bottom center</option>
                                <option value="bottom-right">bottom right</option>
                            </SelectField>
                        )}
                    </div>

                    <RangeField label="image radius" value={item.radius} min={0} max={40} suffix="px" onChange={value => updateMedia(widget.id, item.id, { radius: value })} />
                </div>
            ))}
        </div>
    );
}

function ButtonsEditor({ widget }: { widget: CustomWidget; }) {
    return (
        <div className="vc-cpwm-settings-section">
            <div className="vc-cpwm-section-header">
                <div>
                    <div className="vc-cpwm-settings-section-title">buttons / links</div>
                    <Forms.FormText>max 4 przyciski.</Forms.FormText>
                </div>

                <Button size={Button.Sizes.SMALL} disabled={widget.buttons.length >= 4} onClick={() => addButton(widget.id)}>
                    + add button
                </Button>
            </div>

            {widget.buttons.map((button, index) => (
                <div key={button.id} className="vc-cpwm-sub-editor">
                    <div className="vc-cpwm-sub-editor-header">
                        <strong>button #{index + 1}</strong>
                        <Button size={Button.Sizes.SMALL} color={Button.Colors.RED} onClick={() => removeButton(widget.id, button.id)}>remove</Button>
                    </div>

                    <div className="vc-cpwm-two-column">
                        <div>
                            <SectionTitle>label</SectionTitle>
                            <TextInput value={button.label} placeholder="github" onChange={value => updateButton(widget.id, button.id, { label: value })} />
                        </div>

                        <div>
                            <SectionTitle>icon</SectionTitle>
                            <ImageSourceInput value={button.icon} placeholder="✨ / GH / https://..." allowText onChange={value => updateButton(widget.id, button.id, { icon: value })} />
                        </div>
                    </div>

                    <SectionTitle>url</SectionTitle>
                    <TextInput value={button.url} placeholder="https://..." onChange={value => updateButton(widget.id, button.id, { url: value })} />

                    <div className="vc-cpwm-button-color">
                        <ColorField label="button color" value={button.color} onChange={value => updateButton(widget.id, button.id, { color: value })} />
                    </div>
                </div>
            ))}
        </div>
    );
}

function CardStyleEditor({ widget }: { widget: CustomWidget; }) {
    return (
        <div className="vc-cpwm-settings-section">
            <div className="vc-cpwm-settings-section-title">card / background</div>

            <div className="vc-cpwm-three-column">
                <ColorField label="background" value={widget.backgroundColor} onChange={value => updateWidget(widget.id, { backgroundColor: value })} />
                <ColorField label="text" value={widget.textColor} onChange={value => updateWidget(widget.id, { textColor: value })} />
                <ColorField label="accent" value={widget.accentColor} onChange={value => updateWidget(widget.id, { accentColor: value })} />
            </div>

            <SectionTitle>background image</SectionTitle>
            <ImageSourceInput value={widget.backgroundImage} placeholder="https://..." onChange={value => updateWidget(widget.id, { backgroundImage: value })} />

            <div className="vc-cpwm-control-grid">
                <SelectField label="background fit" value={widget.backgroundFit} onChange={value => updateWidget(widget.id, { backgroundFit: value as BackgroundFit })}>
                    <option value="cover">cover</option>
                    <option value="contain">contain</option>
                    <option value="fill">stretch</option>
                </SelectField>

                <SelectField label="background position" value={widget.backgroundPosition} onChange={value => updateWidget(widget.id, { backgroundPosition: value })}>
                    <option value="left top">left top</option>
                    <option value="center top">center top</option>
                    <option value="right top">right top</option>
                    <option value="left center">left center</option>
                    <option value="center">center</option>
                    <option value="right center">right center</option>
                    <option value="left bottom">left bottom</option>
                    <option value="center bottom">center bottom</option>
                    <option value="right bottom">right bottom</option>
                </SelectField>

                <SelectField label="animation" value={widget.animation} onChange={value => updateWidget(widget.id, { animation: value as WidgetAnimation })}>
                    <option value="none">none</option>
                    <option value="fade">fade</option>
                    <option value="slide">slide</option>
                    <option value="zoom">zoom</option>
                    <option value="glow">glow</option>
                </SelectField>
            </div>

            <div className="vc-cpwm-range-grid">
                <RangeField label="background blur" value={widget.backgroundBlur} min={0} max={30} suffix="px" onChange={value => updateWidget(widget.id, { backgroundBlur: value })} />
                <RangeField label="dark overlay" value={widget.overlayOpacity} min={0} max={90} suffix="%" onChange={value => updateWidget(widget.id, { overlayOpacity: value })} />
                <RangeField label="card radius" value={widget.borderRadius} min={0} max={40} suffix="px" onChange={value => updateWidget(widget.id, { borderRadius: value })} />
                <RangeField label="border width" value={widget.borderWidth} min={0} max={8} suffix="px" onChange={value => updateWidget(widget.id, { borderWidth: value })} />
                <RangeField label="shadow" value={widget.shadowStrength} min={0} max={40} onChange={value => updateWidget(widget.id, { shadowStrength: value })} />
                <RangeField label="glow" value={widget.glowStrength} min={0} max={40} onChange={value => updateWidget(widget.id, { glowStrength: value })} />
            </div>

            <ToggleField label="gradient background" enabled={widget.useGradient} onChange={enabled => updateWidget(widget.id, { useGradient: enabled })} />

            {widget.useGradient && (
                <>
                    <div className="vc-cpwm-three-column">
                        <ColorField label="gradient start" value={widget.gradientStart} onChange={value => updateWidget(widget.id, { gradientStart: value })} />
                        <ColorField label="gradient end" value={widget.gradientEnd} onChange={value => updateWidget(widget.id, { gradientEnd: value })} />
                    </div>

                    <RangeField label="gradient angle" value={widget.gradientAngle} min={0} max={360} suffix="°" onChange={value => updateWidget(widget.id, { gradientAngle: value })} />
                </>
            )}
        </div>
    );
}

function TypographyEditor({ widget }: { widget: CustomWidget; }) {
    return (
        <div className="vc-cpwm-settings-section">
            <div className="vc-cpwm-settings-section-title">typography</div>

            <div className="vc-cpwm-control-grid vc-cpwm-control-grid-small">
                <SelectField label="alignment" value={widget.textAlign} onChange={value => updateWidget(widget.id, { textAlign: value as TextAlign })}>
                    <option value="left">left</option>
                    <option value="center">center</option>
                    <option value="right">right</option>
                </SelectField>

                <SelectField label="weight" value={widget.fontWeight} onChange={value => updateWidget(widget.id, { fontWeight: Number(value) })}>
                    <option value="400">400 normal</option>
                    <option value="500">500</option>
                    <option value="600">600</option>
                    <option value="700">700 bold</option>
                    <option value="800">800</option>
                    <option value="900">900</option>
                </SelectField>
            </div>

            <div className="vc-cpwm-range-grid">
                <RangeField label="title size" value={widget.titleFontSize} min={10} max={40} suffix="px" onChange={value => updateWidget(widget.id, { titleFontSize: value })} />
                <RangeField label="description size" value={widget.descriptionFontSize} min={9} max={30} suffix="px" onChange={value => updateWidget(widget.id, { descriptionFontSize: value })} />
            </div>
        </div>
    );
}

function ImportExportPanel() {
    const [buffer, setBuffer] = useState("");
    const [status, setStatus] = useState("");

    function currentJson() {
        return JSON.stringify({ version: 5, widgets: getWidgets(), nativeWidgets: getNativeWidgets() }, null, 2);
    }

    function loadCurrent() {
        setBuffer(currentJson());
        setStatus("loaded current config");
    }

    function copyCurrent() {
        const text = currentJson();
        copyToClipboard(text);
        setBuffer(text);
        setStatus("copied to clipboard");
    }

    function importJson() {
        try {
            const parsed = JSON.parse(buffer);

            if (Array.isArray(parsed)) {
                writeWidgets(parsed.map((widget: Partial<CustomWidget>) => normalizeWidget({ ...widget, id: widget.id ?? makeId() })));
                setStatus(`imported ${parsed.length} custom widget(s)`);
                return;
            }

            const customList = parsed?.widgets ?? [];
            const nativeList = parsed?.nativeWidgets ?? [];

            if (!Array.isArray(customList) || !Array.isArray(nativeList))
                throw new Error("JSON needs widgets/nativeWidgets arrays");

            writeWidgets(customList.map((widget: Partial<CustomWidget>) => normalizeWidget({ ...widget, id: widget.id ?? makeId() })));
            writeNativeWidgets(nativeList.map((widget: Partial<NativeWidget>) => normalizeNativeWidget({ ...widget, id: widget.id ?? makeId() })));
            setStatus(`imported ${customList.length} custom + ${nativeList.length} native widget(s)`);
        } catch (error) {
            setStatus(`import failed: ${error instanceof Error ? error.message : "invalid json"}`);
        }
    }

    return (
        <div className="vc-cpwm-import-export">
            <div className="vc-cpwm-section-header">
                <div>
                    <div className="vc-cpwm-settings-section-title">import / export json</div>
                    <Forms.FormText>backup or move your setup to another build.</Forms.FormText>
                </div>

                <div className="vc-cpwm-editor-actions">
                    <Button size={Button.Sizes.SMALL} onClick={loadCurrent}>load current</Button>
                    <Button size={Button.Sizes.SMALL} onClick={copyCurrent}>copy export</Button>
                    <Button size={Button.Sizes.SMALL} color={Button.Colors.PRIMARY} onClick={importJson}>import</Button>
                </div>
            </div>

            <TextArea value={buffer} placeholder='{"version":5,"widgets":[...],"nativeWidgets":[...]}' onChange={setBuffer} />
            {!!status && <div className="vc-cpwm-import-status">{status}</div>}
        </div>
    );
}

type CustomEditorSection = "content" | "main" | "media" | "buttons" | "style" | "typography";
type NativeEditorSection = "content" | "hero" | "tiles" | "colors" | "background" | "border";
type EditorTheme = "dark" | "light";

type StudioSection = {
    id: string;
    icon: string;
    label: string;
    description: string;
};

function StudioSidebar({ sections, active, onChange }: { sections: StudioSection[]; active: string; onChange: (id: string) => void; }) {
    return (
        <aside className="vc-cpwm-studio-sidebar">
            <div className="vc-cpwm-studio-sidebar-label">editor</div>
            <div className="vc-cpwm-studio-sidebar-list">
                {sections.map(section => (
                    <button
                        key={section.id}
                        className={`vc-cpwm-studio-nav-item ${active === section.id ? "vc-cpwm-studio-nav-item-active" : ""}`}
                        onClick={() => onChange(section.id)}
                        title={section.description}
                    >
                        <span className="vc-cpwm-studio-nav-icon">{section.icon}</span>
                        <span className="vc-cpwm-studio-nav-copy">
                            <strong>{section.label}</strong>
                            <small>{section.description}</small>
                        </span>
                    </button>
                ))}
            </div>
        </aside>
    );
}

function StudioPanelHeader({ title, description }: { title: string; description: string; }) {
    return (
        <div className="vc-cpwm-studio-panel-header">
            <div>
                <div className="vc-cpwm-studio-panel-eyebrow">editing</div>
                <div className="vc-cpwm-studio-panel-title">{title}</div>
                <div className="vc-cpwm-studio-panel-description">{description}</div>
            </div>
        </div>
    );
}

const CUSTOM_SECTIONS: StudioSection[] = [
    { id: "content", icon: "✎", label: "content", description: "title, description, icon" },
    { id: "main", icon: "▣", label: "main media", description: "main image / gif" },
    { id: "media", icon: "▦", label: "gallery", description: "extra images / gifs" },
    { id: "buttons", icon: "↗", label: "buttons", description: "links and actions" },
    { id: "style", icon: "◐", label: "appearance", description: "card, background, effects" },
    { id: "typography", icon: "Aa", label: "typography", description: "text size and alignment" }
];

const NATIVE_SECTIONS: StudioSection[] = [
    { id: "content", icon: "✎", label: "content", description: "header and text" },
    { id: "hero", icon: "▣", label: "hero image", description: "image, crop and position" },
    { id: "tiles", icon: "▦", label: "bottom tiles", description: "the 2×2 tile grid" },
    { id: "colors", icon: "●", label: "text colors", description: "header, hero and tiles" },
    { id: "background", icon: "◐", label: "background", description: "profile, solid or gradient" },
    { id: "border", icon: "□", label: "border", description: "color, opacity and width" }
];

function CustomWidgetEditorCard({ widget, index, total }: { widget: CustomWidget; index: number; total: number; }) {
    const [section, setSection] = useState<CustomEditorSection>("content");
    const current = CUSTOM_SECTIONS.find(item => item.id === section) ?? CUSTOM_SECTIONS[0]!;

    return (
        <div
            className="vc-cpwm-editor-card vc-cpwm-studio-card"
            onDragOver={event => {
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
            }}
            onDrop={event => {
                event.preventDefault();
                if (!draggedWidgetId) return;

                const rect = event.currentTarget.getBoundingClientRect();
                reorderWidget(draggedWidgetId, widget.id, event.clientY > rect.top + rect.height / 2);
                draggedWidgetId = null;
            }}
        >
            <div className="vc-cpwm-editor-toolbar vc-cpwm-studio-toolbar">
                <div className="vc-cpwm-editor-title">
                    <span
                        className="vc-cpwm-drag-handle"
                        draggable
                        onDragStart={event => {
                            draggedWidgetId = widget.id;
                            event.dataTransfer.effectAllowed = "move";
                        }}
                        onDragEnd={() => { draggedWidgetId = null; }}
                    >
                        ⠿
                    </span>

                    <div className="vc-cpwm-studio-widget-title">
                        <strong>widget #{index + 1}</strong>
                        <span>{widget.title || "untitled widget"}</span>
                    </div>
                </div>

                <div className="vc-cpwm-editor-actions vc-cpwm-studio-actions">
                    <Button size={Button.Sizes.SMALL} disabled={index === 0} onClick={() => moveWidget(widget.id, -1)}>↑</Button>
                    <Button size={Button.Sizes.SMALL} disabled={index === total - 1} onClick={() => moveWidget(widget.id, 1)}>↓</Button>
                    <Button size={Button.Sizes.SMALL} onClick={() => duplicateWidget(widget.id)}>duplicate</Button>
                    <Button size={Button.Sizes.SMALL} onClick={() => resetWidget(widget.id)}>reset</Button>
                    <Button size={Button.Sizes.SMALL} onClick={() => updateWidget(widget.id, { enabled: !widget.enabled })}>{widget.enabled ? "enabled" : "disabled"}</Button>
                    <Button size={Button.Sizes.SMALL} color={Button.Colors.RED} onClick={() => removeWidget(widget.id)}>remove</Button>
                </div>
            </div>

            <div className="vc-cpwm-studio-preset-wrap">
                <PresetBar widgetId={widget.id} />
            </div>

            <div className="vc-cpwm-studio-layout">
                <StudioSidebar
                    sections={CUSTOM_SECTIONS}
                    active={section}
                    onChange={value => setSection(value as CustomEditorSection)}
                />

                <main className="vc-cpwm-studio-panel">
                    <StudioPanelHeader title={current.label} description={current.description} />

                    {section === "content" && (
                        <div className="vc-cpwm-studio-section-body">
                            <div className="vc-cpwm-two-column">
                                <div>
                                    <SectionTitle>title</SectionTitle>
                                    <TextInput value={widget.title} placeholder="japan" onChange={value => updateWidget(widget.id, { title: value })} />
                                </div>
                                <div>
                                    <SectionTitle>icon</SectionTitle>
                                    <ImageSourceInput value={widget.icon} placeholder="🌸 / JP / https://..." allowText onChange={value => updateWidget(widget.id, { icon: value })} />
                                </div>
                            </div>

                            <SectionTitle>description</SectionTitle>
                            <TextArea value={widget.description} placeholder="description..." onChange={value => updateWidget(widget.id, { description: value })} />
                        </div>
                    )}

                    {section === "main" && <MainMediaEditor widget={widget} />}
                    {section === "media" && <ExtraMediaEditor widget={widget} />}
                    {section === "buttons" && <ButtonsEditor widget={widget} />}
                    {section === "style" && <CardStyleEditor widget={widget} />}
                    {section === "typography" && <TypographyEditor widget={widget} />}
                </main>
            </div>
        </div>
    );
}

function CustomBuilderPage() {
    const { widgets: rawWidgets } = settings.use(WIDGET_KEYS);
    const widgets = (rawWidgets ?? []).map(normalizeWidget);

    return (
        <div className="vc-cpwm-manager vc-cpwm-studio-page">
            <div className="vc-cpwm-manager-header vc-cpwm-studio-page-header">
                <div>
                    <div className="vc-cpwm-page-kicker">workspace</div>
                    <Forms.FormTitle tag="h3">custom builder</Forms.FormTitle>
                    <Forms.FormText>freestyle builder without endless scrolling — choose a category on the left.</Forms.FormText>
                </div>

                <Button size={Button.Sizes.SMALL} color={Button.Colors.PRIMARY} onClick={addWidget}>
                    + add widget
                </Button>
            </div>

            {!widgets.length && <div className="vc-cpwm-empty">you do not have any widgets yet.</div>}

            {widgets.map((widget, index) => (
                <CustomWidgetEditorCard key={widget.id} widget={widget} index={index} total={widgets.length} />
            ))}
        </div>
    );
}

function NativeItemEditor({ widget, item, index }: { widget: NativeWidget; item: NativeWidgetItem; index: number; }) {
    return (
        <div
            className="vc-cpwm-native-editor-item vc-cpwm-studio-tile-editor"
            onDragOver={event => {
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
            }}
            onDrop={event => {
                event.preventDefault();
                if (!draggedNativeItem || draggedNativeItem.widgetId !== widget.id) return;

                const rect = event.currentTarget.getBoundingClientRect();
                reorderNativeItem(widget.id, draggedNativeItem.itemId, item.id, event.clientY > rect.top + rect.height / 2);
                draggedNativeItem = null;
            }}
        >
            <div className="vc-cpwm-sub-editor-header vc-cpwm-studio-sub-header">
                <div className="vc-cpwm-sub-editor-title">
                    <span
                        className="vc-cpwm-drag-handle"
                        draggable
                        onDragStart={event => {
                            draggedNativeItem = { widgetId: widget.id, itemId: item.id };
                            event.dataTransfer.effectAllowed = "move";
                        }}
                        onDragEnd={() => { draggedNativeItem = null; }}
                    >
                        ⠿
                    </span>
                    <div className="vc-cpwm-studio-widget-title">
                        <strong>tile #{index + 1}</strong>
                        <span>{item.title || "untitled tile"}</span>
                    </div>
                </div>

                <Button size={Button.Sizes.SMALL} color={Button.Colors.RED} onClick={() => removeNativeItem(widget.id, item.id)}>
                    remove
                </Button>
            </div>

            <div className="vc-cpwm-studio-form-block">
                <SectionTitle>image / gif</SectionTitle>
                <ImageSourceInput value={item.imageUrl} placeholder="https://..." onChange={value => updateNativeItem(widget.id, item.id, { imageUrl: value })} />
            </div>

            <div className="vc-cpwm-control-grid vc-cpwm-control-grid-small">
                <SelectField label="image fit" value={item.imageFit} onChange={value => updateNativeItem(widget.id, item.id, { imageFit: value as NativeImageFit })}>
                    <option value="cover">cover — crop</option>
                    <option value="contain">contain — full image</option>
                    <option value="fill">stretch</option>
                </SelectField>

                <div className="vc-cpwm-native-quick-actions">
                    <span className="vc-cpwm-field-label">quick</span>
                    <div className="vc-cpwm-editor-actions">
                        <Button
                            size={Button.Sizes.SMALL}
                            onClick={() => updateNativeItem(widget.id, item.id, {
                                imageScale: 100,
                                imageOffsetX: 0,
                                imageOffsetY: 0
                            })}
                        >
                            center image
                        </Button>
                        <Button
                            size={Button.Sizes.SMALL}
                            onClick={() => updateNativeItem(widget.id, item.id, {
                                imageFit: "contain",
                                imageScale: 100,
                                imageOffsetX: 0,
                                imageOffsetY: 0
                            })}
                        >
                            show full
                        </Button>
                    </div>
                </div>
            </div>

            <div className="vc-cpwm-range-grid vc-cpwm-native-image-ranges">
                <RangeField
                    label="image box size"
                    value={item.imageBoxScale}
                    min={55}
                    max={100}
                    suffix="%"
                    onChange={value => updateNativeItem(widget.id, item.id, { imageBoxScale: value })}
                />
                <RangeField
                    label="crop zoom"
                    value={item.imageScale}
                    min={item.imageFit === "cover" ? 100 : 50}
                    max={180}
                    suffix="%"
                    onChange={value => updateNativeItem(widget.id, item.id, { imageScale: value })}
                />
                <RangeField
                    label="move left / right"
                    value={item.imageOffsetX}
                    min={-50}
                    max={50}
                    suffix="%"
                    onChange={value => updateNativeItem(widget.id, item.id, { imageOffsetX: value })}
                />
                <RangeField
                    label="move up / down"
                    value={item.imageOffsetY}
                    min={-50}
                    max={50}
                    suffix="%"
                    onChange={value => updateNativeItem(widget.id, item.id, { imageOffsetY: value })}
                />
            </div>

            <div className="vc-cpwm-two-column">
                <div>
                    <SectionTitle>title</SectionTitle>
                    <TextInput value={item.title} placeholder="Love" onChange={value => updateNativeItem(widget.id, item.id, { title: value })} />
                </div>
                <div>
                    <SectionTitle>subtitle</SectionTitle>
                    <TextInput value={item.subtitle} placeholder="Quinn" onChange={value => updateNativeItem(widget.id, item.id, { subtitle: value })} />
                </div>
            </div>
        </div>
    );
}

function NativeWidgetEditorCard({ widget, index, total }: { widget: NativeWidget; index: number; total: number; }) {
    const [section, setSection] = useState<NativeEditorSection>("content");
    const [selectedItemId, setSelectedItemId] = useState<string>(widget.items[0]?.id ?? "");
    const current = NATIVE_SECTIONS.find(item => item.id === section) ?? NATIVE_SECTIONS[0]!;
    const selectedItem = widget.items.find(item => item.id === selectedItemId) ?? widget.items[0];
    const selectedItemIndex = selectedItem ? widget.items.findIndex(item => item.id === selectedItem.id) : -1;

    return (
        <div
            className="vc-cpwm-editor-card vc-cpwm-native-editor-card vc-cpwm-studio-card"
            onDragOver={event => {
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
            }}
            onDrop={event => {
                event.preventDefault();
                if (!draggedNativeWidgetId) return;

                const rect = event.currentTarget.getBoundingClientRect();
                reorderNativeWidget(draggedNativeWidgetId, widget.id, event.clientY > rect.top + rect.height / 2);
                draggedNativeWidgetId = null;
            }}
        >
            <div className="vc-cpwm-editor-toolbar vc-cpwm-studio-toolbar">
                <div className="vc-cpwm-editor-title">
                    <span
                        className="vc-cpwm-drag-handle"
                        draggable
                        onDragStart={event => {
                            draggedNativeWidgetId = widget.id;
                            event.dataTransfer.effectAllowed = "move";
                        }}
                        onDragEnd={() => { draggedNativeWidgetId = null; }}
                    >
                        ⠿
                    </span>
                    <div className="vc-cpwm-studio-widget-title">
                        <strong>native widget #{index + 1}</strong>
                        <span>{widget.headerText || "untitled native widget"}</span>
                    </div>
                </div>

                <div className="vc-cpwm-editor-actions vc-cpwm-studio-actions">
                    <Button size={Button.Sizes.SMALL} disabled={index === 0} onClick={() => moveNativeWidget(widget.id, -1)}>↑</Button>
                    <Button size={Button.Sizes.SMALL} disabled={index === total - 1} onClick={() => moveNativeWidget(widget.id, 1)}>↓</Button>
                    <Button size={Button.Sizes.SMALL} onClick={() => duplicateNativeWidget(widget.id)}>duplicate</Button>
                    <Button size={Button.Sizes.SMALL} onClick={() => resetNativeWidget(widget.id)}>reset</Button>
                    <Button size={Button.Sizes.SMALL} onClick={() => updateNativeWidget(widget.id, { enabled: !widget.enabled })}>{widget.enabled ? "enabled" : "disabled"}</Button>
                    <Button size={Button.Sizes.SMALL} color={Button.Colors.RED} onClick={() => removeNativeWidget(widget.id)}>remove</Button>
                </div>
            </div>

            <div className="vc-cpwm-studio-layout">
                <StudioSidebar
                    sections={NATIVE_SECTIONS}
                    active={section}
                    onChange={value => setSection(value as NativeEditorSection)}
                />

                <main className="vc-cpwm-studio-panel">
                    <StudioPanelHeader title={current.label} description={current.description} />

                    {section === "content" && (
                        <div className="vc-cpwm-studio-section-body">
                            <div className="vc-cpwm-studio-group">
                                <div className="vc-cpwm-studio-group-title">header</div>
                                <div className="vc-cpwm-two-column">
                                    <div>
                                        <SectionTitle>icon / image url</SectionTitle>
                                        <ImageSourceInput value={widget.headerIcon} placeholder="🖤 or https://.../icon.png" allowText onChange={value => updateNativeWidget(widget.id, { headerIcon: value })} />
                                        <div className="vc-cpwm-header-icon-hint">emoji/text, image URL, or local file — images render as a small 16×16 header icon</div>
                                    </div>
                                    <div>
                                        <SectionTitle>name</SectionTitle>
                                        <TextInput value={widget.headerText} placeholder="JoeGoldberg.exe" onChange={value => updateNativeWidget(widget.id, { headerText: value })} />
                                    </div>
                                </div>
                            </div>

                            <div className="vc-cpwm-studio-group">
                                <div className="vc-cpwm-studio-group-title">hero text</div>
                                <div className="vc-cpwm-two-column">
                                    <div>
                                        <SectionTitle>title</SectionTitle>
                                        <TextInput value={widget.heroTitle} placeholder="Hello, you" onChange={value => updateNativeWidget(widget.id, { heroTitle: value })} />
                                    </div>
                                    <div>
                                        <SectionTitle>subtitle</SectionTitle>
                                        <TextInput value={widget.heroSubtitle} placeholder="I'm watching over you" onChange={value => updateNativeWidget(widget.id, { heroSubtitle: value })} />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {section === "hero" && (
                        <div className="vc-cpwm-studio-section-body">
                            <div className="vc-cpwm-studio-form-block">
                                <SectionTitle>hero image / gif</SectionTitle>
                                <ImageSourceInput value={widget.heroImageUrl} placeholder="https://..." onChange={value => updateNativeWidget(widget.id, { heroImageUrl: value })} />
                            </div>

                            <div className="vc-cpwm-control-grid vc-cpwm-control-grid-small">
                                <SelectField label="hero image side" value={widget.heroSide} onChange={value => updateNativeWidget(widget.id, { heroSide: value as NativeHeroSide })}>
                                    <option value="right">right — discord style</option>
                                    <option value="left">left</option>
                                </SelectField>

                                <SelectField label="image fit" value={widget.heroImageFit} onChange={value => updateNativeWidget(widget.id, { heroImageFit: value as NativeImageFit })}>
                                    <option value="cover">cover — crop</option>
                                    <option value="contain">contain — full image</option>
                                    <option value="fill">stretch</option>
                                </SelectField>
                            </div>

                            <div className="vc-cpwm-native-hero-actions vc-cpwm-studio-quick-row">
                                <Button
                                    title="Reset crop position and zoom"
                                    size={Button.Sizes.SMALL}
                                    onClick={() => updateNativeWidget(widget.id, {
                                        heroImageScale: 100,
                                        heroImageOffsetX: 0,
                                        heroImageOffsetY: 0
                                    })}
                                >
                                    center image
                                </Button>
                                <Button
                                    title="Show the entire image without cropping"
                                    size={Button.Sizes.SMALL}
                                    onClick={() => updateNativeWidget(widget.id, {
                                        heroImageFit: "contain",
                                        heroImageScale: 100,
                                        heroImageOffsetX: 0,
                                        heroImageOffsetY: 0
                                    })}
                                >
                                    show full image
                                </Button>
                            </div>

                            <div className="vc-cpwm-range-grid vc-cpwm-native-image-ranges">
                                <RangeField
                                    label="image box size"
                                    value={widget.heroImageBoxScale}
                                    min={55}
                                    max={100}
                                    suffix="%"
                                    onChange={value => updateNativeWidget(widget.id, { heroImageBoxScale: value })}
                                />
                                <RangeField
                                    label="crop zoom"
                                    value={widget.heroImageScale}
                                    min={widget.heroImageFit === "cover" ? 100 : 50}
                                    max={180}
                                    suffix="%"
                                    onChange={value => updateNativeWidget(widget.id, { heroImageScale: value })}
                                />
                                <RangeField
                                    label="move left / right"
                                    value={widget.heroImageOffsetX}
                                    min={-50}
                                    max={50}
                                    suffix="%"
                                    onChange={value => updateNativeWidget(widget.id, { heroImageOffsetX: value })}
                                />
                                <RangeField
                                    label="move up / down"
                                    value={widget.heroImageOffsetY}
                                    min={-50}
                                    max={50}
                                    suffix="%"
                                    onChange={value => updateNativeWidget(widget.id, { heroImageOffsetY: value })}
                                />
                            </div>

                            <div className="vc-cpwm-studio-tip">image box size changes the visible frame, crop zoom adjusts magnification, and move X/Y sets the crop focus.</div>
                        </div>
                    )}

                    {section === "tiles" && (
                        <div className="vc-cpwm-studio-section-body">
                            <div className="vc-cpwm-studio-section-topline">
                                <div>
                                    <div className="vc-cpwm-studio-group-title">tile selector</div>
                                    <div className="vc-cpwm-studio-muted">select a tile to edit only its settings.</div>
                                </div>
                                <Button size={Button.Sizes.SMALL} disabled={widget.items.length >= 4} onClick={() => addNativeItem(widget.id)}>
                                    + add tile
                                </Button>
                            </div>

                            {!!widget.items.length && (
                                <div className="vc-cpwm-tile-picker">
                                    {widget.items.map((item, itemIndex) => {
                                        const image = cleanUrl(item.imageUrl);
                                        const active = selectedItem?.id === item.id;

                                        return (
                                            <button
                                                key={item.id}
                                                className={`vc-cpwm-tile-picker-card ${active ? "vc-cpwm-tile-picker-card-active" : ""}`}
                                                onClick={() => setSelectedItemId(item.id)}
                                            >
                                                <span className="vc-cpwm-tile-picker-thumb">
                                                    {image ? <img src={image} alt="" /> : <span>✦</span>}
                                                </span>
                                                <span className="vc-cpwm-tile-picker-copy">
                                                    <strong>tile #{itemIndex + 1}</strong>
                                                    <small>{item.title || "untitled"}</small>
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}

                            {selectedItem ? (
                                <NativeItemEditor widget={widget} item={selectedItem} index={selectedItemIndex} />
                            ) : (
                                <div className="vc-cpwm-empty vc-cpwm-studio-empty">no tiles yet — add the first one.</div>
                            )}
                        </div>
                    )}

                    {section === "colors" && (
                        <div className="vc-cpwm-studio-section-body">
                            <div className="vc-cpwm-studio-tip">leave a field empty to use Discord’s default color.</div>

                            <div className="vc-cpwm-three-column">
                                <ColorField
                                    label="header"
                                    value={widget.headerTextColor}
                                    onChange={value => updateNativeWidget(widget.id, { headerTextColor: value })}
                                />
                                <ColorField
                                    label="hero title"
                                    value={widget.heroTitleColor}
                                    onChange={value => updateNativeWidget(widget.id, { heroTitleColor: value })}
                                />
                                <ColorField
                                    label="hero subtitle"
                                    value={widget.heroSubtitleColor}
                                    onChange={value => updateNativeWidget(widget.id, { heroSubtitleColor: value })}
                                />
                            </div>

                            <div className="vc-cpwm-two-column vc-cpwm-native-color-row">
                                <ColorField
                                    label="tile title"
                                    value={widget.tileTitleColor}
                                    onChange={value => updateNativeWidget(widget.id, { tileTitleColor: value })}
                                />
                                <ColorField
                                    label="tile subtitle"
                                    value={widget.tileSubtitleColor}
                                    onChange={value => updateNativeWidget(widget.id, { tileSubtitleColor: value })}
                                />
                            </div>
                        </div>
                    )}

                    {section === "background" && (
                        <div className="vc-cpwm-studio-section-body">
                            <SelectField label="background mode" value={widget.backgroundMode} onChange={value => updateNativeWidget(widget.id, { backgroundMode: value as NativeBackgroundMode })}>
                                <option value="profile">profile / discord default</option>
                                <option value="solid">solid color</option>
                                <option value="gradient">gradient</option>
                            </SelectField>

                            {widget.backgroundMode === "profile" && (
                                <div className="vc-cpwm-studio-tip">profile/default syncs the surface with Discord native cards, such as Favorite Game.</div>
                            )}

                            {widget.backgroundMode === "solid" && (
                                <div className="vc-cpwm-native-color-row">
                                    <ColorField
                                        label="background color"
                                        value={widget.backgroundColor}
                                        onChange={value => updateNativeWidget(widget.id, { backgroundColor: value })}
                                    />
                                </div>
                            )}

                            {widget.backgroundMode === "gradient" && (
                                <>
                                    <div className="vc-cpwm-two-column vc-cpwm-native-color-row">
                                        <ColorField
                                            label="gradient start"
                                            value={widget.gradientStart}
                                            onChange={value => updateNativeWidget(widget.id, { gradientStart: value })}
                                        />
                                        <ColorField
                                            label="gradient end"
                                            value={widget.gradientEnd}
                                            onChange={value => updateNativeWidget(widget.id, { gradientEnd: value })}
                                        />
                                    </div>

                                    <RangeField
                                        label="gradient angle"
                                        value={widget.gradientAngle}
                                        min={0}
                                        max={360}
                                        suffix="°"
                                        onChange={value => updateNativeWidget(widget.id, { gradientAngle: value })}
                                    />
                                </>
                            )}
                        </div>
                    )}

                    {section === "border" && (
                        <div className="vc-cpwm-studio-section-body">
                            <div className="vc-cpwm-two-column vc-cpwm-native-color-row">
                                <ColorField
                                    label="border color"
                                    value={widget.borderColor}
                                    onChange={value => updateNativeWidget(widget.id, { borderColor: value })}
                                />
                            </div>

                            <div className="vc-cpwm-range-grid">
                                <RangeField
                                    label="border opacity"
                                    value={widget.borderOpacity}
                                    min={0}
                                    max={100}
                                    suffix="%"
                                    onChange={value => updateNativeWidget(widget.id, { borderOpacity: value })}
                                />
                                <RangeField
                                    label="border width"
                                    value={widget.borderWidth}
                                    min={0}
                                    max={8}
                                    suffix="px"
                                    onChange={value => updateNativeWidget(widget.id, { borderWidth: value })}
                                />
                            </div>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
}

function DiscordNativePage() {
    const { nativeWidgets: rawWidgets } = settings.use(NATIVE_KEYS);
    const widgets = (rawWidgets ?? []).map(normalizeNativeWidget);

    return (
        <div className="vc-cpwm-native-builder vc-cpwm-studio-page">
            <div className="vc-cpwm-manager-header vc-cpwm-studio-page-header">
                <div>
                    <div className="vc-cpwm-page-kicker">workspace</div>
                    <Forms.FormTitle tag="h3">discord native</Forms.FormTitle>
                    <Forms.FormText>same renderer and the same options — the editor is now organized into clean categories.</Forms.FormText>
                </div>

                <Button size={Button.Sizes.SMALL} color={Button.Colors.PRIMARY} onClick={addNativeWidget}>
                    + add native widget
                </Button>
            </div>

            {!widgets.length && <div className="vc-cpwm-empty">no native widgets yet — add the first one.</div>}

            {widgets.map((widget, index) => (
                <NativeWidgetEditorCard key={widget.id} widget={widget} index={index} total={widgets.length} />
            ))}
        </div>
    );
}

function BackupPage() {
    return (
        <div className="vc-cpwm-backup-page">
            <div className="vc-cpwm-manager-header">
                <div>
                    <Forms.FormTitle tag="h3">backup</Forms.FormTitle>
                    <Forms.FormText>export includes custom builder + discord native.</Forms.FormText>
                </div>
            </div>
            <ImportExportPanel />
        </div>
    );
}

function ExternalRightPreview({ page }: { page: "builder" | "native" | "backup"; }) {
    const { widgets: rawWidgets } = settings.use(WIDGET_KEYS);
    const { nativeWidgets: rawNativeWidgets } = settings.use(NATIVE_KEYS);

    if (page === "backup")
        return null;

    const widgets = (rawWidgets ?? [])
        .map(normalizeWidget)
        .filter(widget => widget.enabled);

    const nativeWidgets = (rawNativeWidgets ?? [])
        .map(normalizeNativeWidget)
        .filter(widget => widget.enabled);

    const empty = page === "builder"
        ? widgets.length === 0
        : nativeWidgets.length === 0;

    return (
        <div className={`vc-cpwm-floating-preview vc-cpwm-floating-preview-${page}`}>
            <div className="vc-cpwm-floating-preview-header">
                <strong>{page === "builder" ? "custom builder preview" : "discord native preview"}</strong>
                <span>live</span>
            </div>

            <div className="vc-cpwm-floating-preview-viewport">
                <div className="vc-cpwm-floating-preview-canvas">
                    {empty && (
                        <div className="vc-cpwm-floating-preview-empty">
                            enable or add a widget to see the preview
                        </div>
                    )}

                    {page === "builder" && widgets.map(widget => (
                        <WidgetCard
                            key={`preview-custom-${widget.id}`}
                            widget={widget}
                        />
                    ))}

                    {page === "native" && nativeWidgets.map(widget => (
                        <NativeWidgetCard
                            key={`preview-native-${widget.id}`}
                            widget={widget}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}

function getInitialEditorTheme(): EditorTheme {
    try {
        const stored = window.localStorage.getItem("vc-cpwm-editor-theme");
        if (stored === "light" || stored === "dark") return stored;
    } catch { }

    if (document.documentElement.classList.contains("theme-light") || document.body.classList.contains("theme-light")) {
        return "light";
    }

    return "dark";
}

const CPWM_GITHUB_URL = "https://github.com/LilithLis?tab=repositories";
const CPWM_DISCORD_URL = "https://discord.com/users/1120529887954993313";
const CPWM_DISCORD_SERVER_URL = "https://discord.gg/aXJDKYf6Zg";

function AuthorResourceLinks() {
    return (
        <div className="vc-cpwm-author-inline-links" aria-label="LilithLis links">
            <MaskedLink
                href={CPWM_GITHUB_URL}
                className="vc-cpwm-author-link"
                title="LilithLis on GitHub"
            >
                <span className="vc-cpwm-author-link-icon" aria-hidden="true">⌘</span>
                <span>GitHub</span>
                <span className="vc-cpwm-author-link-arrow">↗</span>
            </MaskedLink>

            <MaskedLink
                href={CPWM_DISCORD_URL}
                className="vc-cpwm-author-link"
                title="LilithLis on Discord"
            >
                <span className="vc-cpwm-author-link-icon vc-cpwm-author-link-icon-discord" aria-hidden="true">●</span>
                <span>Discord</span>
                <span className="vc-cpwm-author-link-arrow">↗</span>
            </MaskedLink>

            <MaskedLink
                href={CPWM_DISCORD_SERVER_URL}
                className="vc-cpwm-author-link vc-cpwm-author-link-server"
                title="Join the Discord Server"
            >
                <span className="vc-cpwm-author-link-icon vc-cpwm-author-link-icon-server" aria-hidden="true">✦</span>
                <span>Discord Server</span>
                <span className="vc-cpwm-author-link-arrow">↗</span>
            </MaskedLink>
        </div>
    );
}

function isCpwmVisible(element: HTMLElement) {
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
}

function cpwmComesBefore(first: Element, second: Element) {
    return !!(first.compareDocumentPosition(second) & Node.DOCUMENT_POSITION_FOLLOWING);
}

function findCpwmSettingsLabel(label: string, after?: Element): HTMLElement | null {
    const wanted = label.trim().toLowerCase();

    const candidates = Array.from(document.querySelectorAll<HTMLElement>(
        "h1, h2, h3, h4, h5, h6, div, span"
    ));

    return candidates.find(element => {
        if (!isCpwmVisible(element)) return false;
        if (element.closest(".vc-cpwm-manager-shell, .vc-cpwm-author-links-host")) return false;
        if (after && !cpwmComesBefore(after, element)) return false;

        /* Discord/Vencord does not always render section labels as heading tags.
         * Prefer the element's own text node so a large parent container is not
         * mistaken for the Authors/Settings label. */
        const ownText = Array.from(element.childNodes)
            .filter(node => node.nodeType === Node.TEXT_NODE)
            .map(node => node.textContent ?? "")
            .join(" ")
            .replace(/\s+/g, " ")
            .trim()
            .toLowerCase();

        return ownText === wanted || elementText(element).toLowerCase() === wanted;
    }) ?? null;
}

function findAuthorsLinkTarget(): HTMLElement | null {
    const authorsLabel = findCpwmSettingsLabel("authors");
    if (!authorsLabel) return null;

    const settingsLabel = findCpwmSettingsLabel("settings", authorsLabel);

    const isBetweenAuthorAndSettings = (element: Element) => {
        if (!cpwmComesBefore(authorsLabel, element)) return false;
        if (settingsLabel && !cpwmComesBefore(element, settingsLabel)) return false;
        return true;
    };

    /* The author avatar is the most stable thing in the Authors block.
     * Find it by document order instead of relying on Discord class names. */
    const image = Array.from(document.querySelectorAll<HTMLElement>("img, [role='img']"))
        .find(element => isCpwmVisible(element) && isBetweenAuthorAndSettings(element));

    if (image) {
        const avatarNode = image.closest("a") as HTMLElement | null ?? image;
        let row = avatarNode.parentElement;

        /* Never append links inside the author <a>; that would create nested links.
         * Also avoid grabbing the whole settings section as the row. */
        if (row && !row.contains(authorsLabel) && (!settingsLabel || !row.contains(settingsLabel))) {
            return row;
        }
    }

    /* SVG/avatar fallback for Discord builds that do not use an <img>. */
    const visual = Array.from(document.querySelectorAll<HTMLElement>("svg"))
        .find(element => isCpwmVisible(element) && isBetweenAuthorAndSettings(element));

    if (visual) {
        const visualNode = visual.closest("a") as HTMLElement | null ?? visual;
        const row = visualNode.parentElement;
        if (row && !row.contains(authorsLabel) && (!settingsLabel || !row.contains(settingsLabel))) {
            return row;
        }
    }

    return null;
}

function mountAuthorResourceLinks() {
    const existing = document.querySelector<HTMLElement>(".vc-cpwm-author-links-host");
    if (existing) return () => {};

    const authorsLabel = findCpwmSettingsLabel("authors");
    if (!authorsLabel) return null;

    const target = findAuthorsLinkTarget();
    const host = document.createElement("div");
    host.className = "vc-cpwm-author-links-host";

    let fallback = false;

    if (target) {
        target.classList.add("vc-cpwm-author-row-target");
        target.appendChild(host);
    } else {
        /* Last-resort placement: put the buttons directly before Settings.
         * This keeps them visible even if Discord changes the avatar wrapper again. */
        const settingsLabel = findCpwmSettingsLabel("settings", authorsLabel);
        if (!settingsLabel?.parentElement) return null;
        settingsLabel.parentElement.insertBefore(host, settingsLabel);
        host.classList.add("vc-cpwm-author-links-host-fallback");
        fallback = true;
    }

    const root = createRoot(host);
    root.render(<AuthorResourceLinks />);

    return () => {
        root.unmount();
        host.remove();
        if (target && !fallback) target.classList.remove("vc-cpwm-author-row-target");
    };
}

function WidgetManager() {
    const [page, setPage] = useState<"builder" | "native" | "backup">("builder");
    const [editorTheme, setEditorTheme] = useState<EditorTheme>(getInitialEditorTheme);

    const changeEditorTheme = (theme: EditorTheme) => {
        setEditorTheme(theme);
        try {
            window.localStorage.setItem("vc-cpwm-editor-theme", theme);
        } catch { }
    };

    useEffect(() => {
        const host = document.createElement("div");
        host.className = `vc-cpwm-floating-preview-root vc-cpwm-floating-preview-root-${page}`;
        document.body.appendChild(host);

        const root = createRoot(host);
        root.render(<ExternalRightPreview page={page} />);

        return () => {
            root.unmount();
            host.remove();
        };
    }, [page]);

    useEffect(() => {
        let cleanup: (() => void) | null = null;
        let frame = 0;

        const ensureMounted = () => {
            if (document.querySelector(".vc-cpwm-author-links-host")) return;

            cleanup?.();
            cleanup = mountAuthorResourceLinks();
        };

        const scheduleMount = () => {
            if (frame) cancelAnimationFrame(frame);
            frame = requestAnimationFrame(ensureMounted);
        };

        ensureMounted();

        const authorObserver = new MutationObserver(scheduleMount);
        authorObserver.observe(document.body, { childList: true, subtree: true });

        return () => {
            authorObserver.disconnect();
            if (frame) cancelAnimationFrame(frame);
            cleanup?.();
        };
    }, []);

    return (
        <div className={`vc-cpwm-manager-shell vc-cpwm-manager-page-${page} vc-cpwm-editor-theme-${editorTheme}`}>
            <div className="vc-cpwm-workspace-bar">
                <div className="vc-cpwm-page-tabs">
                    <button title="Open Custom Builder" className={`vc-cpwm-page-tab ${page === "builder" ? "vc-cpwm-page-tab-active" : ""}`} onClick={() => setPage("builder")}>
                        <span className="vc-cpwm-tab-icon">✦</span>
                        custom builder
                    </button>
                    <button title="Open Discord Native editor" className={`vc-cpwm-page-tab ${page === "native" ? "vc-cpwm-page-tab-active" : ""}`} onClick={() => setPage("native")}>
                        <span className="vc-cpwm-tab-icon">▦</span>
                        discord native
                    </button>
                    <button title="Open Backup tools" className={`vc-cpwm-page-tab ${page === "backup" ? "vc-cpwm-page-tab-active" : ""}`} onClick={() => setPage("backup")}>
                        <span className="vc-cpwm-tab-icon">↥</span>
                        backup
                    </button>
                </div>

                <div className="vc-cpwm-workspace-actions">
                    <div className="vc-cpwm-stable-badge" title="CustomProfileWidgets stable build">
                        <span className="vc-cpwm-stable-dot" aria-hidden="true" />
                        <span className="vc-cpwm-stable-version">v5.8</span>
                        <span className="vc-cpwm-stable-label">stable</span>
                    </div>

                    <div className="vc-cpwm-theme-switch" aria-label="editor theme">
                        <button
                            className={editorTheme === "dark" ? "vc-cpwm-theme-button-active" : ""}
                            onClick={() => changeEditorTheme("dark")}
                            title="dark editor"
                        >
                            ☾ <span>dark</span>
                        </button>
                        <button
                            className={editorTheme === "light" ? "vc-cpwm-theme-button-active" : ""}
                            onClick={() => changeEditorTheme("light")}
                            title="light editor"
                        >
                            ☀ <span>light</span>
                        </button>
                    </div>
                </div>
            </div>

            <div className="vc-cpwm-page-content">
                {page === "builder" && <CustomBuilderPage />}
                {page === "native" && <DiscordNativePage />}
                {page === "backup" && <BackupPage />}
            </div>
        </div>
    );
}

const settings = definePluginSettings({
    widgets: {
        type: OptionType.CUSTOM,
        default: [] as CustomWidget[],
        hidden: true
    },

    nativeWidgets: {
        type: OptionType.CUSTOM,
        default: [] as NativeWidget[],
        hidden: true
    },

    widgetManager: {
        type: OptionType.COMPONENT,
        description: "manage your custom profile widgets",
        component: WidgetManager
    }
});

function mountRoot(parent: HTMLElement, before: ChildNode | null, type: "board" | "popout", compact: boolean) {
    const selector = `[data-vc-cpwm-root="${type}"]`;

    if (Array.from(parent.children).some(child => child.matches(selector))) return;

    const host = document.createElement("div");
    host.dataset.vcCpwmRoot = type;
    host.className = type === "board" ? "vc-cpwm-board-host" : "vc-cpwm-popout-host";

    parent.insertBefore(host, before);

    const root = createRoot(host);
    mountedRoots.set(host, root);
    root.render(<WidgetHost compact={compact} />);
}

function injectBoard() {
    const buttons = Array.from(document.querySelectorAll<HTMLElement>('button, [role="button"]'));
    const addButton = buttons.find(button => /^(\+\s*)?add widget$/i.test(elementText(button)));
    if (!addButton) return;

    let row: HTMLElement | null = addButton.parentElement;

    for (let i = 0; row && i < 7; i++) {
        const text = elementText(row);

        if (/your widgets/i.test(text) && /add widget/i.test(text) && text.length < 250) break;
        row = row.parentElement;
    }

    if (!row?.parentElement) return;

    mountRoot(row.parentElement, row.nextSibling, "board", false);
}

function findOwnProfileControls() {
    const elements = Array.from(document.querySelectorAll<HTMLElement>('button, [role="button"], div'));
    const editProfile = elements.find(element => /^edit profile$/i.test(elementText(element)));
    if (!editProfile) return null;

    let card: HTMLElement | null = editProfile;

    for (let i = 0; card && i < 9; i++) {
        const text = elementText(card);

        if (/edit profile/i.test(text) && /\bonline\b/i.test(text) && /\bclips\b/i.test(text)) return card;
        card = card.parentElement;
    }

    return null;
}

function injectPopout() {
    const controls = findOwnProfileControls();
    if (!controls?.parentElement) return;

    mountRoot(controls.parentElement, controls, "popout", true);
}

function cleanupDeadRoots() {
    for (const [host, root] of mountedRoots) {
        if (host.isConnected) continue;

        root.unmount();
        mountedRoots.delete(host);
    }
}

function scan() {
    scanFrame = null;
    cleanupDeadRoots();
    injectBoard();
    injectPopout();
}

function queueScan() {
    if (scanFrame !== null) return;
    scanFrame = requestAnimationFrame(scan);
}

function startObserver() {
    if (observer) return;

    observer = new MutationObserver(queueScan);
    observer.observe(document.body, { childList: true, subtree: true });
    queueScan();
}

function stopObserver() {
    observer?.disconnect();
    observer = null;

    if (scanFrame !== null) {
        cancelAnimationFrame(scanFrame);
        scanFrame = null;
    }

    for (const [host, root] of mountedRoots) {
        root.unmount();
        host.remove();
    }

    mountedRoots.clear();
}

export default definePlugin({
    name: "CustomProfileWidgets",
    description: "Full client-side custom profile widget builder • v5.8 Stable.",
    authors: [{ name: "LilithLis", id: 1120529887954993313n }],
    settings,

    start() {
        startObserver();
    },

    stop() {
        stopObserver();
    }
});
