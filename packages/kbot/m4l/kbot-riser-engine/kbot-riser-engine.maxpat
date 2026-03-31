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
		"description": "kbot Riser Engine — synthesized transition FX: noise sweeps, builds, impacts",
		"digest": "Auto-triggers risers at genre transitions. All synthesized.",
		"tags": "kbot riser transition sweep build impact noise fx",

		"boxes": [
			{ "box": { "id": "obj-metro", "maxclass": "newobj", "numinlets": 2, "numoutlets": 1, "outlettype": ["bang"], "patching_rect": [30, 30, 100, 22], "text": "metro 4n @active 1" } },
			{ "box": { "id": "obj-js", "maxclass": "newobj", "numinlets": 4, "numoutlets": 5, "outlettype": ["","","","",""], "patching_rect": [30, 120, 350, 22], "text": "js kbot-riser-engine.js" } },
			{ "box": { "id": "obj-type", "maxclass": "live.dial", "numinlets": 1, "numoutlets": 2, "outlettype": ["","float"], "patching_rect": [200, 30, 60, 52], "presentation": 1, "presentation_rect": [15, 45, 60, 52], "parameter_enable": 1, "saved_attribute_attributes": { "valueof": { "parameter_longname": "Riser Type", "parameter_shortname": "Type", "parameter_type": 1, "parameter_mmin": 0.0, "parameter_mmax": 4.0, "parameter_initial_enable": 1, "parameter_initial": [0] } } } },
			{ "box": { "id": "obj-intensity", "maxclass": "live.dial", "numinlets": 1, "numoutlets": 2, "outlettype": ["","float"], "patching_rect": [280, 30, 60, 52], "presentation": 1, "presentation_rect": [95, 45, 60, 52], "parameter_enable": 1, "saved_attribute_attributes": { "valueof": { "parameter_longname": "Intensity", "parameter_shortname": "Intens", "parameter_type": 0, "parameter_unitstyle": 5, "parameter_mmin": 0.0, "parameter_mmax": 1.0, "parameter_initial_enable": 1, "parameter_initial": [0.7] } } } },
			{ "box": { "id": "obj-trigger", "maxclass": "live.button", "numinlets": 1, "numoutlets": 1, "outlettype": [""], "patching_rect": [360, 40, 30, 30], "presentation": 1, "presentation_rect": [175, 50, 35, 35], "parameter_enable": 1, "saved_attribute_attributes": { "valueof": { "parameter_longname": "Trigger Riser", "parameter_shortname": "Trig", "parameter_type": 2, "parameter_mmin": 0.0, "parameter_mmax": 1.0 } } } },
			{ "box": { "id": "obj-trig-msg", "maxclass": "message", "numinlets": 2, "numoutlets": 1, "outlettype": [""], "patching_rect": [360, 80, 55, 22], "text": "trigger" } },

			{ "box": { "id": "obj-noise-cutoff", "maxclass": "newobj", "numinlets": 2, "numoutlets": 1, "outlettype": ["signal"], "patching_rect": [30, 200, 50, 22], "text": "sig~" } },
			{ "box": { "id": "obj-noise-amp", "maxclass": "newobj", "numinlets": 2, "numoutlets": 1, "outlettype": ["signal"], "patching_rect": [120, 200, 50, 22], "text": "sig~" } },
			{ "box": { "id": "obj-noise", "maxclass": "newobj", "numinlets": 1, "numoutlets": 1, "outlettype": ["signal"], "patching_rect": [30, 240, 55, 22], "text": "noise~" } },
			{ "box": { "id": "obj-hp", "maxclass": "newobj", "numinlets": 3, "numoutlets": 4, "outlettype": ["signal","signal","signal","signal"], "patching_rect": [30, 270, 100, 22], "text": "svf~ 200 0.7" } },
			{ "box": { "id": "obj-noise-mul", "maxclass": "newobj", "numinlets": 2, "numoutlets": 1, "outlettype": ["signal"], "patching_rect": [30, 310, 40, 22], "text": "*~" } },

			{ "box": { "id": "obj-sub-freq", "maxclass": "newobj", "numinlets": 2, "numoutlets": 1, "outlettype": ["signal"], "patching_rect": [250, 200, 50, 22], "text": "sig~" } },
			{ "box": { "id": "obj-sub-amp", "maxclass": "newobj", "numinlets": 2, "numoutlets": 1, "outlettype": ["signal"], "patching_rect": [340, 200, 50, 22], "text": "sig~" } },
			{ "box": { "id": "obj-sub-osc", "maxclass": "newobj", "numinlets": 2, "numoutlets": 1, "outlettype": ["signal"], "patching_rect": [250, 240, 60, 22], "text": "cycle~" } },
			{ "box": { "id": "obj-sub-mul", "maxclass": "newobj", "numinlets": 2, "numoutlets": 1, "outlettype": ["signal"], "patching_rect": [250, 270, 40, 22], "text": "*~" } },

			{ "box": { "id": "obj-mix", "maxclass": "newobj", "numinlets": 2, "numoutlets": 1, "outlettype": ["signal"], "patching_rect": [30, 350, 40, 22], "text": "+~" } },
			{ "box": { "id": "obj-master", "maxclass": "newobj", "numinlets": 2, "numoutlets": 1, "outlettype": ["signal"], "patching_rect": [30, 380, 60, 22], "text": "*~ 0.6" } },
			{ "box": { "id": "obj-out", "maxclass": "newobj", "numinlets": 2, "numoutlets": 0, "patching_rect": [30, 410, 80, 22], "text": "plugout~ 2" } },

			{ "box": { "id": "obj-title", "maxclass": "comment", "numinlets": 1, "numoutlets": 0, "text": "kbot Riser Engine v1.0", "fontface": 1, "fontsize": 13, "presentation": 1, "presentation_rect": [15, 8, 200, 20] } },
			{ "box": { "id": "obj-sub-label", "maxclass": "comment", "numinlets": 1, "numoutlets": 0, "text": "Sweep | Build | Impact | Swell | Wash", "fontsize": 9, "textcolor": [0.5,0.5,0.5,1], "presentation": 1, "presentation_rect": [15, 27, 250, 14] } },
			{ "box": { "id": "obj-status", "maxclass": "comment", "numinlets": 1, "numoutlets": 0, "text": "Ready", "presentation": 1, "presentation_rect": [15, 105, 200, 18] } },
			{ "box": { "id": "obj-set-status", "maxclass": "newobj", "numinlets": 1, "numoutlets": 1, "outlettype": [""], "patching_rect": [200, 160, 80, 22], "text": "prepend set" } },
			{ "box": { "id": "obj-label-trig", "maxclass": "comment", "numinlets": 1, "numoutlets": 0, "text": "Trig", "fontsize": 10, "presentation": 1, "presentation_rect": [178, 88, 35, 14] } }
		],

		"lines": [
			{ "patchline": { "source": ["obj-metro", 0], "destination": ["obj-js", 0] } },
			{ "patchline": { "source": ["obj-type", 1], "destination": ["obj-js", 1] } },
			{ "patchline": { "source": ["obj-intensity", 1], "destination": ["obj-js", 2] } },
			{ "patchline": { "source": ["obj-trigger", 0], "destination": ["obj-trig-msg", 0] } },
			{ "patchline": { "source": ["obj-trig-msg", 0], "destination": ["obj-js", 3] } },

			{ "patchline": { "source": ["obj-js", 0], "destination": ["obj-noise-cutoff", 0], "comment": "HP cutoff" } },
			{ "patchline": { "source": ["obj-js", 1], "destination": ["obj-noise-amp", 0], "comment": "noise amp" } },
			{ "patchline": { "source": ["obj-js", 2], "destination": ["obj-sub-freq", 0], "comment": "sub freq" } },
			{ "patchline": { "source": ["obj-js", 3], "destination": ["obj-sub-amp", 0], "comment": "sub amp" } },
			{ "patchline": { "source": ["obj-js", 4], "destination": ["obj-set-status", 0] } },
			{ "patchline": { "source": ["obj-set-status", 0], "destination": ["obj-status", 0] } },

			{ "patchline": { "source": ["obj-noise", 0], "destination": ["obj-hp", 0] } },
			{ "patchline": { "source": ["obj-noise-cutoff", 0], "destination": ["obj-hp", 1], "comment": "sweep cutoff" } },
			{ "patchline": { "source": ["obj-hp", 1], "destination": ["obj-noise-mul", 0], "comment": "HP output" } },
			{ "patchline": { "source": ["obj-noise-amp", 0], "destination": ["obj-noise-mul", 1] } },

			{ "patchline": { "source": ["obj-sub-freq", 0], "destination": ["obj-sub-osc", 0] } },
			{ "patchline": { "source": ["obj-sub-osc", 0], "destination": ["obj-sub-mul", 0] } },
			{ "patchline": { "source": ["obj-sub-amp", 0], "destination": ["obj-sub-mul", 1] } },

			{ "patchline": { "source": ["obj-noise-mul", 0], "destination": ["obj-mix", 0] } },
			{ "patchline": { "source": ["obj-sub-mul", 0], "destination": ["obj-mix", 1] } },
			{ "patchline": { "source": ["obj-mix", 0], "destination": ["obj-master", 0] } },
			{ "patchline": { "source": ["obj-master", 0], "destination": ["obj-out", 0] } },
			{ "patchline": { "source": ["obj-master", 0], "destination": ["obj-out", 1] } }
		]
	}
}
