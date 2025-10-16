import { Response } from 'express';
import {
    AuthenticationError,
    AuthorizationError,
    ConflictError,
    NotFoundError,
    ValidationError
} from '../domains/errors';
import { Client } from '../entities/Client';

import { AuthRequest } from '../types';
import { ClientUseCase } from '../usecase/clientUseCase';
import { SupabaseAssignmentRepository } from '../repositories/supabaseAssignmentRepository';

export class ClientController {
  private clientUseCase: ClientUseCase;
  private assignmentRepository: SupabaseAssignmentRepository;

  constructor (clientUseCase: ClientUseCase, assignmentRepository: SupabaseAssignmentRepository) {
    this.clientUseCase = clientUseCase;
    this.assignmentRepository = assignmentRepository;
  };

  //
  // getClients()
  //
  // Grabs all clients (lite or detailed) based on role or query param
  //
  // returns:
  //    Clients[]
  //
  async getClients(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id, role } = req.user;
      const { detailed } = req.query;

      const clients = detailed === 'true'
        ? await this.clientUseCase.getClientsDetailed(id, role)
        : await this.clientUseCase.getClientsLite(id, role);

      console.log("clients:", clients);

      res.json(clients.map(client => client.toJson()));
    } catch (getError) {
      const error = this.handleError(getError, res);
      if (!res.headersSent) {
        res.status(error.status).json({ error: error.message });
      }
    }
  }
