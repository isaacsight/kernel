(function () {
    // Check if a project is open
    if (app.project === null) {
        alert("Please open an Adobe Premiere Pro project first.");
        return;
    }

    // --- Configuration ---
    var SEQUENCE_NAME = "TikTok_ai-agents-future";
    var FILE_PATHS = ["/Users/isaachernandez/blog design/output_adobe_test/voiceover.mp3"];
    var importedItems = [];
    var currentInsertionTime = 0; // Time in seconds

    // Function to find an imported ProjectItem by its file path
    // We must search the project bin after import, as importFiles doesn't return the items directly.
    function findItemByPath(rootItem, path) {
        var numChildren = rootItem.children.numItems;
        for (var i = 0; i < numChildren; i++) {
            var child = rootItem.children[i];

            // Project items that represent media files usually have a file path
            // Note: getPath(true) provides the full, canonical path
            if (child.get and Path(true) === path) {
                return child;
            }
        }
        return null;
    }

    // --- Step 1: Import Files ---
    $.writeln("Starting file import...");
    
    // Import files (suppress UI, allow duplicates)
    try {
        app.project.importFiles(FILE_PATHS, true, true);
    } catch (e) {
        alert("Error during file import: " + e);
        return;
    }

    // Wait a moment for the import process to complete (Premiere sometimes needs a brief pause)
    // We proceed immediately, relying on findItemByPath to verify existence.

    // Find the imported item(s) in the project root
    var projectRoot = app.project.rootItem;
    for (var j = 0; j < FILE_PATHS.length; j++) {
        var item = findItemByPath(projectRoot, FILE_PATHS[j]);
        if (item) {
            importedItems.push(item);
        } else {
            alert("Failed to locate imported item in project: " + FILE_PATHS[j]);
            return;
        }
    }

    if (importedItems.length === 0) {
        alert("No media items were successfully imported.");
        return;
    }

    // --- Step 2: Create New Sequence ---
    $.writeln("Creating sequence: " + SEQUENCE_NAME);
    app.project.createNewSequence(SEQUENCE_NAME);
    
    var newSequence = app.project.activeSequence;

    if (!newSequence) {
        alert("Error: Could not create or activate the new sequence.");
        return;
    }
    
    // --- Step 3: Add Clips Sequentially ---

    // Note on track selection: The input file is an MP3 (Audio).
    // Premiere Pro prevents placing audio clips on dedicated video tracks (Video 1).
    // Therefore, we must use the first Audio Track (index 0).

    var targetTrack;
    try {
        // Use Audio Track 1 (index 0) for the MP3 file
        targetTrack = newSequence.audioTracks[0];
    } catch (e) {
        alert("Error accessing Audio Track 1: " + e);
        return;
    }
    
    if (!targetTrack) {
        alert("Audio Track 1 is not available for insertion.");
        return;
    }

    $.writeln("Placing clips onto " + targetTrack.name + "...");

    for (var k = 0; k < importedItems.length; k++) {
        var clipItem = importedItems[k];

        // 1. Define insertion point using a Time object
        var insertionTime = new newSequence.time.Time();
        insertionTime.seconds = currentInsertionTime;

        // 2. Insert the clip
        // Use overwriteClip as it reliably places the item at the specified time without moving existing content (which is empty here).
        var success = targetTrack.overwriteClip(clipItem, insertionTime);

        if (success) {
            $.writeln("Successfully placed: " + clipItem.name + " at time: " + insertionTime.getFormatted());

            // 3. Update the insertion time for the next clip
            var duration = clipItem.get and Duration();
            if (duration && duration.seconds > 0) {
                currentInsertionTime += duration.seconds;
            } else {
                $.writeln("Warning: Could not determine duration for clip: " + clipItem.name);
            }
        } else {
            $.writeln("Error: Failed to place clip " + clipItem.name + " on track.");
        }
    }

    $.writeln("Script completed. Sequence '" + SEQUENCE_NAME + "' created and clips placed.");

})();
// End of ExtendScript
// Note: Adobe Premiere Pro must be running with a project open to execute this script successfully.