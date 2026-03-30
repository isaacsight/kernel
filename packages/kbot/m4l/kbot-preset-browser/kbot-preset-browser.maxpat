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
		"rect": [100, 100, 400, 300],
		"openinpresentation": 1,
		"default_fontsize": 12.0,
		"default_fontname": "Arial",
		"devicewidth": 200.0,
		"description": "kbot Preset Browser -- list, load, save, and navigate presets for any device",
		"digest": "Works with native Ableton devices, VST, and AU plugins",
		"tags": "kbot preset browser vst au",
		"boxes": [
			{
				"box": {
					"id": "obj-js",
					"maxclass": "newobj",
					"numinlets": 1,
					"numoutlets": 1,
					"outlettype": [""],
					"patching_rect": [30.0, 30.0, 220.0, 22.0],
					"text": "js kbot-preset-browser.js"
				}
			},
			{
				"box": {
					"id": "obj-title",
					"maxclass": "comment",
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [30.0, 80.0, 180.0, 20.0],
					"text": "kbot Preset Browser v1.0",
					"presentation": 1,
					"presentation_rect": [10.0, 10.0, 180.0, 20.0],
					"fontface": 1
				}
			},
			{
				"box": {
					"id": "obj-prev",
					"maxclass": "textbutton",
					"numinlets": 1,
					"numoutlets": 3,
					"outlettype": ["", "", "int"],
					"patching_rect": [30.0, 110.0, 40.0, 22.0],
					"text": "<",
					"presentation": 1,
					"presentation_rect": [10.0, 35.0, 30.0, 22.0]
				}
			},
			{
				"box": {
					"id": "obj-next",
					"maxclass": "textbutton",
					"numinlets": 1,
					"numoutlets": 3,
					"outlettype": ["", "", "int"],
					"patching_rect": [80.0, 110.0, 40.0, 22.0],
					"text": ">",
					"presentation": 1,
					"presentation_rect": [155.0, 35.0, 30.0, 22.0]
				}
			},
			{
				"box": {
					"id": "obj-preset-name",
					"maxclass": "comment",
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [130.0, 110.0, 200.0, 20.0],
					"text": "---",
					"presentation": 1,
					"presentation_rect": [45.0, 37.0, 105.0, 20.0]
				}
			},
			{
				"box": {
					"id": "obj-output",
					"maxclass": "message",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [""],
					"patching_rect": [30.0, 160.0, 300.0, 22.0],
					"text": ""
				}
			},
			{
				"box": {
					"id": "obj-audio-in",
					"maxclass": "newobj",
					"numinlets": 0,
					"numoutlets": 2,
					"outlettype": ["signal", "signal"],
					"patching_rect": [30.0, 220.0, 80.0, 22.0],
					"text": "plugin~ 2"
				}
			},
			{
				"box": {
					"id": "obj-audio-out",
					"maxclass": "newobj",
					"numinlets": 2,
					"numoutlets": 0,
					"patching_rect": [30.0, 260.0, 80.0, 22.0],
					"text": "plugout~ 2"
				}
			}
		],
		"lines": [
			{
				"patchline": {
					"source": ["obj-js", 0],
					"destination": ["obj-output", 1]
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
