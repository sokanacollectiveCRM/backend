import { ACCOUNT_STATUS, ServiceTypes } from '../types';
import { User } from './User';

export class Client {
  constructor(
    public id: string,
    public user: User,
    public serviceNeeded: ServiceTypes,
    public requestedAt: Date,
    public updatedAt: Date,
    public status: ACCOUNT_STATUS, // or enum if you have one defined
  ) {}

  toJson(): Object {
    return (
      {
        id: this.id,
        user: this.user,
        serviceNeeded: this.serviceNeeded,
        requestedAt: this.requestedAt,
        updatedAt: this.updatedAt,
        status: this.status,
      }
    );
  }
}