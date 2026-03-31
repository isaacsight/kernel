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
		"devicewidth": 380.0,
		"description": "kbot Hat Machine — genre-specific hi-hat patterns with density, swing, and roll control",
		"digest": "6 hat styles from house offbeat to trap triplet rolls",
		"tags": "kbot hat hihat drums pattern house garage trap dj",
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
					"patching_rect": [30.0, 220.0, 300.0, 22.0],
					"text": "js kbot-hat-machine.js"
				}
			},
			{
				"box": {
					"id": "obj-style-dial",
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
							"parameter_longname": "Style",
							"parameter_shortname": "Style",
							"parameter_type": 1,
							"parameter_mmin": 0.0,
							"parameter_mmax": 5.0,
							"parameter_initial_enable": 1,
							"parameter_initial": [0]
						}
					}
				}
			},
			{
				"box": {
					"id": "obj-density-dial",
					"maxclass": "live.dial",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": ["", "float"],
					"patching_rect": [300.0, 30.0, 60.0, 52.0],
					"presentation": 1,
					"presentation_rect": [90.0, 45.0, 60.0, 52.0],
					"parameter_enable": 1,
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Density",
							"parameter_shortname": "Density",
							"parameter_type": 0,
							"parameter_unitstyle": 5,
							"parameter_mmin": 0.0,
							"parameter_mmax": 1.0,
							"parameter_initial_enable": 1,
							"parameter_initial": [0.5]
						}
					}
				}
			},
			{
				"box": {
					"id": "obj-swing-dial",
					"maxclass": "live.dial",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": ["", "float"],
					"patching_rect": [400.0, 30.0, 60.0, 52.0],
					"presentation": 1,
					"presentation_rect": [165.0, 45.0, 60.0, 52.0],
					"parameter_enable": 1,
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Swing",
							"parameter_shortname": "Swing",
							"parameter_type": 0,
							"parameter_unitstyle": 5,
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
					"id": "obj-open-dial",
					"maxclass": "live.dial",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": ["", "float"],
					"patching_rect": [500.0, 30.0, 60.0, 52.0],
					"presentation": 1,
					"presentation_rect": [240.0, 45.0, 60.0, 52.0],
					"parameter_enable": 1,
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Open %",
							"parameter_shortname": "Open",
							"parameter_type": 0,
							"parameter_unitstyle": 5,
							"parameter_mmin": 0.0,
							"parameter_mmax": 0.5,
							"parameter_initial_enable": 1,
							"parameter_initial": [0.08]
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
					"patching_rect": [600.0, 40.0, 20.0, 20.0],
					"presentation": 1,
					"presentation_rect": [330.0, 55.0, 24.0, 24.0],
					"parameter_enable": 1,
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Hat Active",
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
					"id": "obj-roll-button",
					"maxclass": "live.button",
					"numinlets": 1,
					"numoutlets": 1,
					"outlettype": [""],
					"patching_rect": [660.0, 40.0, 20.0, 20.0],
					"presentation": 1,
					"presentation_rect": [330.0, 88.0, 30.0, 30.0],
					"parameter_enable": 1,
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Roll",
							"parameter_shortname": "Roll",
							"parameter_type": 2,
							"parameter_mmin": 0.0,
							"parameter_mmax": 1.0
						}
					}
				}
			},
			{
				"box": {
					"id": "obj-prepend-play",
					"maxclass": "newobj",
					"numinlets": 1,
					"numoutlets": 1,
					"outlettype": [""],
					"patching_rect": [600.0, 100.0, 100.0, 22.0],
					"text": "prepend set_play"
				}
			},
			{
				"box": {
					"id": "obj-prepend-open",
					"maxclass": "newobj",
					"numinlets": 1,
					"numoutlets": 1,
					"outlettype": [""],
					"patching_rect": [500.0, 100.0, 120.0, 22.0],
					"text": "prepend set_open_prob"
				}
			},
			{
				"box": {
					"id": "obj-roll-sel",
					"maxclass": "newobj",
					"numinlets": 2,
					"numoutlets": 2,
					"outlettype": ["bang", ""],
					"patching_rect": [660.0, 100.0, 80.0, 22.0],
					"text": "sel 1"
				}
			},
			{
				"box": {
					"id": "obj-roll-on-msg",
					"maxclass": "message",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [""],
					"patching_rect": [660.0, 140.0, 60.0, 22.0],
					"text": "roll_on"
				}
			},
			{
				"box": {
					"id": "obj-roll-off-msg",
					"maxclass": "message",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [""],
					"patching_rect": [730.0, 140.0, 60.0, 22.0],
					"text": "roll_off"
				}
			},
			{
				"box": {
					"id": "obj-unpack",
					"maxclass": "newobj",
					"numinlets": 1,
					"numoutlets": 3,
					"outlettype": ["int", "int", "int"],
					"patching_rect": [30.0, 270.0, 150.0, 22.0],
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
					"patching_rect": [30.0, 320.0, 120.0, 22.0],
					"text": "makenote 80 60"
				}
			},
			{
				"box": {
					"id": "obj-noteout",
					"maxclass": "newobj",
					"numinlets": 3,
					"numoutlets": 0,
					"patching_rect": [30.0, 360.0, 80.0, 22.0],
					"text": "noteout"
				}
			},
			{
				"box": {
					"id": "obj-title",
					"maxclass": "comment",
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [30.0, 420.0, 300.0, 20.0],
					"text": "kbot Hat Machine v1.0",
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
					"patching_rect": [30.0, 440.0, 300.0, 20.0],
					"text": "House | Tech | Garage | Trap | Triplet | Break",
					"fontsize": 9.0,
					"textcolor": [0.5, 0.5, 0.5, 1.0],
					"presentation": 1,
					"presentation_rect": [15.0, 27.0, 280.0, 14.0]
				}
			},
			{
				"box": {
					"id": "obj-status",
					"maxclass": "comment",
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [350.0, 220.0, 200.0, 20.0],
					"text": "House d:50%",
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
					"patching_rect": [350.0, 250.0, 80.0, 22.0],
					"text": "prepend set"
				}
			},
			{
				"box": {
					"id": "obj-label-on",
					"maxclass": "comment",
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [630.0, 40.0, 30.0, 20.0],
					"text": "On",
					"presentation": 1,
					"presentation_rect": [327.0, 82.0, 30.0, 14.0],
					"fontsize": 10.0
				}
			},
			{
				"box": {
					"id": "obj-label-roll",
					"maxclass": "comment",
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [690.0, 40.0, 40.0, 20.0],
					"text": "Roll",
					"presentation": 1,
					"presentation_rect": [325.0, 120.0, 40.0, 14.0],
					"fontsize": 10.0
				}
			}
		],

		"lines": [
			{
				"patchline": {
					"source": ["obj-metro", 0],
					"destination": ["obj-js", 0],
					"comment": "metro → js step trigger"
				}
			},
			{
				"patchline": {
					"source": ["obj-style-dial", 1],
					"destination": ["obj-js", 1],
					"comment": "style int → js inlet 1"
				}
			},
			{
				"patchline": {
					"source": ["obj-density-dial", 1],
					"destination": ["obj-js", 2],
					"comment": "density float → js inlet 2"
				}
			},
			{
				"patchline": {
					"source": ["obj-swing-dial", 1],
					"destination": ["obj-js", 3],
					"comment": "swing float → js inlet 3"
				}
			},
			{
				"patchline": {
					"source": ["obj-open-dial", 1],
					"destination": ["obj-prepend-open", 0],
					"comment": "open prob → prepend"
				}
			},
			{
				"patchline": {
					"source": ["obj-prepend-open", 0],
					"destination": ["obj-js", 0],
					"comment": "set_open_prob → js"
				}
			},
			{
				"patchline": {
					"source": ["obj-play-toggle", 0],
					"destination": ["obj-prepend-play", 0],
					"comment": "play toggle → prepend"
				}
			},
			{
				"patchline": {
					"source": ["obj-prepend-play", 0],
					"destination": ["obj-js", 0],
					"comment": "set_play → js"
				}
			},
			{
				"patchline": {
					"source": ["obj-roll-button", 0],
					"destination": ["obj-roll-sel", 0],
					"comment": "roll button → sel"
				}
			},
			{
				"patchline": {
					"source": ["obj-roll-sel", 0],
					"destination": ["obj-roll-on-msg", 0],
					"comment": "roll pressed → roll_on"
				}
			},
			{
				"patchline": {
					"source": ["obj-roll-sel", 1],
					"destination": ["obj-roll-off-msg", 0],
					"comment": "roll released → roll_off"
				}
			},
			{
				"patchline": {
					"source": ["obj-roll-on-msg", 0],
					"destination": ["obj-js", 0],
					"comment": "roll_on → js"
				}
			},
			{
				"patchline": {
					"source": ["obj-roll-off-msg", 0],
					"destination": ["obj-js", 0],
					"comment": "roll_off → js"
				}
			},
			{
				"patchline": {
					"source": ["obj-js", 0],
					"destination": ["obj-unpack", 0],
					"comment": "js note data → unpack"
				}
			},
			{
				"patchline": {
					"source": ["obj-js", 1],
					"destination": ["obj-set-status", 0],
					"comment": "js status → set"
				}
			},
			{
				"patchline": {
					"source": ["obj-set-status", 0],
					"destination": ["obj-status", 0],
					"comment": "set → status display"
				}
			},
			{
				"patchline": {
					"source": ["obj-unpack", 2],
					"destination": ["obj-makenote", 2],
					"comment": "duration → makenote"
				}
			},
			{
				"patchline": {
					"source": ["obj-unpack", 1],
					"destination": ["obj-makenote", 1],
					"comment": "velocity → makenote"
				}
			},
			{
				"patchline": {
					"source": ["obj-unpack", 0],
					"destination": ["obj-makenote", 0],
					"comment": "pitch → makenote (trigger)"
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
