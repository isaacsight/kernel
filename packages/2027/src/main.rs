// 2027 Standalone — runs the synth without a DAW
//
// Uses nih-plug's standalone wrapper:
// - CoreAudio for audio output on macOS
// - CoreMIDI for MIDI input on macOS
//
// Usage:
//   cargo run --release --bin twenty-twenty-seven-standalone
//
// Then send MIDI from kbot or connect a MIDI controller.

fn main() {
    nih_plug::wrapper::standalone::nih_export_standalone::<twenty_twenty_seven::TwentyTwentySeven>();
}
