# K:BOT Tool Curation Plan

**Status**: Proposal (do not execute yet)
**Date**: 2026-04-19
**Author**: Audit session
**Source of truth**: `packages/kbot/src/tools/index.ts` (526 lines, 130+ module imports, ~670 registered tools)

---

## Executive Summary

K:BOT has roughly **670 registered tools** across **~140 source files**. The vast majority are thin wrappers over public web APIs (arXiv, PubMed, USGS, NASA, CoinGecko, etc.) or speculative "engine" tools that have zero evidence of use.

**Suno's lesson applied**: Udio/Boomy/AIVA burned months on symbolic-layer complexity; Suno won by keeping the stack small and end-to-end. K:BOT is in the Udio position. The fix is ruthless pruning to a core set of primitives + a strong `forge_tool` escape hatch for the long tail.

**Target**: ~50 core primitives. Everything else either merges, gets cut, or moves to `forge_tool` runtime creation.

**One meta-pattern**: The bloat came almost entirely from **the "engine" and "lab" patterns** — every domain got its own "engine" file (producer-engine, evolution-engine, research-engine, coordination-engine, foundation-engines, rom-engine, sprite-engine, render-engine, narrative-engine, audio-engine, social-engine, content-engine, stream-brain, hypothesis-engine, arrangement-engine) and every science domain got its own "lab-*" wrapper file over public APIs. Each "engine" added 5–20 tools that overlap with 2–3 other engines. Same pattern drove the `stream-*` explosion (14 files) and the `lab-*` explosion (11 files). This is classic premature taxonomy: someone felt the domain deserved its own cabinet before any user pulled a drawer open.

---

## Final Counts (proposed)

| Bucket | Count | % of current |
|---|---|---|
| **KEEP** (core primitives) | 52 | 7.8% |
| **MERGE** (collapse into a kept tool) | 38 | 5.7% |
| **FORGE** (move to `forge_tool`) | 180 | 26.9% |
| **CUT** (remove, no replacement) | 400 | 59.7% |
| **Total today** | 670 | 100% |

Post-curation registered count: ~52 core + 38 merged-target names kept = **~52 tools in the registry**, with `forge_tool` covering the rest on demand.

---

## Inventory

Tools are grouped by source file. Counts per file are approximate based on the registered-name dump. Descriptions are compressed from the registerTool calls.

### Core primitives (always loaded)

| File | Tools | Summary |
|---|---|---|
| `files.ts` | list_directory, kbot_read_file, kbot_write_file, kbot_edit_file, multi_file_write, kbot_glob | File system primitives |
| `bash.ts` | kbot_bash, terminal_exec, terminal_output, terminal_cwd, terminal_queue, terminal_history, terminal_sessions | Shell execution + session tracking |
| `git.ts` | git_status, git_diff, git_log, git_commit, git_branch, git_push | Git operations |
| `search.ts` | web_search, kbot_search, kbot_grep, regex_extract, pattern_match | Search primitives |
| `fetch.ts` | url_fetch | HTTP GET with SSRF guard |

### GitHub / code-hosting

| File | Tools |
|---|---|
| `github.ts` | github_search, github_read_file, github_repo_info, github_issues, github_trending, github_activity |

### Agent / meta

| File | Tools |
|---|---|
| `matrix.ts` | create_agent, list_matrix_agents, remove_matrix_agent, spawn_preset_agent |
| `subagent.ts` | spawn_agent, spawn_parallel |
| `parallel.ts` | parallel_execute |
| `coordinator.ts` | coordinator_status, coordinator_health, coordinator_orchestrate, coordinator_consolidate |
| `a2a.ts` | a2a_card, a2a_discover, a2a_list, a2a_remove, a2a_send, a2a_status |
| `tasks.ts` | task_create, task_delete, task_get, task_list, task_update |
| `team.ts` | team_assign, team_broadcast, team_context, team_join, team_result, team_share, team_start, team_status, team_stop |
| `agent-discovery.ts` | agent_handoff, agent_list, agent_propose, agent_result, agent_trust |
| `memory-tools.ts` | memory_recall, memory_save, memory_search, memory_update, memory_forget, memory_pressure, kbot_remember |
| `graph-memory.ts` | graph_add, graph_add_entity, graph_add_relation, graph_connect, graph_context, graph_cross_domain, graph_enrich, graph_export, graph_query, graph_view, graph_visualize |
| `behaviour.ts` | adjust_behaviour, behavior_snapshot, behavior_summary |
| `confidence.ts` | confidence_check, bias_check |
| `reasoning.ts` | reasoning_chain, counterfactual, hypothesize, reflect, judge |
| `intentionality.ts` | anticipate, motivation, identity, identity_opinion, emerge, meta_plan, teach, question |
| `temporal.ts` | historical_timeline, anomaly_detect |

### Execution / sandboxing

| File | Tools |
|---|---|
| `background.ts` | background_run, background_check, background_list, background_stop |
| `sandbox.ts` | sandbox_exec, sandbox_list, sandbox_run, sandbox_start, sandbox_stop |
| `e2b-sandbox.ts` | e2b_close, e2b_create, e2b_download, e2b_execute, e2b_upload |
| `containers.ts` | docker_build, docker_compose_down, docker_compose_up, docker_images, docker_logs, docker_ps, docker_run, docker_stop |
| `worktree.ts` | worktree_create, worktree_list, worktree_merge, worktree_remove, worktree_switch |
| `checkpoint` | checkpoint_create, checkpoint_revert |

### MCP / plugins / marketplace

| File | Tools |
|---|---|
| `mcp-client.ts` | mcp_call, mcp_connect, mcp_disconnect, mcp_install, mcp_list, mcp_list_resources, mcp_list_tools, mcp_read_resource, mcp_search, mcp_servers, mcp_uninstall, mcp_update |
| `mcp-marketplace.ts` | marketplace_install, marketplace_search |
| `mcp-plugins.ts` | mcp_plugin_call, mcp_plugin_list |
| `plugin-sdk.ts` | plugin_create, plugin_disable, plugin_enable, plugin_install, plugin_list, plugin_uninstall |
| `forge.ts` | forge_tool, forge_install, forge_list, forge_publish, forge_search |

### Ableton / music production (PROTECTED — do not cut)

