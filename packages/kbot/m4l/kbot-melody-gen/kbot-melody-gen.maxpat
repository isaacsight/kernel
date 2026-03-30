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
		"rect": [100, 100, 450, 350],
		"openinpresentation": 1,
		"default_fontsize": 12.0,
		"default_fontname": "Arial",
		"devicewidth": 250.0,
		"description": "kbot Melody Generator -- AI-powered scale-aware melody generation",
		"digest": "Generates melodies from parameters (key, scale, style, density) and writes them to clips or outputs real-time MIDI",
		"tags": "kbot melody generator midi scale ai",
		"boxes": [
			{
				"box": {
					"id": "obj-js",
					"maxclass": "newobj",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": ["", ""],
					"patching_rect": [30.0, 30.0, 200.0, 22.0],
					"text": "js kbot-melody-gen.js"
				}
			},
			{
				"box": {
					"id": "obj-title",
					"maxclass": "comment",
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [30.0, 80.0, 200.0, 20.0],
					"text": "kbot Melody Gen v1.0",
					"presentation": 1,
					"presentation_rect": [10.0, 10.0, 230.0, 20.0],
					"fontface": 1
				}
			},
			{
				"box": {
					"id": "obj-scale-label",
					"maxclass": "comment",
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [30.0, 100.0, 200.0, 20.0],
					"text": "Scale: -- | Style: --",
					"presentation": 1,
					"presentation_rect": [10.0, 30.0, 230.0, 20.0]
				}
			},
			{
				"box": {
					"id": "obj-density",
					"maxclass": "dial",
					"numinlets": 1,
					"numoutlets": 1,
					"outlettype": ["float"],
					"patching_rect": [30.0, 130.0, 40.0, 40.0],
					"presentation": 1,
					"presentation_rect": [10.0, 55.0, 40.0, 40.0]
				}
			},
			{
				"box": {
					"id": "obj-density-label",
					"maxclass": "comment",
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [75.0, 140.0, 60.0, 20.0],
					"text": "Density",
					"presentation": 1,
					"presentation_rect": [55.0, 65.0, 60.0, 20.0]
				}
			},
			{
				"box": {
					"id": "obj-generate-btn",
					"maxclass": "textbutton",
					"numinlets": 1,
					"numoutlets": 3,
					"outlettype": ["", "", "int"],
					"patching_rect": [150.0, 130.0, 80.0, 25.0],
					"text": "Generate",
					"presentation": 1,
					"presentation_rect": [120.0, 60.0, 80.0, 25.0]
				}
			},
			{
				"box": {
					"id": "obj-live-toggle",
					"maxclass": "toggle",
					"numinlets": 1,
					"numoutlets": 1,
					"outlettype": ["int"],
					"patching_rect": [250.0, 130.0, 20.0, 20.0],
					"presentation": 1,
					"presentation_rect": [210.0, 63.0, 20.0, 20.0]
				}
			},
			{
				"box": {
					"id": "obj-live-label",
					"maxclass": "comment",
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [275.0, 130.0, 40.0, 20.0],
					"text": "Live",
					"presentation": 1,
					"presentation_rect": [210.0, 50.0, 40.0, 20.0]
				}
			},
			{
				"box": {
					"id": "obj-noteout",
					"maxclass": "newobj",
					"numinlets": 3,
					"numoutlets": 0,
					"patching_rect": [30.0, 200.0, 100.0, 22.0],
					"text": "noteout"
				}
			},
			{
				"box": {
					"id": "obj-output",
					"maxclass": "message",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [""],
					"patching_rect": [250.0, 200.0, 200.0, 22.0],
					"text": ""
				}
			},
			{
				"box": {
					"id": "obj-midiin",
					"maxclass": "newobj",
					"numinlets": 0,
					"numoutlets": 1,
					"outlettype": [""],
					"patching_rect": [30.0, 260.0, 50.0, 22.0],
					"text": "midiin"
				}
			},
			{
				"box": {
					"id": "obj-midiout",
					"maxclass": "newobj",
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [30.0, 290.0, 55.0, 22.0],
					"text": "midiout"
				}
			}
		],
		"lines": [
			{
				"patchline": {
					"source": ["obj-js", 0],
					"destination": ["obj-noteout", 0],
					"comment": "MIDI notes from live mode"
				}
			},
			{
				"patchline": {
					"source": ["obj-js", 1],
					"destination": ["obj-output", 1],
					"comment": "Result messages"
				}
			},
			{
				"patchline": {
					"source": ["obj-midiin", 0],
					"destination": ["obj-midiout", 0],
					"comment": "MIDI passthrough"
				}
			}
		]
	}
}
