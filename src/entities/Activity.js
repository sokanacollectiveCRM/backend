"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Activity = void 0;
class Activity {
    constructor(id, clientId, type, description, metadata, timestamp = new Date(), createdBy) {
        this.id = id;
        this.clientId = clientId;
        this.type = type;
        this.description = description;
        this.metadata = metadata;
        this.timestamp = timestamp;
        this.createdBy = createdBy;
    }
    toJson() {
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
exports.Activity = Activity;
