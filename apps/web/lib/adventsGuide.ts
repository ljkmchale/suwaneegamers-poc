import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";

export type GuideSubjectKind = "location" | "business";

export interface GuideReview {
  id: string;
  subjectId: string;
  characterName: string;
  rating: number;
  comment: string;
  createdAt: string;
  updatedAt: string;
  isMine: boolean;
}

export interface GuideSubject {
  id: string;
  kind: GuideSubjectKind;
  mapLocationId: string;
  parentSubjectId?: string;
  name: string;
  averageRating: number | null;
  reviewCount: number;
  reviews: GuideReview[];
}

interface SubjectRow {
  id: string;
  kind: GuideSubjectKind;
  map_location_id: string;
  parent_subject_id: string | null;
  name: string;
  average_rating: number | null;
  review_count: number;
}

function normalizeLocationId(value: string): string {
  const id = value.trim().toLowerCase();
  if (!/^[a-z0-9][a-z0-9-]{0,99}$/.test(id)) throw new Error("Invalid map location.");
  return id;
}

function normalizeName(value: string, label: string): string {
  const name = value.replace(/\s+/g, " ").trim();
  if (name.length < 2 || name.length > 100) throw new Error(`${label} must be 2–100 characters.`);
  return name;
}

function subjectId(kind: GuideSubjectKind, locationId: string, name: string): string {
  const suffix = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
  return kind === "location" ? `location:${locationId}` : `business:${locationId}:${suffix}`;
}

export function ensureLocationSubject(locationIdInput: string, locationNameInput: string): string {
  const locationId = normalizeLocationId(locationIdInput);
  const name = normalizeName(locationNameInput, "Location name");
  const id = subjectId("location", locationId, name);
  const now = new Date().toISOString();
  getDb().prepare(`
    INSERT INTO advents_guide_subjects
      (id, kind, map_location_id, parent_subject_id, name, created_at, updated_at)
    VALUES (?, 'location', ?, NULL, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET name = excluded.name, updated_at = excluded.updated_at
  `).run(id, locationId, name, now, now);
  return id;
}

export function addBusiness(input: {
  locationId: string;
  locationName: string;
  businessName: string;
  userProfileId: string;
}): string {
  const locationId = normalizeLocationId(input.locationId);
  const name = normalizeName(input.businessName, "Business name");
  const parentId = ensureLocationSubject(locationId, input.locationName);
  const id = subjectId("business", locationId, name);
  const now = new Date().toISOString();
  getDb().prepare(`
    INSERT INTO advents_guide_subjects
      (id, kind, map_location_id, parent_subject_id, name, created_by_user_id, created_at, updated_at)
    VALUES (?, 'business', ?, ?, ?, ?, ?, ?)
    ON CONFLICT(map_location_id, lower(name)) WHERE kind = 'business'
    DO UPDATE SET updated_at = excluded.updated_at
  `).run(id, locationId, parentId, name, input.userProfileId, now, now);
  return id;
}

function getSubjectRows(locationIdInput: string): SubjectRow[] {
  const locationId = normalizeLocationId(locationIdInput);
  return getDb().prepare(`
    SELECT s.id, s.kind, s.map_location_id, s.parent_subject_id, s.name,
           ROUND(AVG(r.rating), 1) AS average_rating,
           COUNT(r.id) AS review_count
      FROM advents_guide_subjects s
      LEFT JOIN advents_guide_reviews r ON r.subject_id = s.id
     WHERE s.map_location_id = ?
     GROUP BY s.id
     ORDER BY CASE s.kind WHEN 'location' THEN 0 ELSE 1 END, lower(s.name)
  `).all(locationId) as SubjectRow[];
}

export function getLocationGuide(
  locationId: string,
  locationName: string,
  viewerProfileId?: string,
): { location: GuideSubject; businesses: GuideSubject[] } {
  const locationSubjectId = ensureLocationSubject(locationId, locationName);
  const rows = getSubjectRows(locationId);
  const reviewRows = getDb().prepare(`
    SELECT id, subject_id, character_name, rating, comment, created_at, updated_at, user_profile_id
      FROM advents_guide_reviews
     WHERE subject_id IN (SELECT id FROM advents_guide_subjects WHERE map_location_id = ?)
     ORDER BY updated_at DESC
  `).all(normalizeLocationId(locationId)) as Array<{
    id: string; subject_id: string; character_name: string; rating: number; comment: string;
    created_at: string; updated_at: string; user_profile_id: string;
  }>;
  const mapSubject = (row: SubjectRow): GuideSubject => ({
    id: row.id,
    kind: row.kind,
    mapLocationId: row.map_location_id,
    parentSubjectId: row.parent_subject_id ?? undefined,
    name: row.name,
    averageRating: row.average_rating,
    reviewCount: row.review_count,
    reviews: reviewRows.filter((review) => review.subject_id === row.id).map((review) => ({
      id: review.id,
      subjectId: review.subject_id,
      characterName: review.character_name,
      rating: review.rating,
      comment: review.comment,
      createdAt: review.created_at,
      updatedAt: review.updated_at,
      isMine: review.user_profile_id === viewerProfileId,
    })),
  });
  const subjects = rows.map(mapSubject);
  const location = subjects.find((subject) => subject.id === locationSubjectId);
  if (!location) throw new Error("Location guide could not be loaded.");
  return { location, businesses: subjects.filter((subject) => subject.kind === "business") };
}

export function saveReview(input: {
  subjectId: string;
  userProfileId: string;
  characterName: string;
  allowedCharacters: string[];
  rating: number;
  comment: string;
}): void {
  const characterName = normalizeName(input.characterName, "Character name");
  if (!input.allowedCharacters.includes(characterName)) throw new Error("Choose one of your assigned characters.");
  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) throw new Error("Rating must be 1–5 stars.");
  const comment = input.comment.trim();
  if (comment.length > 1200) throw new Error("Comment must be 1,200 characters or fewer.");
  const subject = getDb().prepare(`SELECT id FROM advents_guide_subjects WHERE id = ?`).get(input.subjectId);
  if (!subject) throw new Error("Review subject not found.");
  const now = new Date().toISOString();
  getDb().prepare(`
    INSERT INTO advents_guide_reviews
      (id, subject_id, user_profile_id, character_name, rating, comment, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(subject_id, user_profile_id) DO UPDATE SET
      character_name = excluded.character_name,
      rating = excluded.rating,
      comment = excluded.comment,
      updated_at = excluded.updated_at
  `).run(randomUUID(), input.subjectId, input.userProfileId, characterName, input.rating, comment, now, now);
}

export function listRatingSummaries(): Record<string, { averageRating: number; reviewCount: number }> {
  const rows = getDb().prepare(`
    SELECT s.map_location_id, ROUND(AVG(r.rating), 1) AS average_rating, COUNT(r.id) AS review_count
      FROM advents_guide_subjects s
      JOIN advents_guide_reviews r ON r.subject_id = s.id
     WHERE s.kind = 'location'
     GROUP BY s.map_location_id
  `).all() as Array<{ map_location_id: string; average_rating: number; review_count: number }>;
  return Object.fromEntries(rows.map((row) => [row.map_location_id, {
    averageRating: row.average_rating,
    reviewCount: row.review_count,
  }]));
}
