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
		"rect": [100, 100, 800, 500],
		"bglocked": 0,
		"openinpresentation": 1,
		"default_fontsize": 12.0,
		"default_fontname": "Arial",
		"gridonopen": 1,
		"gridsize": [15.0, 15.0],
		"gridsnaponopen": 1,
		"objectsnaponopen": 1,
		"statusbarvisible": 2,
		"toolbarvisible": 0,
		"devicewidth": 350.0,
		"description": "kbot Genre Morph — drum pattern morphing: House > Tech House > UK Garage > Trap",
		"digest": "Turn one dial to morph between 4 genres in real-time",
		"tags": "kbot genre morph drums house techhouse garage trap dj",
		"style": "",

		"boxes": [
			{
				"box": {
					"id": "obj-metro",
					"maxclass": "newobj",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": ["bang"],
					"patching_rect": [30.0, 30.0, 140.0, 22.0],
					"text": "metro 16n @active 1"
				}
			},
			{
				"box": {
					"id": "obj-js",
					"maxclass": "newobj",
					"numinlets": 4,
					"numoutlets": 2,
					"outlettype": ["", ""],
					"patching_rect": [30.0, 180.0, 300.0, 22.0],
					"text": "js kbot-genre-morph.js"
				}
			},
			{
				"box": {
					"id": "obj-genre-dial",
					"maxclass": "live.dial",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": ["", "float"],
					"patching_rect": [200.0, 30.0, 60.0, 52.0],
					"presentation": 1,
					"presentation_rect": [15.0, 45.0, 60.0, 52.0],
					"parameter_enable": 1,
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Genre",
							"parameter_shortname": "Genre",
							"parameter_type": 0,
							"parameter_unitstyle": 1,
							"parameter_mmin": 0.0,
							"parameter_mmax": 1.0,
							"parameter_initial_enable": 1,
							"parameter_initial": [0.0]
						}
					}
				}
			},
			{
				"box": {
					"id": "obj-var-dial",
					"maxclass": "live.dial",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": ["", "float"],
					"patching_rect": [300.0, 30.0, 60.0, 52.0],
					"presentation": 1,
					"presentation_rect": [95.0, 45.0, 60.0, 52.0],
					"parameter_enable": 1,
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Variation",
							"parameter_shortname": "Var",
							"parameter_type": 1,
							"parameter_mmin": 0.0,
							"parameter_mmax": 2.0,
							"parameter_initial_enable": 1,
							"parameter_initial": [0]
						}
					}
				}
			},
			{
				"box": {
					"id": "obj-human-dial",
					"maxclass": "live.dial",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": ["", "float"],
					"patching_rect": [400.0, 30.0, 60.0, 52.0],
					"presentation": 1,
					"presentation_rect": [175.0, 45.0, 60.0, 52.0],
					"parameter_enable": 1,
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Humanize",
							"parameter_shortname": "Human",
							"parameter_type": 0,
							"parameter_unitstyle": 5,
							"parameter_mmin": 0.0,
							"parameter_mmax": 1.0,
							"parameter_initial_enable": 1,
							"parameter_initial": [0.15]
						}
					}
				}
			},
			{
				"box": {
					"id": "obj-play-toggle",
					"maxclass": "live.toggle",
					"numinlets": 1,
					"numoutlets": 1,
					"outlettype": [""],
					"patching_rect": [500.0, 40.0, 20.0, 20.0],
					"presentation": 1,
					"presentation_rect": [260.0, 55.0, 24.0, 24.0],
					"parameter_enable": 1,
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Active",
							"parameter_shortname": "On",
							"parameter_type": 2,
							"parameter_mmin": 0.0,
							"parameter_mmax": 1.0,
							"parameter_initial_enable": 1,
							"parameter_initial": [1]
						}
					}
				}
			},
			{
				"box": {
					"id": "obj-auto-bpm",
					"maxclass": "live.toggle",
					"numinlets": 1,
					"numoutlets": 1,
					"outlettype": [""],
					"patching_rect": [560.0, 40.0, 20.0, 20.0],
					"presentation": 1,
					"presentation_rect": [300.0, 55.0, 24.0, 24.0],
					"parameter_enable": 1,
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "AutoBPM",
							"parameter_shortname": "BPM",
							"parameter_type": 2,
							"parameter_mmin": 0.0,
							"parameter_mmax": 1.0,
							"parameter_initial_enable": 1,
							"parameter_initial": [0]
						}
					}
				}
			},
			{
				"box": {
					"id": "obj-prepend-humanize",
					"maxclass": "newobj",
					"numinlets": 1,
					"numoutlets": 1,
					"outlettype": [""],
					"patching_rect": [400.0, 110.0, 130.0, 22.0],
					"text": "prepend set_humanize"
				}
			},
			{
				"box": {
					"id": "obj-prepend-autobpm",
					"maxclass": "newobj",
					"numinlets": 1,
					"numoutlets": 1,
					"outlettype": [""],
					"patching_rect": [560.0, 110.0, 130.0, 22.0],
					"text": "prepend set_auto_bpm"
				}
			},
			{
				"box": {
					"id": "obj-unpack",
					"maxclass": "newobj",
					"numinlets": 1,
					"numoutlets": 3,
					"outlettype": ["int", "int", "int"],
					"patching_rect": [30.0, 230.0, 150.0, 22.0],
					"text": "unpack 0 0 0"
				}
			},
			{
				"box": {
					"id": "obj-makenote",
					"maxclass": "newobj",
					"numinlets": 3,
					"numoutlets": 2,
					"outlettype": ["float", "float"],
					"patching_rect": [30.0, 280.0, 120.0, 22.0],
					"text": "makenote 80 100"
				}
			},
			{
				"box": {
					"id": "obj-noteout",
					"maxclass": "newobj",
					"numinlets": 3,
					"numoutlets": 0,
					"patching_rect": [30.0, 320.0, 80.0, 22.0],
					"text": "noteout"
				}
			},
			{
				"box": {
					"id": "obj-title",
					"maxclass": "comment",
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [30.0, 380.0, 300.0, 20.0],
					"text": "kbot Genre Morph v1.0",
					"fontface": 1,
					"fontsize": 13.0,
					"presentation": 1,
					"presentation_rect": [15.0, 8.0, 200.0, 20.0]
				}
			},
			{
				"box": {
					"id": "obj-subtitle",
					"maxclass": "comment",
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [30.0, 400.0, 300.0, 20.0],
					"text": "House > Tech > Garage > Trap",
					"fontsize": 10.0,
					"textcolor": [0.5, 0.5, 0.5, 1.0],
					"presentation": 1,
					"presentation_rect": [15.0, 27.0, 200.0, 16.0]
				}
			},
			{
				"box": {
					"id": "obj-status",
					"maxclass": "comment",
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [350.0, 180.0, 200.0, 20.0],
					"text": "House 124bpm",
					"presentation": 1,
					"presentation_rect": [15.0, 105.0, 200.0, 18.0]
				}
			},
			{
				"box": {
					"id": "obj-set-status",
					"maxclass": "newobj",
					"numinlets": 1,
					"numoutlets": 1,
					"outlettype": [""],
					"patching_rect": [350.0, 210.0, 80.0, 22.0],
					"text": "prepend set"
				}
			},
			{
				"box": {
					"id": "obj-label-on",
					"maxclass": "comment",
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [530.0, 40.0, 30.0, 20.0],
					"text": "On",
					"presentation": 1,
					"presentation_rect": [257.0, 82.0, 30.0, 16.0],
					"fontsize": 10.0
				}
			},
			{
				"box": {
					"id": "obj-label-bpm",
					"maxclass": "comment",
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [590.0, 40.0, 40.0, 20.0],
					"text": "BPM",
					"presentation": 1,
					"presentation_rect": [295.0, 82.0, 40.0, 16.0],
					"fontsize": 10.0
				}
			}
		],

		"lines": [
			{
				"patchline": {
					"source": ["obj-metro", 0],
					"destination": ["obj-js", 0],
					"comment": "metro bang → js step trigger"
				}
			},
			{
				"patchline": {
					"source": ["obj-genre-dial", 1],
					"destination": ["obj-js", 1],
					"comment": "genre float → js inlet 1"
				}
			},
			{
				"patchline": {
					"source": ["obj-play-toggle", 0],
					"destination": ["obj-js", 2],
					"comment": "play toggle → js inlet 2"
				}
			},
			{
				"patchline": {
					"source": ["obj-var-dial", 1],
					"destination": ["obj-js", 3],
					"comment": "variation → js inlet 3"
				}
			},
			{
				"patchline": {
					"source": ["obj-human-dial", 1],
					"destination": ["obj-prepend-humanize", 0],
					"comment": "humanize float → prepend"
				}
			},
			{
				"patchline": {
					"source": ["obj-prepend-humanize", 0],
					"destination": ["obj-js", 0],
					"comment": "set_humanize → js"
				}
			},
			{
				"patchline": {
					"source": ["obj-auto-bpm", 0],
					"destination": ["obj-prepend-autobpm", 0],
					"comment": "auto bpm toggle → prepend"
				}
			},
			{
				"patchline": {
					"source": ["obj-prepend-autobpm", 0],
					"destination": ["obj-js", 0],
					"comment": "set_auto_bpm → js"
				}
			},
			{
				"patchline": {
					"source": ["obj-js", 0],
					"destination": ["obj-unpack", 0],
					"comment": "js note data → unpack [pitch vel dur]"
				}
			},
			{
				"patchline": {
					"source": ["obj-js", 1],
					"destination": ["obj-set-status", 0],
					"comment": "js status text → set status comment"
				}
			},
			{
				"patchline": {
					"source": ["obj-set-status", 0],
					"destination": ["obj-status", 0],
					"comment": "set → status comment"
				}
			},
			{
				"patchline": {
					"source": ["obj-unpack", 2],
					"destination": ["obj-makenote", 2],
					"comment": "duration → makenote right inlet (fires first)"
				}
			},
			{
				"patchline": {
					"source": ["obj-unpack", 1],
					"destination": ["obj-makenote", 1],
					"comment": "velocity → makenote middle inlet (fires second)"
				}
			},
			{
				"patchline": {
					"source": ["obj-unpack", 0],
					"destination": ["obj-makenote", 0],
					"comment": "pitch → makenote left inlet (triggers note, fires last)"
				}
			},
			{
				"patchline": {
					"source": ["obj-makenote", 0],
					"destination": ["obj-noteout", 0],
					"comment": "pitch → noteout"
				}
			},
			{
				"patchline": {
					"source": ["obj-makenote", 1],
					"destination": ["obj-noteout", 1],
					"comment": "velocity → noteout"
				}
			}
		]
	}
}
