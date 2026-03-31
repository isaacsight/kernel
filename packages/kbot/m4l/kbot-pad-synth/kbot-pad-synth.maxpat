{
	"patcher": {
		"fileversion": 1,
		"appversion": { "major": 9, "minor": 0, "revision": 0, "architecture": "x64", "modernui": 1 },
		"classnamespace": "box",
		"rect": [100, 100, 800, 550],
		"openinpresentation": 1,
		"default_fontsize": 12.0,
		"default_fontname": "Arial",
		"devicewidth": 300.0,
		"description": "kbot Pad Synth — genre-morphing pads: warm→stab→lush→dark",
		"digest": "Detuned saw pad with genre-controlled filter + chorus + reverb",
		"tags": "kbot pad synth chords genre warm lush dark",

		"boxes": [
			{ "box": { "id": "obj-midiin", "maxclass": "newobj", "numinlets": 1, "numoutlets": 1, "outlettype": ["int"], "patching_rect": [30, 30, 60, 22], "text": "midiin" } },
			{ "box": { "id": "obj-midiparse", "maxclass": "newobj", "numinlets": 1, "numoutlets": 8, "outlettype": ["","","","","","","",""], "patching_rect": [30, 60, 120, 22], "text": "midiparse" } },
			{ "box": { "id": "obj-js", "maxclass": "newobj", "numinlets": 3, "numoutlets": 9, "outlettype": ["","","","","","","","",""], "patching_rect": [30, 120, 350, 22], "text": "js kbot-pad-synth.js" } },
			{ "box": { "id": "obj-genre", "maxclass": "live.dial", "numinlets": 1, "numoutlets": 2, "outlettype": ["","float"], "patching_rect": [400, 30, 60, 52], "presentation": 1, "presentation_rect": [15, 45, 60, 52], "parameter_enable": 1, "saved_attribute_attributes": { "valueof": { "parameter_longname": "Genre", "parameter_shortname": "Genre", "parameter_type": 0, "parameter_mmin": 0.0, "parameter_mmax": 1.0, "parameter_initial_enable": 1, "parameter_initial": [0.0] } } } },
			{ "box": { "id": "obj-space-dial", "maxclass": "live.dial", "numinlets": 1, "numoutlets": 2, "outlettype": ["","float"], "patching_rect": [480, 30, 60, 52], "presentation": 1, "presentation_rect": [95, 45, 60, 52], "parameter_enable": 1, "saved_attribute_attributes": { "valueof": { "parameter_longname": "Space", "parameter_shortname": "Space", "parameter_type": 0, "parameter_unitstyle": 5, "parameter_mmin": 0.0, "parameter_mmax": 1.0, "parameter_initial_enable": 1, "parameter_initial": [0.5] } } } },

			{ "box": { "id": "obj-freq-sig", "maxclass": "newobj", "numinlets": 2, "numoutlets": 1, "outlettype": ["signal"], "patching_rect": [30, 180, 50, 22], "text": "sig~" } },
			{ "box": { "id": "obj-on-msg", "maxclass": "message", "numinlets": 2, "numoutlets": 1, "outlettype": [""], "patching_rect": [120, 170, 120, 22], "text": "0.7 50, 0.65 500" } },
			{ "box": { "id": "obj-off-msg", "maxclass": "message", "numinlets": 2, "numoutlets": 1, "outlettype": [""], "patching_rect": [260, 170, 80, 22], "text": "0. 800" } },
			{ "box": { "id": "obj-aenv", "maxclass": "newobj", "numinlets": 2, "numoutlets": 2, "outlettype": ["signal","bang"], "patching_rect": [120, 210, 60, 22], "text": "line~" } },

			{ "box": { "id": "obj-saw1", "maxclass": "newobj", "numinlets": 2, "numoutlets": 1, "outlettype": ["signal"], "patching_rect": [30, 250, 60, 22], "text": "saw~" } },
			{ "box": { "id": "obj-detune-up", "maxclass": "newobj", "numinlets": 2, "numoutlets": 1, "outlettype": ["signal"], "patching_rect": [110, 220, 75, 22], "text": "*~ 1.003" } },
			{ "box": { "id": "obj-saw2", "maxclass": "newobj", "numinlets": 2, "numoutlets": 1, "outlettype": ["signal"], "patching_rect": [110, 250, 60, 22], "text": "saw~" } },
			{ "box": { "id": "obj-detune-dn", "maxclass": "newobj", "numinlets": 2, "numoutlets": 1, "outlettype": ["signal"], "patching_rect": [190, 220, 75, 22], "text": "*~ 0.997" } },
			{ "box": { "id": "obj-saw3", "maxclass": "newobj", "numinlets": 2, "numoutlets": 1, "outlettype": ["signal"], "patching_rect": [190, 250, 60, 22], "text": "saw~" } },
			{ "box": { "id": "obj-osc-mix1", "maxclass": "newobj", "numinlets": 2, "numoutlets": 1, "outlettype": ["signal"], "patching_rect": [30, 290, 40, 22], "text": "+~" } },
			{ "box": { "id": "obj-osc-mix2", "maxclass": "newobj", "numinlets": 2, "numoutlets": 1, "outlettype": ["signal"], "patching_rect": [30, 320, 40, 22], "text": "+~" } },
			{ "box": { "id": "obj-osc-gain", "maxclass": "newobj", "numinlets": 2, "numoutlets": 1, "outlettype": ["signal"], "patching_rect": [30, 350, 60, 22], "text": "*~ 0.25" } },

			{ "box": { "id": "obj-cutoff-sig", "maxclass": "newobj", "numinlets": 2, "numoutlets": 1, "outlettype": ["signal"], "patching_rect": [280, 350, 50, 22], "text": "sig~" } },
			{ "box": { "id": "obj-filter", "maxclass": "newobj", "numinlets": 3, "numoutlets": 4, "outlettype": ["signal","signal","signal","signal"], "patching_rect": [30, 380, 120, 22], "text": "svf~ 2000 0.5" } },

			{ "box": { "id": "obj-amp-mul", "maxclass": "newobj", "numinlets": 2, "numoutlets": 1, "outlettype": ["signal"], "patching_rect": [30, 420, 40, 22], "text": "*~" } },

			{ "box": { "id": "obj-delay-chorus", "maxclass": "newobj", "numinlets": 1, "numoutlets": 1, "outlettype": ["signal"], "patching_rect": [130, 420, 90, 22], "text": "tapin~ 50" } },
			{ "box": { "id": "obj-chorus-tap", "maxclass": "newobj", "numinlets": 1, "numoutlets": 1, "outlettype": ["signal"], "patching_rect": [130, 450, 90, 22], "text": "tapout~ 15" } },
			{ "box": { "id": "obj-chorus-mix", "maxclass": "newobj", "numinlets": 2, "numoutlets": 1, "outlettype": ["signal"], "patching_rect": [30, 460, 40, 22], "text": "+~" } },
			{ "box": { "id": "obj-chorus-gain", "maxclass": "newobj", "numinlets": 2, "numoutlets": 1, "outlettype": ["signal"], "patching_rect": [130, 480, 60, 22], "text": "*~ 0.3" } },

			{ "box": { "id": "obj-out", "maxclass": "newobj", "numinlets": 2, "numoutlets": 0, "patching_rect": [30, 510, 80, 22], "text": "plugout~ 2" } },

			{ "box": { "id": "obj-title", "maxclass": "comment", "numinlets": 1, "numoutlets": 0, "text": "kbot Pad Synth v1.0", "fontface": 1, "fontsize": 13, "presentation": 1, "presentation_rect": [15, 8, 200, 20] } },
			{ "box": { "id": "obj-sub", "maxclass": "comment", "numinlets": 1, "numoutlets": 0, "text": "Warm | Stab | Lush | Dark", "fontsize": 9, "textcolor": [0.5,0.5,0.5,1], "presentation": 1, "presentation_rect": [15, 27, 200, 14] } },
			{ "box": { "id": "obj-status", "maxclass": "comment", "numinlets": 1, "numoutlets": 0, "text": "Pads: Warm", "presentation": 1, "presentation_rect": [15, 105, 200, 18] } },
			{ "box": { "id": "obj-set-status", "maxclass": "newobj", "numinlets": 1, "numoutlets": 1, "outlettype": [""], "patching_rect": [400, 120, 80, 22], "text": "prepend set" } }
		],

		"lines": [
			{ "patchline": { "source": ["obj-midiin", 0], "destination": ["obj-midiparse", 0] } },
			{ "patchline": { "source": ["obj-midiparse", 0], "destination": ["obj-js", 0] } },
			{ "patchline": { "source": ["obj-midiparse", 1], "destination": ["obj-js", 1] } },
			{ "patchline": { "source": ["obj-genre", 1], "destination": ["obj-js", 2] } },

			{ "patchline": { "source": ["obj-js", 0], "destination": ["obj-freq-sig", 0] } },
			{ "patchline": { "source": ["obj-js", 1], "destination": ["obj-on-msg", 0] } },
			{ "patchline": { "source": ["obj-js", 2], "destination": ["obj-off-msg", 0] } },
			{ "patchline": { "source": ["obj-js", 4], "destination": ["obj-cutoff-sig", 0] } },
			{ "patchline": { "source": ["obj-js", 8], "destination": ["obj-set-status", 0] } },
			{ "patchline": { "source": ["obj-set-status", 0], "destination": ["obj-status", 0] } },

			{ "patchline": { "source": ["obj-on-msg", 0], "destination": ["obj-aenv", 0] } },
			{ "patchline": { "source": ["obj-off-msg", 0], "destination": ["obj-aenv", 0] } },

			{ "patchline": { "source": ["obj-freq-sig", 0], "destination": ["obj-saw1", 0] } },
			{ "patchline": { "source": ["obj-freq-sig", 0], "destination": ["obj-detune-up", 0] } },
			{ "patchline": { "source": ["obj-freq-sig", 0], "destination": ["obj-detune-dn", 0] } },
			{ "patchline": { "source": ["obj-detune-up", 0], "destination": ["obj-saw2", 0] } },
			{ "patchline": { "source": ["obj-detune-dn", 0], "destination": ["obj-saw3", 0] } },
			{ "patchline": { "source": ["obj-saw1", 0], "destination": ["obj-osc-mix1", 0] } },
			{ "patchline": { "source": ["obj-saw2", 0], "destination": ["obj-osc-mix1", 1] } },
			{ "patchline": { "source": ["obj-osc-mix1", 0], "destination": ["obj-osc-mix2", 0] } },
			{ "patchline": { "source": ["obj-saw3", 0], "destination": ["obj-osc-mix2", 1] } },
			{ "patchline": { "source": ["obj-osc-mix2", 0], "destination": ["obj-osc-gain", 0] } },

			{ "patchline": { "source": ["obj-osc-gain", 0], "destination": ["obj-filter", 0] } },
			{ "patchline": { "source": ["obj-cutoff-sig", 0], "destination": ["obj-filter", 1] } },

			{ "patchline": { "source": ["obj-filter", 0], "destination": ["obj-amp-mul", 0] } },
			{ "patchline": { "source": ["obj-aenv", 0], "destination": ["obj-amp-mul", 1] } },

			{ "patchline": { "source": ["obj-amp-mul", 0], "destination": ["obj-delay-chorus", 0] } },
			{ "patchline": { "source": ["obj-delay-chorus", 0], "destination": ["obj-chorus-tap", 0] } },
			{ "patchline": { "source": ["obj-chorus-tap", 0], "destination": ["obj-chorus-gain", 0] } },
			{ "patchline": { "source": ["obj-chorus-gain", 0], "destination": ["obj-chorus-mix", 1] } },
			{ "patchline": { "source": ["obj-amp-mul", 0], "destination": ["obj-chorus-mix", 0] } },

			{ "patchline": { "source": ["obj-chorus-mix", 0], "destination": ["obj-out", 0] } },
			{ "patchline": { "source": ["obj-chorus-mix", 0], "destination": ["obj-out", 1] } }
		]
	}
}
