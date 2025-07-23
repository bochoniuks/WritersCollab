import { Plugin } from 'prosemirror-state';

const heightTrackingPlugin = new Plugin({
  state: {
    init() {
      return {};  // Store node heights in a dictionary, keyed by position
    },
    apply(tr, value) {
      const meta = tr.getMeta('heightData');
      if (meta) {
        return { ...value, ...meta };  // Update node heights with new data
      }
      return value;
    },
  },
  props: {
    handleDOMEvents: {
      update(view, event) {
        const heights = {};

        // Calculate the height for the changed node
        const getHeight = (node, pos) => {
          const nodeElement = view.domAtPos(pos).node;
          return nodeElement.offsetHeight;
        };

        // Function to recalculate heights starting from a changed node upwards
        const recalculateHeight = (node, pos) => {
          // Recalculate the height for the current node
          heights[pos] = getHeight(node, pos);

          // If the node has a parent, propagate the recalculation upwards
          const parentPos = view.state.doc.resolve(pos).parent;
          if (parentPos) {
            // Call recursively for parent nodes if needed
            recalculateHeight(parentPos.node, pos - 1); // Move up the document
          }
        };

        // Detect which nodes are affected and recalculate their heights
        view.state.doc.nodesBetween(0, view.state.doc.content.size, (node, pos) => {
          if (node.isText || node.isBlock) {
            recalculateHeight(node, pos);  // Recalculate affected node's height
          }
        });

        // Dispatch the height updates in a transaction
        if (Object.keys(heights).length > 0) {
          view.dispatch(view.state.tr.setMeta('heightData', heights));
        }

        return false;  // Allow the default behavior to continue
      },
    },
  },
});
