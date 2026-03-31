{
	"patcher": {
		"fileversion": 1,
		"appversion": { "major": 9, "minor": 0, "revision": 0, "architecture": "x64", "modernui": 1 },
		"classnamespace": "box",
		"rect": [100, 100, 900, 600],
		"openinpresentation": 1,
		"default_fontsize": 12.0,
		"default_fontname": "Arial",
		"devicewidth": 350.0,
		"description": "kbot Bass Synth — genre-morphing bass: House sub, Tech saw, Garage reese, Trap 808",
		"digest": "Pure M4L bass synthesis with genre-aware timbre morphing",
		"tags": "kbot bass synth 808 sub reese genre",

		"boxes": [
			{ "box": { "id": "obj-midiin", "maxclass": "newobj", "numinlets": 1, "numoutlets": 1, "outlettype": ["int"], "patching_rect": [30, 30, 60, 22], "text": "midiin" } },
			{ "box": { "id": "obj-midiparse", "maxclass": "newobj", "numinlets": 1, "numoutlets": 8, "outlettype": ["","","","","","","",""], "patching_rect": [30, 60, 120, 22], "text": "midiparse" } },
			{ "box": { "id": "obj-js", "maxclass": "newobj", "numinlets": 3, "numoutlets": 10, "outlettype": ["","","","","","","","","",""], "patching_rect": [30, 120, 400, 22], "text": "js kbot-bass-synth.js" } },
			{ "box": { "id": "obj-genre", "maxclass": "live.dial", "numinlets": 1, "numoutlets": 2, "outlettype": ["","float"], "patching_rect": [450, 30, 60, 52], "presentation": 1, "presentation_rect": [15, 45, 60, 52], "parameter_enable": 1, "saved_attribute_attributes": { "valueof": { "parameter_longname": "Genre", "parameter_shortname": "Genre", "parameter_type": 0, "parameter_mmin": 0.0, "parameter_mmax": 1.0, "parameter_initial_enable": 1, "parameter_initial": [0.0] } } } },
			{ "box": { "id": "obj-drive-dial", "maxclass": "live.dial", "numinlets": 1, "numoutlets": 2, "outlettype": ["","float"], "patching_rect": [530, 30, 60, 52], "presentation": 1, "presentation_rect": [95, 45, 60, 52], "parameter_enable": 1, "saved_attribute_attributes": { "valueof": { "parameter_longname": "Drive", "parameter_shortname": "Drive", "parameter_type": 0, "parameter_unitstyle": 5, "parameter_mmin": 0.0, "parameter_mmax": 1.0, "parameter_initial_enable": 1, "parameter_initial": [0.0] } } } },
			{ "box": { "id": "obj-sub-dial", "maxclass": "live.dial", "numinlets": 1, "numoutlets": 2, "outlettype": ["","float"], "patching_rect": [610, 30, 60, 52], "presentation": 1, "presentation_rect": [175, 45, 60, 52], "parameter_enable": 1, "saved_attribute_attributes": { "valueof": { "parameter_longname": "Sub", "parameter_shortname": "Sub", "parameter_type": 0, "parameter_unitstyle": 5, "parameter_mmin": 0.0, "parameter_mmax": 1.0, "parameter_initial_enable": 1, "parameter_initial": [0.7] } } } },

			{ "box": { "id": "obj-freq-sig", "maxclass": "newobj", "numinlets": 2, "numoutlets": 1, "outlettype": ["signal"], "patching_rect": [30, 180, 50, 22], "text": "sig~" } },
			{ "box": { "id": "obj-on-msg", "maxclass": "message", "numinlets": 2, "numoutlets": 1, "outlettype": [""], "patching_rect": [120, 170, 90, 22], "text": "1. 2, 0.8 $1" } },
			{ "box": { "id": "obj-off-msg", "maxclass": "message", "numinlets": 2, "numoutlets": 1, "outlettype": [""], "patching_rect": [230, 170, 100, 22], "text": "0. 100" } },
			{ "box": { "id": "obj-aenv", "maxclass": "newobj", "numinlets": 2, "numoutlets": 2, "outlettype": ["signal","bang"], "patching_rect": [120, 210, 60, 22], "text": "line~" } },
			{ "box": { "id": "obj-vel-sig", "maxclass": "newobj", "numinlets": 2, "numoutlets": 1, "outlettype": ["signal"], "patching_rect": [350, 180, 50, 22], "text": "sig~" } },

			{ "box": { "id": "obj-saw1", "maxclass": "newobj", "numinlets": 2, "numoutlets": 1, "outlettype": ["signal"], "patching_rect": [30, 250, 60, 22], "text": "saw~" } },
			{ "box": { "id": "obj-saw2-detune", "maxclass": "newobj", "numinlets": 2, "numoutlets": 1, "outlettype": ["signal"], "patching_rect": [110, 220, 70, 22], "text": "*~ 1.005" } },
			{ "box": { "id": "obj-saw2", "maxclass": "newobj", "numinlets": 2, "numoutlets": 1, "outlettype": ["signal"], "patching_rect": [110, 250, 60, 22], "text": "saw~" } },
			{ "box": { "id": "obj-sine", "maxclass": "newobj", "numinlets": 2, "numoutlets": 1, "outlettype": ["signal"], "patching_rect": [190, 250, 60, 22], "text": "cycle~" } },
			{ "box": { "id": "obj-osc-mix1", "maxclass": "newobj", "numinlets": 2, "numoutlets": 1, "outlettype": ["signal"], "patching_rect": [30, 290, 40, 22], "text": "+~" } },
			{ "box": { "id": "obj-osc-mix2", "maxclass": "newobj", "numinlets": 2, "numoutlets": 1, "outlettype": ["signal"], "patching_rect": [30, 320, 40, 22], "text": "+~" } },
			{ "box": { "id": "obj-osc-gain", "maxclass": "newobj", "numinlets": 2, "numoutlets": 1, "outlettype": ["signal"], "patching_rect": [30, 350, 60, 22], "text": "*~ 0.33" } },

			{ "box": { "id": "obj-cutoff-sig", "maxclass": "newobj", "numinlets": 2, "numoutlets": 1, "outlettype": ["signal"], "patching_rect": [280, 320, 50, 22], "text": "sig~" } },
			{ "box": { "id": "obj-filter", "maxclass": "newobj", "numinlets": 3, "numoutlets": 4, "outlettype": ["signal","signal","signal","signal"], "patching_rect": [30, 390, 120, 22], "text": "svf~ 400 0.5" } },

			{ "box": { "id": "obj-amp-mul", "maxclass": "newobj", "numinlets": 2, "numoutlets": 1, "outlettype": ["signal"], "patching_rect": [30, 430, 40, 22], "text": "*~" } },
			{ "box": { "id": "obj-vel-mul", "maxclass": "newobj", "numinlets": 2, "numoutlets": 1, "outlettype": ["signal"], "patching_rect": [30, 460, 40, 22], "text": "*~" } },
			{ "box": { "id": "obj-clip", "maxclass": "newobj", "numinlets": 3, "numoutlets": 1, "outlettype": ["signal"], "patching_rect": [30, 490, 100, 22], "text": "clip~ -0.8 0.8" } },
			{ "box": { "id": "obj-out", "maxclass": "newobj", "numinlets": 2, "numoutlets": 0, "patching_rect": [30, 530, 80, 22], "text": "plugout~ 2" } },

			{ "box": { "id": "obj-title", "maxclass": "comment", "numinlets": 1, "numoutlets": 0, "text": "kbot Bass Synth v1.0", "fontface": 1, "fontsize": 13, "presentation": 1, "presentation_rect": [15, 8, 200, 20] } },
			{ "box": { "id": "obj-sub-label", "maxclass": "comment", "numinlets": 1, "numoutlets": 0, "text": "Sub | Saw | Reese | 808", "fontsize": 9, "textcolor": [0.5,0.5,0.5,1], "presentation": 1, "presentation_rect": [15, 27, 200, 14] } },
			{ "box": { "id": "obj-status", "maxclass": "comment", "numinlets": 1, "numoutlets": 0, "text": "Bass: Sub", "presentation": 1, "presentation_rect": [15, 105, 200, 18] } },
			{ "box": { "id": "obj-set-status", "maxclass": "newobj", "numinlets": 1, "numoutlets": 1, "outlettype": [""], "patching_rect": [450, 120, 80, 22], "text": "prepend set" } }
		],

		"lines": [
			{ "patchline": { "source": ["obj-midiin", 0], "destination": ["obj-midiparse", 0] } },
			{ "patchline": { "source": ["obj-midiparse", 0], "destination": ["obj-js", 0] } },
			{ "patchline": { "source": ["obj-midiparse", 1], "destination": ["obj-js", 1] } },
			{ "patchline": { "source": ["obj-genre", 1], "destination": ["obj-js", 2] } },

			{ "patchline": { "source": ["obj-js", 0], "destination": ["obj-freq-sig", 0], "comment": "freq Hz" } },
			{ "patchline": { "source": ["obj-js", 1], "destination": ["obj-on-msg", 0], "comment": "note on → amp env" } },
			{ "patchline": { "source": ["obj-js", 2], "destination": ["obj-off-msg", 0], "comment": "note off → release" } },
			{ "patchline": { "source": ["obj-js", 3], "destination": ["obj-vel-sig", 0], "comment": "velocity" } },
			{ "patchline": { "source": ["obj-js", 4], "destination": ["obj-cutoff-sig", 0], "comment": "filter cutoff" } },
			{ "patchline": { "source": ["obj-js", 8], "destination": ["obj-on-msg", 1], "comment": "decay ms → env shape" } },
			{ "patchline": { "source": ["obj-js", 9], "destination": ["obj-set-status", 0] } },
			{ "patchline": { "source": ["obj-set-status", 0], "destination": ["obj-status", 0] } },

			{ "patchline": { "source": ["obj-on-msg", 0], "destination": ["obj-aenv", 0] } },
			{ "patchline": { "source": ["obj-off-msg", 0], "destination": ["obj-aenv", 0] } },

			{ "patchline": { "source": ["obj-freq-sig", 0], "destination": ["obj-saw1", 0], "comment": "freq → saw1" } },
			{ "patchline": { "source": ["obj-freq-sig", 0], "destination": ["obj-saw2-detune", 0], "comment": "freq → detune" } },
			{ "patchline": { "source": ["obj-freq-sig", 0], "destination": ["obj-sine", 0], "comment": "freq → sine" } },
			{ "patchline": { "source": ["obj-saw2-detune", 0], "destination": ["obj-saw2", 0], "comment": "detuned freq → saw2" } },
			{ "patchline": { "source": ["obj-saw1", 0], "destination": ["obj-osc-mix1", 0] } },
			{ "patchline": { "source": ["obj-saw2", 0], "destination": ["obj-osc-mix1", 1] } },
			{ "patchline": { "source": ["obj-osc-mix1", 0], "destination": ["obj-osc-mix2", 0] } },
			{ "patchline": { "source": ["obj-sine", 0], "destination": ["obj-osc-mix2", 1] } },
			{ "patchline": { "source": ["obj-osc-mix2", 0], "destination": ["obj-osc-gain", 0] } },

			{ "patchline": { "source": ["obj-osc-gain", 0], "destination": ["obj-filter", 0] } },
			{ "patchline": { "source": ["obj-cutoff-sig", 0], "destination": ["obj-filter", 1], "comment": "cutoff control" } },

			{ "patchline": { "source": ["obj-filter", 0], "destination": ["obj-amp-mul", 0], "comment": "LP out" } },
			{ "patchline": { "source": ["obj-aenv", 0], "destination": ["obj-amp-mul", 1] } },
			{ "patchline": { "source": ["obj-amp-mul", 0], "destination": ["obj-vel-mul", 0] } },
			{ "patchline": { "source": ["obj-vel-sig", 0], "destination": ["obj-vel-mul", 1] } },
			{ "patchline": { "source": ["obj-vel-mul", 0], "destination": ["obj-clip", 0] } },
			{ "patchline": { "source": ["obj-clip", 0], "destination": ["obj-out", 0] } },
			{ "patchline": { "source": ["obj-clip", 0], "destination": ["obj-out", 1] } }
		]
	}
}
