// infrastructure/repositories/SupabaseUserRepository.ts

import { SupabaseClient } from '@supabase/supabase-js';
import { Client } from 'entities/Client';
import { User } from 'entities/User';
import { File as MulterFile } from 'multer';
import { UserRepository } from 'repositories/interface/userRepository';
import { ROLE } from 'types';

export class SupabaseUserRepository implements UserRepository {
  private supabaseClient: SupabaseClient;
  
  constructor(
    supabaseClient: SupabaseClient
  ) {
    this.supabaseClient = supabaseClient;
  }
  
  async findByEmail(email: string): Promise<User | null> {
    const { data, error } = await this.supabaseClient
      .from('users')
      .select('*')
      .eq('email', email)
      .single();
      
    if (error || !data) {
      return null;
    }
    
    return this.mapToUser(data);
  }

  async exportCSV():Promise<string | null>{
    const {data,error} = await this.supabaseClient
    .from('users')
    .select('*')
    .csv()
    if(error || !data){
      throw new Error(`Failed to fetch CSV Data ${error.message}`);
    }
    return data;
  }

  async findByRole(role: string): Promise<User[]> {
    const { data, error } = await this.supabaseClient
      .from('users')
      .select('*')
      .eq('role', role)
      .order('first_name', { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch ${role} users: ${error.message}`);
    }

    return data.map(this.mapToUser);
  }

  async findClientsAll(): Promise<any> {
    const { data, error } = await this.supabaseClient
      .from('client_info')
      .select(`
        id,
        firstname,
        lastname,
        service_needed,
        requested,
        updated_at,
        status,
        user_id,
        users (
          profile_picture,
          firstname,
          lastname
        )
      `);

    if (error) {
      throw new Error(`${error.message}`);
    }
    
    console.log("data", data);

    return data.map((client) => this.mapToClient(client));
  }

  async findClientsByDoula(doulaId: string): Promise<User[]> {
    const { data: assignments, error: assignmentsError } = await this.supabaseClient
      .from('assignments')
      .select('client_id')
      .eq('doula_id', doulaId)

    if (assignmentsError) {
      throw new Error(`Failed to fetch assignments: ${assignmentsError.message}`);
    }

    // Return if there are no assigned clients
    if (!assignments || assignments.length === 0) {
      return [];
    }

    // store out client ids into an array
    const clientIds = assignments.map(assignment => assignment.client_id);

    // grab our users
    const { data: users, error: getUsersError } = await this.supabaseClient
      .from('users')
      .select('*')
      .eq('id', clientIds);

    if (getUsersError) {
      throw new Error(`${getUsersError.message}`);
    }

    return users.map(this.mapToUser);
  }
  
  async save(user: User): Promise<User> {
    const { data, error } = await this.supabaseClient
      .from('users')
      .upsert({
        id: user.id,
        username: user.username,
        email: user.email,
        firstname: user.firstname,
        lastname: user.lastname,
      })
      .select()
      .single();
      
    if (error) {
      console.log(error.message)
      throw new Error(error.message);
    }
    
    return this.mapToUser(data);
  }

  async update(userId: string, fieldsToUpdate: Partial<User>): Promise<User> {

    const { data: updatedUser, error: updatedUserError } = await this.supabaseClient
      .from('users')
      .update(fieldsToUpdate)
      .eq('id', userId)
      .select()
      .single()

    console.log(updatedUserError);

    if (updatedUserError) throw new Error(updatedUserError.message);
    return this.mapToUser(updatedUser);
  }
  
  async findAll(): Promise<User[]> {
    const { data, error } = await this.supabaseClient
    .from('users')
    .select('username, email, firstname, lastname')
    .order('username', { ascending: true });
    
    if (error) {
      throw new Error(`Failed to fetch users: ${error.message}`);
    }
    
    return data.map(this.mapToUser);
  }
  
  async getHoursById(id: string): Promise<any> {
    console.log("getHoursById is run");
    try {
      // Get all hours entries for this doula
      const { data: hoursData, error: hoursError } = await this.supabaseClient
        .from('hours')
        .select('*')
        .eq('doula_id', id);
      
      if (hoursError) throw new Error(hoursError.message);
      if (!hoursData) {
        console.log("there's no hours data so returning []");
        return []
      };
      
      // Get doula data once (since it's the same for all entries)
      const doulaData = await this.findById(id);
      if (!doulaData) throw new Error(`Doula with ID ${id} not found`);
      
      // Process each hour entry to include client data
      const result = await Promise.all(hoursData.map(async (entry) => {
        const clientData = await this.findById(entry.client_id);
        
        return {
          id: entry.id,
          start_time: entry.start_time,
          end_time: entry.end_time,
          doula: {
            id: doulaData.id,
            firstname: doulaData.firstname,
            lastname: doulaData.lastname
          },
          client: clientData ? {
            id: clientData.id,
            firstname: clientData.firstname,
            lastname: clientData.lastname
          } : null
        };
      }));

      console.log("about to return result", result);
      
      return result;
    } catch (error) {
      throw new Error(`Failed to get user's hours: ${error.message}`);
    }
  }
  
  async findById(id: string): Promise<User | null> {
    const { data, error } = await this.supabaseClient
      .from('users')
      .select('*')
      .eq('id', id)
      .single();
      
    if (error || !data) {
      return null;
    }
    
    return this.mapToUser(data);
  }
  
  async delete(id: string): Promise<void> {
    const { error } = await this.supabaseClient
      .from('users')
      .delete()
      .eq('id', id);
      
    if (error) {
      throw new Error(`Failed to delete user: ${error.message}`);
    }
  }
  
  async uploadProfilePicture(user: User, profilePicture: MulterFile) {
    const filePath = `${user.id}/${Date.now()}_${profilePicture.originalname}`;

    // upload to supabase
    const { data, error: uploadError } = await this.supabaseClient.storage
    .from('profile-pictures')
    .upload(filePath, profilePicture.buffer, {
      contentType: profilePicture.mimetype,
      upsert: true,
    });

    if (uploadError) {
      console.log('Upload error', uploadError);
      throw new Error('failed to stash profile picture');
    }

    // grab the link to it
    const { data: { publicUrl }} = await this.supabaseClient.storage
      .from('profile-pictures')
      .getPublicUrl(filePath);

    console.log("this is the data", publicUrl);

    return publicUrl;
  }

  // Helper to map database user to domain User
  private mapToUser(data: any): User {
    return new User({
      id: data.id,
      username: data.username,
      email: data.email,
      firstname: data.firstname,
      lastname: data.lastname,
      created_at: new Date(data.created_at || Date.now()),
      updated_at: new Date(data.updated_at || Date.now()),
      role: data.role || ROLE.CLIENT,
      address: data.address,
      city: data.city,
      state: data.state,
      country: data.country,
      zip_code: data.zip_code,
      profile_picture: data.profile_picture,
      account_status: data.account_status,
      business: data.business,
      bio: data.bio
    });
  }

  // Helper to map to client entity
  private mapToClient(data: any): Client {
    // If the user has created a profile, grab user data from users table. If not, grab details
    // from the request form (client_info table).
    const userData = data.users ? {
      id: data.users.user_id,
      firstname: data.users.firstname,
      lastname: data.users.lastname,
      profile_picture: data.users,
    } :
    {
      id: data.id,
      firstname: data.firstname,
      lastname: data.lastname,
      profile_picture: ''
    };

    // if user doesn't exist (not approved), we fill fields from client_info table
    const user = this.mapToUser({
      id: userData.id ?? data.id,
      firstname: userData.firstname,
      lastname: userData.lastname,
      profile_picture: userData.profile_picture,
      role: 'client',
    })

    return new Client(
      user,
      data.service_needed,
      new Date(data.requested),
      new Date(data.updated_at),
      data.status
    )
  }
}