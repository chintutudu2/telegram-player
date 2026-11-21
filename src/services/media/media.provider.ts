import type {
  Media,
  MediaDetails,
  MediaListKind,
  MediaScope,
  MediaType,
} from "@/types/media";

/**
 * Contract every catalog backend implements. Adding a new source
 * (Telegram channel index, Firestore collection…) means writing one
 * object that satisfies this interface — nothing in the UI changes.
 */
export interface MediaProvider {
  readonly name: string;
  list(scope: MediaScope, kind: MediaListKind): Promise<Media[]>;
  search(query: string, scope: MediaScope): Promise<Media[]>;
  details(type: MediaType, id: string): Promise<MediaDetails | null>;
}
