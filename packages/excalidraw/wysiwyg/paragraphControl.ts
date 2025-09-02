import { EditorState } from 'prosemirror-state';
import { Node as PMNode } from 'prosemirror-model';

/** High-level structural flags. */
export const enum EditFlag {
  REGULAR_EDIT = 'REGULAR_EDIT',
  PARAGRAPH_BREAK = 'PARAGRAPH_BREAK',
  PARAGRAPH_MERGE = 'PARAGRAPH_MERGE',
}

/** Action constants, now including BREAK_SPLIT_ID for 2.1.3 */
export const enum ActionType {
  DO_NOTHING = 'DO_NOTHING',
  PARAGRAPH_BREAK = 'PARAGRAPH_BREAK',
  KEEP_START_SPLIT_ID = 'KEEP_START_SPLIT_ID',
  KEEP_END_SPLIT_ID = 'KEEP_END_SPLIT_ID',
  BREAK_SPLIT_ID = 'BREAK_SPLIT_ID',            // ⬅️ NEW
  REPLACE_SPLIT_ID = 'REPLACE_SPLIT_ID',
  MERGE_NODES_END = 'MERGE_NODES_END',
}

export type Action =
  | { type: ActionType.DO_NOTHING }
  | { type: ActionType.PARAGRAPH_BREAK }
  | { type: ActionType.KEEP_START_SPLIT_ID; splitId: string }
  | { type: ActionType.KEEP_END_SPLIT_ID; splitId: string }
  | { type: ActionType.BREAK_SPLIT_ID; splitId: string } // ⬅️ NEW
  | { type: ActionType.REPLACE_SPLIT_ID; keepSplitId: string; replaceSplitId: string }
  | { type: ActionType.MERGE_NODES_END; endSplitId: string; startSplitId: '' };

export interface PositionOverrides {
  prevFrom?: number; prevTo?: number;
  currFrom?: number; currTo?: number;
}

interface BlockContext {
  node: PMNode;
  depth: number;
  parent: PMNode;
  indexInParent: number;
  startPos: number;
  splitId?: string;
}

function readSplitId(node: PMNode, splitAttr: string): string | undefined {
  const v = node?.attrs?.[splitAttr];
  return typeof v === 'string' && v.length > 0 ? v : undefined;
}

function getBlockContext(doc: PMNode, pos: number, splitAttr: string): BlockContext {
  const $pos = doc.resolve(pos);
  let depth = $pos.depth;
  while (depth > 0 && !$pos.node(depth).type.isBlock) depth--;
  const node = $pos.node(depth);
  const parent = depth > 0 ? $pos.node(depth - 1) : doc;
  const indexInParent = $pos.index(depth);
  const startPos = $pos.start(depth);
  const splitId = readSplitId(node, splitAttr);
  return { node, depth, parent, indexInParent, startPos, splitId };
}

function sameBlock(a: BlockContext, b: BlockContext): boolean {
  return a.startPos === b.startPos;
}

/**
 * Returns true if *any* previous sibling shares the same splitId.
 * If you want ONLY contiguous siblings, break on first non-matching and return false.
 */
function anyPrevSharesSplitId(ctx: BlockContext, splitAttr: string): boolean {
  const id = readSplitId(ctx.node, splitAttr);
  if (!id) return false;
  for (let i = ctx.indexInParent - 1; i >= 0; i--) {
    const sib = ctx.parent.child(i);
    const sid = readSplitId(sib, splitAttr);
    if (sid === id) return true;
    // For contiguous-only behavior, uncomment the next line:
    // else break;
  }
  return false;
}

/** Same idea for next siblings. */
function anyNextSharesSplitId(ctx: BlockContext, splitAttr: string): boolean {
  const id = readSplitId(ctx.node, splitAttr);
  if (!id) return false;
  for (let i = ctx.indexInParent + 1; i < ctx.parent.childCount; i++) {
    const sib = ctx.parent.child(i);
    const sid = readSplitId(sib, splitAttr);
    if (sid === id) return true;
    // For contiguous-only behavior, uncomment the next line:
    // else break;
  }
  return false;
}

