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
		"description": "kbot Drum Loader -- direct sample loading into Drum Rack pads via LOM",
		"digest": "Fixes the browser.load_item() drum pad targeting bug. Sets SimplerDevice.sample_file_path directly.",
		"tags": "kbot drum rack sample loader simpler",
		"boxes": [
			{
				"box": {
					"id": "obj-js",
					"maxclass": "newobj",
					"numinlets": 1,
					"numoutlets": 1,
					"outlettype": [""],
					"patching_rect": [30.0, 30.0, 200.0, 22.0],
					"text": "js kbot-drum-loader.js"
				}
			},
			{
				"box": {
					"id": "obj-title",
					"maxclass": "comment",
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [30.0, 80.0, 180.0, 20.0],
					"text": "kbot Drum Loader v1.0",
					"presentation": 1,
					"presentation_rect": [10.0, 10.0, 180.0, 20.0],
					"fontface": 1
				}
			},
			{
				"box": {
					"id": "obj-status",
					"maxclass": "comment",
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [30.0, 100.0, 180.0, 20.0],
					"text": "Direct pad sample injection",
					"presentation": 1,
					"presentation_rect": [10.0, 30.0, 180.0, 20.0]
				}
			},
			{
				"box": {
					"id": "obj-output",
					"maxclass": "message",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [""],
					"patching_rect": [30.0, 140.0, 300.0, 22.0],
					"text": "last result appears here"
				}
			},
			{
				"box": {
					"id": "obj-midiin",
					"maxclass": "newobj",
					"numinlets": 0,
					"numoutlets": 1,
					"outlettype": [""],
					"patching_rect": [30.0, 200.0, 50.0, 22.0],
					"text": "midiin"
				}
			},
			{
				"box": {
					"id": "obj-midiout",
					"maxclass": "newobj",
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [30.0, 240.0, 55.0, 22.0],
					"text": "midiout"
				}
			}
		],
		"lines": [
			{
				"patchline": {
					"source": ["obj-js", 0],
					"destination": ["obj-output", 1],
					"comment": "JS output -> display"
				}
			},
			{
				"patchline": {
					"source": ["obj-midiin", 0],
					"destination": ["obj-midiout", 0],
					"comment": "MIDI passthrough (required for MIDI Effect)"
				}
			}
		]
	}
}
