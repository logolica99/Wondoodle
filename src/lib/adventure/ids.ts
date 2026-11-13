export function newAdventureId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `adv-${crypto.randomUUID()}`;
  }
  return `adv-${Date.now()}`;
}

export function newStepId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `step-${crypto.randomUUID()}`;
  }
  return `step-${Date.now()}`;
}

export function newRevisionId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `rev-${crypto.randomUUID()}`;
  }
  return `rev-${Date.now()}`;
}

export function newEvidenceId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `ev-${crypto.randomUUID()}`;
  }
  return `ev-${Date.now()}`;
}

export function newSnapshotId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `snap-${crypto.randomUUID()}`;
  }
  return `snap-${Date.now()}`;
}