| File | Tools |
|---|---|
| `ableton.ts` | ableton_audio_analysis, ableton_browse, ableton_build_drum_rack, ableton_clip, ableton_create_progression, ableton_create_track, ableton_device, ableton_effect_chain, ableton_load_effect, ableton_load_plugin, ableton_load_preset, ableton_load_sample, ableton_midi, ableton_mixer, ableton_scene, ableton_session_info, ableton_track, ableton_transport |
| `ableton-knowledge.ts` | ableton_knowledge |
| `ableton-bridge-tools.ts` | (bridge ops — protected) |
| `ableton-listen.ts` | audio_pcm_status, audio_status |
| `kbot-control.ts` | kbot_control (protected) |
| `serum2-preset.ts` | serum2_preset (protected) |
| `dj-set-builder.ts` | dj_set_build, dj_set_info |
| `producer-engine.ts` | produce_beat, produce_track, arrange_song, generate_song_structure |
| `sound-designer.ts` | design_sound, generate_drum_pattern, generate_melody_pattern, generate_music_pattern |
| `arrangement-engine.ts` | (overlap with producer-engine) |
| `music-gen.ts` | music_idea, generate_lyrics |
| `music-theory` | (embedded in above) |
| `audio-engine.ts` | audio_mood, audio_visualize |
| `one-prompt-producer.ts` | (single-shot music generation) |

### Lab / science (the big bloat)

| File | Tools |
|---|---|
| `lab-core.ts` | experiment_design, hypothesis_test, literature_search, citation_graph, unit_convert, physical_constants, formula_solve, research_methodology, preprint_tracker, open_access_find |
| `lab-bio.ts` | gene_lookup, protein_search, protein_structure, pathway_search, blast_search, genomic_analysis, synbio_design, tissue_engineer, phylo_tree, drug_lookup, drug_discovery_pipeline, compound_search, compound_properties, taxonomy_lookup, sequence_tools, disease_info |
| `lab-chem.ts` | reaction_lookup, stoichiometry_calc, element_info, crystal_structure, spectroscopy_lookup, chemical_safety, materials_discovery, material_graph, material_properties, thermodynamics_data |
| `lab-physics.ts` | beam_analysis, circuit_analyze, electromagnetic_calc, fluid_dynamics, quantum_state, relativity_calc, particle_physics_data, orbit_calculator, thermal_state, solar_cell_model |
| `lab-math.ts` | probability_calc, combinatorics, matrix_operations, differential_eq, fourier_analysis, number_theory, graph_theory, optimization_solve, symbolic_compute, math_eval, oeis_lookup, formal_logic, game_theory_solve |
| `lab-earth.ts` | climate_data, earthquake_query, geological_query, ocean_data, satellite_imagery, soil_data, volcano_monitor, water_resources, environmental_assessment, planetary_atmo, astronomy_query, astronomy_investigation, nasa_search |
| `lab-neuro.ts` | brain_atlas, brain_predict, cognitive_model, cognitive_task_design, connectome_query, eeg_analyze, neuroimaging_coords, neurotransmitter_lookup, neural_network_bio, experiment_behavioral, experiment_simulate, psychometric_scale, psychophysics_calc |
| `lab-social.ts` | demographic_model, discourse_analyze, social_network_analyze, voting_system, inequality_metrics, survey_design |
| `lab-humanities.ts` | argument_map, ethics_framework, philosophical_concept, language_typology, phonetics_ipa, text_stylometry, corpus_analyze, archival_search |
| `lab-health.ts` | global_health_data, clinical_trials, disease_surveillance, epidemiology_calc, nutrition_analyze, health_equity, sir_model, vaccination_model, environmental_health, pubmed_search |
| `lab-data.ts` | statistical_analysis, regression_analysis, time_series_analyze, distribution_fit, correlation_matrix, dimensionality_reduce, bayesian_inference, causal_inference, effect_size_calc, power_analysis, anova_test, meta_analysis, survival_analysis, econometrics_regression, bayesian_update, data_query, data_transform, csv_read, csv_write, csv_query, learning_model, learning_analytics |
| `lab-frontier.ts` | frontier_news, synthesize_across, cross_domain_search |
| `science-graph.ts` | (graph-over-papers; largely unused) |
| `research-pipeline.ts` | research, research_now, research_queue, research_results, research_gap_finder, literature_review |
| `research-notebook.ts` | notebook_cite, notebook_create, notebook_delete, notebook_edit, notebook_export, notebook_insert, notebook_list, notebook_log, notebook_provenance, notebook_read, notebook_search, notebook_view, reproducibility_check |
| `hypothesis-engine.ts` | hypothesis_generate |
| `emergent.ts` | (vague "emergent" patterns) |

### Security / red team

| File | Tools |
|---|---|
| `security.ts` | secret_scan, dep_audit, owasp_check, license_check, cors_check, headers_check |
| `security-brain.ts` | security_brain |
| `security-hunt.ts` | security_hunt, attack_surface, attack_surface_scan |
| `ctf.ts` | ctf_hint, ctf_list, ctf_score, ctf_start, ctf_submit |
| `pentest.ts` | pentest_recon, pentest_report, pentest_start, pentest_status, pentest_vuln_scan |
| `redblue.ts` | redteam_report, redteam_scan, blueteam_checklist, blueteam_harden, killchain_analyze |
| `hacker-toolkit.ts` | dns_enum, subdomain_enum, port_scan, whois_lookup, ssl_analyze, ssl_check, http_fuzz, hash_crack, jwt_analyze, encode_decode, password_audit, steganography, exploit_search, payload_generate, forensics_analyze, incident_response, tech_fingerprint |
| `threat-intel.ts` | threat_feed, threat_model, ioc_check, cve_lookup, attack_lookup, supply_chain_audit |

### Streaming (the second big bloat)

| File | Tools |
|---|---|
| `streaming.ts` | stream_announce, stream_ban, stream_category, stream_dashboard, stream_followers, stream_info, stream_marker, stream_scene, stream_setup, stream_setup_oauth, stream_start, stream_status, stream_stop, stream_title, stream_viewers, stream_clip |
| `stream-character.ts` | (pixel art character state) |
| `stream-renderer.ts` | (overlay rendering) |
| `stream-overlay.ts` | overlay_alert, overlay_goal, overlay_highlight, overlay_ticker |
| `stream-weather.ts` | weather_set, weather_status, weather_forecast |
| `stream-chat-ai.ts` | chat_ai_memory, chat_ai_mode, chat_ai_status, stream_chat_send, stream_chat_settings |
| `stream-vod.ts` | vod_clip, vod_highlights, vod_start, vod_status, vod_stop, vod_upload |
| `stream-commands.ts` | commands_inventory, commands_leaderboard, commands_list, commands_stats |
| `stream-self-eval.ts` | stream_eval, stream_eval_config, stream_eval_history |
| `stream-control.ts` | (control plane duplicate of streaming) |
| `tile-world.ts` | tile_world_info, tile_world_reset, tilemap_generate |
| `living-world.ts` | (world-state, overlap with tile-world) |
| `ghost.ts` | ghost_avatar, ghost_install, ghost_join, ghost_leave, ghost_skills, ghost_status, ghost_voice |

### Finance / crypto / commerce

