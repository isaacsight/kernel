"""
kbot_control_surface.py — Main ControlSurface for the KBotBridge Remote Script

Exposes Ableton's Browser API over TCP so kbot can programmatically
load any native device (Saturator, EQ Eight, Compressor, etc.) onto
any track. Also provides track/device listing for introspection.

Actions:
  ping               — heartbeat
  browser_search     — search browser tree for items matching a query
  browser_load       — load a browser item by URI onto a track
  browser_load_by_name — search + load in one step
  browser_categories — list top-level browser categories
  list_tracks        — list all tracks with names and device counts
  list_devices       — list devices on a track
"""

from ableton.v2.control_surface import ControlSurface
import Live
import logging
import os
import traceback

from .tcp_server import TCPServer

logger = logging.getLogger("kbot_bridge")

# Maximum browser search depth to avoid freezing Live
MAX_SEARCH_DEPTH = 6
MAX_RESULTS = 50


class KBotControlSurface(ControlSurface):
    def __init__(self, c_instance):
        ControlSurface.__init__(self, c_instance)

        self._tcp_server = None

        try:
            self._start_logging()
            self._tcp_server = TCPServer()
            self._tcp_server.start()
            self.schedule_message(0, self._tick)
            self.show_message("KBotBridge: Listening on port 9998")
            logger.info("KBotBridge initialized")
        except Exception as e:
            self.show_message("KBotBridge: Failed to start — %s" % e)
            logger.error("KBotBridge init failed: %s" % traceback.format_exc())

    # ── Logging ───────────────────────────────────────────────────────

    def _start_logging(self):
        module_path = os.path.dirname(os.path.realpath(__file__))
        log_dir = os.path.join(module_path, "logs")
        if not os.path.exists(log_dir):
            os.mkdir(log_dir, 0o755)
        log_path = os.path.join(log_dir, "kbot_bridge.log")
        handler = logging.FileHandler(log_path)
        handler.setLevel(logging.INFO)
        formatter = logging.Formatter("(%(asctime)s) [%(levelname)s] %(message)s")
        handler.setFormatter(formatter)
        logger.addHandler(handler)
        logger.setLevel(logging.INFO)
        self._log_handler = handler

    def _stop_logging(self):
        if hasattr(self, "_log_handler"):
            logger.removeHandler(self._log_handler)

    # ── Tick loop ─────────────────────────────────────────────────────

    def _tick(self):
        """
        Called every ~100ms via schedule_message.
        Reads commands from TCP, dispatches, sends responses.
        """
        if self._tcp_server:
            try:
                commands = self._tcp_server.process()
                for cmd in commands:
                    self._dispatch(cmd)
            except Exception as e:
                logger.error("KBotBridge tick error: %s" % traceback.format_exc())
        self.schedule_message(1, self._tick)

    # ── Command dispatch ──────────────────────────────────────────────

    def _dispatch(self, cmd):
        """Route a command dict to the appropriate handler."""
        cmd_id = cmd.get("id", 0)
        action = cmd.get("action", "")

        handlers = {
            "ping": self._handle_ping,
            "browser_search": self._handle_browser_search,
            "browser_load": self._handle_browser_load,
            "browser_load_by_name": self._handle_browser_load_by_name,
            "browser_categories": self._handle_browser_categories,
            "list_tracks": self._handle_list_tracks,
            "list_devices": self._handle_list_devices,
        }

        handler = handlers.get(action)
        if handler:
            try:
                result = handler(cmd)
                result["id"] = cmd_id
                self._tcp_server.send_response(result)
            except Exception as e:
                logger.error("KBotBridge action '%s' error: %s" % (action, traceback.format_exc()))
                self._tcp_server.send_response({
                    "id": cmd_id,
                    "ok": False,
                    "error": str(e),
                })
        else:
            self._tcp_server.send_response({
                "id": cmd_id,
                "ok": False,
                "error": "Unknown action: %s" % action,
            })

    # ── Handlers ──────────────────────────────────────────────────────

    def _handle_ping(self, cmd):
        return {"ok": True, "version": "1.0.0", "service": "KBotBridge"}

    def _handle_browser_search(self, cmd):
        """
        Search the browser tree for items matching a query string.
        Params:
          query    — search string (case-insensitive substring match)
          category — instruments/audio_effects/midi_effects/drums/samples/all
        Returns:
          results  — array of {name, uri, is_loadable, is_device}
        """
        query = cmd.get("query", "").lower()
        category = cmd.get("category", "all").lower()

        if not query:
            return {"ok": False, "error": "Missing 'query' parameter"}

        browser = self.application.browser
        results = []

        roots = self._get_browser_roots(browser, category)

        for root in roots:
            self._search_recursive(root, query, results, depth=0)
            if len(results) >= MAX_RESULTS:
                break

        return {
            "ok": True,
            "results": results[:MAX_RESULTS],
            "count": len(results),
        }

    def _handle_browser_load(self, cmd):
        """
        Load a browser item onto a track.
        Params:
          track — 0-indexed track number
          uri   — the URI string from a browser_search result
        """
        track_idx = cmd.get("track", 0)
        uri = cmd.get("uri", "")

        if not uri:
            return {"ok": False, "error": "Missing 'uri' parameter"}

        song = self.song()
        tracks = list(song.tracks)

        if track_idx < 0 or track_idx >= len(tracks):
            return {"ok": False, "error": "Track index %d out of range (0-%d)" % (track_idx, len(tracks) - 1)}

        # Select the target track so browser.load_item places the device there
        song.view.selected_track = tracks[track_idx]

        # Find the item by URI
        browser = self.application.browser
        item = self._find_by_uri(browser, uri)

        if not item:
            return {"ok": False, "error": "Browser item not found for URI: %s" % uri}

        if not item.is_loadable:
            return {"ok": False, "error": "Item '%s' is not loadable" % item.name}

        browser.load_item(item)
        logger.info("Loaded '%s' onto track %d (%s)" % (item.name, track_idx, tracks[track_idx].name))

        return {
            "ok": True,
            "loaded": item.name,
            "track": track_idx,
            "track_name": tracks[track_idx].name,
        }

    def _handle_browser_load_by_name(self, cmd):
        """
        Search + load in one step. Finds the first loadable match and loads it.
        Params:
          track    — 0-indexed track number
          name     — search string
          category — instruments/audio_effects/midi_effects/drums/samples/all
        """
        track_idx = cmd.get("track", 0)
        name = cmd.get("name", "").lower()
        category = cmd.get("category", "all").lower()

        if not name:
            return {"ok": False, "error": "Missing 'name' parameter"}

        song = self.song()
        tracks = list(song.tracks)

        if track_idx < 0 or track_idx >= len(tracks):
            return {"ok": False, "error": "Track index %d out of range (0-%d)" % (track_idx, len(tracks) - 1)}

        # Select the target track
        song.view.selected_track = tracks[track_idx]

        browser = self.application.browser
        roots = self._get_browser_roots(browser, category)

        # Find first loadable match
        found = self._find_first_loadable(roots, name)

        if not found:
            return {"ok": False, "error": "No loadable item found matching '%s'" % name}

        browser.load_item(found)
        logger.info("Loaded '%s' onto track %d (%s)" % (found.name, track_idx, tracks[track_idx].name))

        return {
            "ok": True,
            "loaded": found.name,
            "track": track_idx,
            "track_name": tracks[track_idx].name,
        }

    def _handle_browser_categories(self, cmd):
        """List top-level browser categories with child counts."""
        browser = self.application.browser
        categories = []

        category_roots = [
            ("instruments", browser.instruments),
            ("audio_effects", browser.audio_effects),
            ("midi_effects", browser.midi_effects),
            ("drums", browser.drums),
            ("samples", browser.samples),
            ("packs", browser.packs),
            ("plugins", browser.plugins),
            ("max_for_live", browser.max_for_live),
        ]

        for name, root in category_roots:
            try:
                children = list(root.children)
                categories.append({
                    "name": name,
                    "display_name": root.name,
                    "child_count": len(children),
                })
            except Exception:
                categories.append({
                    "name": name,
                    "display_name": name,
                    "child_count": 0,
                })

        return {"ok": True, "categories": categories}

    def _handle_list_tracks(self, cmd):
        """List all tracks with names, types, and device counts."""
        song = self.song()
        tracks = []

        for i, track in enumerate(song.tracks):
            devices = list(track.devices) if track.devices else []
            tracks.append({
                "index": i,
                "name": track.name,
                "has_midi_input": track.has_midi_input,
                "has_audio_input": track.has_audio_input,
                "is_foldable": track.is_foldable,
                "mute": track.mute,
                "solo": track.solo,
                "arm": track.arm,
                "device_count": len(devices),
            })

        return_tracks = []
        for i, track in enumerate(song.return_tracks):
            devices = list(track.devices) if track.devices else []
            return_tracks.append({
                "index": i,
                "name": track.name,
                "device_count": len(devices),
            })

        return {
            "ok": True,
            "tracks": tracks,
            "return_tracks": return_tracks,
            "master_device_count": len(list(song.master_track.devices)),
        }

    def _handle_list_devices(self, cmd):
        """
        List devices on a track.
        Params:
          track — 0-indexed track number
        """
        track_idx = cmd.get("track", 0)
        song = self.song()
        tracks = list(song.tracks)

        if track_idx < 0 or track_idx >= len(tracks):
            return {"ok": False, "error": "Track index %d out of range (0-%d)" % (track_idx, len(tracks) - 1)}

        track = tracks[track_idx]
        devices = []

        for i, device in enumerate(track.devices):
            params = []
            for p in device.parameters:
                params.append({
                    "name": p.name,
                    "value": p.value,
                    "min": p.min,
                    "max": p.max,
                    "is_enabled": p.is_enabled,
                })
            devices.append({
                "index": i,
                "name": device.name,
                "class_name": device.class_name,
                "type": str(device.type),
                "is_active": device.is_active,
                "can_have_chains": device.can_have_chains,
                "parameter_count": len(params),
                "parameters": params,
            })

        return {
            "ok": True,
            "track": track_idx,
            "track_name": track.name,
            "devices": devices,
        }

    # ── Browser helpers ───────────────────────────────────────────────

    def _get_browser_roots(self, browser, category):
        """Get the browser root items for a given category."""
        category_map = {
            "instruments": [browser.instruments],
            "audio_effects": [browser.audio_effects],
            "midi_effects": [browser.midi_effects],
            "drums": [browser.drums],
            "samples": [browser.samples],
            "plugins": [browser.plugins],
            "max_for_live": [browser.max_for_live],
            "packs": [browser.packs],
        }

        if category in category_map:
            return category_map[category]

        # "all" — search the most useful categories
        return [
            browser.instruments,
            browser.audio_effects,
            browser.midi_effects,
            browser.drums,
            browser.plugins,
            browser.max_for_live,
        ]

    def _search_recursive(self, item, query, results, depth=0):
        """Recursively search browser items for query matches."""
        if depth > MAX_SEARCH_DEPTH or len(results) >= MAX_RESULTS:
            return

        try:
            for child in item.children:
                name_lower = child.name.lower()
                if query in name_lower:
                    results.append({
                        "name": child.name,
                        "uri": child.uri if hasattr(child, "uri") else "",
                        "is_loadable": child.is_loadable,
                        "is_device": child.is_device if hasattr(child, "is_device") else False,
                    })
                    if len(results) >= MAX_RESULTS:
                        return
                # Always recurse into children (folders, categories)
                if hasattr(child, "children"):
                    self._search_recursive(child, query, results, depth + 1)
        except Exception:
            pass

    def _find_first_loadable(self, roots, query):
        """
        Find the first loadable browser item matching the query.
        Prefers exact name matches over substring matches.
        """
        # First pass: look for exact matches
        exact = []
        partial = []

        for root in roots:
            self._collect_matches(root, query, exact, partial, depth=0)
            # If we have an exact loadable match, use it immediately
            for item in exact:
                if item.is_loadable:
                    return item

        # Second pass: return first loadable partial match
        for item in partial:
            if item.is_loadable:
                return item

        return None

    def _collect_matches(self, item, query, exact, partial, depth=0):
        """Collect exact and partial matches from the browser tree."""
        if depth > MAX_SEARCH_DEPTH:
            return
        if len(exact) + len(partial) > MAX_RESULTS:
            return

        try:
            for child in item.children:
                name_lower = child.name.lower()
                if name_lower == query:
                    exact.append(child)
                elif query in name_lower:
                    partial.append(child)
                if hasattr(child, "children"):
                    self._collect_matches(child, query, exact, partial, depth + 1)
        except Exception:
            pass

    def _find_by_uri(self, browser, uri):
        """Find a browser item by its URI string."""
        roots = [
            browser.instruments,
            browser.audio_effects,
            browser.midi_effects,
            browser.drums,
            browser.samples,
            browser.plugins,
            browser.max_for_live,
            browser.packs,
        ]

        for root in roots:
            result = self._find_uri_recursive(root, uri, depth=0)
            if result:
                return result

        return None

    def _find_uri_recursive(self, item, uri, depth=0):
        """Recursively search for an item with a matching URI."""
        if depth > MAX_SEARCH_DEPTH + 2:
            return None

        try:
            for child in item.children:
                child_uri = child.uri if hasattr(child, "uri") else ""
                if child_uri == uri:
                    return child
                if hasattr(child, "children"):
                    result = self._find_uri_recursive(child, uri, depth + 1)
                    if result:
                        return result
        except Exception:
            pass

        return None

    # ── Lifecycle ─────────────────────────────────────────────────────

    def disconnect(self):
        """Called when Live removes the control surface."""
        self.show_message("KBotBridge: Disconnecting...")
        logger.info("KBotBridge disconnecting")
        if self._tcp_server:
            self._tcp_server.shutdown()
        self._stop_logging()
        super().disconnect()
