import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "prosemirror-state";
import type { EditorView } from "prosemirror-view";
import type { Node as ProseMirrorNode } from "prosemirror-model";

export type HeightData = Record<number, number>;

export const heightTrackingPluginKey =
  new PluginKey<HeightData>("heightTracking");

export const HeightTracking = Extension.create({
  name: "heightTracking",
  addProseMirrorPlugins() {
    return [
        new Plugin<HeightData>({
            key: heightTrackingPluginKey,
            state: {
                init(): HeightData {
                    return {};
                },
                apply(tr, value) {
                    const meta = tr.getMeta(heightTrackingPluginKey);
                    return meta ? { ...value, ...meta } : value;
                },
            },
            view(editorView: EditorView) {
                return {
                    update(view) {
                        const heights: HeightData = {};

                        const getHeight = (node: ProseMirrorNode, pos: number): number => {
                        const nodeElement = view.domAtPos(pos).node as HTMLElement;
                        return nodeElement.offsetHeight;
                        };

                        const recalc = (node: ProseMirrorNode, pos: number): void => {
                        heights[pos] = getHeight(node, pos);
                        const resolved = view.state.doc.resolve(pos);
                        if (resolved.depth > 0) {
                            const parent = resolved.node(resolved.depth - 1);
                            const parentPos = resolved.before(resolved.depth);
                            recalc(parent, parentPos);
                        }
                        };

                        view.state.doc.nodesBetween(0, view.state.doc.content.size, (node, pos) => {
                        if (node.isText || node.isBlock) {
                            recalc(node, pos);
                        }
                        });

                        if (Object.keys(heights).length > 0) {
                            console.log(heights);
                            view.dispatch(view.state.tr.setMeta(heightTrackingPluginKey, heights));
                        }
                    },
                };
            },
        }),
    ];
  },
});
