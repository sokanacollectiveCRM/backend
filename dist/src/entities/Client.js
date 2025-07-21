"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Client = void 0;
class Client {
    constructor(id, user, serviceNeeded, requestedAt, updatedAt, status, 
    // Optional detailed fields from client_info
    childrenExpected, pronouns, health_history, allergies, due_date, hospital, baby_sex, annual_income, service_specifics, phoneNumber) {
        this.id = id;
        this.user = user;
        this.serviceNeeded = serviceNeeded;
        this.requestedAt = requestedAt;
        this.updatedAt = updatedAt;
        this.status = status;
        this.childrenExpected = childrenExpected;
        this.pronouns = pronouns;
        this.health_history = health_history;
        this.allergies = allergies;
        this.due_date = due_date;
        this.hospital = hospital;
        this.baby_sex = baby_sex;
        this.annual_income = annual_income;
        this.service_specifics = service_specifics;
        this.phoneNumber = phoneNumber;
    }
    toJson() {
        return ({
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
            ...(this.service_specifics && { service_specifics: this.service_specifics }),
            ...(this.phoneNumber && { phoneNumber: this.phoneNumber }) // Include phone number in JSON
        });
    }
}
exports.Client = Client;
