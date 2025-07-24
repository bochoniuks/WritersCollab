import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "prosemirror-state";
import type { EditorView } from "prosemirror-view";
import type { Node as ProseMirrorNode } from "prosemirror-model";

export type HeightData = Map<ProseMirrorNode, number>;

export const heightTrackingPluginKey =
  new PluginKey<HeightData>("heightTracking");

const areHeightsEqual = (prev: HeightData, next: HeightData): boolean => {
    
    if (prev.size !== next.size) {
        return false;
    }
    for (const [node, height] of prev) {
        if (next.get(node) !== height) {
            return false;
        }
    }
    
    return true;
};

export const HeightTracking = Extension.create({
  name: "heightTracking",
  addProseMirrorPlugins() {
    return [
        new Plugin<HeightData>({
            key: heightTrackingPluginKey,
            state: {
                init(): HeightData {
                    return new Map();
                },
                apply(tr, value) {
                    const meta = tr.getMeta(heightTrackingPluginKey);
                    return meta ? (meta as HeightData) : value;
                },
            },
            view(editorView: EditorView) {
                // let prevState = editorView.state;
                return {
                    update(view, prevState) {
                        const start = performance.now();
                        const prevHeights = heightTrackingPluginKey.getState(prevState) as HeightData;
                        const heights: HeightData = new Map();

                        const getHeight = (node: ProseMirrorNode, pos: number): number => {
                            const element = view.domAtPos(pos).node as HTMLElement;
                            return element.offsetHeight;
                        };

                        const visited = new Set<ProseMirrorNode>();
                        const recalc = (node: ProseMirrorNode, pos: number): void => {
                            if (visited.has(node)) {
                                return;
                            }
                            visited.add(node);
                            heights.set(node, getHeight(node, pos));
                            const resolved = view.state.doc.resolve(pos);
                            if (resolved.depth > 0) {
                                const parent = resolved.node(resolved.depth - 1);
                                const parentPos = resolved.before(resolved.depth);
                                recalc(parent, parentPos);
                            }
                        };
                        let calls = 0;
                        view.state.doc.nodesBetween(
                            0,
                            view.state.doc.content.size,
                            (node, pos) => {
                                if (node.isText || node.isBlock) {
                                    recalc(node, pos);
                                    calls+=1;
                                }
                            },
                        );

                        if (!areHeightsEqual(prevHeights, heights)) {
                            console.log(heights)
                            view.dispatch(
                                view.state.tr.setMeta(heightTrackingPluginKey, heights),
                            );
                        }
                        const end = performance.now();
                        console.log("Calls: ", calls)
                        console.log("HeightTracking update took", end - start, "ms");
                        // prevState = view.state;
                    },
                };
            },
        }),
    ];
  },
});
