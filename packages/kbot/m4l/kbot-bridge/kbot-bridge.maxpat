{
	"patcher": {
		"fileversion": 1,
		"appversion": {
			"major": 9,
			"minor": 0,
			"revision": 0,
			"architecture": "x64",
			"modernui": 1
		},
		"classnamespace": "box",
		"rect": [100, 100, 600, 400],
		"bglocked": 0,
		"openinpresentation": 1,
		"default_fontsize": 12.0,
		"default_fontface": 0,
		"default_fontname": "Arial",
		"gridonopen": 1,
		"gridsize": [15.0, 15.0],
		"gridsnaponopen": 1,
		"objectsnaponopen": 1,
		"statusbarvisible": 2,
		"toolbarvisible": 0,
		"lefttoolbarpinned": 0,
		"toptoolbarpinned": 0,
		"righttoolbarpinned": 0,
		"bottomtoolbarpinned": 0,
		"toolbars_unpinned_last_save": 0,
		"tallnewobj": 0,
		"boxanimatetime": 200,
		"enablehscroll": 0,
		"enablevscroll": 0,
		"devicewidth": 200.0,
		"description": "kbot Bridge -- WebSocket server for full LOM access from kbot CLI",
		"digest": "Replaces AbletonOSC. Runs WebSocket on port 9999.",
		"tags": "kbot bridge websocket lom",
		"style": "",
		"subpatcher_template": "",
		"boxes": [
			{
				"box": {
					"id": "obj-1",
					"maxclass": "newobj",
					"numinlets": 1,
					"numoutlets": 1,
					"outlettype": [""],
					"patching_rect": [30.0, 30.0, 280.0, 22.0],
					"text": "node.script kbot-bridge.js @autostart 1"
				}
			},
			{
				"box": {
					"id": "obj-2",
					"maxclass": "newobj",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": ["", ""],
					"patching_rect": [30.0, 80.0, 200.0, 22.0],
					"text": "js kbot-bridge-lom.js"
				}
			},
			{
				"box": {
					"id": "obj-3",
					"maxclass": "newobj",
					"numinlets": 1,
					"numoutlets": 1,
					"outlettype": [""],
					"patching_rect": [30.0, 130.0, 150.0, 22.0],
					"text": "route lom_command"
				}
			},
			{
				"box": {
					"id": "obj-4",
					"maxclass": "newobj",
					"numinlets": 1,
					"numoutlets": 1,
					"outlettype": [""],
					"patching_rect": [30.0, 180.0, 150.0, 22.0],
					"text": "prepend lom_result"
				}
			},
			{
				"box": {
					"id": "obj-5",
					"maxclass": "newobj",
					"numinlets": 1,
					"numoutlets": 1,
					"outlettype": [""],
					"patching_rect": [250.0, 180.0, 150.0, 22.0],
					"text": "prepend lom_event"
				}
			},
			{
				"box": {
					"id": "obj-6",
					"maxclass": "comment",
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [30.0, 240.0, 280.0, 20.0],
					"text": "kbot Bridge v1.0 -- ws://localhost:9999",
					"presentation": 1,
					"presentation_rect": [10.0, 10.0, 180.0, 20.0]
				}
			},
			{
				"box": {
					"id": "obj-7",
					"maxclass": "comment",
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [30.0, 260.0, 280.0, 20.0],
					"text": "Status: starting...",
					"presentation": 1,
					"presentation_rect": [10.0, 30.0, 180.0, 20.0]
				}
			},
			{
				"box": {
					"id": "obj-audio-in",
					"maxclass": "newobj",
					"numinlets": 0,
					"numoutlets": 2,
					"outlettype": ["signal", "signal"],
					"patching_rect": [30.0, 300.0, 80.0, 22.0],
					"text": "plugin~ 2"
				}
			},
			{
				"box": {
					"id": "obj-audio-out",
					"maxclass": "newobj",
					"numinlets": 2,
					"numoutlets": 0,
					"patching_rect": [30.0, 340.0, 80.0, 22.0],
					"text": "plugout~ 2"
				}
			}
		],
		"lines": [
			{
				"patchline": {
					"source": ["obj-1", 0],
					"destination": ["obj-3", 0],
					"comment": "node.script outlet -> route lom_command"
				}
			},
			{
				"patchline": {
					"source": ["obj-3", 0],
					"destination": ["obj-2", 0],
					"comment": "route -> js (LOM commands)"
				}
			},
			{
				"patchline": {
					"source": ["obj-2", 0],
					"destination": ["obj-4", 0],
					"comment": "js result outlet -> prepend lom_result"
				}
			},
			{
				"patchline": {
					"source": ["obj-2", 1],
					"destination": ["obj-5", 0],
					"comment": "js event outlet -> prepend lom_event"
				}
			},
			{
				"patchline": {
					"source": ["obj-4", 0],
					"destination": ["obj-1", 0],
					"comment": "lom_result -> node.script inlet (back to WebSocket)"
				}
			},
			{
				"patchline": {
					"source": ["obj-5", 0],
					"destination": ["obj-1", 0],
					"comment": "lom_event -> node.script inlet (push to subscribers)"
				}
			},
			{
				"patchline": {
					"source": ["obj-audio-in", 0],
					"destination": ["obj-audio-out", 0],
					"comment": "audio passthrough L"
				}
			},
			{
				"patchline": {
					"source": ["obj-audio-in", 1],
					"destination": ["obj-audio-out", 1],
					"comment": "audio passthrough R"
				}
			}
		]
	}
}
