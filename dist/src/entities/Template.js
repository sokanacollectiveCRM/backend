"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Template = void 0;
class Template {
    constructor(id, name, depositFee, serviceFee, storagePath) {
        this.id = id;
        this.name = name;
        this.depositFee = depositFee;
        this.serviceFee = serviceFee;
        this.storagePath = storagePath;
    }
    toJson() {
        return {
            id: this.id,
            name: this.name,
            depositFee: this.depositFee,
            serviceFee: this.serviceFee,
            storagePath: this.storagePath,
        };
    }
}
exports.Template = Template;
