import '@tiptap/pm/view'

declare module '@tiptap/pm/view' {
  interface EditorView {
    page?: {
      width: number
      height: number
      margin: {
        left: number
        right: number
        top: number
        bottom: number
      }
    }
  }
}