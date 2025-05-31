export enum VISIBILITY {
  PUBLIC = "public",
  PRIVATE = "private"
}

export class NOTE {
  id: string;
  content: string;
  created_by: string;
  work_log_id: string;
  visibility: VISIBILITY;
}