'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.User = void 0;
const types_1 = require('../types');
class User {
  constructor(data) {
    this.id = data.id;
    this.email = data.email || '';
    this.firstname = data.firstname || '';
    this.lastname = data.lastname || '';
    this.created_at = data.created_at || new Date();
    this.updated_at = data.updated_at || new Date();
    this.role = data.role || types_1.ROLE.CLIENT;
    this.children_expected = data.children_expected || '';
    this.service_needed = data.service_needed || '';
    this.health_history = data.health_history || '';
    this.allergies = data.allergies || '';
    this.due_date = data.due_date || '';
    this.annual_income = data.annual_income || '';
    this.status = data.status || '';
    this.hospital = data.hospital || '';
    this.address = data.address || '';
    this.city = data.city || '';
    this.state = data.state || types_1.STATE.IL;
    this.country = data.country || '';
    this.zip_code = data.zip_code || -1;
    this.profile_picture = data.profile_picture || null;
    this.account_status = data.account_status || types_1.ACCOUNT_STATUS.PENDING;
    this.business = data.business || '';
    this.bio = data.bio || '';
    this.service_needed = data.service_needed || '';
  }
  getFullName() {
    return `${this.firstname} ${this.lastname}`.trim();
  }
  toJSON() {
    return {
      id: this.id,
      email: this.email,
      firstname: this.firstname,
      lastname: this.lastname,
      fullName: this.getFullName(),
      children_expected: this.children_expected,
      service_needed: this.service_needed,
      health_history: this.health_history,
      allergies: this.allergies,
      due_date: this.due_date,
      annual_income: this.annual_income,
      status: this.status,
      hospital: this.hospital,
      created_at: this.created_at,
      updatedAt: this.updated_at,
      role: this.role,
      address: this.address,
      city: this.city,
      state: this.state,
      country: this.country,
      zip_code: this.zip_code,
      profile_picture: this.profile_picture,
      account_status: this.account_status,
      business: this.business,
      bio: this.bio,
    };
  }
}
exports.User = User;