export function classifyEdit(
  prev: EditorState,
  curr: EditorState,
  splitAttr: string = 'splitId',
  positions?: PositionOverrides,
): EditFlag {
  const prevFrom = positions?.prevFrom ?? prev.selection.from;
  const prevTo   = positions?.prevTo   ?? prev.selection.to;
  const currFrom = positions?.currFrom ?? curr.selection.from;
  const currTo   = positions?.currTo   ?? curr.selection.to;

  const prevStart = getBlockContext(prev.doc, prevFrom, splitAttr);
  const prevEnd   = getBlockContext(prev.doc, prevTo,   splitAttr);
  const currStart = getBlockContext(curr.doc, currFrom, splitAttr);
  const currEnd   = getBlockContext(curr.doc, currTo,   splitAttr);

  const prevSame = sameBlock(prevStart, prevEnd);
  const currSame = sameBlock(currStart, currEnd);

  if (prevSame && currSame) return EditFlag.REGULAR_EDIT;
  if (prevSame && !currSame) return EditFlag.PARAGRAPH_BREAK;
  if (!prevSame && currSame) return EditFlag.PARAGRAPH_MERGE;
  return EditFlag.REGULAR_EDIT;
}

/**
 * Split-ID aware decision logic with updated 2.1.3:
 * 1) REGULAR_EDIT  -> DO_NOTHING 
 * 2) PARAGRAPH_BREAK:
 *    2.1 If initial start has splitId:
 *        2.1.3 If previous *and* next share it -> BREAK_SPLIT_ID(splitId)  
 *        2.1.1 Else if previous share it      -> KEEP_START_SPLIT_ID(splitId)
 *        2.1.2 Else if next share it          -> KEEP_END_SPLIT_ID(splitId)
 *        Else -> PARAGRAPH_BREAK
 *    2.2 If no splitId on start -> PARAGRAPH_BREAK
 3) PARAGRAPH_MERGE:
 *    3.1 If start has splitId and end has a *different* splitId ->
 *        REPLACE_SPLIT_ID(keepSplitId = start.splitId, replaceSplitId = end.splitId)
 *    3.2 If start has no splitId and end has splitId ->
 *        MERGE_NODES_END(endSplitId = end.splitId, startSplitId = '')
 *    3.3 If start has splitId and end has no splitId ->
 *        KEEP_START_SPLIT_ID(start.splitId)
 *
 * Notes:
 * - When both previous *and* next siblings share the splitId on a paragraph break,
 *   this function prefers KEEP_START_SPLIT_ID (stable, backward-leaning choice). Adjust if needed.
 * - If none of the merge sub-cases apply, we default to DO_NOTHING (pragmatic no-op).
 */

export function decideSplitAction(
  prev: EditorState,
  curr: EditorState,
  splitAttr: string = 'splitId',
  positions?: PositionOverrides,
): Action {
  const flag = classifyEdit(prev, curr, splitAttr, positions);

  const prevFrom = positions?.prevFrom ?? prev.selection.from;
  const prevTo   = positions?.prevTo   ?? prev.selection.to;
  const startCtx = getBlockContext(prev.doc, prevFrom, splitAttr);
  const endCtx   = getBlockContext(prev.doc, prevTo,   splitAttr);
  const startId  = startCtx.splitId;
  const endId    = endCtx.splitId;

  switch (flag) {
    case EditFlag.REGULAR_EDIT:
      return { type: ActionType.DO_NOTHING };

    case EditFlag.PARAGRAPH_BREAK: {
      if (!startId) return { type: ActionType.PARAGRAPH_BREAK };

      const hasPrev = anyPrevSharesSplitId(startCtx, splitAttr);
      const hasNext = anyNextSharesSplitId(startCtx, splitAttr);

      if (hasPrev && hasNext) {
        // 2.1.3 — both sides share the same splitId
        return { type: ActionType.BREAK_SPLIT_ID, splitId: startId };
      }
      if (hasPrev) {
        // 2.1.1 — keep start's splitId
        return { type: ActionType.KEEP_START_SPLIT_ID, splitId: startId };
      }
      if (hasNext) {
        // 2.1.2 — keep end's splitId
        return { type: ActionType.KEEP_END_SPLIT_ID, splitId: startId };
      }
      // 2.1 no neighbors share it — treat as a plain break
      return { type: ActionType.PARAGRAPH_BREAK };
    }

    case EditFlag.PARAGRAPH_MERGE: {
      const startHas = !!startId;
      const endHas   = !!endId;
      if (startHas && endHas && startId !== endId) {
        // 3.1 Different split ids: keep start, replace end.
        return {
          type: ActionType.REPLACE_SPLIT_ID,
          keepSplitId: startId!,
          replaceSplitId: endId!,
        };
      }
      if (!startHas && endHas) {
        // 3.2 Start has none, end has one: merge into end's splitId.
        return {
          type: ActionType.MERGE_NODES_END,
          endSplitId: endId!,
          startSplitId: '',
        };
      }
      if (startHas && !endHas) {
        // 3.3 Keep the start split id.
        return { type: ActionType.KEEP_START_SPLIT_ID, splitId: startId! };
      }
      // Both lack splitId or both identical => nothing to do.
      return { type: ActionType.DO_NOTHING };
    }
  }
}
