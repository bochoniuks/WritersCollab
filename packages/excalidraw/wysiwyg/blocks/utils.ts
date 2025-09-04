// AFTER (new file)
import { EditorView } from "prosemirror-view";
import { getBlockStrategy } from "./registry";

export const splitBlockAt = (view: EditorView, pos: number) => {
  const $pos = view.state.doc.resolve(pos);
  const type = $pos.parent.type.name;
  const strategy = getBlockStrategy(type);
  if (!strategy) return;

  const action = strategy.decide(view.state, view.state); // caller can pass prev state if needed
  strategy.apply(view, action);
};