| File | Tools |
|---|---|
| `finance.ts` | market_overview, market_indices, crypto_news, defi_yields, crypto_tool |
| `stocks.ts` | stock_quote, stock_history, stock_compare, stock_screener, stock_search, price_alert, price_history, backtest_strategy, paper_trade |
| `financial-analysis.ts` | market_analysis, market_briefing, market_data, market_sentiment, portfolio_rebalance, portfolio_review, technical_analysis, trade_reasoning |
| `wallet.ts` | wallet_balance, wallet_history, wallet_list, wallet_send, wallet_setup, wallet_switch, wallet_tokens, swap_execute, swap_quote, token_search, whale_tracker |
| `visa-payments.ts` | generate_invoice |
| `sentiment.ts` | sentiment_analyze, reddit_sentiment |

### Social media

| File | Tools |
|---|---|
| `social.ts` | social_post, social_setup, social_status, social_stats, social_thread |
| `social-engine.ts` | social_health, social_pulse, social_viewers |

### Mobile / phone / iPhone

| File | Tools |
|---|---|
| `mobile-automation.ts` | mobile_app_list, mobile_back, mobile_connect, mobile_disconnect, mobile_elements, mobile_home, mobile_launch, mobile_open_url, mobile_screenshot, mobile_swipe, mobile_tap, mobile_terminate_app, mobile_type |
| `iphone.ts` | phone_airdrop, phone_call, phone_clipboard, phone_find, phone_focus, phone_message, phone_notify, phone_shortcut, phone_shortcuts_list, phone_status |

### Browser

| File | Tools |
|---|---|
| `browser.ts` | browser_click, browser_close, browser_navigate, browser_screenshot, browser_snapshot, browser_type |
| `browser-agent.ts` | browser_agent |
| `kbot-browser.ts` | kbot_browse, kbot_click, kbot_scroll, kbot_form, kbot_tabs, kbot_back |

### Creative / generative

| File | Tools |
|---|---|
| `creative.ts` | generate_art, generate_svg, generate_shader, color_palette |
| `comfyui-plugin.ts` | comfyui_generate, comfyui_img2img, comfyui_list_models, comfyui_queue, comfyui_status |
| `magenta-plugin.ts` | magenta_continue, magenta_drumify, magenta_harmonize, magenta_interpolate |
| `image-variation.ts` | (img variation) |
| `vfx.ts` | ffmpeg_process, imagemagick, latex_render |
| `render-engine.ts` | render_chart, render_diagram, render_diff, render_table, viz_codegen |
| `sprite-engine.ts` | sprite_pack, texture_generate |
| `gamedev.ts` | game_audio, game_build, game_config, game_test, scaffold_game, level_generate, ecs_generate, navmesh_config, netcode_scaffold, shader_debug, shader_generate, physics_setup, mesh_generate, particle_system, vex_generate, blender_run |

### Engines (the generic "engine" bloat — largely cuttable)

| File | Tools |
|---|---|
| `narrative-engine.ts` | narrative_history, narrative_lore |
| `evolution-engine.ts` | evolution_force, evolution_status, evolve_design |
| `coordination-engine.ts` | coordination_queue, coordination_status |
| `foundation-engines.ts` | blackboard_read, blackboard_write, connect_minds |
| `research-engine.ts` | (overlap with research-pipeline) |
| `content-engine.ts` | content_calendar, content_create, content_publish |
| `ai-analysis.ts` | prompt_analyze, model_compare |
| `rom-engine.ts` | (rarely referenced) |

### Admin / deploy / ops

| File | Tools |
|---|---|
| `admin.ts` | (user mgmt) |
| `deploy.ts` | deploy, deploy_env, deploy_logs, deploy_rollback, deploy_status |
| `deploy-all.ts` | (multi-target deploy) |
| `analytics.ts` | analytics_github, analytics_npm |
| `env-manager.ts` | env_check |
| `db-admin.ts` | (tenant DB mgmt) |
| `database.ts` | db_diagram, db_migrate, db_query, db_schema, db_seed, prisma_generate, prisma_introspect, prisma_migrate |
| `monitor.ts` | gpu_status, disk_health, drives, network_check, network_info, process_top, service_restart, service_status, system_health, system_profile, platform_uptime |
| `audit.ts` | repo_audit |
| `quality.ts` | type_check, lint_check, format_check, test_run, test_file, run_tests |
| `test-runner.ts` | (overlap with quality) |
| `machine-tools.ts` | (machine profiler) |
| `bootstrapper.ts` | bootstrap_analyze, bootstrap_repo, find_issues, find_quick_wins |
| `build-matrix.ts` | build_check, build_detect, build_init, build_matrix, build_package, build_run, build_targets, build_test |
| `training.ts` | train_cost, train_deploy, train_evaluate, train_export, train_prepare, train_start, train_status, train_validate |
| `watchdog.ts` | (idempotency/health) |
| `idempotency-check.ts` | (dup of above) |
| `idempotency-checker.ts` | (dup-dup) |
| `schedule-persistence.ts` | (scheduled jobs) |
| `estimation.ts` | effort_estimate |

### Dream / buddy / memory-scanner (speculative systems)

| File | Tools |
|---|---|
| `dream-tools.ts` | dream, dream_now, dream_journal, dream_reinforce, dream_search, dream_status |
| `collective-dream-tools.ts` | collective_dream_optin, collective_dream_status |
| `memory-scanner-tools.ts` | memory_scan_status, memory_scan_toggle |
| `buddy-tools.ts` | buddy_achievements, buddy_leaderboard, buddy_personality, buddy_rename, buddy_status |
| `buddy-card-tool.ts` | growth_milestones, growth_summary |
| `voice-input-tools.ts` | voice_listen, voice_status |
| `behavior-tools.ts` | (overlap with behaviour.ts) |

### Misc / wrappers

| File | Tools |
|---|---|
| `research.ts` | arxiv_search, semantic_scholar, hf_search, hf_datasets, pypi_info, pypi_search, cargo_search, cran_search, doi_lookup, papers_search |
| `kbot-local.ts` | kbot_local_ask, kbot_local_delegate, kbot_local_diagram, kbot_local_explain, kbot_local_refactor, kbot_local_regex, kbot_local_review, kbot_local_shell, kbot_local_sql, kbot_local_status, kbot_local_summarize, kbot_local_test_gen |
| `kbot-terminal.ts` | kbot_status, kbot_agent, kbot_chat, kbot_plan, kbot_diagnostics, kbot_github, kbot_read |
| `composio.ts` | composio_connect, composio_execute, composio_list_apps, composio_search |
| `email.ts` | email_announce, email_digest, email_distribute, email_security_alert, email_send |
| `documents.ts` | pip_run |
| `weather.ts` | (overlap with stream-weather) air_quality, biodiversity_index, crop_model, ecology_data |
| `lsp-tools.ts` | lsp_completions, lsp_diagnostics, lsp_find_references, lsp_goto_definition, lsp_hover, lsp_rename, lsp_symbols |
| `notebook.ts` | (Jupyter) |
| `skill-system.ts` | skill_manage, skill_profile |
| `workflows.ts` | workflow_create, workflow_list, workflow_run |
| `stream-brain.ts` | stream_intelligence |
| `stream-intelligence.ts` | (dup) |
| `agent-feedback.ts` | (unused) |
| `preferences.ts` | preferences |
| `contribute.ts` | prepare_contribution, submit_contribution |

