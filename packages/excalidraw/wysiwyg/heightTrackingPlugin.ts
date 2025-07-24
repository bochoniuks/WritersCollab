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
                return {
                    update(view, prevState) {
                        // const start = performance.now();

                        // skip recalculation if nothing changed
                        if (prevState.doc.eq(view.state.doc)) {
                            return;
                        }
                        const prevHeights = heightTrackingPluginKey.getState(prevState) as HeightData;
                        const heights: HeightData = new Map();

                        const visited = new Set<ProseMirrorNode>();

                        const diffStart = view.state.doc.content.findDiffStart(prevState.doc.content);
                        if (diffStart == null) {
                            return;
                        }
                        const diffEnd =
                            view.state.doc.content.findDiffEnd(prevState.doc.content) ?? {
                            a: view.state.doc.content.size,
                            b: prevState.doc.content.size,
                        };
                        const newEnd = diffEnd.a;

                        const nodesToMeasure: Array<{ node: ProseMirrorNode; dom: HTMLElement }> = [];

                        const collect = (node: ProseMirrorNode, pos: number): void => {
                        if (visited.has(node)) return;
                        visited.add(node);
                        const dom = view.nodeDOM(pos) as HTMLElement | null;
                        if (dom) nodesToMeasure.push({ node, dom });

                        // also collect ancestors
                        const resolved = view.state.doc.resolve(pos);
                            if (resolved.depth > 0) {
                                collect(resolved.node(resolved.depth - 1), resolved.before(resolved.depth));
                            }
                        };

                        view.state.doc.nodesBetween(diffStart, newEnd, (node, pos) => {
                            if (node.isBlock) {      // text nodes skipped
                                collect(node, pos);    // only gather nodes, no measurement yet
                            }
                        });

                        // measure all collected nodes once
                        for (const { node, dom } of nodesToMeasure) {
                            heights.set(node, dom.offsetHeight);
                        }

                        if (!areHeightsEqual(prevHeights, heights)) {
                            view.dispatch(
                                view.state.tr.setMeta(heightTrackingPluginKey, heights),
                            );
                        }
                        // const end = performance.now();
                        // console.log("HeightTracking update took", end - start, "ms");
                    },
                };
            },
        }),
    ];
  },
});
