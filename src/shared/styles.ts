import type { StylePreset } from "./types";

export const PRESETS: StylePreset[] = [
  {
    id: "professional",
    label: "Professional",
    description: "Formal, courteous, workplace-appropriate",
    instruction:
      "polished and professional — complete, well-formed sentences, precise " +
      "word choice, and a brief courteous opening or close where it fits; no " +
      "slang, emoji, or exclamation marks; plain business English rather than " +
      "jargon or buzzwords, and emotionally neutral rather than effusive",
  },
  {
    id: "casual",
    label: "Casual",
    description: "Relaxed, like texting a friend",
    instruction:
      "relaxed and casual, like texting a friend — contractions, short " +
      "sentences, the occasional fragment, everyday words, and no greeting or " +
      "sign-off; easygoing and matter-of-fact rather than emotionally " +
      "attentive, and friendly without teasing or flirting",
  },
  {
    id: "direct",
    label: "Direct",
    description: "Says it plainly, no softening",
    instruction:
      "direct and unsoftened — open with the answer, decision, or request, " +
      "then give only the detail that supports it; no pleasantries, " +
      'apologies, hedges ("I think", "maybe", "just"), or cushioning, and ' +
      "state disagreement or a no plainly; match the conversation's level of " +
      "formality, and stay matter-of-fact rather than curt or rude",
  },
  {
    id: "warm",
    label: "Warm",
    description: "Caring, attentive, gently softened",
    instruction:
      "warm and caring — acknowledge the other person's situation or " +
      "feelings before answering, show genuine interest or appreciation, and " +
      "soften hard news without burying it; match the conversation's level of " +
      "formality, and stay sincere and earnest rather than playful or " +
      "flirtatious",
  },
  {
    id: "flirty",
    label: "Flirty",
    description: "Playful, teasing, charming",
    instruction:
      "playful and flirty — light teasing, a compliment or playful callback, " +
      "a hint of interest in the other person, relaxed grammar, and the " +
      "occasional emoji; confident and fun rather than earnest or sentimental, " +
      "and never explicit",
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
