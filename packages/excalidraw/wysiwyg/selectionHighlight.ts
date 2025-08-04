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
  const background = selectionStyles.backgroundColor;
  const color = selectionStyles.color;
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
                    decoration = DecorationSet.create(tr.doc, [
                        Decoration.inline(from, to, {
                        class: "selection-highlight",
                        style: `
                            background:${style.background};
                            color:${style.color};
                            margin:-${style.padding}px 0;
                            padding:${style.padding}px 0;
                        `,
                        })
                    ]);
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
                        tr.setSelection(TextSelection.create(view.state.doc, from, to));
                        console.log("Showing selection - ", from, to)
                    }
                    view.dispatch(tr);
                    return false;
                },
            },
        },
    })
    ];
}});
