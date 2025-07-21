"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UserUseCase = void 0;
const errors_1 = require("../domains/errors");
class UserUseCase {
    constructor(userRepository) {
        this.userRepository = userRepository;
    }
    async getUserById(targetUserId) {
        const user = await this.userRepository.findById(targetUserId);
        if (!user) {
            throw new errors_1.NotFoundError("User not found");
        }
        return user;
    }
    async getHoursById(targetUserId) {
        const hours = await this.userRepository.getHoursById(targetUserId);
        if (!hours) {
            throw new errors_1.NotFoundError("Could not get hours based on Id");
        }
        return hours;
    }
    async getAllHours() {
        const hours = await this.userRepository.getAllHours();
        if (!hours) {
            throw new errors_1.NotFoundError("Could not retrieve all work entries");
        }
        return hours;
    }
    async addNewHours(doula_id, client_id, start_time, end_time, note) {
        const newWorkEntry = await this.userRepository.addNewHours(doula_id, client_id, start_time, end_time, note);
        return newWorkEntry;
    }
    async uploadProfilePicture(user, profilePicture) {
        const signedUrl = await this.userRepository.uploadProfilePicture(user, profilePicture);
        return signedUrl;
    }
    async updateUser(user, updateData) {
        const fieldsToUpdate = Object.entries(updateData).reduce((acc, [key, value]) => {
            if (value !== '' && user[key] !== value) {
                acc[key] = value;
            }
            return acc;
        }, {});
        if (Object.keys(fieldsToUpdate).length === 0) {
            return user; // Nothing to update
        }
        return this.userRepository.update(user.id, fieldsToUpdate);
    }
    async getAllUsers() {
        return this.userRepository.findAll();
    }
    async getAllTeamMembers() {
        return this.userRepository.findAllTeamMembers();
    }
    async deleteMember(userId) {
        return this.userRepository.delete(userId);
    }
    async addMember(firstname, lastname, userEmail, userRole) {
        return this.userRepository.addMember(firstname, lastname, userEmail, userRole);
    }
}
exports.UserUseCase = UserUseCase;