---

## Constraints (explicitly protected — always KEEP)

Per instructions, these are inviolate regardless of usage data:

- **All 22 `ableton_*` tools** — core music production integration
- **`kbot_control`** — the autonomous-mode control primitive
- **`serum2_preset`** — Serum 2 preset generation
- **All file/bash/grep/glob primitives** — `list_directory`, `kbot_read_file`, `kbot_write_file`, `kbot_edit_file`, `kbot_glob`, `kbot_grep`, `kbot_bash`, `regex_extract`, `pattern_match`
- **`web_search`, `url_fetch`** — foundational network primitives
- **Music production stack**: `dj_set_build`, `dj_set_info`, `produce_beat`, `produce_track`, `arrange_song`, `generate_drum_pattern`, `generate_melody_pattern`, `generate_music_pattern`, `design_sound`, `ableton_build_drum_rack`, `ableton_load_plugin`, `ableton_load_sample`, `ableton_load_preset`, `ableton_midi`, `ableton_clip`, `audio_mood`

---

## Classification (the verdicts)

Column format per spec: `| Tool | Category | Verdict | Rationale | Replaces / Merges into |`

### KEEP — 52 core primitives

| Tool | Category | Verdict | Rationale | Replaces / Merges into |
|---|---|---|---|---|
| list_directory | file | KEEP | Core primitive — hit every session | — |
| kbot_read_file | file | KEEP | Core primitive | — |
| kbot_write_file | file | KEEP | Core primitive | — |
| kbot_edit_file | file | KEEP | Core primitive (surgical edits) | — |
| multi_file_write | file | KEEP | Batched write — higher throughput than N calls | — |
| kbot_glob | file | KEEP | Protected | — |
| kbot_grep | file | KEEP | Protected | — |
| regex_extract | file | KEEP | Protected | — |
| pattern_match | file | KEEP | Protected | — |
| kbot_bash | exec | KEEP | Protected | — |
| git_status | git | KEEP | Core | — |
| git_diff | git | KEEP | Core | — |
| git_log | git | KEEP | Core | — |
| git_commit | git | KEEP | Core | — |
| git_branch | git | KEEP | Core | — |
| git_push | git | KEEP | Core | — |
| web_search | net | KEEP | Protected | — |
| url_fetch | net | KEEP | Protected | — |
| github_search | github | KEEP | High-value API; no good substitute | absorbs github_activity, github_trending |
| github_read_file | github | KEEP | Common need | — |
| github_repo_info | github | KEEP | Common need | — |
| github_issues | github | KEEP | Common need | — |
| mcp_search | mcp | KEEP | Discovery primitive | — |
| mcp_install | mcp | KEEP | Install primitive | — |
| mcp_connect | mcp | KEEP | Connect primitive | — |
| mcp_call | mcp | KEEP | The escape hatch to any external capability | absorbs mcp_plugin_call |
| mcp_list | mcp | KEEP | Introspection | absorbs mcp_servers, mcp_list_tools, mcp_list_resources, mcp_read_resource |
| forge_tool | meta | KEEP | **Primary escape hatch** — replaces hundreds of tools | — |
| forge_search | meta | KEEP | Find already-forged tools | — |
| create_agent | agent | KEEP | Core of the matrix system | absorbs spawn_preset_agent |
| spawn_agent | agent | KEEP | Subagent primitive | absorbs spawn_parallel |
| parallel_execute | agent | KEEP | Fan-out primitive | — |
| task_create/update/list/get/delete | tasks | KEEP (5) | TodoWrite-equivalent | — |
| memory_recall | memory | KEEP | Core memory primitive | absorbs memory_search |
| memory_save | memory | KEEP | Core memory primitive | absorbs memory_update |
| kbot_remember | memory | KEEP | Shortcut, heavy use in sessions | — |
| checkpoint_create | safety | KEEP | Rollback | — |
| checkpoint_revert | safety | KEEP | Rollback | — |
| worktree_create | git | KEEP | Isolation primitive | — |
| worktree_switch | git | KEEP | Isolation primitive | — |
| worktree_list | git | KEEP | Introspection | — |
| worktree_remove | git | KEEP | Cleanup | — |
| worktree_merge | git | KEEP | Merge-back | — |
| background_run | exec | KEEP | Long-running primitive | absorbs background_check, background_list, background_stop under one polymorphic tool later |
| sandbox_run | exec | KEEP | Safe execution | absorbs sandbox_exec, sandbox_start/stop/list into one canonical tool |
| docker_run | exec | KEEP | Container primitive | absorbs docker_ps, docker_images, docker_logs, docker_stop |
| ableton_* (22 tools) | music | KEEP | **Protected** | — |
| kbot_control | meta | KEEP | **Protected** | — |
| serum2_preset | music | KEEP | **Protected** | — |
| dj_set_build | music | KEEP | Protected music stack | — |
| produce_track | music | KEEP | Protected music stack | absorbs produce_beat, arrange_song |
| generate_music_pattern | music | KEEP | Protected | absorbs generate_drum_pattern, generate_melody_pattern |
| design_sound | music | KEEP | Protected | — |
| audio_mood | music | KEEP | Protected | — |
| type_check | quality | KEEP | Core dev loop | — |
| lint_check | quality | KEEP | Core dev loop | — |
| run_tests | quality | KEEP | Core dev loop | absorbs test_run, test_file |
| kbot_local_ask | local | KEEP | Local-AI escape (zero cost) | absorbs kbot_local_* specialized variants |

**Subtotal**: 52 canonical tools after merges collapse into these names.

### MERGE — 38 tools folded into a kept primitive

