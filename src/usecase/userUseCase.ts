import { NotFoundError } from 'domains/errors';
import { User } from 'entities/User';
import { File as MulterFile } from 'multer';
import { UserRepository } from 'repositories/interface/userRepository';

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

  async uploadProfilePicture(user: User, profilePicture: MulterFile) {
    const signedUrl = await this.userRepository.uploadProfilePicture(user, profilePicture);
    console.log(signedUrl);
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

    console.log('fields to update', fieldsToUpdate);

    return this.userRepository.update(user.id, fieldsToUpdate);
  }

  async getAllUsers(): Promise<User[]> {
    return this.userRepository.findAll();
  }

  async getAllTeamMembers(): Promise<User[]> {
    return this.userRepository.findAllTeamMembers();
  }
}

