-- kbot M4L Device Loader
-- Uses AppleScript + System Events to load devices via Ableton's browser
-- This is the hack: we control the GUI directly

on run
	tell application "Ableton Live 12" to activate
	delay 0.5

	-- Open browser with Cmd+Opt+B if needed
	tell application "System Events"
		tell process "Ableton Live 12"
			-- Type "kbot" in browser search to find our devices
			-- First, click on the search field in the browser
			-- Use keyboard shortcut to focus browser search: Cmd+F

			-- Press Cmd+F to search
			keystroke "f" using command down
			delay 0.3

			-- Clear and type search
			keystroke "a" using command down
			keystroke "kbot-drum-synth"
			delay 1.0

			-- Press Enter to confirm search, then drag would need coordinates
			-- which vary by screen. Instead, use Return to load onto selected track
			key code 36 -- Return
			delay 0.5
		end tell
	end tell
end run
