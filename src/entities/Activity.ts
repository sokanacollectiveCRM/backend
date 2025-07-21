export interface ActivityMetadata {
  [key: string]: any;
}

export class Activity {
  constructor(
    public id: string,
    public clientId: string,
    public type: string,
    public description?: string,
    public metadata?: ActivityMetadata,
    public timestamp: Date = new Date(),
    public createdBy?: string
  ) {}

  toJson(): Object {
    return {
      id: this.id,
      clientId: this.clientId,
      type: this.type,
      description: this.description,
      metadata: this.metadata,
      timestamp: this.timestamp,
      createdBy: this.createdBy
    };
  }
} 