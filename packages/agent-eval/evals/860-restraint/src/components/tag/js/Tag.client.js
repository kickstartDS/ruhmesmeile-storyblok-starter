/**
 * Removes a tag from the DOM when its remove control is activated.
 *
 * Delegated from the document so tags rendered after this script runs are
 * covered without re-initialising anything.
 */
document.addEventListener("click", (event) => {
  const trigger = event.target.closest(".dsa-tag__remove");
  if (!trigger) return;

  const tag = trigger.closest(".dsa-tag");
  if (!tag) return;

  tag.dispatchEvent(new CustomEvent("dsa-tag:remove", { bubbles: true }));
  tag.remove();
});
