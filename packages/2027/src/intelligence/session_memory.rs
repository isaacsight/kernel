//! Session Memory: JSON file-backed user preference learning.
//!
//! Stores learned preferences at `~/.2027/memory.json`.
//! No SQLite — just serde-free manual JSON parsing/writing.
//! All operations are infallible; failures silently return defaults.

use std::collections::HashMap;

/// The persistent memory store.
#[derive(Debug, Clone)]
pub struct SessionMemory {
    /// Running average of filter cutoff settings (0.0-1.0 normalized).
    pub preferred_brightness: f32,
    /// Running average of LFO depth (0.0-1.0).
    pub preferred_movement: f32,
    /// Most-used oscillator type (0=WT, 1=FM, 2=Granular).
    pub preferred_engine: i32,
    /// Most-used drum genre name.
    pub genre_tendency: String,
    /// How many times the plugin has been loaded.
    pub session_count: u32,
    /// Last 10 patch descriptions that were held for >30 seconds.
    pub favorite_patches: Vec<String>,
    /// Per-hour average brightness (hour 0-23 → avg cutoff).
    pub time_of_day_brightness: HashMap<u8, f32>,

    // --- Internal tracking (not persisted directly) ---
    /// Count of brightness samples in the running average.
    brightness_samples: u32,
    /// Count of movement samples in the running average.
    movement_samples: u32,
    /// Osc type usage counts: [wavetable, fm, granular].
    engine_counts: [u32; 3],
    /// Genre usage counts.
    genre_counts: HashMap<String, u32>,
    /// Time-of-day sample counts per hour.
    tod_samples: HashMap<u8, u32>,

    /// Whether data has changed since last save.
    dirty: bool,
}

impl Default for SessionMemory {
    fn default() -> Self {
        Self {
            preferred_brightness: 0.5,
            preferred_movement: 0.0,
            preferred_engine: 0,
            genre_tendency: String::new(),
            session_count: 0,
            favorite_patches: Vec::new(),
            time_of_day_brightness: HashMap::new(),
            brightness_samples: 1,
            movement_samples: 1,
            engine_counts: [1, 0, 0],
            genre_counts: HashMap::new(),
            tod_samples: HashMap::new(),
            dirty: false,
        }
    }
}

impl SessionMemory {
    /// Load memory from `~/.2027/memory.json`. Returns defaults on any failure.
    pub fn load() -> Self {
        let path = match memory_path() {
            Some(p) => p,
            None => return Self::default(),
        };

        let contents = match std::fs::read_to_string(&path) {
            Ok(c) => c,
            Err(_) => return Self::default(),
        };

        parse_memory_json(&contents).unwrap_or_default()
    }

    /// Save memory to `~/.2027/memory.json`. Silently ignores errors.
    pub fn save(&mut self) {
        if !self.dirty {
            return;
        }

        let path = match memory_path() {
            Some(p) => p,
            None => return,
        };

        // Ensure directory exists
        if let Some(parent) = std::path::Path::new(&path).parent() {
            let _ = std::fs::create_dir_all(parent);
        }

        let json = self.to_json();
        let _ = std::fs::write(&path, json);
        self.dirty = false;
    }

    /// Record a parameter snapshot (call periodically during use, ~every 5 seconds).
    ///
    /// - `cutoff_norm`: filter cutoff normalized 0-1
    /// - `lfo_depth`: LFO depth 0-1
    /// - `osc_mode`: oscillator mode (0/1/2)
    /// - `hour`: current hour 0-23 (for circadian learning)
    pub fn record_parameter_snapshot(
        &mut self,
        cutoff_norm: f32,
        lfo_depth: f32,
        osc_mode: i32,
        hour: u8,
    ) {
        // Running average for brightness
        self.brightness_samples += 1;
        let n = self.brightness_samples as f32;
        self.preferred_brightness += (cutoff_norm - self.preferred_brightness) / n;

        // Running average for movement
        self.movement_samples += 1;
        let m = self.movement_samples as f32;
        self.preferred_movement += (lfo_depth - self.preferred_movement) / m;

        // Engine usage counting
        let idx = (osc_mode as usize).min(2);
        self.engine_counts[idx] += 1;
        self.preferred_engine = self
            .engine_counts
            .iter()
            .enumerate()
            .max_by_key(|(_, &c)| c)
            .map(|(i, _)| i as i32)
            .unwrap_or(0);

        // Time-of-day brightness
        let hour = hour.min(23);
        let tod_count = self.tod_samples.entry(hour).or_insert(0);
        *tod_count += 1;
        let tc = *tod_count as f32;
        let entry = self.time_of_day_brightness.entry(hour).or_insert(0.5);
        *entry += (cutoff_norm - *entry) / tc;

        self.dirty = true;
    }

