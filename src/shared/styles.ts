import type { StylePreset } from "./types";

export const PRESETS: StylePreset[] = [
  {
    id: "professional",
    label: "Professional",
    description: "Polished, courteous, workplace-appropriate",
    instruction:
      "polished and professional — complete sentences, precise word choice, " +
      "courteous but not effusive, and no slang, emoji, or exclamation marks; " +
      "plain business English rather than jargon or buzzwords",
  },
  {
    id: "casual",
    label: "Casual",
    description: "Relaxed and conversational",
    instruction:
      "relaxed and casual — contractions, short sentences, the occasional " +
      "fragment, everyday words, and no greeting or sign-off; friendly and " +
      "light rather than affectionate or gushing",
  },
  {
    id: "direct",
    label: "Direct",
    description: "Straight to the point, no padding",
    instruction:
      "blunt and direct — lead with the point in the first sentence and then " +
      "stop, in one to three sentences with no preamble and no hedging " +
      '("I think", "maybe", "just"); matter-of-fact without tipping into curt ' +
      "or rude",
  },
  {
    id: "warm",
    label: "Warm",
    description: "Sincere and considerate",
    instruction:
      "warm and sincere — acknowledge the other person’s situation before " +
      "answering, use considerate and personal phrasing, and soften hard news " +
      "without burying it; genuine and grounded rather than flirtatious",
  },
  {
    id: "flirty",
    label: "Flirty",
    description: "Playful, teasing, charming",
    instruction:
      "playful and flirty — light teasing, a little charm, relaxed grammar, " +
      "and the occasional emoji; fun and confident rather than earnest, and " +
      "never explicit",
  },
  {
    id: "corporate",
    label: "Corporate",
    description: "Buzzword-heavy business speak",
    instruction:
      "buzzword-heavy corporate jargon — draw freely on the full vocabulary of " +
      "business speak (synergy, alignment, bandwidth, circle back, low-hanging " +
      "fruit, and stakeholder value are just a few examples; reach for whatever " +
      "other jargon fits), and happily over-explain at length, while still " +
      "clearly conveying the same underlying message",
  },
];

export const DEFAULT_PRESET_ID = PRESETS[0].id;

export function getPreset(id: string): StylePreset | undefined {
  return PRESETS.find((p) => p.id === id);
}
