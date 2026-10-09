// Schätzle's working mark (development/plans/waiting-states.md): a little price tag swinging on its
// string, the way a tag does on a shelf when someone brushes past. In the waiting buttons (Folio's
// configureWaiting) and the connection pill. Drawn in currentColor, so it's white on the red button
// and ink elsewhere; app.css swings it, and holds it still under reduced motion.

export const TAG_MARK =
  '<svg class="tag-mark" viewBox="0 0 24 20" aria-hidden="true">' +
  '<path class="string" d="M6.5 10 L3 1.5" />' +
  '<g class="swing"><path d="M8 4h12a2.5 2.5 0 0 1 2.5 2.5v7A2.5 2.5 0 0 1 20 16H8L2.6 10Z M6.5 8.6a1.4 1.4 0 1 0 0 2.8a1.4 1.4 0 1 0 0-2.8Z" fill-rule="evenodd" /></g>' +
  '</svg>';