    /// Record a drum genre usage.
    pub fn record_genre(&mut self, genre: &str) {
        let count = self.genre_counts.entry(genre.to_string()).or_insert(0);
        *count += 1;

        // Update genre_tendency to most-used
        if let Some((best, _)) = self.genre_counts.iter().max_by_key(|(_, &v)| v) {
            self.genre_tendency = best.clone();
        }

        self.dirty = true;
    }

    /// Record a favorite patch (held >30 seconds). Keeps last 10.
    pub fn record_favorite_patch(&mut self, description: &str) {
        self.favorite_patches.push(description.to_string());
        if self.favorite_patches.len() > 10 {
            self.favorite_patches.remove(0);
        }
        self.dirty = true;
    }

    /// Increment session count (call once on plugin initialize).
    pub fn begin_session(&mut self) {
        self.session_count += 1;
        self.dirty = true;
    }

    /// Suggest initial patch parameters based on learned preferences.
    ///
    /// Returns (cutoff_norm, lfo_depth, osc_mode) suitable for setting
    /// initial parameters on a new session.
    pub fn suggest_initial_patch(&self, hour: u8) -> (f32, f32, i32) {
        // Use time-of-day brightness if we have data for this hour,
        // otherwise fall back to overall preference
        let brightness = self
            .time_of_day_brightness
            .get(&hour.min(23))
            .copied()
            .unwrap_or(self.preferred_brightness);

        (brightness, self.preferred_movement, self.preferred_engine)
    }

    /// Retrieve a learned preference by key name.
    pub fn get_preference(&self, key: &str) -> Option<f32> {
        match key {
            "brightness" => Some(self.preferred_brightness),
            "movement" => Some(self.preferred_movement),
            "engine" => Some(self.preferred_engine as f32),
            "session_count" => Some(self.session_count as f32),
            _ => None,
        }
    }

    // -----------------------------------------------------------------------
    // JSON serialization (manual, no serde dependency)
    // -----------------------------------------------------------------------