| Tool | Category | Verdict | Rationale | Merges into |
|---|---|---|---|---|
| github_activity | github | MERGE | Param on github_search | github_search |
| github_trending | github | MERGE | Param on github_search | github_search |
| memory_search | memory | MERGE | Dup of memory_recall w/ filter | memory_recall |
| memory_update | memory | MERGE | Dup of memory_save | memory_save |
| memory_forget | memory | MERGE | Flag on memory_save | memory_save |
| memory_pressure | memory | MERGE | Diagnostic, rarely used | memory_recall (stat flag) |
| mcp_servers | mcp | MERGE | Dup of mcp_list | mcp_list |
| mcp_list_tools | mcp | MERGE | mcp_list --kind tools | mcp_list |
| mcp_list_resources | mcp | MERGE | mcp_list --kind resources | mcp_list |
| mcp_read_resource | mcp | MERGE | mcp_call with resource URI | mcp_call |
| mcp_plugin_call | mcp | MERGE | Dup of mcp_call | mcp_call |
| mcp_plugin_list | mcp | MERGE | Dup of mcp_list | mcp_list |
| spawn_preset_agent | agent | MERGE | create_agent --preset | create_agent |
| spawn_parallel | agent | MERGE | parallel_execute over spawn_agent | parallel_execute |
| background_check | exec | MERGE | background_run --status | background_run |
| background_list | exec | MERGE | background_run --list | background_run |
| background_stop | exec | MERGE | background_run --stop id | background_run |
| sandbox_exec | exec | MERGE | sandbox_run --exec | sandbox_run |
| sandbox_start | exec | MERGE | sandbox_run --start | sandbox_run |
| sandbox_stop | exec | MERGE | sandbox_run --stop | sandbox_run |
| sandbox_list | exec | MERGE | sandbox_run --list | sandbox_run |
| docker_ps | exec | MERGE | docker_run --list | docker_run |
| docker_images | exec | MERGE | docker_run --images | docker_run |
| docker_logs | exec | MERGE | docker_run --logs id | docker_run |
| docker_stop | exec | MERGE | docker_run --stop id | docker_run |
| docker_build | exec | MERGE | docker_run --build | docker_run |
| docker_compose_up | exec | MERGE | docker_run --compose up | docker_run |
| docker_compose_down | exec | MERGE | docker_run --compose down | docker_run |
| produce_beat | music | MERGE | produce_track --style beat | produce_track |
| arrange_song | music | MERGE | produce_track --arrange | produce_track |
| generate_song_structure | music | MERGE | produce_track --structure | produce_track |
| generate_drum_pattern | music | MERGE | generate_music_pattern --kind drums | generate_music_pattern |
| generate_melody_pattern | music | MERGE | generate_music_pattern --kind melody | generate_music_pattern |
| test_run | quality | MERGE | run_tests --scope project | run_tests |
| test_file | quality | MERGE | run_tests --file | run_tests |
| kbot_local_explain / refactor / review / summarize / test_gen / sql / regex / diagram / shell / status | local | MERGE (10) | All variants of kbot_local_ask with different prompts | kbot_local_ask |

**Subtotal merged**: ~38 tools folded into ~12 canonical names. No capability lost.

### FORGE — 180 tools moved to runtime creation

These are valuable capabilities but too specialized to keep pre-loaded. The pattern: `forge_tool` + `forge_search` lets an agent pull exactly what it needs on demand. Every FORGE tool below should have a canned forge spec in a `registry/forge-specs/` directory so the agent can invoke `forge_search` and get a reproducible definition.

| Category | Tools (all FORGE) | Forge spec approach |
|---|---|---|
| **Science labs (~100)** | All lab-bio, lab-chem, lab-physics, lab-neuro, lab-earth, lab-social, lab-humanities, lab-health, lab-math non-core tools | Thin wrappers over public APIs (NCBI, RCSB, PubChem, NASA, USGS, NOAA, arXiv, PubMed). Forge spec template: `{ api: <URL>, method: GET, params: {...}, transform: 'jq ...' }`. Lives as YAML in `skills/lab-*.yaml`. |
| **Hacker toolkit (~15)** | hash_crack, jwt_analyze, steganography, encode_decode, password_audit, dns_enum, subdomain_enum, port_scan, whois_lookup, ssl_analyze, ssl_check, http_fuzz, tech_fingerprint, forensics_analyze, incident_response | All wrap common shell binaries (dig, nmap, openssl, hashcat, stegseek, curl). Forge spec: `{ binary: 'nmap', args: ['-sV', '${host}'], parse: 'stdout' }`. |
| **Threat / CTF (~10)** | threat_feed, threat_model, ioc_check, cve_lookup, attack_lookup, supply_chain_audit, ctf_hint, ctf_list, ctf_score, ctf_start, ctf_submit | Wrappers over CVE-CIRCL, MITRE, CTFd API. |
| **Finance / markets (~12)** | stock_screener, stock_compare, paper_trade, backtest_strategy, market_analysis, market_briefing, market_sentiment, portfolio_rebalance, portfolio_review, technical_analysis, trade_reasoning, price_alert | Wrappers over yfinance, Alpha Vantage, CoinGecko. Forge spec. |
| **Wallet / web3 (~11)** | wallet_balance, wallet_history, wallet_list, wallet_send, wallet_setup, wallet_switch, wallet_tokens, swap_execute, swap_quote, token_search, whale_tracker | Keep as forge recipes — most users don't hold crypto. Security-sensitive anyway. |
| **Gamedev (~14)** | game_audio, game_build, game_config, game_test, scaffold_game, level_generate, ecs_generate, navmesh_config, netcode_scaffold, shader_debug, shader_generate, physics_setup, mesh_generate, particle_system, vex_generate | Specialist domain. Forge on demand. |
| **VFX / media (~4)** | ffmpeg_process, imagemagick, latex_render, blender_run | Shell wrappers — forge spec is trivial. |
| **Training ML (~8)** | train_cost, train_deploy, train_evaluate, train_export, train_prepare, train_start, train_status, train_validate | Specialist. Forge. |
| **Research wrappers (~10)** | arxiv_search, semantic_scholar, pubmed_search, doi_lookup, open_access_find, preprint_tracker, hf_search, hf_datasets, papers_search, cargo_search, cran_search, pypi_search, pypi_info | All are `url_fetch` + JSON parse. Forge specs in `skills/research.yaml`. |
| **Composio (~4)** | composio_connect, composio_execute, composio_list_apps, composio_search | External integration — forge if user adopts it. |
| **Notebook research (~13)** | notebook_cite, notebook_create, notebook_delete, notebook_edit, notebook_export, notebook_insert, notebook_list, notebook_log, notebook_provenance, notebook_read, notebook_search, notebook_view, reproducibility_check | Niche research-workflow tooling; most users use markdown files. Forge. |

**Subtotal forged**: ~180 tools. Each should ship as a YAML spec in `skills/` or `registry/forge-specs/` so `forge_search` finds them instantly.

### CUT — 400 tools removed with no replacement

The long tail. Either duplicate, speculative, never-invoked, or replaceable by `url_fetch` + `kbot_bash`.

