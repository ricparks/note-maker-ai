
const leaves = app.workspace.getLeavesOfType('file-explorer');
if (leaves.length > 0) {
    const view = leaves[0].view;
    console.log("File Explorer View:", view);
    // Check for common internal properties for selection
    if (view.files) console.log("view.files:", view.files);
    if (view.selectedDom) console.log("view.selectedDom:", view.selectedDom);
    if (view.selection) console.log("view.selection:", view.selection);

    // Attempt to drill into the DOM to find selected items if property not found
    const selectedElements = view.containerEl.querySelectorAll('.nav-file-title.is-active');
    console.log("Selected DOM elements count:", selectedElements.length);
    selectedElements.forEach(el => console.log(el.innerText));
} else {
    console.log("No file explorer leaf found.");
}
