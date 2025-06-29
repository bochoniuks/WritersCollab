// packages/excalidraw/wysiwyg/styledHardBreak.ts
import HardBreak from "@tiptap/extension-hard-break";
import {
  DEFAULT_FONT_FAMILY,
  DEFAULT_FONT_SIZE,
  FONT_FAMILY,
} from "@excalidraw/common";

export const StyledHardBreak = HardBreak.extend({
  addCommands() {
    return {
      setHardBreak:
        () =>
        ({ commands, chain, state, editor }) => {
          return commands.first([
            () => commands.exitCode(),
            () =>
              commands.command(() => {
                const { selection, storedMarks } = state;
                if (selection.$from.parent.type.spec.isolating) {
                  return false;
                }

                const { keepMarks } = this.options;
                const { splittableMarks } = editor.extensionManager;

                let marks =
                  storedMarks ||
                  (selection.$from.parentOffset && selection.$from.marks()) ||
                  selection.$to.nodeAfter?.marks;

                if (!marks || !marks.length) {
                  const fontName =
                    Object.entries(FONT_FAMILY).find(
                      ([, id]) => id === DEFAULT_FONT_FAMILY,
                    )?.[0] ?? "Excalifont";
                  marks = [
                    editor.schema.marks.textStyle.create({
                      fontFamily: fontName,
                      fontSize: `${DEFAULT_FONT_SIZE}px`,
                    }),
                  ];
                }

                const filteredMarks = marks.filter((mark) =>
                  splittableMarks.includes(mark.type.name),
                );

                const node = editor.schema.nodes.hardBreak.create(
                  null,
                  null,
                  filteredMarks,
                );

                return chain()
                  .insertContent(node)
                  .command(({ tr, dispatch }) => {
                    if (dispatch && keepMarks) {
                      tr.ensureMarks(filteredMarks);
                    }
                    return true;
                  })
                  .run();
              }),
          ]);
        },
    };
  },
});
