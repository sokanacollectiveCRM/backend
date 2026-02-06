/**
 * CreateActivityRequestDTO - Request body shape for creating an activity.
 * Validated in controller before processing.
 */
export interface CreateActivityRequestDTO {
  activity_type: string;
  content: string;
}
