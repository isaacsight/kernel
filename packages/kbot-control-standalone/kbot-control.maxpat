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
		"rect": [100, 100, 620, 420],
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
		"devicewidth": 220.0,
		"description": "kbot-control -- one M4L device that supersedes AbletonOSC, AbletonBridge, and kbot-bridge. JSON-RPC 2.0 over WebSocket on ws://127.0.0.1:9000 with full LOM access.",
		"digest": "Unified Ableton control for kbot. Drop in once; kbot finds it automatically.",
		"tags": "kbot control websocket lom json-rpc",
		"style": "",
		"subpatcher_template": "",
		"boxes": [
			{
				"box": {
					"id": "obj-server",
					"maxclass": "newobj",
					"numinlets": 1,
					"numoutlets": 1,
					"outlettype": [""],
					"patching_rect": [30.0, 30.0, 340.0, 22.0],
					"text": "node.script kbot-control-server.js @autostart 1 @watch 1"
				}
			},
			{
				"box": {
					"id": "obj-route-request",
					"maxclass": "newobj",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": ["", ""],
					"patching_rect": [30.0, 80.0, 160.0, 22.0],
					"text": "route request"
				}
			},
			{
				"box": {
					"id": "obj-js",
					"maxclass": "newobj",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": ["", ""],
					"patching_rect": [30.0, 130.0, 200.0, 22.0],
					"text": "js kbot-control.js"
				}
			},
			{
				"box": {
					"id": "obj-prepend-response",
					"maxclass": "newobj",
					"numinlets": 1,
					"numoutlets": 1,
					"outlettype": [""],
					"patching_rect": [30.0, 180.0, 180.0, 22.0],
					"text": "prepend response"
				}
			},
			{
				"box": {
					"id": "obj-prepend-notify",
					"maxclass": "newobj",
					"numinlets": 1,
					"numoutlets": 1,
					"outlettype": [""],
					"patching_rect": [260.0, 180.0, 180.0, 22.0],
					"text": "t l"
				}
			},
			{
				"box": {
					"id": "obj-title",
					"maxclass": "comment",
					"numinlets": 1,
					"numoutlets": 0,
					"fontsize": 14.0,
					"patching_rect": [30.0, 230.0, 400.0, 22.0],
					"text": "kbot-control v0.1.0",
					"presentation": 1,
					"presentation_rect": [10.0, 8.0, 200.0, 22.0]
				}
			},
			{
				"box": {
					"id": "obj-status",
					"maxclass": "comment",
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [30.0, 255.0, 400.0, 20.0],
					"text": "WebSocket -> ws://127.0.0.1:9000",
					"presentation": 1,
					"presentation_rect": [10.0, 30.0, 200.0, 18.0]
				}
			},
			{
				"box": {
					"id": "obj-subtitle",
					"maxclass": "comment",
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [30.0, 275.0, 400.0, 20.0],
					"text": "JSON-RPC 2.0 -- full LOM dispatcher",
					"presentation": 1,
					"presentation_rect": [10.0, 48.0, 200.0, 18.0]
				}
			},
			{
				"box": {
					"id": "obj-audio-in",
					"maxclass": "newobj",
					"numinlets": 0,
					"numoutlets": 2,
					"outlettype": ["signal", "signal"],
					"patching_rect": [30.0, 320.0, 80.0, 22.0],
					"text": "plugin~ 2"
				}
			},
			{
				"box": {
					"id": "obj-audio-out",
					"maxclass": "newobj",
					"numinlets": 2,
					"numoutlets": 0,
					"patching_rect": [30.0, 360.0, 80.0, 22.0],
					"text": "plugout~ 2"
				}
			}
		],
		"lines": [
			{
				"patchline": {
					"source": ["obj-server", 0],
					"destination": ["obj-route-request", 0],
					"comment": "node.script outlet -> route request"
				}
			},
			{
				"patchline": {
					"source": ["obj-route-request", 0],
					"destination": ["obj-js", 0],
					"comment": "route request (matched) -> js dispatcher"
				}
			},
			{
				"patchline": {
					"source": ["obj-js", 0],
					"destination": ["obj-prepend-response", 0],
					"comment": "js outlet 0 (rpc result) -> prepend response"
				}
			},
			{
				"patchline": {
					"source": ["obj-js", 1],
					"destination": ["obj-server", 0],
					"comment": "js outlet 1 (notify + json already tagged) -> node.script directly"
				}
			},
			{
				"patchline": {
					"source": ["obj-prepend-response", 0],
					"destination": ["obj-server", 0],
					"comment": "response back into node.script -> WebSocket send"
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
