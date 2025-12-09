import { Response } from 'express';
import { AuthRequest } from '../types';
import { EmailController } from './emailController';
import { UserRepository } from '../repositories/interface/userRepository';
import { ClientRepository } from '../repositories/interface/clientRepository';
import { SupabaseAssignmentRepository } from '../repositories/supabaseAssignmentRepository';
import { ACCOUNT_STATUS, CLIENT_STATUS, ROLE } from '../types';
import * as crypto from 'crypto';

export class AdminController {
  private emailController: EmailController;
  private userRepository: UserRepository;
  private clientRepository: ClientRepository;
  private assignmentRepository: SupabaseAssignmentRepository;

  constructor(
    userRepository: UserRepository,
    clientRepository: ClientRepository,
    assignmentRepository: SupabaseAssignmentRepository
  ) {
    this.emailController = new EmailController();
    this.userRepository = userRepository;
    this.clientRepository = clientRepository;
    this.assignmentRepository = assignmentRepository;
  }

  /**
   * Invite a doula to join the platform
   * POST /api/admin/doulas/invite
   */
  async inviteDoula(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { email, firstname, lastname } = req.body;

      // Validate required fields
      if (!email || !firstname || !lastname) {
        res.status(400).json({
          success: false,
          error: 'Missing required fields: email, firstname, and lastname are required'
        });
        return;
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        res.status(400).json({
          success: false,
          error: 'Invalid email format'
        });
        return;
      }

      // Check if user already exists
      const existingUser = await this.userRepository.findByEmail(email);

      if (existingUser) {
        // If user exists but is not pending, they may have already signed up
        if (existingUser.account_status !== ACCOUNT_STATUS.PENDING) {
          res.status(400).json({
            success: false,
            error: 'A user with this email already exists and has completed signup'
          });
          return;
        }
        // If user exists and is pending, we can still send the invite
        // (maybe they didn't receive the first email)
      } else {
        // Create user record with pending status
        try {
          const newUser = await this.userRepository.addMember(firstname, lastname, email, ROLE.DOULA);
          console.log(`✅ Created user record for ${email} with ID: ${newUser.id}, status: ${newUser.account_status}`);

          // Verify the user was created correctly
          const verifyUser = await this.userRepository.findByEmail(email);
          if (!verifyUser) {
            console.error(`❌ User creation verification failed: ${email} not found after creation`);
            res.status(500).json({
              success: false,
              error: 'User record was created but could not be verified. Please try again.'
            });
            return;
          }

          if (verifyUser.account_status !== ACCOUNT_STATUS.PENDING) {
            console.warn(`⚠️  User ${email} created but account_status is ${verifyUser.account_status}, expected 'pending'`);
          }
        } catch (error: any) {
          // If addMember fails, check if it's because user already exists (race condition)
          console.error(`Error creating user for ${email}:`, error);
          const userCheck = await this.userRepository.findByEmail(email);
          if (!userCheck) {
            // User doesn't exist and creation failed - rethrow the error
            console.error('Failed to create user record:', error);
            res.status(500).json({
              success: false,
              error: `Failed to create user record: ${error.message}`
            });
            return;
          }
          // User exists now (race condition), check their status
          console.log(`User ${email} already exists (race condition), status: ${userCheck.account_status}`);
          if (userCheck.account_status !== ACCOUNT_STATUS.PENDING) {
            res.status(400).json({
              success: false,
              error: 'A user with this email already exists and has completed signup'
            });
            return;
          }
          // User exists and is pending, continue with invite
        }
      }

      // Generate invite token (optional, for tracking)
      const inviteToken = crypto.randomBytes(32).toString('hex');

      // Send invitation email
      await this.emailController.sendDoulaInvite(email, firstname, lastname, inviteToken);

      res.status(200).json({
        success: true,
        message: `Invitation email sent to ${email}`,
        data: {
          email,
          firstname,
          lastname,
          inviteToken // Return token for potential tracking
        }
      });
    } catch (error: any) {
      console.error('Error inviting doula:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to send invitation email'
      });
    }
  }

  /**
   * Match a doula with a client (only clients in 'matching' phase)
   * POST /api/admin/assignments/match
   */
  async matchDoulaWithClient(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { clientId, doulaId, notes } = req.body;

      // Validate required fields
      if (!clientId || !doulaId) {
        res.status(400).json({
          success: false,
          error: 'Missing required fields: clientId and doulaId are required'
        });
        return;
      }

      // Verify client exists and get their status
      const client = await this.clientRepository.findById(clientId);
      if (!client) {
        res.status(404).json({
          success: false,
          error: 'Client not found'
        });
        return;
      }

      // Verify client is in 'matching' phase
      if (client.status !== CLIENT_STATUS.MATCHING) {
        res.status(400).json({
          success: false,
          error: `Client is not in matching phase. Current status: ${client.status}. Only clients with status 'matching' can be assigned to doulas.`
        });
        return;
      }

      // Verify doula exists and is actually a doula
      const doula = await this.userRepository.findById(doulaId);
      if (!doula) {
        res.status(404).json({
          success: false,
          error: 'Doula not found'
        });
        return;
      }

      if (doula.role !== ROLE.DOULA) {
        res.status(400).json({
          success: false,
          error: 'User is not a doula'
        });
        return;
      }

      // Check if assignment already exists
      const existingAssignments = await this.assignmentRepository.getAssignedDoulas(clientId);
      const alreadyAssigned = existingAssignments.some(a => a.doulaId === doulaId);

      if (alreadyAssigned) {
        res.status(400).json({
          success: false,
          error: 'This doula is already assigned to this client'
        });
        return;
      }

      // Create the assignment
      const adminId = req.user?.id;
      const authHeader = req.headers.authorization;
      const accessToken = authHeader?.split(' ')[1];

      const assignment = await this.assignmentRepository.assignDoula(
        clientId,
        doulaId,
        adminId,
        accessToken
      );

      // Update assignment notes if provided
      if (notes) {
        await this.assignmentRepository.updateAssignmentNotes(assignment.id, notes);
      }

      // Send email notifications to doula and client
      try {
        // Helper function to get full name from user, checking multiple name fields
        const getUserFullName = (user: any): string => {
          // Try firstname/lastname first
          const name1 = `${user.firstname || ''} ${user.lastname || ''}`.trim();
          if (name1) return name1;

          // Try first_name/last_name as fallback
          const name2 = `${user.first_name || ''} ${user.last_name || ''}`.trim();
          if (name2) return name2;

          // Try preferred_name if available
          if (user.preferred_name) return user.preferred_name;

          // Last resort: return email or generic
          return user.email || 'Client';
        };

        const doulaName = getUserFullName(doula);
        const clientName = getUserFullName(client.user);

        // Send email to doula
        await this.emailController.sendDoulaMatchNotification(
          doula.email,
          doulaName,
          clientName,
          client.user.email,
          notes
        );

        // Send email to client
        await this.emailController.sendClientMatchNotification(
          client.user.email,
          clientName,
          doulaName,
          doula.email
        );

        console.log(`📧 Sent match notification emails to doula (${doula.email}) and client (${client.user.email})`);
      } catch (emailError) {
        console.error('Failed to send match notification emails:', emailError);
        // Don't fail the request if email fails
      }

      console.log(`✅ Admin ${adminId} matched doula ${doulaId} with client ${clientId}`);

      res.status(201).json({
        success: true,
        message: 'Doula successfully matched with client',
        data: {
          assignment: {
            id: assignment.id,
            clientId: assignment.clientId,
            doulaId: assignment.doulaId,
            assignedAt: assignment.assignedAt,
            assignedBy: assignment.assignedBy,
            notes: notes || assignment.notes,
            status: assignment.status
          },
          client: {
            id: client.id,
            name: `${client.user.firstname} ${client.user.lastname}`,
            status: client.status
          },
          doula: {
            id: doula.id,
            name: `${doula.firstname} ${doula.lastname}`,
            email: doula.email
          }
        }
      });
    } catch (error: any) {
      console.error('Error matching doula with client:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to match doula with client'
      });
    }
  }

  /**
   * Get all clients in matching phase
   * GET /api/admin/clients/matching
   */
  async getMatchingClients(req: AuthRequest, res: Response): Promise<void> {
    try {
      const clients = await this.clientRepository.findClientsByStatus(CLIENT_STATUS.MATCHING);

      res.status(200).json({
        success: true,
        count: clients.length,
        data: clients.map(client => ({
          id: client.id,
          firstname: client.user.firstname || '',
          lastname: client.user.lastname || '',
          email: client.user.email || '',
          phone: client.phoneNumber || client.user.phone_number || '',
          dueDate: client.due_date ? (client.due_date instanceof Date ? client.due_date.toISOString().split('T')[0] : client.due_date) : '',
          status: client.status,
          address: client.user.address || '',
          city: client.user.city || '',
          state: client.user.state || '',
          zipCode: client.user.zip_code || '',
          healthHistory: client.health_history || '',
          allergies: client.allergies || '',
          hospital: client.hospital || '',
          serviceNeeded: client.serviceNeeded || '',
          // Additional useful fields
          phoneNumber: client.phoneNumber || client.user.phone_number || '',
          pronouns: client.pronouns || client.user.pronouns || '',
          annualIncome: client.annual_income || '',
          serviceSpecifics: client.service_specifics || '',
          childrenExpected: client.childrenExpected || '',
          // Include full user object for detailed views
          user: client.user
        }))
      });
    } catch (error: any) {
      console.error('Error fetching matching clients:', error);
      res.status(500).json({
        success: false,
        error: error.message || 'Failed to fetch matching clients'
      });
    }
  }

  private handleError(error: any, res: Response): void {
    console.error('AdminController error:', error);
    const status = error.status || 500;
    const message = error.message || 'Internal server error';
    res.status(status).json({ error: message });
  }
}
