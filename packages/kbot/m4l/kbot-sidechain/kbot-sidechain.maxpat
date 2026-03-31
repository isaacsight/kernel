{
	"patcher": {
		"fileversion": 1,
		"appversion": { "major": 9, "minor": 0, "revision": 0, "architecture": "x64", "modernui": 1 },
		"classnamespace": "box",
		"rect": [100, 100, 700, 450],
		"openinpresentation": 1,
		"default_fontsize": 12.0,
		"default_fontname": "Arial",
		"devicewidth": 300.0,
		"description": "kbot Sidechain — genre-aware pump envelope. No audio key needed.",
		"digest": "Fake sidechain that knows kick positions per genre",
		"tags": "kbot sidechain pump ducking genre house trap",

		"boxes": [
			{ "box": { "id": "obj-audio-in", "maxclass": "newobj", "numinlets": 0, "numoutlets": 2, "outlettype": ["signal","signal"], "patching_rect": [30, 30, 80, 22], "text": "plugin~ 2" } },
			{ "box": { "id": "obj-metro", "maxclass": "newobj", "numinlets": 2, "numoutlets": 1, "outlettype": ["bang"], "patching_rect": [300, 30, 100, 22], "text": "metro 16n @active 1" } },
			{ "box": { "id": "obj-js", "maxclass": "newobj", "numinlets": 4, "numoutlets": 2, "outlettype": ["",""], "patching_rect": [300, 120, 300, 22], "text": "js kbot-sidechain.js" } },
			{ "box": { "id": "obj-genre", "maxclass": "live.dial", "numinlets": 1, "numoutlets": 2, "outlettype": ["","float"], "patching_rect": [420, 30, 60, 52], "presentation": 1, "presentation_rect": [15, 45, 60, 52], "parameter_enable": 1, "saved_attribute_attributes": { "valueof": { "parameter_longname": "SC Genre", "parameter_shortname": "Genre", "parameter_type": 0, "parameter_mmin": 0.0, "parameter_mmax": 1.0, "parameter_initial_enable": 1, "parameter_initial": [0.0] } } } },
			{ "box": { "id": "obj-depth", "maxclass": "live.dial", "numinlets": 1, "numoutlets": 2, "outlettype": ["","float"], "patching_rect": [500, 30, 60, 52], "presentation": 1, "presentation_rect": [95, 45, 60, 52], "parameter_enable": 1, "saved_attribute_attributes": { "valueof": { "parameter_longname": "SC Depth", "parameter_shortname": "Depth", "parameter_type": 0, "parameter_unitstyle": 5, "parameter_mmin": 0.0, "parameter_mmax": 1.0, "parameter_initial_enable": 1, "parameter_initial": [0.7] } } } },
			{ "box": { "id": "obj-release", "maxclass": "live.dial", "numinlets": 1, "numoutlets": 2, "outlettype": ["","float"], "patching_rect": [580, 30, 60, 52], "presentation": 1, "presentation_rect": [175, 45, 60, 52], "parameter_enable": 1, "saved_attribute_attributes": { "valueof": { "parameter_longname": "SC Release", "parameter_shortname": "Release", "parameter_type": 0, "parameter_mmin": 10.0, "parameter_mmax": 500.0, "parameter_initial_enable": 1, "parameter_initial": [200.0] } } } },

			{ "box": { "id": "obj-env", "maxclass": "newobj", "numinlets": 2, "numoutlets": 2, "outlettype": ["signal","bang"], "patching_rect": [300, 180, 60, 22], "text": "line~ 1." } },
			{ "box": { "id": "obj-duck-L", "maxclass": "newobj", "numinlets": 2, "numoutlets": 1, "outlettype": ["signal"], "patching_rect": [30, 180, 40, 22], "text": "*~" } },
			{ "box": { "id": "obj-duck-R", "maxclass": "newobj", "numinlets": 2, "numoutlets": 1, "outlettype": ["signal"], "patching_rect": [150, 180, 40, 22], "text": "*~" } },
			{ "box": { "id": "obj-out", "maxclass": "newobj", "numinlets": 2, "numoutlets": 0, "patching_rect": [30, 250, 80, 22], "text": "plugout~ 2" } },

			{ "box": { "id": "obj-title", "maxclass": "comment", "numinlets": 1, "numoutlets": 0, "text": "kbot Sidechain v1.0", "fontface": 1, "fontsize": 13, "presentation": 1, "presentation_rect": [15, 8, 200, 20] } },
			{ "box": { "id": "obj-sub", "maxclass": "comment", "numinlets": 1, "numoutlets": 0, "text": "Genre-aware pump", "fontsize": 9, "textcolor": [0.5,0.5,0.5,1], "presentation": 1, "presentation_rect": [15, 27, 150, 14] } },
			{ "box": { "id": "obj-status", "maxclass": "comment", "numinlets": 1, "numoutlets": 0, "text": "Ready", "presentation": 1, "presentation_rect": [15, 105, 200, 18] } },
			{ "box": { "id": "obj-set-status", "maxclass": "newobj", "numinlets": 1, "numoutlets": 1, "outlettype": [""], "patching_rect": [400, 180, 80, 22], "text": "prepend set" } }
		],

		"lines": [
			{ "patchline": { "source": ["obj-metro", 0], "destination": ["obj-js", 0] } },
			{ "patchline": { "source": ["obj-genre", 1], "destination": ["obj-js", 1] } },
			{ "patchline": { "source": ["obj-depth", 1], "destination": ["obj-js", 2] } },
			{ "patchline": { "source": ["obj-release", 1], "destination": ["obj-js", 3] } },

			{ "patchline": { "source": ["obj-js", 0], "destination": ["obj-env", 0], "comment": "envelope messages → line~" } },
			{ "patchline": { "source": ["obj-js", 1], "destination": ["obj-set-status", 0] } },
			{ "patchline": { "source": ["obj-set-status", 0], "destination": ["obj-status", 0] } },

			{ "patchline": { "source": ["obj-audio-in", 0], "destination": ["obj-duck-L", 0] } },
			{ "patchline": { "source": ["obj-audio-in", 1], "destination": ["obj-duck-R", 0] } },
			{ "patchline": { "source": ["obj-env", 0], "destination": ["obj-duck-L", 1] } },
			{ "patchline": { "source": ["obj-env", 0], "destination": ["obj-duck-R", 1] } },
			{ "patchline": { "source": ["obj-duck-L", 0], "destination": ["obj-out", 0] } },
			{ "patchline": { "source": ["obj-duck-R", 0], "destination": ["obj-out", 1] } }
		]
	}
}