//
  // getCSVClients()
  //
  // Grabs all client data in CSV form
  //
  // returns:
  //    CSV of users
  //
  async exportCSV(
    req: AuthRequest,
    res: Response,
  ): Promise<void> {
    try {
      const {role} = req.user;
      const clientsCSV = await this.clientUseCase.exportCSV(role);
      res.header("Content-Type", "text/csv");
      res.attachment("clients.csv");

      res.send(clientsCSV);
    }
    catch (getError) {
      const error = this.handleError(getError, res);

      if (!res.headersSent) {
        res.status(error.status).json({ error: error.message})
      }
    }
  }

  //
  // getClientById()
  //
  // Grab a specific client with detailed information
  //
  // returns:
  //    Client
  //
  async getClientById(req: AuthRequest, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { detailed } = req.query;

    if (!id) {
      res.status(400).json({ error: 'Missing client ID' });
      return;
    }

    const client = detailed === 'true'
      ? await this.clientUseCase.getClientDetailed(id)
      : await this.clientUseCase.getClientLite(id);

    res.json(client.toJson());
  } catch (error) {
    const err = this.handleError(error, res);
    if (!res.headersSent) {
      res.status(err.status).json({ error: err.message });
    }
  }
}

  async deleteClient(req: AuthRequest, res: Response): Promise<void> {
    const { id } = req.body;
    console.log('DELETE /clients/delete called with id:', id);
    if (!id) {
      console.log('No client ID provided');
      res.status(400).json({ error: 'Missing client ID' });
      return;
    }
    try {
      await this.clientUseCase.deleteClient(id);
      console.log('Client deleted successfully:', id);
      res.status(204).send();
    } catch (error) {
      console.error('Error deleting client:', error);
      const err = this.handleError(error, res);
      res.status(err.status).json({ error: err.message });
    }
  }

  //
  // updateClientStatus
  //
  // Updates client status in client_info table by grabbing the client to update in the request body
  //
  // returns:
  //    Client with updatedAt timestamp
  //
  async updateClientStatus(
    req: AuthRequest,
    res: Response,
  ): Promise<void> {
    const { clientId, status } = req.body;
    console.log(clientId, status);

    if (!clientId || !status) {
      res.status(400).json({ message: 'Missing client ID or status' });
      return;
    }

    try {
      // Update client status directly in client_info table
      const client = await this.clientUseCase.updateClientStatus(clientId, status);

      res.json({
        success: true,
        client: {
          id: client.id,
          status: client.status,
          updatedAt: client.updatedAt,
          firstname: client.user.firstname,
          lastname: client.user.lastname,
          email: client.user.email,
          role: client.user.role,
          serviceNeeded: client.serviceNeeded,
          requestedAt: client.requestedAt
        }
      });
    }
    catch (statusError) {
      const error = this.handleError(statusError, res);
      res.status(error.status).json({ error: error.message });
    }
  }

  //
  // updateClient
  //
  // Updates client profile fields
  //
  // returns:
  //    Client with updatedAt timestamp
  //
  async updateClient(
    req: AuthRequest,
    res: Response,
  ): Promise<void> {
    const { id } = req.params;
    const updateData = req.body;

    console.log('🔧 PUT /clients/:id - UPDATE REQUEST START');
    console.log('Controller: Request details:', {
      method: req.method,
      url: req.url,
      originalUrl: req.originalUrl,
      path: req.path,
      params: req.params,
      id,
      idType: typeof id
    });

    if (!id) {
      res.status(400).json({ error: 'Missing client ID' });
      return;
    }

    // Validate that id looks like a UUID
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      console.error('Controller: Invalid client ID format:', id);
      res.status(400).json({ error: `Invalid client ID format: ${id}. Expected UUID format.` });
      return;
    }

    console.log('📝 Controller: Frontend sent these fields to update:', {
      clientId: id,
      updateDataKeys: Object.keys(updateData),
      updateDataValues: updateData,
      updateDataCount: Object.keys(updateData).length
    });

    // Log specific fields we're looking for
    const importantFields = [
      'preferred_contact_method', 'preferred_name', 'pronouns', 'home_type',
      'services_interested', 'phoneNumber', 'phone_number', 'firstname', 'lastname', 'email'
    ];

    console.log('🎯 Controller: Checking for important fields in request:');
    importantFields.forEach(field => {
      if (updateData[field] !== undefined) {
        console.log(`  ✅ ${field}: "${updateData[field]}" (${typeof updateData[field]})`);
      } else {
        console.log(`  ❌ ${field}: undefined`);
      }
    });

    try {
      const client = await this.clientUseCase.updateClientProfile(
        id,
        updateData
      );

      console.log('✅ Controller: Client updated successfully in database');
      console.log('📊 Controller: Full client object returned from use case:', {
        clientId: client.id,
        userObjectKeys: Object.keys(client.user),
        userObjectKeyCount: Object.keys(client.user).length,
        clientFields: {
          serviceNeeded: client.serviceNeeded,
          status: client.status,
          phoneNumber: client.phoneNumber
        }
      });

      // Log what we're about to send back to frontend
      const responseData = {
        success: true,
        client: {
          // Basic client info
          id: client.id,
          updatedAt: client.updatedAt,
          status: client.status,
          serviceNeeded: client.serviceNeeded,
          requestedAt: client.requestedAt,
          phoneNumber: client.phoneNumber,

          // All user/profile fields from client_info table
          firstname: client.user.firstname,
          lastname: client.user.lastname,
          email: client.user.email,
          role: client.user.role,

          // All the fields that were missing from responses
          preferred_contact_method: client.user.preferred_contact_method,
          preferred_name: client.user.preferred_name,
          payment_method: client.user.payment_method,  // Add this field
          pronouns: client.user.pronouns,
          home_type: client.user.home_type,
          services_interested: client.user.services_interested,
          phone_number: client.user.phone_number,
          health_notes: client.user.health_notes,
          service_specifics: client.user.service_specifics,
          baby_sex: client.user.baby_sex,
          baby_name: client.user.baby_name,
          birth_hospital: client.user.birth_hospital,
          birth_location: client.user.birth_location,
          number_of_babies: client.user.number_of_babies,
          provider_type: client.user.provider_type,
          pregnancy_number: client.user.pregnancy_number,
          had_previous_pregnancies: client.user.had_previous_pregnancies,
          previous_pregnancies_count: client.user.previous_pregnancies_count,
          living_children_count: client.user.living_children_count,
          past_pregnancy_experience: client.user.past_pregnancy_experience,
          service_support_details: client.user.service_support_details,
          race_ethnicity: client.user.race_ethnicity,
          primary_language: client.user.primary_language,
          client_age_range: client.user.client_age_range,
          insurance: client.user.insurance,
          demographics_multi: client.user.demographics_multi,
          pronouns_other: client.user.pronouns_other,
          home_phone: client.user.home_phone,
          home_access: client.user.home_access,
          pets: client.user.pets,
          relationship_status: client.user.relationship_status,
          first_name: client.user.first_name,
          last_name: client.user.last_name,
          middle_name: client.user.middle_name,
          mobile_phone: client.user.mobile_phone,
          work_phone: client.user.work_phone,
          referral_source: client.user.referral_source,
          referral_name: client.user.referral_name,
          referral_email: client.user.referral_email,

          // Additional fields
          address: client.user.address,
          city: client.user.city,
          state: client.user.state,
          country: client.user.country,
          zip_code: client.user.zip_code,
          profile_picture: client.user.profile_picture,
          account_status: client.user.account_status,
          business: client.user.business,
          bio: client.user.bio,
          children_expected: client.user.children_expected,
          service_needed: client.user.service_needed,
          health_history: client.user.health_history,
          allergies: client.user.allergies,
          due_date: client.user.due_date,
          annual_income: client.user.annual_income,
          hospital: client.user.hospital,

          // Client entity specific fields
          childrenExpected: client.childrenExpected,
          healthHistory: client.health_history,
          dueDate: client.due_date,
          babySex: client.baby_sex,
          annualIncome: client.annual_income,
          serviceSpecifics: client.service_specifics
        }
      };

      console.log('📤 Controller: Response being sent to frontend:', {
        responseKeys: Object.keys(responseData.client),
        responseKeyCount: Object.keys(responseData.client).length,
        responseData: responseData
      });

      // Check if important fields are missing from response
      console.log('⚠️  Controller: Missing fields in response (not sent to frontend):');
      importantFields.forEach(field => {
        if (updateData[field] !== undefined && !(field in responseData.client)) {
          console.log(`  🚨 ${field}: "${updateData[field]}" was updated but NOT in response`);
        }
      });

      console.log('🔧 PUT /clients/:id - UPDATE REQUEST COMPLETE');
      console.log('=====================================');

      res.json(responseData);
    }
    catch (error) {
      console.error('❌ Controller: Error updating client:', error);
      const err = this.handleError(error, res);
      res.status(err.status).json({ error: err.message });
    }
  }

  //
  // createActivity()
  //
  // Creates a custom activity entry for a client
  //
  // returns:
  //    Activity
  //
  async createActivity(req: AuthRequest, res: Response): Promise<void> {
    const { id } = req.params;
    const { type, description, metadata } = req.body;

    if (!id) {
      res.status(400).json({ error: 'Missing client ID' });
      return;
    }

    if (!type || !description) {
      res.status(400).json({ error: 'Missing type or description' });
      return;
    }

    try {
      const activity = await this.clientUseCase.createActivity(
        id,
        type,
        description,
        metadata,
        req.user?.id
      );

      res.json({
        success: true,
        activity: {
          id: activity.id,
          clientId: activity.clientId,
          type: activity.type,
          description: activity.description,
          metadata: activity.metadata,
          timestamp: activity.timestamp,
        },
      });
    } catch (error) {
      const err = this.handleError(error, res);
      res.status(err.status).json({ error: err.message });
    }
  }

  //
  // getClientActivities()
  //
  // Retrieves all activities/notes for a specific client
  //
  // returns:
  //    Activity[]
  //
  async getClientActivities(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      if (!id) {
        res.status(400).json({ error: 'Missing client ID' });
        return;
      }

      const activities = await this.clientUseCase.getClientActivities(id);

      res.json({
        success: true,
        activities: activities
      });
    } catch (error) {
      const err = this.handleError(error, res);
      res.status(err.status).json({ error: err.message });
    }
  }

  //
  // assignDoula()
  //
  // Assign a doula to a client
  //
  // returns:
  //    Assignment object
  //
  async assignDoula(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id: clientId } = req.params;
      const { doulaId } = req.body;

      if (!clientId || !doulaId) {
        res.status(400).json({ error: 'Missing clientId or doulaId' });
        return;
      }

      const assignment = await this.assignmentRepository.assignDoula(
        clientId,
        doulaId,
        req.user?.id
      );

      res.json({
        success: true,
        assignment: {
          id: assignment.id,
          doulaId: assignment.doulaId,
          clientId: assignment.clientId,
          assignedAt: assignment.assignedAt,
          status: assignment.status
        }
      });
    } catch (error) {
      const err = this.handleError(error, res);
      res.status(err.status).json({ error: err.message });
    }
  }

  //
  // unassignDoula()
  //
  // Unassign a doula from a client
  //
  // returns:
  //    Success message
  //
  async unassignDoula(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id: clientId, doulaId } = req.params;

      if (!clientId || !doulaId) {
        res.status(400).json({ error: 'Missing clientId or doulaId' });
        return;
      }

      await this.assignmentRepository.unassignDoula(clientId, doulaId);

      res.json({
        success: true,
        message: 'Doula unassigned successfully'
      });
    } catch (error) {
      const err = this.handleError(error, res);
      res.status(err.status).json({ error: err.message });
    }
  }

  //
  // getAssignedDoulas()
  //
  // Get all doulas assigned to a specific client
  //
  // returns:
  //    Array of assigned doulas with their info
  //
  async getAssignedDoulas(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id: clientId } = req.params;

      if (!clientId) {
        res.status(400).json({ error: 'Missing clientId' });
        return;
      }

      const doulas = await this.assignmentRepository.getAssignedDoulas(clientId);

      res.json({
        success: true,
        doulas: doulas
      });
    } catch (error) {
      const err = this.handleError(error, res);
      res.status(err.status).json({ error: err.message });
    }
  }

  // Helper method to handle errors
  private handleError(
    error: Error,
    res: Response
  ): { status: number, message: string } {
    console.error('Error:', error.message);

    if (error instanceof ValidationError) {
      return { status: 400, message: error.message};
    } else if (error instanceof ConflictError) {
      return { status: 409, message: error.message};
    } else if (error instanceof AuthenticationError) {
      return { status: 401, message: error.message};
    } else if (error instanceof NotFoundError) {
      return { status: 404, message: error.message};
    } else if (error instanceof AuthorizationError) {
      return { status: 403, message: error.message};
    } else {
      return { status: 500, message: error.message};
    }
  }

  // Helper for returning basic summary of a client
  private mapToClientSummary(client: Client) {
    return {
      id: client.user.id.toString(),
      firstname: client.user.firstname,
      lastname: client.user.lastname,
      serviceNeeded: client.serviceNeeded,
      requestedAt: client.requestedAt,
      updatedAt: client.updatedAt,
      status: client.status,
    };
  }
}
