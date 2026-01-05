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
    public phoneNumber?: string, // Add phone number field
    public portal_status?: string, // Portal invite status: 'not_invited', 'invited', 'active', 'disabled'
  ) {}

  toJson(): Object {
    return {
      id: this.id,
      user: this.user,
      serviceNeeded: this.serviceNeeded,
      requestedAt: this.requestedAt,
      updatedAt: this.updatedAt,
      status: this.status,

      // Always include all fields (even if null/undefined/empty) so frontend forms can display them
      childrenExpected: this.childrenExpected,
      pronouns: this.pronouns,
      health_history: this.health_history,
      allergies: this.allergies,
      due_date: this.due_date,
      hospital: this.hospital,
      baby_sex: this.baby_sex,
      annual_income: this.annual_income,
      service_specifics: this.service_specifics,
      phoneNumber: this.phoneNumber,
      portal_status: this.portal_status
    };
  }
}