| Group | Tool list (abbreviated) | Rationale |
|---|---|---|
| **"Engine" bloat (~30)** | narrative_history, narrative_lore, evolution_force, evolution_status, evolve_design, coordination_queue, coordination_status, blackboard_read, blackboard_write, connect_minds, content_calendar, content_create, content_publish, prompt_analyze, model_compare, research_gap_finder, literature_review, research_now, research_queue, research_results, hypothesis_generate, hypothesis_test, emerge, synthesize_across, cross_domain_search, frontier_news, stream_intelligence, stream_brain | Zero user signal. "Engines" are a documentation pattern, not a tool pattern. Their functionality is reproducible with 2-3 prompt steps. |
| **Stream ecosystem duplicates (~60)** | All stream-* beyond a canonical stream_status + stream_start + stream_stop + stream_chat_send: stream_announce, stream_ban, stream_category, stream_dashboard, stream_followers, stream_info, stream_marker, stream_scene, stream_setup_oauth, stream_title, stream_viewers, stream_clip, overlay_alert, overlay_goal, overlay_highlight, overlay_ticker, weather_set, weather_status, weather_forecast, chat_ai_memory, chat_ai_mode, chat_ai_status, stream_chat_settings, vod_clip, vod_highlights, vod_start, vod_status, vod_stop, vod_upload, commands_inventory, commands_leaderboard, commands_list, commands_stats, stream_eval, stream_eval_config, stream_eval_history, ghost_avatar, ghost_install, ghost_join, ghost_leave, ghost_skills, ghost_status, ghost_voice, tile_world_info, tile_world_reset, tilemap_generate, audio_visualize | The streaming system is a separate product. Pull it into its own daemon/package. Keep 4 tools in kbot if at all. |
| **Buddy / dream / ghost (~20)** | buddy_achievements, buddy_leaderboard, buddy_personality, buddy_rename, buddy_status, growth_milestones, growth_summary, dream, dream_now, dream_journal, dream_reinforce, dream_search, dream_status, collective_dream_optin, collective_dream_status, memory_scan_status, memory_scan_toggle, behavior_snapshot, behavior_summary | Speculative UX layer. Runs in the daemon; agent doesn't need tool-level access. |
| **Duplicate memory/graph (~11)** | graph_add, graph_add_entity, graph_add_relation, graph_connect, graph_context, graph_cross_domain, graph_enrich, graph_export, graph_query, graph_view, graph_visualize | The 11-tool graph memory API is overengineered. Knowledge lives better in files + grep. `memory_recall/save` covers the rest. |
| **Duplicate social (~8)** | social_post, social_setup, social_status, social_stats, social_thread, social_health, social_pulse, social_viewers | **Pick one canonical `social_post` (forged).** Everything else is a variation a prompt can encode. |
| **Mobile / iPhone (~22)** | All mobile_* + phone_* | Mobile automation is flaky and used by ~0 users. If needed, wrap via Shortcuts MCP. |
| **Science-graph / emergent / foundation (~5)** | science_graph, emerge, connect_minds, blackboard_*, foundation_* | Vague "emergent intelligence" tools with no concrete contract. |
| **Image / creative wrappers (~8)** | comfyui_generate, comfyui_img2img, comfyui_list_models, comfyui_queue, comfyui_status, magenta_continue, magenta_drumify, magenta_harmonize, magenta_interpolate, generate_art, generate_svg, generate_shader, color_palette, image_variation, texture_generate, sprite_pack, render_chart, render_diagram, render_diff, render_table, viz_codegen | ComfyUI is a separate daemon. Magenta is deprecated by ableton tools. Rendering is `kbot_bash` + imagemagick. Move to FORGE for ones worth keeping. |
| **Idempotency / watchdog / schedule (~5)** | idempotency_check, idempotency_checker, watchdog, schedule_persistence, estimation | Infrastructure, not a tool the agent invokes. Move to internal middleware. |
| **Pentest workflow (~5)** | pentest_recon, pentest_report, pentest_start, pentest_status, pentest_vuln_scan | Workflow orchestration for a tiny user segment. Forge it if needed. |
| **Red/blue workflow (~5)** | redteam_report, redteam_scan, blueteam_checklist, blueteam_harden, killchain_analyze | Same reasoning as pentest — workflow wrappers. |
| **Training (~8)** | All train_* | Niche ML training flow. Forge. |
| **Bootstrap / contribute (~6)** | bootstrap_analyze, bootstrap_repo, find_issues, find_quick_wins, prepare_contribution, submit_contribution | Agent-driven PR flow. These are 10-line prompts masquerading as tools. |
| **Ghost / skill / identity (~10)** | skill_manage, skill_profile, identity, identity_opinion, teach, question, meta_plan, reflect, judge, motivation, anticipate | Metacognition tools with no measurable signal. |
| **Deploy duplicates (~6)** | deploy_all, deploy_env, deploy_logs, deploy_rollback, deploy_status | Collapse into a single `deploy` + `kbot_bash` or `gh` CLI. |
| **DB admin (~8)** | db_diagram, db_migrate, db_seed, prisma_generate, prisma_introspect, prisma_migrate, terraform_plan | Shell wrappers. Forge. |
| **Monitor duplicates (~8)** | gpu_status, disk_health, drives, network_check, network_info, process_top, service_restart, service_status, system_health, system_profile, platform_uptime | One `system_profile` suffices; the rest are one-liners. Forge. |
| **Financial analysis layer (~8)** | market_analysis, market_briefing, market_data, market_sentiment, portfolio_rebalance, portfolio_review, technical_analysis, trade_reasoning | Forge spec per function. None are core. |
| **Composio / marketplace redundant (~6)** | composio_connect/execute/list/search, marketplace_install, marketplace_search | Covered by `mcp_search` + `mcp_install`. |
| **Email duplicates (~5)** | email_announce, email_digest, email_distribute, email_security_alert, email_send | One `email_send` via forge. Kill the rest. |
| **A2A protocol (~6)** | a2a_card, a2a_discover, a2a_list, a2a_remove, a2a_send, a2a_status | No known user. The A2A protocol is still in draft. Forge if/when adopted. |
| **Stream-character + tile-world (~6)** | ghost_*, tile_world_*, living_world | Game-like world state. Move to its own product package. |
| **Ctf (~5)** | ctf_hint, ctf_list, ctf_score, ctf_start, ctf_submit | CTFd API wrapper — forge. |
| **Narrative + foundation + evolution + coordination engine (~15)** | All "*-engine" register functions | These are the biggest source of confusion; each adds 2-5 tools that overlap the research/task/agent primitives. Hard delete. |
| **Visa / payments / finance noise (~5)** | generate_invoice, visa_payments registrations | One-off integrations. |
| **LSP (~7)** | lsp_completions, lsp_diagnostics, lsp_find_references, lsp_goto_definition, lsp_hover, lsp_rename, lsp_symbols | LSP is available via Claude Code's built-in LSP tool. Local kbot doesn't need its own. Forge if user runs headless. |
| **Misc zero-signal (~20)** | effort_estimate, analytics_github, analytics_npm, audit/repo_audit duplicates, confidence_check, bias_check, voting_system, anomaly_detect, historical_timeline, formal_logic, game_theory_solve, discourse_analyze, learning_analytics, learning_model, corpus_analyze, archival_search, ethics_framework, philosophical_concept, generate_report, crypto_news, defi_yields, crypto_tool, stock_search | Scattered specialized wrappers with near-zero hit rate. All forge-spec reproducible. |

