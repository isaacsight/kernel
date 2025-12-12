(function () {
    // This script requires Adobe Photoshop to run.
    if (typeof app === 'undefined' || typeof app.documents === 'undefined') {
        alert("This script must be run within Adobe Photoshop.");
        return;
    }

    // --- Configuration Variables ---
    var DOC_W = 1920;
    var DOC_H = 1080;
    var DOC_RES = 72;
    // Output path specified by the user
    var OUTPUT_PATH = "/Users/isaachernandez/blog design/output_adobe_test/ai-agents-creative-team_thumb.jpg";
    var BG_COLOR_RGB = [20, 30, 60]; // Dark Blue
    var TEXT_COLOR_RGB = [255, 255, 255]; // White
    var FONT_SIZE = 150;
    var FONT_NAME_PRIMARY = "Impact";
    // Fallback font name (Standard internal name for Arial Bold)
    var FONT_NAME_FALLBACK = "Arial-BoldMT";
    // Use \r for line breaks in Photoshop TextItem content
    var TEXT_CONTENT = "AI CREATIVE\rREVOLUTION";
    
    // Store original settings for cleanup
    var originalDisplayDialogs = app.displayDialogs;
    var originalRulerUnits = app.preferences.rulerUnits;
    var doc = null;

    try {
        // IMPORTANT: Suppress all dialogs to run autonomously
        app.displayDialogs = DialogModes.NO;
        app.preferences.rulerUnits = RulerUnits.PIXELS;

        // 1. Create a 1920x1080px document (72dpi).
        doc = app.documents.add(DOC_W, DOC_H, DOC_RES, "AI Creative Thumbnail", NewDocumentMode.RGB, DocumentFill.SOLID);

        // 2. Define Dark Blue color
        var darkBlue = new SolidColor();
        darkBlue.rgb.red = BG_COLOR_RGB[0];
        darkBlue.rgb.green = BG_COLOR_RGB[1];
        darkBlue.rgb.blue = BG_COLOR_RGB[2];

        // Fill background using doc.selection.fill()
        doc.selection.selectAll();
        doc.selection.fill(darkBlue, ColorBlendMode.NORMAL, 100);
        doc.selection.deselect();


        // 3. Add a text layer
        var textLayer = doc.artLayers.add();
        textLayer.kind = LayerKind.TEXT;

        var whiteColor = new SolidColor();
        whiteColor.rgb.red = TEXT_COLOR_RGB[0];
        whiteColor.rgb.green = TEXT_COLOR_RGB[1];
        whiteColor.rgb.blue = TEXT_COLOR_RGB[2];

        var tI = textLayer.textItem;
        tI.contents = TEXT_CONTENT;
        tI.size = new UnitValue(FONT_SIZE, "px");
        tI.color = whiteColor;
        tI.justification = Justification.CENTER;

        // Try setting the primary font, use fallback if not found
        try {
            tI.font = FONT_NAME_PRIMARY;
        } catch (e) {
            // Font not available, use fallback
            tI.font = FONT_NAME_FALLBACK;
        }

        // 4. Simplified centering logic: Position set to the center coordinates [960, 540]
        // Note: This sets the text baseline position, providing rough centering.
        tI.position = new Array(DOC_W / 2, DOC_H / 2);


        // 5. Setup Save for Web options
        var saveFile = new File(OUTPUT_PATH);
        
        // Ensure the necessary directories exist
        var outputFolder = saveFile.parent;
        if (!outputFolder.exists) {
            outputFolder.create();
        }

        var sfwOptions = new ExportOptionsSaveForWeb();
        sfwOptions.format = SaveDocumentType.JPEG;
        sfwOptions.quality = 60; // Requested quality 60
        sfwOptions.optimized = true;

        // 6. Save the document using ExportOptionsSaveForWeb
        doc.exportDocument(saveFile, ExportType.SAVEFORWEB, sfwOptions);

    } catch (e) {
        // Error handling
        if (doc) {
            $.writeln("Error processing document: " + e.message);
        }
        alert("Script execution failed.\nError: " + e.message + "\nLine: " + e.line);

    } finally {
        // Cleanup: Close the document without saving changes
        if (doc) {
            doc.close(SaveOptions.DONOTSAVECHANGES); 
        }

        // Restore original user preferences
        app.displayDialogs = originalDisplayDialogs;
        app.preferences.rulerUnits = originalRulerUnits;
    }

})();
// End of script