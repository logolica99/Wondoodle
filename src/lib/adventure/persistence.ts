"use client";

import { getDB } from "@/lib/canvas/storage";
import type {
  AdventureEvidence,
  AdventureRevision,
  AdventureStep,
  CanvasSnapshotRecord,
  LearningAdventure,
} from "@/types/adventure";

export async function putSnapshot(
  record: CanvasSnapshotRecord
): Promise<void> {
  const db = getDB();
  await db.canvasSnapshots.put(record);
}

export async function getSnapshot(
  id: string
): Promise<CanvasSnapshotRecord | undefined> {
  return getDB().canvasSnapshots.get(id);
}

export async function putAdventure(adventure: LearningAdventure): Promise<void> {
  await getDB().learningAdventures.put(adventure);
}

export async function getAdventure(
  id: string
): Promise<LearningAdventure | undefined> {
  return getDB().learningAdventures.get(id);
}

export async function getActiveAdventure(
  documentId?: string
): Promise<LearningAdventure | undefined> {
  const db = getDB();
  const all = await db.learningAdventures
    .where("status")
    .equals("active")
    .reverse()
    .sortBy("updatedAt");
  const match = documentId
    ? all.filter((a) => a.documentId === documentId)
    : all;
  return match.at(-1);
}

export async function listAdventures(): Promise<LearningAdventure[]> {
  return getDB().learningAdventures.orderBy("updatedAt").reverse().toArray();
}

export async function putStep(step: AdventureStep): Promise<void> {
  await getDB().adventureSteps.put(step);
}

export async function putSteps(steps: AdventureStep[]): Promise<void> {
  await getDB().adventureSteps.bulkPut(steps);
}

export async function getStepsForAdventure(
  adventureId: string
): Promise<AdventureStep[]> {
  const rows = await getDB()
    .adventureSteps.where("adventureId")
    .equals(adventureId)
    .toArray();
  return rows.sort((a, b) => a.order - b.order);
}

export async function getStep(id: string): Promise<AdventureStep | undefined> {
  return getDB().adventureSteps.get(id);
}

export async function putRevision(revision: AdventureRevision): Promise<void> {
  await getDB().adventureRevisions.put(revision);
}

export async function getRevisionsForAdventure(
  adventureId: string
): Promise<AdventureRevision[]> {
  const rows = await getDB()
    .adventureRevisions.where("adventureId")
    .equals(adventureId)
    .toArray();
  return rows.sort((a, b) => a.createdAt - b.createdAt);
}

export async function putEvidence(evidence: AdventureEvidence): Promise<void> {
  await getDB().adventureEvidence.put(evidence);
}

export async function getEvidenceForStep(
  stepId: string
): Promise<AdventureEvidence[]> {
  const rows = await getDB()
    .adventureEvidence.where("stepId")
    .equals(stepId)
    .toArray();
  return rows.sort((a, b) => a.createdAt - b.createdAt);
}
