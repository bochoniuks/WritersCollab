import { Extension } from "@tiptap/core";
import { Plugin, PluginKey, TextSelection } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";

type SelectionRange = { from: number; to: number } | null;

type SelectionStyles = {
  background: string;
  color: string;
  padding: number;
};

const getSelectionStyles = (element: HTMLElement): SelectionStyles => {
    const selectionStyles = window.getComputedStyle(element, "::selection");
    const baseStyles = window.getComputedStyle(element);
    let background = selectionStyles.backgroundColor;
    let color = selectionStyles.color;

    if (!background || background === "rgba(0, 0, 0, 0)") {
        background =
            baseStyles.getPropertyValue("--wysiwyg-selection-background") || "#b3d4fc";
    }
    if (!color || color === "rgba(0, 0, 0, 0)") {
        color =
            baseStyles.getPropertyValue("--wysiwyg-selection-color") || "#000";
    }

    const lineHeight = parseFloat(baseStyles.lineHeight);
    const fontSize = parseFloat(baseStyles.fontSize);
    const padding = Math.max((lineHeight - fontSize) / 2, 0);
    return { background, color, padding };
};

interface SelectionHighlightState {
  decoration: DecorationSet;
  storedSelection: SelectionRange;
  lastSelection: SelectionRange;
}

export const selectionHighlightPluginKey =
  new PluginKey<SelectionHighlightState>("selectionHighlight");

export const SelectionHighlight = Extension.create({
  name: "selectionHighlight",
  addProseMirrorPlugins() {
    return [
      new Plugin<SelectionHighlightState>({
        key: selectionHighlightPluginKey,
        state: {
            init: () => ({
                    decoration: DecorationSet.empty,
                    storedSelection: null,
                    lastSelection: null,
                }),
            apply(tr, value) {
                let { decoration, storedSelection, lastSelection } = value;

                decoration = decoration.map(tr.mapping, tr.doc);
                if (storedSelection) {
                storedSelection = {
                    from: tr.mapping.map(storedSelection.from),
                    to: tr.mapping.map(storedSelection.to),
                };
                }
                if (lastSelection) {
                lastSelection = {
                    from: tr.mapping.map(lastSelection.from),
                    to: tr.mapping.map(lastSelection.to),
                };
                }

                if (tr.selectionSet) {
                const { from, to } = tr.selection;
                lastSelection = from !== to ? { from, to } : null;
                }

                const meta = tr.getMeta(selectionHighlightPluginKey);
                if (meta?.set) {

                    const { from, to, style } = meta.set;
                    const decorations: Decoration[] = [];

                    tr.doc.nodesBetween(from, to, (node, pos) => {
                    const start = Math.max(from, node.isTextblock ? pos + 1 : pos);
                    const end = Math.min(to, pos + node.nodeSize - (node.isTextblock ? 1 : 0));

                    // Highlight text inside partially or fully selected text blocks
                    if (node.isTextblock) {
                        if (start < end) {
                        decorations.push(
                            Decoration.inline(start, end, {
                            class: "selection-highlight",
                            style: `
                                background:${style.background};
                                color:${style.color};
                                box-shadow:0 0 0 ${style.padding}px ${style.background};
                                display:inline-block;
                            `,
                            }),
                        );
                        }
                        return false;            // avoid descending into text nodes
                    }

                    // Highlight entire non-text nodes (images, complete paragraphs, etc.)
                    if (from <= pos && to >= pos + node.nodeSize) {
                        decorations.push(
                        Decoration.node(pos, pos + node.nodeSize, {
                            style: `
                            background:${style.background};
                            box-shadow:0 0 0 ${style.padding}px ${style.background};
                            `,
                        }),
                        );
                        return false;
                    }

                    return true;
                    });

                    decoration = DecorationSet.create(tr.doc, decorations);
                    storedSelection = { from, to };

                }
                if (meta?.clear) {
                    decoration = DecorationSet.empty;
                    storedSelection = null;
                }
                return { decoration, storedSelection, lastSelection };
            },
        },
        props: {
            decorations(state) {
                return (
                    selectionHighlightPluginKey.getState(state)?.decoration ??
                    DecorationSet.empty
                );
            },
            handleDOMEvents: {
                blur: (view) => {
                    const pluginState = selectionHighlightPluginKey.getState(view.state);
                    const lastSelection = pluginState?.lastSelection;
                    console.log(lastSelection)
                    if (lastSelection) {
                        const style = getSelectionStyles(view.dom as HTMLElement);
                        view.dispatch(
                            view.state.tr.setMeta(selectionHighlightPluginKey, {
                            set: { ...lastSelection, style },
                            })
                        );
                    }
                    return false;
                },
                focus: (view) => {
                    console.log("Focus Back")
                    const pluginState = selectionHighlightPluginKey.getState(view.state);
                    const storedSelection = pluginState?.storedSelection;
                    const tr = view.state.tr.setMeta(selectionHighlightPluginKey, { clear: true });
                    if (storedSelection) {
                        const { from, to } = storedSelection;
                        const selection = TextSelection.between(
                            view.state.doc.resolve(from),
                            view.state.doc.resolve(to)
                        );
                        tr.setSelection(selection);
                        console.log("Showing selection - ", from, to);
                    }
                    view.dispatch(tr);
                    return false;
                },
            },
        },
    })
    ];
}});
