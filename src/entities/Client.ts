import { CLIENT_STATUS, ServiceTypes } from '../types';
import { User } from './User';

export class Client {
  constructor(
    public id: string,
    public user: User,
    public serviceNeeded: ServiceTypes,
    public requestedAt: Date,
    public updatedAt: Date,
    public status: CLIENT_STATUS,

    // Optional detailed fields from client_info
    public childrenExpected?: string,
    public pronouns?: string,
    public health_history?: string,
    public allergies?: string,
    public due_date?: Date,
    public hospital?: string,
    public baby_sex?: string,
    public annual_income?: string,
    public service_specifics?: string,
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

        // Optional detailed fields from client_info
        ...(this.childrenExpected && { childrenExpected: this.childrenExpected }),
        ...(this.pronouns && { pronouns: this.pronouns }),
        ...(this.health_history && { health_history: this.health_history }),
        ...(this.allergies && { allergies: this.allergies }),
        ...(this.due_date && { due_date: this.due_date }),
        ...(this.hospital && { hospital: this.hospital }),
        ...(this.baby_sex && { baby_sex: this.baby_sex }),
        ...(this.annual_income && { annual_income: this.annual_income }),
        ...(this.service_specifics && { service_specifics: this.service_specifics })
      }
    );
  }
}