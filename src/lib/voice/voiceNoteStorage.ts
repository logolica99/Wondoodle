import type { VoiceNote } from "@/types/voice";

/** Strip session-only fields before persistence. */
export function toPersistentVoiceNote(note: VoiceNote): VoiceNote {
  return {
    ...note,
    audioMimeType: null,
  };
}

export function voiceNotesWithoutAudio(
  notes: VoiceNote[] | undefined
): VoiceNote[] {
  return (notes ?? []).map(toPersistentVoiceNote);
}