**Subtotal cut**: ~400 tools.

---

## Constraints to respect (re-stated, do NOT cut)

Copy for verification during execution:

- [x] All `ableton_*` tools (22 of them) — confirmed in KEEP
- [x] `kbot_control` — confirmed in KEEP
- [x] `serum2_preset` — confirmed in KEEP
- [x] All file/bash/grep/glob primitives — confirmed in KEEP
- [x] `web_search`, `url_fetch` — confirmed in KEEP
- [x] Music production stack (drum rack, midi, sample, plugin load) — confirmed in KEEP

---

## Aggressive cut candidates (spicy takes)

### lab-* — axe almost all
Every `lab-*` tool is a thin wrapper over a public API. `url_fetch` handles the HTTP; the agent can format the query and parse the JSON itself. The only reason to keep a tool registered is if the call is:
1. High-frequency (>5% of sessions), AND
2. Has a non-obvious transform step that the agent would get wrong without help.

Almost nothing in `lab-*` meets that bar. **Keep zero from lab-chem, lab-physics, lab-earth, lab-neuro, lab-social, lab-humanities, lab-health, lab-math.** Move them all to forge specs in `skills/science.yaml`. `lab-bio` keeps 0. `lab-data` keeps 0 (stats are a `pip_run` away). `lab-core` keeps 0 (`research_methodology`, `formula_solve`, `unit_convert` are all better as inline prompts).

### Social — collapse to one tool
Six social tools is five too many. The delta between `social_post`, `social_thread`, `social_pulse`, `social_viewers`, `social_health`, `social_stats` is param-level. **Keep zero in the core registry; forge one `social_post` from `skills/social.yaml`** that takes `{platform, kind: post|thread|reply, text}`.

### Stream ecosystem — excise as a subsystem
Fourteen stream-* files and ~60 tools for a feature that runs from the `tools/kbot-social-daemon.ts` + `tools/kbot-discovery-daemon.ts`. The agent doesn't drive streams in real time; the daemon does. **Move the entire streaming surface out of `packages/kbot/src/tools/` into `tools/streaming-daemon/`.** If a user wants to invoke it from an agent session, they can via `kbot_bash`.

### Memory/graph — collapse
The graph memory API (`graph_add_entity`, `graph_add_relation`, `graph_query`, etc.) is 11 tools pretending to be a knowledge graph. In practice, notes live in `SCRATCHPAD.md` and `~/.kbot/memory/`, which are file + grep primitives. **Cut all graph_*. Keep `memory_recall` and `memory_save` (with a `kind: graph|note|fact` param).**

### "Engine" files — delete as a category
`narrative-engine`, `evolution-engine`, `coordination-engine`, `foundation-engines`, `research-engine`, `content-engine`, `sprite-engine`, `rom-engine`, `audio-engine`, `social-engine`, `hypothesis-engine`, `arrangement-engine`, `producer-engine`, `stream-brain` — these are organizational sins, not capabilities. Each was spun up because a sub-project felt important. The capabilities worth keeping (e.g. `produce_track`, `design_sound`) survive in KEEP; the rest go.

### Dream / buddy / ghost — daemon-only
These belong in the background daemon, not the agent tool registry. The agent doesn't need to poke dream state during normal use. If a user explicitly asks "what's the buddy status?", `kbot_bash` runs `npm run buddy:status`. **Delete all buddy_*, dream_*, ghost_*, collective_dream_*, memory_scan_*.**

### Mobile/iPhone — no evidence of use
22 mobile/phone tools and no user has filed a mobile issue. Cut.

### Redundant research wrappers
`arxiv_search`, `semantic_scholar`, `hf_search`, `pypi_info`, `papers_search`, `doi_lookup`, `open_access_find`, `preprint_tracker`, `literature_search`, `literature_review` — all `url_fetch` + regex. One forge spec.

### Training (`train_*`) — niche
Eight train_* tools for ML pipeline orchestration. If a user runs ML training, they use `modal`, `sky`, or a notebook — not kbot. Forge.

### Duplicate idempotency files
`idempotency-check.ts` AND `idempotency-checker.ts` both exist. This is literally a typo-split of the same feature. Cut both — move the logic to middleware.

---

## Target

**52 core primitives** resident in the registry, with `forge_tool` + ~180 pre-written forge specs covering the long tail. The rest (400) are cut.

Counts per category (after curation):

| Category | Count |
|---|---|
| File primitives | 6 |
| Bash / exec | 3 (kbot_bash, background_run, sandbox_run) |
| Git | 6 |
| Search / fetch | 4 (web_search, url_fetch, kbot_grep, regex_extract) |
| GitHub | 4 |
| MCP | 5 |
| Agent / matrix | 5 |
| Tasks | 5 |
| Memory | 3 |
| Quality / dev | 3 |
| Worktree | 5 |
| Safety (checkpoint) | 2 |
| Music production (protected) | 28 (22 ableton + kbot_control + serum2_preset + dj_set_build + dj_set_info + produce_track + generate_music_pattern) |
| Forge / meta | 3 (forge_tool, forge_search, create_agent) |
| Local AI | 1 (kbot_local_ask) |
| **Total** | **~83 with music-protection; ~52 if music collapses further** |

*Note*: The 28-tool ableton surface is protected. The rest of the design lands at ~52 non-music primitives, ~80 total with music. That's still a 87% reduction from 670.

---

## Migration Path (what do users do instead?)

For every CUT tool, the alternative must be explicit:

