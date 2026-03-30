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
		"rect": [100, 100, 500, 350],
		"openinpresentation": 1,
		"default_fontsize": 12.0,
		"default_fontname": "Arial",
		"devicewidth": 250.0,
		"description": "kbot Auto Mixer -- frequency analysis, collision detection, LUFS monitoring",
		"digest": "AI-powered mix analysis engine for kbot",
		"tags": "kbot mixer analysis lufs eq",
		"boxes": [
			{
				"box": {
					"id": "obj-node",
					"maxclass": "newobj",
					"numinlets": 1,
					"numoutlets": 1,
					"outlettype": [""],
					"patching_rect": [30.0, 30.0, 300.0, 22.0],
					"text": "node.script kbot-auto-mixer.js @autostart 1"
				}
			},
			{
				"box": {
					"id": "obj-route",
					"maxclass": "newobj",
					"numinlets": 1,
					"numoutlets": 4,
					"outlettype": ["", "", "", ""],
					"patching_rect": [30.0, 70.0, 350.0, 22.0],
					"text": "route status analyze_request mix_report apply_corrections"
				}
			},
			{
				"box": {
					"id": "obj-status",
					"maxclass": "comment",
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [30.0, 200.0, 200.0, 20.0],
					"text": "Status: initializing...",
					"presentation": 1,
					"presentation_rect": [10.0, 10.0, 230.0, 20.0]
				}
			},
			{
				"box": {
					"id": "obj-title",
					"maxclass": "comment",
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [30.0, 220.0, 200.0, 20.0],
					"text": "kbot Auto Mixer v1.0",
					"presentation": 1,
					"presentation_rect": [10.0, 30.0, 230.0, 20.0],
					"fontface": 1
				}
			},
			{
				"box": {
					"id": "obj-mode-toggle",
					"maxclass": "toggle",
					"numinlets": 1,
					"numoutlets": 1,
					"outlettype": ["int"],
					"patching_rect": [30.0, 110.0, 20.0, 20.0],
					"presentation": 1,
					"presentation_rect": [10.0, 55.0, 20.0, 20.0]
				}
			},
			{
				"box": {
					"id": "obj-mode-label",
					"maxclass": "comment",
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [55.0, 110.0, 100.0, 20.0],
					"text": "Active Mode",
					"presentation": 1,
					"presentation_rect": [35.0, 55.0, 100.0, 20.0]
				}
			},
			{
				"box": {
					"id": "obj-audio-in",
					"maxclass": "newobj",
					"numinlets": 0,
					"numoutlets": 2,
					"outlettype": ["signal", "signal"],
					"patching_rect": [30.0, 270.0, 80.0, 22.0],
					"text": "plugin~ 2"
				}
			},
			{
				"box": {
					"id": "obj-audio-out",
					"maxclass": "newobj",
					"numinlets": 2,
					"numoutlets": 0,
					"patching_rect": [30.0, 300.0, 80.0, 22.0],
					"text": "plugout~ 2"
				}
			}
		],
		"lines": [
			{
				"patchline": {
					"source": ["obj-node", 0],
					"destination": ["obj-route", 0]
				}
			},
			{
				"patchline": {
					"source": ["obj-audio-in", 0],
					"destination": ["obj-audio-out", 0]
				}
			},
			{
				"patchline": {
					"source": ["obj-audio-in", 1],
					"destination": ["obj-audio-out", 1]
				}
			}
		]
	}
}