    fn to_json(&self) -> String {
        let mut s = String::with_capacity(2048);
        s.push_str("{\n");
        s.push_str(&format!(
            "  \"preferred_brightness\": {},\n",
            self.preferred_brightness
        ));
        s.push_str(&format!(
            "  \"preferred_movement\": {},\n",
            self.preferred_movement
        ));
        s.push_str(&format!(
            "  \"preferred_engine\": {},\n",
            self.preferred_engine
        ));
        s.push_str(&format!(
            "  \"genre_tendency\": \"{}\",\n",
            escape_json_string(&self.genre_tendency)
        ));
        s.push_str(&format!("  \"session_count\": {},\n", self.session_count));
        s.push_str(&format!(
            "  \"brightness_samples\": {},\n",
            self.brightness_samples
        ));
        s.push_str(&format!(
            "  \"movement_samples\": {},\n",
            self.movement_samples
        ));

        // Engine counts
        s.push_str(&format!(
            "  \"engine_counts\": [{}, {}, {}],\n",
            self.engine_counts[0], self.engine_counts[1], self.engine_counts[2]
        ));

        // Favorite patches
        s.push_str("  \"favorite_patches\": [");
        for (i, patch) in self.favorite_patches.iter().enumerate() {
            if i > 0 {
                s.push_str(", ");
            }
            s.push_str(&format!("\"{}\"", escape_json_string(patch)));
        }
        s.push_str("],\n");

        // Time of day brightness
        s.push_str("  \"time_of_day_brightness\": {");
        let mut first = true;
        let mut hours: Vec<_> = self.time_of_day_brightness.keys().collect();
        hours.sort();
        for hour in hours {
            if let Some(val) = self.time_of_day_brightness.get(hour) {
                if !first {
                    s.push_str(", ");
                }
                s.push_str(&format!("\"{}\": {}", hour, val));
                first = false;
            }
        }
        s.push_str("},\n");

        // Time of day sample counts
        s.push_str("  \"tod_samples\": {");
        first = true;
        let mut hours: Vec<_> = self.tod_samples.keys().collect();
        hours.sort();
        for hour in hours {
            if let Some(val) = self.tod_samples.get(hour) {
                if !first {
                    s.push_str(", ");
                }
                s.push_str(&format!("\"{}\": {}", hour, val));
                first = false;
            }
        }
        s.push_str("},\n");

        // Genre counts
        s.push_str("  \"genre_counts\": {");
        first = true;
        let mut genres: Vec<_> = self.genre_counts.keys().collect();
        genres.sort();
        for genre in genres {
            if let Some(val) = self.genre_counts.get(genre) {
                if !first {
                    s.push_str(", ");
                }
                s.push_str(&format!("\"{}\":{}", escape_json_string(genre), val));
                first = false;
            }
        }
        s.push_str("}\n");

        s.push_str("}\n");
        s
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Get the memory file path: `~/.2027/memory.json`.
fn memory_path() -> Option<String> {
    std::env::var("HOME").ok().map(|home| {
        format!("{}/.2027/memory.json", home)
    })
}

/// Minimal JSON string escaping.
fn escape_json_string(s: &str) -> String {
    s.replace('\\', "\\\\")
        .replace('"', "\\\"")
        .replace('\n', "\\n")
        .replace('\r', "\\r")
        .replace('\t', "\\t")
}

/// Parse the memory JSON file (manual parser, no serde).
fn parse_memory_json(json: &str) -> Option<SessionMemory> {
    let mut mem = SessionMemory::default();

    mem.preferred_brightness = extract_f32(json, "preferred_brightness").unwrap_or(0.5);
    mem.preferred_movement = extract_f32(json, "preferred_movement").unwrap_or(0.0);
    mem.preferred_engine = extract_f32(json, "preferred_engine").unwrap_or(0.0) as i32;
    mem.genre_tendency = extract_string(json, "genre_tendency").unwrap_or_default();
    mem.session_count = extract_f32(json, "session_count").unwrap_or(0.0) as u32;
    mem.brightness_samples = extract_f32(json, "brightness_samples").unwrap_or(1.0) as u32;
    mem.movement_samples = extract_f32(json, "movement_samples").unwrap_or(1.0) as u32;

    // Parse engine_counts array
    if let Some(arr) = extract_array(json, "engine_counts") {
        let nums: Vec<u32> = arr
            .split(',')
            .filter_map(|s| s.trim().parse::<f32>().ok().map(|f| f as u32))
            .collect();
        if nums.len() >= 3 {
            mem.engine_counts = [nums[0], nums[1], nums[2]];
        }
    }

    // Parse favorite_patches string array
    if let Some(arr) = extract_array(json, "favorite_patches") {
        mem.favorite_patches = arr
            .split('"')
            .enumerate()
            .filter_map(|(i, s)| {
                // In a JSON string array, the actual strings are at odd indices
                // between the quote delimiters after splitting on "
                if i % 2 == 1 && !s.is_empty() {
                    Some(s.to_string())
                } else {
                    None
                }
            })
            .collect();
    }

    // Parse time_of_day_brightness object
    if let Some(obj) = extract_object(json, "time_of_day_brightness") {
        mem.time_of_day_brightness = parse_num_map(&obj);
    }

    // Parse tod_samples object
    if let Some(obj) = extract_object(json, "tod_samples") {
        for (k, v) in parse_num_map(&obj) {
            mem.tod_samples.insert(k, v as u32);
        }
    }

    // Parse genre_counts object
    if let Some(obj) = extract_object(json, "genre_counts") {
        for (key, val) in parse_string_num_map(&obj) {
            mem.genre_counts.insert(key, val as u32);
        }
    }

    Some(mem)
}

/// Extract a float value for a given key from JSON text.
fn extract_f32(json: &str, key: &str) -> Option<f32> {
    let pattern = format!("\"{}\"", key);
    let idx = json.find(&pattern)?;
    let after = &json[idx + pattern.len()..];
    // Skip `: ` (colon + optional whitespace)
    let after = after.trim_start().strip_prefix(':')?;
    let after = after.trim_start();
    // Read until comma, brace, bracket, or newline
    let end = after
        .find(|c: char| c == ',' || c == '}' || c == ']' || c == '\n')
        .unwrap_or(after.len());
    after[..end].trim().parse::<f32>().ok()
}

/// Extract a string value for a given key from JSON text.
fn extract_string(json: &str, key: &str) -> Option<String> {
    let pattern = format!("\"{}\"", key);
    let idx = json.find(&pattern)?;
    let after = &json[idx + pattern.len()..];
    let after = after.trim_start().strip_prefix(':')?.trim_start();
    let after = after.strip_prefix('"')?;
    let end = after.find('"')?;
    Some(after[..end].to_string())
}

/// Extract the contents of an array `[...]` for a given key.
fn extract_array(json: &str, key: &str) -> Option<String> {
    let pattern = format!("\"{}\"", key);
    let idx = json.find(&pattern)?;
    let after = &json[idx + pattern.len()..];
    let start = after.find('[')?;
    let end = after[start..].find(']')?;
    Some(after[start + 1..start + end].to_string())
}

/// Extract the contents of an object `{...}` for a given key.
fn extract_object(json: &str, key: &str) -> Option<String> {
    let pattern = format!("\"{}\"", key);
    let idx = json.find(&pattern)?;
    let after = &json[idx + pattern.len()..];
    let start = after.find('{')?;
    // Find matching close brace (not nested)
    let mut depth = 0;
    for (i, ch) in after[start..].char_indices() {
        match ch {
            '{' => depth += 1,
            '}' => {
                depth -= 1;
                if depth == 0 {
                    return Some(after[start + 1..start + i].to_string());
                }
            }
            _ => {}
        }
    }
    None
}

/// Parse a `{"0": 0.5, "14": 0.7}` map into HashMap<u8, f32>.
fn parse_num_map(obj: &str) -> HashMap<u8, f32> {
    let mut map = HashMap::new();
    // Split on commas, extract "key": value pairs
    for pair in obj.split(',') {
        let pair = pair.trim();
        if pair.is_empty() {
            continue;
        }
        // Find quoted key
        let parts: Vec<&str> = pair.splitn(2, ':').collect();
        if parts.len() == 2 {
            let key = parts[0].trim().trim_matches('"');
            let val = parts[1].trim();
            if let (Ok(k), Ok(v)) = (key.parse::<u8>(), val.parse::<f32>()) {
                map.insert(k, v);
            }
        }
    }
    map
}

/// Parse a `{"trap": 5, "house": 3}` map into Vec<(String, f32)>.
fn parse_string_num_map(obj: &str) -> Vec<(String, f32)> {
    let mut result = Vec::new();
    for pair in obj.split(',') {
        let pair = pair.trim();
        if pair.is_empty() {
            continue;
        }
        let parts: Vec<&str> = pair.splitn(2, ':').collect();
        if parts.len() == 2 {
            let key = parts[0].trim().trim_matches('"').to_string();
            let val = parts[1].trim();
            if let Ok(v) = val.parse::<f32>() {
                result.push((key, v));
            }
        }
    }
    result
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_default_memory() {
        let mem = SessionMemory::default();
        assert_eq!(mem.session_count, 0);
        assert_eq!(mem.preferred_brightness, 0.5);
    }

    #[test]
    fn test_record_snapshot() {
        let mut mem = SessionMemory::default();
        mem.record_parameter_snapshot(0.8, 0.5, 1, 14);
        mem.record_parameter_snapshot(0.9, 0.6, 1, 14);
        // Brightness should drift toward 0.8-0.9
        assert!(mem.preferred_brightness > 0.5);
        // Engine should be FM (1)
        assert_eq!(mem.preferred_engine, 1);
        assert!(mem.dirty);
    }

    #[test]
    fn test_suggest_initial() {
        let mut mem = SessionMemory::default();
        // Record some night-time preferences (dark sounds)
        for _ in 0..10 {
            mem.record_parameter_snapshot(0.3, 0.2, 0, 23);
        }
        // Record some day-time preferences (bright sounds)
        for _ in 0..10 {
            mem.record_parameter_snapshot(0.8, 0.5, 0, 12);
        }
        let (night_bright, _, _) = mem.suggest_initial_patch(23);
        let (day_bright, _, _) = mem.suggest_initial_patch(12);
        assert!(day_bright > night_bright);
    }

    #[test]
    fn test_json_roundtrip() {
        let mut mem = SessionMemory::default();
        mem.record_parameter_snapshot(0.7, 0.4, 2, 10);
        mem.record_genre("trap");
        mem.record_favorite_patch("bright fm lead");
        mem.begin_session();

        let json = mem.to_json();
        let restored = parse_memory_json(&json).unwrap();
        assert_eq!(restored.session_count, mem.session_count);
        assert!((restored.preferred_brightness - mem.preferred_brightness).abs() < 0.01);
        assert_eq!(restored.favorite_patches.len(), 1);
        assert_eq!(restored.favorite_patches[0], "bright fm lead");
    }

    #[test]
    fn test_get_preference() {
        let mem = SessionMemory::default();
        assert_eq!(mem.get_preference("brightness"), Some(0.5));
        assert_eq!(mem.get_preference("nonexistent"), None);
    }
}
