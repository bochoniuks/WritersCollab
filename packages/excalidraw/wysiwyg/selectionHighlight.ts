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
  selection: SelectionRange;
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
          init: () => ({ decoration: DecorationSet.empty, selection: null }),
          apply(tr, value) {
            let { decoration, selection } = value;

            // keep decorations & stored selection in sync with doc changes
            decoration = decoration.map(tr.mapping, tr.doc);
            if (selection) {
              selection = {
                from: tr.mapping.map(selection.from),
                to: tr.mapping.map(selection.to),
              };
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
                 }),
               ]);
               selection = { from, to };
            }

            if (meta?.clear || tr.docChanged) {
              decoration = DecorationSet.empty;
              if (meta?.clear) {
                selection = null;
              }
            }

            return { decoration, selection };
          },
        },
        props: {
          decorations(state) {
            const pluginState = selectionHighlightPluginKey.getState(state);
            return pluginState ? pluginState.decoration : null;
          },
          handleDOMEvents: {
            blur: (view) => {
                const { from, to } = view.state.selection;
                if (from !== to) {
                  const style = getSelectionStyles(view.dom as HTMLElement);
                  view.dispatch(
                    view.state.tr.setMeta(selectionHighlightPluginKey, {
                      set: { from, to, style },
                    }),
                  );
                }
                return false;
            },
            focus: (view) => {
              const pluginState = selectionHighlightPluginKey.getState(
                view.state,
              );
              const tr = view.state.tr.setMeta(
                selectionHighlightPluginKey,
                { clear: true },
              );
              if (pluginState?.selection) {
                const { from, to } = pluginState.selection;
                tr.setSelection(
                  TextSelection.create(view.state.doc, from, to),
                );
              }
              view.dispatch(tr);
              return false;
            },
          },
        },
      }),
    ];
  },
});
