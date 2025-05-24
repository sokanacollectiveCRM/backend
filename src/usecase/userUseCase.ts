import { File as MulterFile } from 'multer';
import { UserRepository } from 'repositories/interface/userRepository';
import { NotFoundError } from '../domains/errors';
import { WORK_ENTRY } from '../entities/Hours';
import { User } from '../entities/User';

export class UserUseCase {
  private userRepository: UserRepository;

  constructor(userRepository: UserRepository) {
    this.userRepository = userRepository;
  }

  async getUserById(targetUserId: string): Promise<User> {
    const user = await this.userRepository.findById(targetUserId);

    if(!user) {
      throw new NotFoundError("User not found");
    }

    return user;
  }
  
  async getHoursById(targetUserId: string): Promise<WORK_ENTRY[]> {
    const hours = await this.userRepository.getHoursById(targetUserId);
    
    if(!hours) {
      throw new NotFoundError("Could not get hours based on Id");
    }

    return hours;
  }

  async addNewHours(doula_id: string, client_id: string, start_time: Date, end_time: Date) {
    const newWorkEntry = await this.userRepository.addNewHours(doula_id, client_id, start_time, end_time);

    return newWorkEntry;
  }

  async uploadProfilePicture(user: User, profilePicture: MulterFile) {
    const signedUrl = await this.userRepository.uploadProfilePicture(user, profilePicture);
    return signedUrl;
  }

  async updateUser(user: User, updateData: Partial<User>) {

    const fieldsToUpdate = Object.entries(updateData).reduce((acc, [key, value]) => {
      if (value !== '' && user[key] !== value) {
        acc[key] = value;
      }
      return acc;
    }, {} as Partial<User>);

    if (Object.keys(fieldsToUpdate).length === 0) {
      return user; // Nothing to update
    }

    return this.userRepository.update(user.id, fieldsToUpdate);
  }

  async getAllUsers(): Promise<User[]> {
    return this.userRepository.findAll();
  }

  async getAllTeamMembers(): Promise<User[]> {
    return this.userRepository.findAllTeamMembers();
  }

  async deleteMember(userId: string): Promise<void> {
    return this.userRepository.delete(userId);
  }

  async addMember(firstname: string, lastname: string, userEmail: string, userRole: string): Promise<User> {
    return this.userRepository.addMember(firstname, lastname, userEmail, userRole);
  }

 
}

