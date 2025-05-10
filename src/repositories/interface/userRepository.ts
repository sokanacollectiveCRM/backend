import { User } from 'entities/User';
import { WORK_ENTRY, WORK_ENTRY_ROW } from 'entities/Hours';
import type { File as MulterFile } from 'multer';

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
   * FOR SHOWCASE ONLY
   */
  findClientsAll(): Promise<any>;
  
  /**
   * Save a user to the repository
   */
  save(user: User): Promise<User>;

  /**
   * Update a user to the repository
   */
  update(userId: string, fieldsToUpdate: Partial<User>): Promise<User>;
  
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

  /**
   * Upload a user profile picture
   */
  uploadProfilePicture(user: User, profilePicture: MulterFile): Promise<string>;
    
  /**
   * Get this user's work hours
   */
  getHoursById(id: string): Promise<WORK_ENTRY[]>;
  
  /**
   * Add a new doula work session entry 
   */
  addNewHours(doula_id: string, client_id: string, start_time: Date, end_time: Date): Promise<WORK_ENTRY_ROW>;
}