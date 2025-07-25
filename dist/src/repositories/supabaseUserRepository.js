"use strict";
// infrastructure/repositories/SupabaseUserRepository.ts
Object.defineProperty(exports, "__esModule", { value: true });
exports.SupabaseUserRepository = void 0;
const Client_1 = require("../entities/Client");
const User_1 = require("../entities/User");
const types_1 = require("../types");
class SupabaseUserRepository {
    constructor(supabaseClient) {
        this.supabaseClient = supabaseClient;
    }
    async findByEmail(email) {
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
    async findByRole(role) {
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
    // async findClientsAll(): Promise<any> {
    //   const { data, error } = await this.supabaseClient
    //     .from('client_info')
    //     .select('first_name, last_name, service_needed, requested, updated_at, status');
    //   if (error) {
    //     throw new Error(`Failed to fetch clients: ${error.message}`);
    //   }
    //   return data.map((client) => ({
    //     firstName: client.first_name,
    //     lastName: client.last_name,
    //     serviceNeeded: client.service_needed,
    //     requestedAt: new Date(client.requested), // Ensure it's a Date object
    //     updatedAt: new Date(client.updated_at), // Ensure it's a Date object
    //     status: client.status,
    //   }));
    // }
    // infrastructure/repositories/SupabaseUserRepository.ts
    // infrastructure/repositories/SupabaseUserRepository.ts
    // infrastructure/repositories/SupabaseUserRepository.ts
    // infrastructure/repositories/SupabaseUserRepository.ts
    async findClientsAll() {
        const { data, error } = await this.supabaseClient
            .from('client_info')
            .select(`
      id,
      user_id,           
      firstname,
      lastname,
      email,
      service_needed,
      requested,
      updated_at,
      status
    `);
        if (error) {
            throw new Error(`Failed to fetch clients: ${error.message}`);
        }
        return data.map(client => ({
            id: client.id,
            userId: client.user_id, // expose the real UUID
            firstName: client.firstname,
            lastName: client.lastname,
            email: client.email,
            serviceNeeded: client.service_needed,
            requestedAt: new Date(client.requested),
            updatedAt: new Date(client.updated_at),
            status: client.status,
        }));
    }
    // Add this method inside the SupabaseUserRepository class
    async updateClientStatusToCustomer(userId) {
        console.log('Updating client_info where user_id =', userId);
        const { error } = await this.supabaseClient
            .from('client_info')
            .update({ status: 'customer' }) // set the new status
            .eq('user_id', userId); // match by user_id (UUID)
        if (error) {
            throw new Error(`Failed to update client status: ${error.message}`);
        }
    }
    async findClientsById(id) {
        const { data, error } = await this.supabaseClient
            .from('client_info')
            .select(`
      id,
      firstname,
      lastname,
      email,
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
    `)
            .eq('id', id);
        if (error) {
            throw new Error(`${error.message}`);
        }
        if (!data || data.length === 0) {
            console.log("GOING TO EERROR: NO DATA, client id is", id);
            return null;
        }
        return this.mapToClient(data[0]);
    }
    async findClientsByDoula(doulaId) {
        const { data: assignments, error: assignmentsError } = await this.supabaseClient
            .from('assignments')
            .select('client_id')
            .eq('doula_id', doulaId);
        if (assignmentsError) {
            throw new Error(`Failed to fetch assignments: ${assignmentsError.message}`);
        }
        // Return if there are no assigned clients
        if (!assignments || assignments.length === 0) {
            return [];
        }
        // store out client ids into an array
        const clientIds = assignments.map(assignment => assignment.client_id);
        // console.log("clientIds are ", clientIds);
        // grab our users
        const { data: users, error: getUsersError } = await this.supabaseClient
            .from('client_info')
            .select('*')
            .in('id', clientIds);
        if (getUsersError) {
            throw new Error(`${getUsersError.message}`);
        }
        // console.log("after call to client_info");
        return users.map(user => this.mapToClient(user));
    }
    async save(user) {
        const { data, error } = await this.supabaseClient
            .from('users')
            .upsert({
            id: user.id,
            email: user.email,
            firstname: user.firstname,
            lastname: user.lastname,
        }, { onConflict: 'email' })
            .select()
            .single();
        if (error) {
            throw new Error(error.message);
        }
        return this.mapToUser(data);
    }
    async update(userId, fieldsToUpdate) {
        const { data: updatedUser, error: updatedUserError } = await this.supabaseClient
            .from('users')
            .update(fieldsToUpdate)
            .eq('id', userId)
            .select()
            .single();
        if (updatedUserError)
            throw new Error(updatedUserError.message);
        return this.mapToUser(updatedUser);
    }
    async findAll() {
        const { data, error } = await this.supabaseClient
            .from('users')
            .select('email, firstname, lastname')
            .order('firstname', { ascending: true });
        if (error) {
            throw new Error(`Failed to fetch users: ${error.message}`);
        }
        return data.map(this.mapToUser);
    }
    async findAllTeamMembers() {
        try {
            const { data, error } = await this.supabaseClient
                .from('users')
                .select('id, firstname, lastname, email, role, bio')
                .in('role', ['doula', 'admin']);
            if (error) {
                throw new Error(`Failed to retrieve team members: ${error.message}`);
            }
            const mappedUsers = data.map(this.mapToUser);
            return mappedUsers;
        }
        catch (err) {
            throw new Error(`Failed to fetch team members: ${err.message}`);
        }
    }
    async addMember(firstname, lastname, userEmail, userRole) {
        try {
            const { data, error } = await this.supabaseClient
                .from('users')
                .insert([
                {
                    firstname: firstname,
                    lastname: lastname,
                    email: userEmail,
                    role: userRole
                },
            ])
                .select()
                .single();
            if (error) {
                throw new Error(`Failed to add member: ${error.message}`);
            }
            return this.mapToUser(data);
        }
        catch (err) {
            throw new Error(`Failed to add member: ${err.message}`);
        }
    }
    async getHoursById(id) {
        try {
            // Get all hours entries for this doula
            const { data: hoursData, error: hoursError } = await this.supabaseClient
                .from('hours')
                .select('*')
                .eq('doula_id', id);
            if (hoursError)
                throw new Error(hoursError.message);
            if (!hoursData) {
                return [];
            }
            ;
            // Get doula data once (since it's the same for all entries)
            const doulaData = await this.findById(id);
            if (!doulaData)
                throw new Error(`Doula with ID ${id} not found`);
            // Process each hour entry to include client data
            const result = await Promise.all(hoursData.map(async (entry) => {
                const clientData = await this.findClientsById(entry.client_id);
                if (!clientData) {
                    console.log("clientData is null, entry is", entry);
                }
                // console.log("in getHoursById in supabaseUsersRepository, clientData (to which we are accessing clientData.firstname) is ", clientData);
                const noteData = await this.findNoteByWorkLogId(entry.id);
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
                        id: clientData.user.id,
                        firstname: clientData.user.firstname,
                        lastname: clientData.user.lastname
                    } : null,
                    note: noteData ? noteData : null
                };
            }));
            return result;
        }
        catch (error) {
            throw new Error(`Failed to get user's hours: ${error.message}`);
        }
    }
    async getAllHours() {
        try {
            // Get all hours entries for this doula
            const { data: hoursData, error: hoursError } = await this.supabaseClient
                .from('hours')
                .select('*');
            if (hoursError)
                throw new Error(hoursError.message);
            if (!hoursData) {
                return [];
            }
            ;
            // Process each hour entry to include client data
            const result = await Promise.all(hoursData.map(async (entry) => {
                // console.log("entry is", entry);
                const clientData = await this.findClientsById(entry.client_id);
                const noteData = await this.findNoteByWorkLogId(entry.id);
                const doulaData = await this.findById(entry.doula_id);
                if (!doulaData)
                    throw new Error(`Doula with the ID ${entry.doula_id} not found, inside getAllHours()`);
                if (!clientData) {
                    console.log("clientData is null in getAllHours, entry is", entry);
                }
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
                        firstname: clientData.user.firstname,
                        lastname: clientData.user.lastname
                    } : null,
                    note: noteData ? noteData : null
                };
            }));
            return result;
        }
        catch (error) {
            throw new Error(`Failed to get all hours: ${error.message}`);
        }
    }
    async findById(id) {
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
    async findNoteByWorkLogId(id) {
        const { data, error } = await this.supabaseClient
            .from('notes')
            .select('*')
            .eq('work_log_id', id);
        if (error) {
            console.log(`Given this work_log_id: ${id} error finding note correspimonding to it: ${error.message}`);
        }
        return data[0];
    }
    async delete(id) {
        const { error } = await this.supabaseClient
            .from('users')
            .delete()
            .eq('id', id);
        if (error) {
            throw new Error(`Failed to delete user: ${error.message}`);
        }
    }
    async uploadProfilePicture(user, profilePicture) {
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
        const { data: { publicUrl } } = await this.supabaseClient.storage
            .from('profile-pictures')
            .getPublicUrl(filePath);
        return publicUrl;
    }
    // Helper to map database user to domain User
    mapToUser(data) {
        return new User_1.User({
            id: data.id,
            email: data.email,
            firstname: data.firstname,
            lastname: data.lastname,
            created_at: new Date(data.created_at || Date.now()),
            updated_at: new Date(data.updated_at || Date.now()),
            role: data.role || types_1.ROLE.CLIENT,
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
    mapToClient(data) {
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
        });
        return new Client_1.Client(data.id, user, data.service_needed, new Date(data.requested), new Date(data.updated_at), data.status);
    }
    async addNewHours(doula_id, client_id, start_time, end_time, note) {
        const { data: hoursData, error: hoursError } = await this.supabaseClient
            .from('hours')
            .insert([
            {
                doula_id: doula_id,
                client_id: client_id,
                start_time: start_time,
                end_time: end_time
            }
        ])
            .select();
        if (hoursError) {
            throw new Error(`Failed to post new user: ${hoursError.message}`);
        }
        // console.log("hoursData is" , hoursData);
        // console.log("the id contained in hoursData is", hoursData[0].id);
        if (note != "") {
            // console.log("note is not empty and about to call https call, note is", note);
            const { data: noteData, error: noteError } = await this.supabaseClient
                .from('notes')
                .insert([
                {
                    content: note,
                    created_by: doula_id,
                    work_log_id: hoursData[0].id,
                    visibility: "public"
                }
            ])
                .select();
            if (noteError) {
                throw new Error(`The note field is nonempty but failed to add note, ${noteError.message}`);
            }
        }
        return hoursData[0];
    }
}
exports.SupabaseUserRepository = SupabaseUserRepository;
