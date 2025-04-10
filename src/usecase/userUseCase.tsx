import { AuthorizationError, NotFoundError } from 'domains/errors';
import { User } from 'entities/User';
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

  async getAllUsers(): Promise<User[]> {
    return this.userRepository.findAll();
  }
}

