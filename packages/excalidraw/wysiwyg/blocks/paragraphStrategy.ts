// AFTER (new file)
import { decideSplitAction, ActionType, type Action } from "../paragraphControl";
import { BlockStrategy } from "./registry";
import { heightTrackingInternalKey } from "../transactionFlags";
import { EditorView } from "prosemirror-view";
import { randomId } from "@excalidraw/common";

export const paragraphStrategy: BlockStrategy<Action> = {
  decide: decideSplitAction,
  apply(view: EditorView, action: Action) {
        const { state } = view;
        let tr = state.tr;

        switch (action.type) {
            case ActionType.KEEP_START_SPLIT_ID: {
                console.log("KEEP_START_SPLIT_ID")
            // TODO: This case should include the splitId in the start node 
            // and remove the splitId in the end node.
                const { splitId } = action;
                const $from = state.selection.$from;
                const startPos = $from.before();

                // include splitId in the start node
                tr = tr.setNodeMarkup(startPos, undefined, {
                ...$from.parent.attrs,
                splitId,
                });

                // remove splitId from the end node
                let endPos = startPos + $from.parent.nodeSize;
                let end = state.doc.nodeAt(endPos);
                if (end?.type.name === "page") {
                endPos += 1;                     // move to first child of the page
                end = state.doc.nodeAt(endPos);
                }
                if (end?.type.name === "paragraph") {
                const attrs = { ...end.attrs };
                delete attrs.splitId;
                tr = tr.setNodeMarkup(endPos, undefined, attrs);
                }

                break;
            }
            case ActionType.KEEP_END_SPLIT_ID: {
            console.log("KEEP_END_SPLIT_ID")
            // TODO: This case should include the splitId in the end node and 
            // remove the splitId in the start node.
            const { splitId } = action;
            const $from = state.selection.$from;
            const endPos = $from.before();                       // start of new paragraph

            // ensure the new (end) paragraph keeps the splitId
            tr = tr.setNodeMarkup(endPos, undefined, {
                ...$from.parent.attrs,
                splitId,
            });

            // remove the splitId from the paragraph before the split
            const $prev = state.doc.resolve(endPos);
            const prevNode = $prev.nodeBefore;
            if (prevNode && prevNode.type.name === "paragraph") {
                const startPos = endPos - prevNode.nodeSize;
                const attrs = { ...prevNode.attrs };
                delete attrs.splitId;
                tr = tr.setNodeMarkup(startPos, undefined, attrs);
            }

            break;
            }
            case ActionType.BREAK_SPLIT_ID: {
            console.log("BREAK_SPLIT_ID")
            // TODO: This case should include the splitId in the start node and 
            // define a new one that will be replaces for every paragraph after 
            // the start node that use the start node splitId
            const { splitId } = action;
            const $from = state.selection.$from;
            const startPos = $from.before();
            const newId = randomId();

            // keep original splitId in the start node
            tr = tr.setNodeMarkup(startPos, undefined, {
                ...$from.parent.attrs,
                splitId,
            });

            // assign new splitId to all subsequent contiguous paragraphs sharing the old one
            let pos = startPos + $from.parent.nodeSize;
            let node = state.doc.nodeAt(pos);
            while (node && node.type.name === "paragraph" && node.attrs.splitId === splitId) {
                tr = tr.setNodeMarkup(pos, undefined, { ...node.attrs, splitId: newId });
                pos += node.nodeSize;
                node = state.doc.nodeAt(pos);
            }

            break;
            }
            case ActionType.REPLACE_SPLIT_ID: {
            console.log("REPLACE_SPLIT_ID")
            const { keepSplitId, replaceSplitId } = action;
            state.doc.descendants((node, pos) => {
                if (node.type.name === "paragraph" && node.attrs.splitId === replaceSplitId) {
                tr = tr.setNodeMarkup(pos, undefined, {
                    ...node.attrs,
                    splitId: keepSplitId,
                });
                }
            });
            break;
            }
            case ActionType.MERGE_NODES_END:
            console.log("MERGE_NODES_END")
            // TODO: This case should use the splitId from the end node for the 
            // new node and replace all the nodes with splitId from start node 
            // for the splitId from end Node.
            const { endSplitId, startSplitId } = action;
            const $from = state.selection.$from;
            const startPos = $from.before();

            // resulting node adopts the end node's splitId
            tr = tr.setNodeMarkup(startPos, undefined, {
                ...$from.parent.attrs,
                splitId: endSplitId,
            });

            // replace any remaining nodes that used the start splitId
            if (startSplitId) {
                state.doc.descendants((node, pos) => {
                if (node.type.name === "paragraph" && node.attrs.splitId === startSplitId) {
                    tr = tr.setNodeMarkup(pos, undefined, {
                    ...node.attrs,
                    splitId: endSplitId,
                    });
                }
                });
            }

            break;
            case ActionType.PARAGRAPH_BREAK:
            case ActionType.DO_NOTHING:
            default:
            // handled elsewhere or no structural changes
            break;
        }
    view.dispatch(tr.setMeta(heightTrackingInternalKey, true));
  },
};
