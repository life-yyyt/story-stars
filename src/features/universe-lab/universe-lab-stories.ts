export interface UniverseLabStory {
  id: string;
  starId: string;
  title: string;
  body: string;
  authorLabel: string;
  coordinateLabel: string;
  coordinateCode: string | null;
  visibility: 'public' | 'private';
  likeCount: number;
  viewCount: number;
  likedByViewer: boolean;
  isOwner: boolean;
}
