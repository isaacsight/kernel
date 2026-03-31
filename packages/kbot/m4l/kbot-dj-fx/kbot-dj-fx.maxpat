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
		"rect": [100, 100, 900, 600],
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
		"devicewidth": 450.0,
		"description": "kbot DJ FX — One-knob performance effects: Filter, Delay, Reverb, Stutter, Brake/Riser",
		"digest": "DJ performance effects with one-knob macros",
		"tags": "kbot dj fx filter delay reverb stutter brake riser performance",
		"style": "",

		"boxes": [
			{
				"box": {
					"id": "obj-audio-in",
					"maxclass": "newobj",
					"numinlets": 0,
					"numoutlets": 2,
					"outlettype": ["signal", "signal"],
					"patching_rect": [30.0, 30.0, 80.0, 22.0],
					"text": "plugin~ 2"
				}
			},
			{
				"box": {
					"id": "obj-js",
					"maxclass": "newobj",
					"numinlets": 6,
					"numoutlets": 6,
					"outlettype": ["", "", "", "", "", ""],
					"patching_rect": [400.0, 180.0, 350.0, 22.0],
					"text": "js kbot-dj-fx.js"
				}
			},
			{
				"box": {
					"id": "obj-filter-dial",
					"maxclass": "live.dial",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": ["", "float"],
					"patching_rect": [400.0, 30.0, 60.0, 52.0],
					"presentation": 1,
					"presentation_rect": [15.0, 45.0, 55.0, 52.0],
					"parameter_enable": 1,
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Filter",
							"parameter_shortname": "Filter",
							"parameter_type": 0,
							"parameter_unitstyle": 1,
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
					"id": "obj-delay-dial",
					"maxclass": "live.dial",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": ["", "float"],
					"patching_rect": [480.0, 30.0, 60.0, 52.0],
					"presentation": 1,
					"presentation_rect": [80.0, 45.0, 55.0, 52.0],
					"parameter_enable": 1,
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Echo",
							"parameter_shortname": "Echo",
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
					"id": "obj-reverb-dial",
					"maxclass": "live.dial",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": ["", "float"],
					"patching_rect": [560.0, 30.0, 60.0, 52.0],
					"presentation": 1,
					"presentation_rect": [145.0, 45.0, 55.0, 52.0],
					"parameter_enable": 1,
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Wash",
							"parameter_shortname": "Wash",
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
					"id": "obj-stutter-dial",
					"maxclass": "live.dial",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": ["", "float"],
					"patching_rect": [640.0, 30.0, 60.0, 52.0],
					"presentation": 1,
					"presentation_rect": [210.0, 45.0, 55.0, 52.0],
					"parameter_enable": 1,
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Stutter",
							"parameter_shortname": "Stut",
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
					"id": "obj-brake-dial",
					"maxclass": "live.dial",
					"numinlets": 1,
					"numoutlets": 2,
					"outlettype": ["", "float"],
					"patching_rect": [720.0, 30.0, 60.0, 52.0],
					"presentation": 1,
					"presentation_rect": [275.0, 45.0, 55.0, 52.0],
					"parameter_enable": 1,
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Brake/Rise",
							"parameter_shortname": "B/R",
							"parameter_type": 0,
							"parameter_unitstyle": 1,
							"parameter_mmin": -1.0,
							"parameter_mmax": 1.0,
							"parameter_initial_enable": 1,
							"parameter_initial": [0.0]
						}
					}
				}
			},
			{
				"box": {
					"id": "obj-kill-button",
					"maxclass": "live.button",
					"numinlets": 1,
					"numoutlets": 1,
					"outlettype": [""],
					"patching_rect": [800.0, 40.0, 30.0, 30.0],
					"presentation": 1,
					"presentation_rect": [395.0, 50.0, 35.0, 35.0],
					"parameter_enable": 1,
					"saved_attribute_attributes": {
						"valueof": {
							"parameter_longname": "Kill FX",
							"parameter_shortname": "Kill",
							"parameter_type": 2,
							"parameter_mmin": 0.0,
							"parameter_mmax": 1.0
						}
					}
				}
			},
			{
				"box": {
					"id": "obj-kill-msg",
					"maxclass": "message",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": [""],
					"patching_rect": [800.0, 100.0, 40.0, 22.0],
					"text": "kill"
				}
			},
			{
				"box": {
					"id": "obj-route-filter",
					"maxclass": "newobj",
					"numinlets": 1,
					"numoutlets": 3,
					"outlettype": ["int", "int", ""],
					"patching_rect": [30.0, 240.0, 200.0, 22.0],
					"text": "unpack 0 0 0."
				}
			},
			{
				"box": {
					"id": "obj-svf-L",
					"maxclass": "newobj",
					"numinlets": 3,
					"numoutlets": 4,
					"outlettype": ["signal", "signal", "signal", "signal"],
					"patching_rect": [30.0, 300.0, 200.0, 22.0],
					"text": "svf~ 20000 0.5"
				}
			},
			{
				"box": {
					"id": "obj-svf-R",
					"maxclass": "newobj",
					"numinlets": 3,
					"numoutlets": 4,
					"outlettype": ["signal", "signal", "signal", "signal"],
					"patching_rect": [250.0, 300.0, 200.0, 22.0],
					"text": "svf~ 20000 0.5"
				}
			},
			{
				"box": {
					"id": "obj-filter-select",
					"maxclass": "newobj",
					"numinlets": 3,
					"numoutlets": 1,
					"outlettype": ["signal"],
					"patching_rect": [30.0, 340.0, 120.0, 22.0],
					"text": "selector~ 2"
				}
			},
			{
				"box": {
					"id": "obj-filter-select-R",
					"maxclass": "newobj",
					"numinlets": 3,
					"numoutlets": 1,
					"outlettype": ["signal"],
					"patching_rect": [250.0, 340.0, 120.0, 22.0],
					"text": "selector~ 2"
				}
			},
			{
				"box": {
					"id": "obj-filter-type-plus1",
					"maxclass": "newobj",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": ["int"],
					"patching_rect": [30.0, 270.0, 50.0, 22.0],
					"text": "+ 1"
				}
			},
			{
				"box": {
					"id": "obj-tapin-L",
					"maxclass": "newobj",
					"numinlets": 1,
					"numoutlets": 1,
					"outlettype": ["signal"],
					"patching_rect": [30.0, 380.0, 100.0, 22.0],
					"text": "tapin~ 2000"
				}
			},
			{
				"box": {
					"id": "obj-tapout-L",
					"maxclass": "newobj",
					"numinlets": 1,
					"numoutlets": 1,
					"outlettype": ["signal"],
					"patching_rect": [30.0, 410.0, 100.0, 22.0],
					"text": "tapout~ 500"
				}
			},
			{
				"box": {
					"id": "obj-fb-gain-L",
					"maxclass": "newobj",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": ["signal"],
					"patching_rect": [150.0, 410.0, 60.0, 22.0],
					"text": "*~ 0.3"
				}
			},
			{
				"box": {
					"id": "obj-delay-wet-L",
					"maxclass": "newobj",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": ["signal"],
					"patching_rect": [30.0, 440.0, 60.0, 22.0],
					"text": "*~ 0."
				}
			},
			{
				"box": {
					"id": "obj-delay-add-L",
					"maxclass": "newobj",
					"numinlets": 2,
					"numoutlets": 1,
					"outlettype": ["signal"],
					"patching_rect": [30.0, 470.0, 60.0, 22.0],
					"text": "+~"
				}
			},
			{
				"box": {
					"id": "obj-audio-out",
					"maxclass": "newobj",
					"numinlets": 2,
					"numoutlets": 0,
					"patching_rect": [30.0, 530.0, 80.0, 22.0],
					"text": "plugout~ 2"
				}
			},
			{
				"box": {
					"id": "obj-title",
					"maxclass": "comment",
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [500.0, 400.0, 200.0, 20.0],
					"text": "kbot DJ FX v1.0",
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
					"patching_rect": [500.0, 420.0, 300.0, 20.0],
					"text": "Filter | Echo | Wash | Stutter | Brake/Rise | Kill",
					"fontsize": 9.0,
					"textcolor": [0.5, 0.5, 0.5, 1.0],
					"presentation": 1,
					"presentation_rect": [15.0, 27.0, 300.0, 14.0]
				}
			},
			{
				"box": {
					"id": "obj-status",
					"maxclass": "comment",
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [500.0, 440.0, 200.0, 20.0],
					"text": "Ready",
					"presentation": 1,
					"presentation_rect": [15.0, 105.0, 300.0, 18.0]
				}
			},
			{
				"box": {
					"id": "obj-set-status",
					"maxclass": "newobj",
					"numinlets": 1,
					"numoutlets": 1,
					"outlettype": [""],
					"patching_rect": [500.0, 470.0, 80.0, 22.0],
					"text": "prepend set"
				}
			},
			{
				"box": {
					"id": "obj-label-kill",
					"maxclass": "comment",
					"numinlets": 1,
					"numoutlets": 0,
					"patching_rect": [830.0, 40.0, 30.0, 20.0],
					"text": "Kill",
					"fontface": 1,
					"textcolor": [0.8, 0.2, 0.2, 1.0],
					"presentation": 1,
					"presentation_rect": [393.0, 88.0, 40.0, 16.0],
					"fontsize": 10.0
				}
			}
		],

		"lines": [
			{
				"patchline": {
					"source": ["obj-filter-dial", 1],
					"destination": ["obj-js", 0],
					"comment": "filter macro → js"
				}
			},
			{
				"patchline": {
					"source": ["obj-delay-dial", 1],
					"destination": ["obj-js", 1],
					"comment": "delay macro → js"
				}
			},
			{
				"patchline": {
					"source": ["obj-reverb-dial", 1],
					"destination": ["obj-js", 2],
					"comment": "reverb macro → js"
				}
			},
			{
				"patchline": {
					"source": ["obj-stutter-dial", 1],
					"destination": ["obj-js", 3],
					"comment": "stutter rate → js"
				}
			},
			{
				"patchline": {
					"source": ["obj-brake-dial", 1],
					"destination": ["obj-js", 4],
					"comment": "brake/riser → js"
				}
			},
			{
				"patchline": {
					"source": ["obj-kill-button", 0],
					"destination": ["obj-kill-msg", 0],
					"comment": "kill button → message"
				}
			},
			{
				"patchline": {
					"source": ["obj-kill-msg", 0],
					"destination": ["obj-js", 0],
					"comment": "kill → js"
				}
			},
			{
				"patchline": {
					"source": ["obj-js", 0],
					"destination": ["obj-route-filter", 0],
					"comment": "filter params [type cutoff reso] → unpack"
				}
			},
			{
				"patchline": {
					"source": ["obj-route-filter", 0],
					"destination": ["obj-filter-type-plus1", 0],
					"comment": "filter type → +1 for selector"
				}
			},
			{
				"patchline": {
					"source": ["obj-filter-type-plus1", 0],
					"destination": ["obj-filter-select", 0],
					"comment": "selector index: 1=LP, 2=HP"
				}
			},
			{
				"patchline": {
					"source": ["obj-filter-type-plus1", 0],
					"destination": ["obj-filter-select-R", 0],
					"comment": "selector index R"
				}
			},
			{
				"patchline": {
					"source": ["obj-audio-in", 0],
					"destination": ["obj-svf-L", 0],
					"comment": "audio L → filter L"
				}
			},
			{
				"patchline": {
					"source": ["obj-audio-in", 1],
					"destination": ["obj-svf-R", 0],
					"comment": "audio R → filter R"
				}
			},
			{
				"patchline": {
					"source": ["obj-svf-L", 0],
					"destination": ["obj-filter-select", 1],
					"comment": "LP output → selector input 1"
				}
			},
			{
				"patchline": {
					"source": ["obj-svf-L", 1],
					"destination": ["obj-filter-select", 2],
					"comment": "HP output → selector input 2"
				}
			},
			{
				"patchline": {
					"source": ["obj-svf-R", 0],
					"destination": ["obj-filter-select-R", 1],
					"comment": "LP R → selector R 1"
				}
			},
			{
				"patchline": {
					"source": ["obj-svf-R", 1],
					"destination": ["obj-filter-select-R", 2],
					"comment": "HP R → selector R 2"
				}
			},
			{
				"patchline": {
					"source": ["obj-filter-select", 0],
					"destination": ["obj-tapin-L", 0],
					"comment": "filtered L → delay"
				}
			},
			{
				"patchline": {
					"source": ["obj-filter-select", 0],
					"destination": ["obj-delay-add-L", 0],
					"comment": "filtered L → dry path"
				}
			},
			{
				"patchline": {
					"source": ["obj-tapin-L", 0],
					"destination": ["obj-tapout-L", 0],
					"comment": "tapin → tapout"
				}
			},
			{
				"patchline": {
					"source": ["obj-tapout-L", 0],
					"destination": ["obj-fb-gain-L", 0],
					"comment": "delayed → feedback gain"
				}
			},
			{
				"patchline": {
					"source": ["obj-tapout-L", 0],
					"destination": ["obj-delay-wet-L", 0],
					"comment": "delayed → wet gain"
				}
			},
			{
				"patchline": {
					"source": ["obj-delay-wet-L", 0],
					"destination": ["obj-delay-add-L", 1],
					"comment": "wet delay → add to dry"
				}
			},
			{
				"patchline": {
					"source": ["obj-delay-add-L", 0],
					"destination": ["obj-audio-out", 0],
					"comment": "mixed L → output L"
				}
			},
			{
				"patchline": {
					"source": ["obj-filter-select-R", 0],
					"destination": ["obj-audio-out", 1],
					"comment": "filtered R → output R (simplified)"
				}
			},
			{
				"patchline": {
					"source": ["obj-js", 5],
					"destination": ["obj-set-status", 0],
					"comment": "status text → display"
				}
			},
			{
				"patchline": {
					"source": ["obj-set-status", 0],
					"destination": ["obj-status", 0],
					"comment": "set → status"
				}
			}
		]
	}
}
