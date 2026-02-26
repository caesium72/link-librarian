export interface Collection {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  color: string;
  icon: string;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface CollectionLink {
  id: string;
  collection_id: string;
  link_id: string;
  added_at: string;
}