| Cut tool group | Replacement pattern |
|---|---|
| `lab-*` science wrappers | `url_fetch` + forge spec in `skills/science.yaml`. Example: `forge_tool({ ref: 'arxiv_search' })` pulls the recipe. |
| `hacker-toolkit.ts` | `kbot_bash` with the underlying binary (nmap, dig, openssl). |
| `threat-intel.ts` | `url_fetch` against CIRCL / MITRE / NVD JSON. |
| `stream-*` | Run the streaming daemon directly: `npm run stream:start`. Agent doesn't touch it. |
| `mobile_*`, `phone_*` | Use iOS Shortcuts via an MCP integration when that arrives. No substitute in 3.60.x. **Capability removed.** |
| `graph_*` | `memory_save({ kind: 'graph', ... })` + `memory_recall({ kind: 'graph' })`. |
| `buddy_*`, `dream_*`, `ghost_*`, `collective_dream_*` | Daemon-side only. Users interact via `npm run daemon:*` or the web companion. |
| `social_*` (5 dups) | One forged `social_post({ platform, kind, text })`. |
| `*-engine` tools | The matrix agent (`create_agent` + a system prompt) covers any "engine" workflow. |
| `train_*` | Forge spec wrapping Modal / SkyPilot CLI. |
| `ctf_*`, `pentest_*`, `redblue_*` workflows | `kbot_bash` + a prompt describing the workflow. Workflow-level tools buy nothing over a prompt. |
| `vfx.ts` (ffmpeg/imagemagick) | `kbot_bash "ffmpeg ..."`. Capability preserved via shell. |
| `lsp_*` | Claude Code's built-in LSP tool in IDE sessions. For kbot CLI: forge if needed. |
| `composio_*` | `mcp_search composio` + standard MCP flow. |
| `a2a_*` | Forge when A2A protocol is released (currently draft). |
| `db_*`, `prisma_*`, `terraform_*` | `kbot_bash` + the underlying CLI. |
| `monitor.ts` (gpu_status, disk_health, etc.) | `kbot_bash` + `df`, `nvidia-smi`, `top`. |
| `content_*`, `email_*` duplicates | Forge one `email_send` spec. Web companion handles announcements. |
| Research notebook (13 tools) | Markdown files + git. Capability preserved via files.ts. |
| Duplicate `kbot_local_*` specializations | `kbot_local_ask` with a prompt template. |
| `analytics_github`, `analytics_npm` | `url_fetch` the GitHub Stats and npm download APIs. |
| `financial-analysis.ts` (8 tools) | Forge specs against yfinance / Alpha Vantage. |
| `wallet.ts` (11 tools) | Forge; sensitive enough that explicit invocation is preferable. |

---

## Risk List — top 10 cuts most likely to break existing users

Ranked by risk:

| # | Cut | Risk | Mitigation |
|---|---|---|---|
| 1 | **All `research_*` / `literature_*` tools** | HIGH. The `research` command is advertised in README and was demo'd in the daemon. Cutting breaks researcher-agent workflows. | Keep `research` (single top-level tool) that internally uses `url_fetch` + forge specs. Ship migration guide. |
| 2 | **All `graph_*` memory tools** | HIGH. Convergence system in web companion references graph API; removing silently breaks the session-long memory story. | Preserve the graph-memory internal engine; remove only the tool surface. Swap calls to `memory_save({kind:'graph'})`. |
| 3 | **`stream_*` family** | HIGH. Streaming daemon and `tools/kbot-social-daemon.ts` invoke these names. Cutting requires a coordinated daemon refactor. | Do the daemon refactor in the same PR or gate behind a feature flag. |
| 4 | **`social_*` consolidation** | MEDIUM. Social daemon posts via `social_post`. Other variants may be scripted in crontabs. | Keep `social_post` as an alias that accepts all prior param shapes. |
| 5 | **`mcp_list_*` / `mcp_servers` collapse** | MEDIUM. These names appear in docs and in the MCP README. Renaming breaks copy-paste. | Add thin aliases that forward to `mcp_list({kind})` for 2-3 versions. |
| 6 | **`lsp_*` tools** | MEDIUM. IDE bridge (`packages/kbot/src/ide/`) exposes these to editors. Cutting kills the headless kbot-as-LSP flow. | Keep `lsp_*` in the IDE entry-point but hide from agent-tool registry. |
| 7 | **`dream_*` / `buddy_*`** | MEDIUM. The dream engine (v3.63.0) is featured in release notes. HN post advertised it. Users may poke `dream_status`. | Expose via `kbot dream` CLI subcommand; remove only from agent-tool surface. |
| 8 | **`docker_*` collapse into `docker_run`** | MEDIUM. Docker workflows in CI scripts may invoke specific names. | Keep aliases for one major version. |
| 9 | **`pubmed_search`, `arxiv_search`, `hf_search`** | MEDIUM. Researcher agent README lists these by name. | Forge-spec + alias. |
| 10 | **`ctf_*`, `pentest_*`** | LOW-MEDIUM. Security community may use. | Ship forge specs + CHANGELOG note. |

---

## Execution plan (for whoever implements this)

1. **Phase 1 — ship the forge spec system** (no tool deletion yet). Author `skills/*.yaml` for the 180 FORGE candidates. Make `forge_search` able to resolve them instantly.
2. **Phase 2 — tag tools in `index.ts`** with a `deprecated: true` flag and a `replacement` field. Log a soft warning on invocation.
3. **Phase 3 — collapse MERGE groups behind aliases**. Add polymorphic params to the surviving tool; keep old names as thin shims.
4. **Phase 4 — watch telemetry for 2 weeks**. Use the existing `getToolMetrics()` telemetry. Any tool with zero calls from non-daemon sessions is safe to cut.
5. **Phase 5 — hard-delete CUT tools**, bump to v4.0.0, ship migration guide. Announce on HN + npm README.
6. **Phase 6 — publish a leaderboard** of what got cut and what the forge-spec equivalent is, so community users can re-forge anything we missed.

---

## Report (TL;DR for the caller)

- **Final counts**: **KEEP 52** · **MERGE 38** → 12 canonical shims · **FORGE 180** · **CUT 400**. Registry drops from ~670 → ~52 (or ~80 counting the protected music surface).
- **Top 5 riskiest cuts**:
  1. `research_*` + `literature_*` (advertised in README, demo'd in daemon)
  2. `graph_*` memory (wired into Convergence in the web companion)
  3. `stream_*` family (streaming + social daemons import these names)
  4. `social_*` consolidation (crontabs + daemons call specific variants)
  5. `lsp_*` (IDE bridge surface)
- **Meta-pattern**: The bloat is entirely the **"engine" / "lab" taxonomy reflex**. Every domain (narrative, evolution, coordination, research, content, audio, sprite, rom, producer, arrangement, streaming) got its own "engine" file with 5-20 overlapping tools. Every science subject (bio, chem, physics, neuro, earth, social, humanities, health, math, data) got its own "lab-*" wrapper file, each 10-15 tools over a single public API. **The fix is not smaller engines — it's no engines.** One matrix agent + one `forge_tool` replaces every engine and every lab file. That's Suno's end-to-end simplicity lesson in one sentence: a single strong primitive (the agent + forge_tool) beats a hierarchy of domain-specific primitives.
