
tell application "Adobe Photoshop 2025"
    activate
    
    -- Settings
    set docWidth to 1920
    set docHeight to 1080
    set outputFilePath to "/Users/isaachernandez/blog design/output_adobe_test/ai-agents-creative-team_thumb.jpg"
    
    -- 1. Create Document
    set myDoc to make new document with properties {width:docWidth, height:docHeight}
    
    -- 2. Fill Background (Solid Blue)
    set current layer of myDoc to layer "Background" of myDoc
    set fillColor to {class:RGB color, red:20, green:30, blue:60}
    fill selection of current layer of myDoc with contents {class:RGB color, red:20, green:30, blue:60}
    
    -- 3. Add Text
    set textLayer to make new art layer of myDoc with properties {kind:text layer}
    set textItem of textLayer to {contents:"AI CREATIVE\nREVOLUTION", size:150, kind:paragraph text}
    set textItem of textLayer to {position:{docWidth / 2, docHeight / 2}, justification:center}
    set color of textItem of textLayer to {class:RGB color, red:255, green:255, blue:255}
    
    -- 4. Save for Web (JPEG)
    set myOptions to {class:save for web export options, quality:60, format:JPEG}
    export myDoc in (POSIX file outputFilePath) as save for web with options myOptions
    
    close myDoc saving no
end tell
