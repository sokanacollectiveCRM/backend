import { User } from 'entities/User';

/**
 * UserRepository defines the interface for user data operations
 */
export interface UserRepository {
  /**
   * Find a user by their email
   */
  findByEmail(email: string): Promise<User | null>;

  /**
   * Get all users by role
   */
  findByRole(role: string): Promise<User[]>;

  /**
   * Get all clients by Doula
   */
  findClientsByDoula(doulaId: string): Promise<User[]>;
  
  /**
   * Save a user to the repository
   */
  save(user: User): Promise<User>;
  
  /**
   * Get all users
   */
  findAll(): Promise<User[]>;
  
  /**
   * Find a user by ID
   */
  findById(id: string): Promise<User | null>;
  
  /**
   * Delete a user
   */
  delete(id: string): Promise<void>;
}