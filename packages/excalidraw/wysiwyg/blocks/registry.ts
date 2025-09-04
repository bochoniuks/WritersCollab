// AFTER (new file)
import type { EditorState } from "prosemirror-state";
import type { EditorView } from "prosemirror-view";

export interface BlockAction {}
export interface BlockStrategy<A extends BlockAction = BlockAction> {
  decide(prev: EditorState, curr: EditorState): A;
  apply(view: EditorView, action: A): void;
}

const strategies: Record<string, BlockStrategy | undefined> = {};

export const registerBlockStrategy = (name: string, strategy: BlockStrategy) => {
  strategies[name] = strategy;
};

export const getBlockStrategy = (name: string) => strategies[name];
