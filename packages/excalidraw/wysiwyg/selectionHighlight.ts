import { Extension } from "@tiptap/core";
import { Plugin, PluginKey, TextSelection } from "prosemirror-state";
import { Decoration, DecorationSet } from "prosemirror-view";

type SelectionRange = { from: number; to: number } | null;

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
              const { from, to } = meta.set;
              decoration = DecorationSet.create(tr.doc, [
                Decoration.inline(from, to, { class: "selection-highlight" }),
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
                view.dispatch(
                  view.state.tr.setMeta(selectionHighlightPluginKey, {
                    set: { from, to },
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
