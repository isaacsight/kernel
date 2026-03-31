{
	"patcher": {
		"fileversion": 1,
		"appversion": { "major": 9, "minor": 0, "revision": 0, "architecture": "x64", "modernui": 1 },
		"classnamespace": "box",
		"rect": [100, 100, 700, 400],
		"openinpresentation": 1,
		"default_fontsize": 12.0,
		"default_fontname": "Arial",
		"devicewidth": 350.0,
		"description": "kbot Auto-Pilot — conducts the 20-min set. Morphs Genre dial 0→1 over time via LiveAPI.",
		"digest": "Automatic genre morphing conductor for the DJ set",
		"tags": "kbot autopilot automation conductor genre morph liveapi",

		"boxes": [
			{ "box": { "id": "obj-metro", "maxclass": "newobj", "numinlets": 2, "numoutlets": 1, "outlettype": ["bang"], "patching_rect": [30, 30, 100, 22], "text": "metro 4n @active 1" } },
			{ "box": { "id": "obj-js", "maxclass": "newobj", "numinlets": 4, "numoutlets": 2, "outlettype": ["", ""], "patching_rect": [30, 120, 300, 22], "text": "js kbot-auto-pilot.js" } },
			{ "box": { "id": "obj-dur-dial", "maxclass": "live.dial", "numinlets": 1, "numoutlets": 2, "outlettype": ["","float"], "patching_rect": [200, 30, 60, 52], "presentation": 1, "presentation_rect": [15, 45, 60, 52], "parameter_enable": 1, "saved_attribute_attributes": { "valueof": { "parameter_longname": "Duration", "parameter_shortname": "Dur min", "parameter_type": 0, "parameter_mmin": 1.0, "parameter_mmax": 60.0, "parameter_initial_enable": 1, "parameter_initial": [20.0] } } } },
			{ "box": { "id": "obj-curve-dial", "maxclass": "live.dial", "numinlets": 1, "numoutlets": 2, "outlettype": ["","float"], "patching_rect": [280, 30, 60, 52], "presentation": 1, "presentation_rect": [95, 45, 60, 52], "parameter_enable": 1, "saved_attribute_attributes": { "valueof": { "parameter_longname": "Curve", "parameter_shortname": "Curve", "parameter_type": 0, "parameter_mmin": -1.0, "parameter_mmax": 1.0, "parameter_initial_enable": 1, "parameter_initial": [0.0] } } } },
			{ "box": { "id": "obj-active", "maxclass": "live.toggle", "numinlets": 1, "numoutlets": 1, "outlettype": [""], "patching_rect": [360, 40, 24, 24], "presentation": 1, "presentation_rect": [175, 55, 24, 24], "parameter_enable": 1, "saved_attribute_attributes": { "valueof": { "parameter_longname": "Pilot Active", "parameter_shortname": "On", "parameter_type": 2, "parameter_mmin": 0.0, "parameter_mmax": 1.0, "parameter_initial_enable": 1, "parameter_initial": [1] } } } },

			{ "box": { "id": "obj-genre-out", "maxclass": "newobj", "numinlets": 1, "numoutlets": 0, "patching_rect": [30, 170, 120, 22], "text": "send genre_position" } },

			{ "box": { "id": "obj-title", "maxclass": "comment", "numinlets": 1, "numoutlets": 0, "text": "kbot Auto-Pilot v1.0", "fontface": 1, "fontsize": 13, "presentation": 1, "presentation_rect": [15, 8, 200, 20] } },
			{ "box": { "id": "obj-sub", "maxclass": "comment", "numinlets": 1, "numoutlets": 0, "text": "House → Tech → Garage → Trap", "fontsize": 9, "textcolor": [0.5,0.5,0.5,1], "presentation": 1, "presentation_rect": [15, 27, 200, 14] } },
			{ "box": { "id": "obj-status", "maxclass": "comment", "numinlets": 1, "numoutlets": 0, "text": "Auto-pilot ON", "presentation": 1, "presentation_rect": [15, 105, 250, 18] } },
			{ "box": { "id": "obj-set-status", "maxclass": "newobj", "numinlets": 1, "numoutlets": 1, "outlettype": [""], "patching_rect": [200, 120, 80, 22], "text": "prepend set" } },
			{ "box": { "id": "obj-label-on", "maxclass": "comment", "numinlets": 1, "numoutlets": 0, "text": "On", "fontsize": 10, "presentation": 1, "presentation_rect": [175, 82, 30, 14] } }
		],

		"lines": [
			{ "patchline": { "source": ["obj-metro", 0], "destination": ["obj-js", 0] } },
			{ "patchline": { "source": ["obj-dur-dial", 1], "destination": ["obj-js", 1] } },
			{ "patchline": { "source": ["obj-curve-dial", 1], "destination": ["obj-js", 2] } },
			{ "patchline": { "source": ["obj-active", 0], "destination": ["obj-js", 3] } },
			{ "patchline": { "source": ["obj-js", 0], "destination": ["obj-genre-out", 0], "comment": "genre position broadcast" } },
			{ "patchline": { "source": ["obj-js", 1], "destination": ["obj-set-status", 0] } },
			{ "patchline": { "source": ["obj-set-status", 0], "destination": ["obj-status", 0] } }
		]
	}
}
