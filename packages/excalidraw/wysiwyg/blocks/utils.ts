// AFTER (new file)
import { EditorView } from "prosemirror-view";
import { getBlockStrategy } from "./registry";
import type { EditorState } from "prosemirror-state";

export const splitBlockAt = (
  view: EditorView,
  pos: number,
  prevState: EditorState = view.state,
) => {
  const $pos = view.state.doc.resolve(pos);
  const type = $pos.parent.type.name;
  const strategy = getBlockStrategy(type);
  if (!strategy) return;

  const action = strategy.decide(prevState, view.state);
  strategy.apply(view, action);
};