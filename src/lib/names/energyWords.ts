/**
 * Energy word lists (10 Nov 2026, accounts; for Joe's review in the PR). One adjective and one noun, then a number:
 * "SwiftVolt48" as a username suggestion now, "Swift Volt 48" as a generated guest name in rated matches (wave 3).
 *
 * Every word is chosen to be safe on its own and in any pairing: no body, size or hardness words (no Big, Hard,
 * Stiff, Wet, Hot, Rod, Pole, Ball, Nut, Bang…), nothing about violence, drink, drugs, race, religion or politics,
 * no brand or game names. names-check proves every pairing passes the word filter and the reserved list, and that
 * each list has no duplicates. Capitalised as shown; letters only.
 */

export const ENERGY_ADJECTIVES: readonly string[] = [
  "Swift", "Bright", "Rapid", "Quick", "Brisk", "Nimble", "Agile", "Keen", "Bold", "Brave",
  "Calm", "Clever", "Cosmic", "Crisp", "Daring", "Dazzling", "Eager", "Electric", "Epic", "Fearless",
  "Fleet", "Golden", "Glowing", "Grand", "Happy", "Heroic", "Jolly", "Kinetic", "Lively", "Lucky",
  "Lunar", "Magnetic", "Mighty", "Noble", "Plucky", "Polar", "Prime", "Quantum", "Radiant", "Ready",
  "Royal", "Shining", "Silver", "Sharp", "Snappy", "Solar", "Sonic", "Sparky", "Speedy", "Spry",
  "Steady", "Stellar", "Sunny", "Super", "Turbo", "Valiant", "Vivid", "Witty", "Zippy", "Zesty",
];

export const ENERGY_NOUNS: readonly string[] = [
  "Volt", "Spark", "Pulse", "Surge", "Bolt", "Comet", "Flash", "Flare", "Beam", "Dash",
  "Zap", "Zing", "Jolt", "Charge", "Current", "Circuit", "Dynamo", "Joule", "Quark", "Amp",
  "Ion", "Photon", "Proton", "Quasar", "Pulsar", "Nova", "Star", "Meteor", "Orbit", "Rocket",
  "Falcon", "Hawk", "Lynx", "Fox", "Tiger", "Panther", "Cheetah", "Hare", "Otter", "Thunder",
  "Storm", "Gale", "Breeze", "Wave", "Tide", "Ember", "Torch", "Lantern", "Beacon", "Prism",
  "Crystal", "Gem", "Glow", "Gleam", "Sprint", "Racer", "Pilot", "Ace", "Echo", "Pixel",
];
