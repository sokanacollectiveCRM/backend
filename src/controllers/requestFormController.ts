import { Request, Response } from "express";
import { NodemailerService } from '../services/emailService';
import { RequestFormService } from "../services/RequestFormService";
import { AuthRequest, RequestFormData, RequestStatus } from "../types";

const notificationEmail = 'info@sokanacollective.com';
const emailService = new NodemailerService();

export class RequestFormController {
    private service: RequestFormService;

    constructor(requestFormService: RequestFormService) {
        this.service = requestFormService;
    }

    async createRequest(req: AuthRequest, res: Response): Promise<void> {
        try {
            if (!req.body) {
                res.status(400).json({ error: 'No body found in request' });
                return;
            }

            if (!req.user?.id) {
                res.status(401).json({ error: 'User not authenticated' });
                return;
            }

            const formData: RequestFormData = req.body;
            const result = await this.service.createRequest(formData);

            res.status(201).json({
                message: "Request form submitted successfully",
                data: result
            });
        } catch (error) {
            console.error("Error creating request:", error);
            res.status(400).json({ error: error.message });
        }
    }

    async getUserRequests(req: AuthRequest, res: Response): Promise<void> {
        try {
            if (!req.user?.id) {
                res.status(401).json({ error: 'User not authenticated' });
                return;
            }

            const requests = await this.service.getUserRequests(req.user.id);
            res.status(200).json({
                message: "User requests retrieved successfully",
                data: requests
            });
        } catch (error) {
            console.error("Error getting user requests:", error);
            res.status(500).json({ error: error.message });
        }
    }

    async getRequestById(req: AuthRequest, res: Response): Promise<void> {
        try {
            if (!req.user?.id) {
                res.status(401).json({ error: 'User not authenticated' });
                return;
            }

            const { id } = req.params;
            if (!id) {
                res.status(400).json({ error: 'Request ID is required' });
                return;
            }

            const request = await this.service.getRequestById(id, req.user.id);
            if (!request) {
                res.status(404).json({ error: 'Request not found' });
                return;
            }

            res.status(200).json({
                message: "Request retrieved successfully",
                data: request
            });
        } catch (error) {
            console.error("Error getting request by ID:", error);
            res.status(500).json({ error: error.message });
        }
    }

    async getAllRequests(req: AuthRequest, res: Response): Promise<void> {
        try {
            if (!req.user?.id) {
                res.status(401).json({ error: 'User not authenticated' });
                return;
            }

            // Check if user is admin
            if (req.user.role !== 'admin') {
                res.status(403).json({ error: 'Admin access required' });
                return;
            }

            const requests = await this.service.getAllRequests();
            res.status(200).json({
                message: "All requests retrieved successfully",
                data: requests
            });
        } catch (error) {
            console.error("Error getting all requests:", error);
            res.status(500).json({ error: error.message });
        }
    }

    async getRequestByIdAdmin(req: AuthRequest, res: Response): Promise<void> {
        try {
            if (!req.user?.id) {
                res.status(401).json({ error: 'User not authenticated' });
                return;
            }

            // Check if user is admin
            if (req.user.role !== 'admin') {
                res.status(403).json({ error: 'Admin access required' });
                return;
            }

            const { id } = req.params;
            if (!id) {
                res.status(400).json({ error: 'Request ID is required' });
                return;
            }

            const request = await this.service.getRequestByIdAdmin(id);
            if (!request) {
                res.status(404).json({ error: 'Request not found' });
                return;
            }

            res.status(200).json({
                message: "Request retrieved successfully",
                data: request
            });
        } catch (error) {
            console.error("Error getting request by ID (admin):", error);
            res.status(500).json({ error: error.message });
        }
    }

    async updateRequestStatus(req: AuthRequest, res: Response): Promise<void> {
        try {
            if (!req.user?.id) {
                res.status(401).json({ error: 'User not authenticated' });
                return;
            }

            // Check if user is admin
            if (req.user.role !== 'admin') {
                res.status(403).json({ error: 'Admin access required' });
                return;
            }

            const { id } = req.params;
            const { status } = req.body;

            if (!id) {
                res.status(400).json({ error: 'Request ID is required' });
                return;
            }

            if (!status) {
                res.status(400).json({ error: 'Status is required' });
                return;
            }

            const validStatuses = Object.values(RequestStatus);
            if (!validStatuses.includes(status)) {
                res.status(400).json({
                    error: 'Invalid status value',
                    validStatuses: validStatuses
                });
                return;
            }

            const updatedRequest = await this.service.updateRequestStatus(id, status);
            res.status(200).json({
                message: "Request status updated successfully",
                data: updatedRequest
            });
        } catch (error) {
            console.error("Error updating request status:", error);
            res.status(500).json({ error: error.message });
        }
    }

    // Updated method to handle all 10-step form fields
    async createForm(req: Request, res: Response): Promise<void> {
        try {
            if (!req.body) {
                res.status(400).json({ error: 'No body found in request' });
                return;
            }
            const formData = req.body;
            const savedForm = await this.service.newForm(formData);

            // Send notification email
            try {
                const subject = 'New Lead Submitted via Request Form';

                // Create comprehensive text version
                const text = `A new lead has been submitted via the request form.

CLIENT DETAILS:
Name: ${savedForm.firstname} ${savedForm.lastname}
Email: ${savedForm.email}
Phone: ${savedForm.phone_number}
Pronouns: ${savedForm.pronouns || 'Not specified'}${savedForm.pronouns_other ? ` (${savedForm.pronouns_other})` : ''}
Children Expected: ${savedForm.children_expected || 'Not specified'}

HOME DETAILS:
Address: ${savedForm.address}
City: ${savedForm.city}
State: ${savedForm.state}
Zip Code: ${savedForm.zip_code}
Home Phone: ${savedForm.home_phone || 'Not provided'}
Home Type: ${savedForm.home_type || 'Not specified'}
Home Access: ${savedForm.home_access || 'Not specified'}
Pets: ${savedForm.pets || 'None'}

FAMILY MEMBERS:
Relationship Status: ${savedForm.relationship_status || 'Not specified'}
Partner Name: ${savedForm.first_name || 'Not provided'} ${savedForm.last_name || ''} ${savedForm.middle_name ? `(${savedForm.middle_name})` : ''}
Partner Mobile: ${savedForm.mobile_phone || 'Not provided'}
Partner Work Phone: ${savedForm.work_phone || 'Not provided'}

REFERRAL:
Source: ${savedForm.referral_source || 'Not specified'}
Referral Name: ${savedForm.referral_name || 'Not provided'}
Referral Email: ${savedForm.referral_email || 'Not provided'}

HEALTH HISTORY:
Health History: ${savedForm.health_history || 'None reported'}
Allergies: ${savedForm.allergies || 'None reported'}
Health Notes: ${savedForm.health_notes || 'None'}

PAYMENT INFO:
Annual Income: ${savedForm.annual_income || 'Not specified'}
Service Needed: ${savedForm.service_needed}
Service Specifics: ${savedForm.service_specifics || 'Not provided'}

PREGNANCY/BABY:
Due Date: ${savedForm.due_date ? new Date(savedForm.due_date).toLocaleDateString() : 'Not specified'}
Birth Location: ${savedForm.birth_location || 'Not specified'}
Birth Hospital: ${savedForm.birth_hospital || 'Not specified'}
Number of Babies: ${savedForm.number_of_babies || 'Not specified'}
Baby Name: ${savedForm.baby_name || 'Not specified'}
Provider Type: ${savedForm.provider_type || 'Not specified'}
Pregnancy Number: ${savedForm.pregnancy_number || 'Not specified'}
Hospital: ${savedForm.hospital || 'Not specified'}

PAST PREGNANCIES:
Had Previous Pregnancies: ${savedForm.had_previous_pregnancies ? 'Yes' : 'No'}
Previous Pregnancies Count: ${savedForm.previous_pregnancies_count || '0'}
Living Children Count: ${savedForm.living_children_count || '0'}
Past Pregnancy Experience: ${savedForm.past_pregnancy_experience || 'None'}

SERVICES INTERESTED:
Services: ${Array.isArray(savedForm.services_interested) ? savedForm.services_interested.join(', ') : savedForm.services_interested || 'Not specified'}
Service Support Details: ${savedForm.service_support_details || 'Not provided'}

DEMOGRAPHICS:
Race/Ethnicity: ${savedForm.race_ethnicity || 'Not specified'}
Primary Language: ${savedForm.primary_language || 'Not specified'}
Client Age Range: ${savedForm.client_age_range || 'Not specified'}
Insurance: ${savedForm.insurance || 'Not specified'}
Demographics: ${Array.isArray(savedForm.demographics_multi) ? savedForm.demographics_multi.join(', ') : savedForm.demographics_multi || 'None'}

FORM SUBMISSION DETAILS:
Submission Date: ${new Date().toLocaleString()}
Status: lead`;



                // Create comprehensive HTML version
                const html = `
                  <div style="font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; background-color: #f9f9f9; padding: 20px;">
                    <div style="background-color: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                      <h1 style="color: #4CAF50; text-align: center; margin-bottom: 30px; border-bottom: 3px solid #4CAF50; padding-bottom: 10px;">New Lead Submitted</h1>

                      <div style="margin-bottom: 25px;">
                        <h2 style="color: #333; background-color: #e8f5e8; padding: 10px; border-radius: 5px;">👤 Client Details</h2>
                        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                          <tr><td style="font-weight: bold; padding: 8px; width: 30%; background-color: #f5f5f5;">Name:</td><td style="padding: 8px;">${savedForm.firstname} ${savedForm.lastname}</td></tr>
                          <tr><td style="font-weight: bold; padding: 8px; background-color: #f5f5f5;">Email:</td><td style="padding: 8px;"><a href="mailto:${savedForm.email}">${savedForm.email}</a></td></tr>
                          <tr><td style="font-weight: bold; padding: 8px; background-color: #f5f5f5;">Phone:</td><td style="padding: 8px;"><a href="tel:${savedForm.phone_number}">${savedForm.phone_number}</a></td></tr>
                          <tr><td style="font-weight: bold; padding: 8px; background-color: #f5f5f5;">Pronouns:</td><td style="padding: 8px;">${savedForm.pronouns || 'Not specified'}${savedForm.pronouns_other ? ` (${savedForm.pronouns_other})` : ''}</td></tr>
                          <tr><td style="font-weight: bold; padding: 8px; background-color: #f5f5f5;">Children Expected:</td><td style="padding: 8px;">${savedForm.children_expected || 'Not specified'}</td></tr>
                        </table>
                      </div>

                      <div style="margin-bottom: 25px;">
                        <h2 style="color: #333; background-color: #e8f5e8; padding: 10px; border-radius: 5px;">🏠 Home Details</h2>
                        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                          <tr><td style="font-weight: bold; padding: 8px; width: 30%; background-color: #f5f5f5;">Address:</td><td style="padding: 8px;">${savedForm.address}</td></tr>
                          <tr><td style="font-weight: bold; padding: 8px; background-color: #f5f5f5;">City/State/Zip:</td><td style="padding: 8px;">${savedForm.city}, ${savedForm.state} ${savedForm.zip_code}</td></tr>
                          <tr><td style="font-weight: bold; padding: 8px; background-color: #f5f5f5;">Home Phone:</td><td style="padding: 8px;">${savedForm.home_phone || 'Not provided'}</td></tr>
                          <tr><td style="font-weight: bold; padding: 8px; background-color: #f5f5f5;">Home Type:</td><td style="padding: 8px;">${savedForm.home_type || 'Not specified'}</td></tr>
                          <tr><td style="font-weight: bold; padding: 8px; background-color: #f5f5f5;">Home Access:</td><td style="padding: 8px;">${savedForm.home_access || 'Not specified'}</td></tr>
                          <tr><td style="font-weight: bold; padding: 8px; background-color: #f5f5f5;">Pets:</td><td style="padding: 8px;">${savedForm.pets || 'None'}</td></tr>
                        </table>
                      </div>

                      <div style="margin-bottom: 25px;">
                        <h2 style="color: #333; background-color: #e8f5e8; padding: 10px; border-radius: 5px;">👨‍👩‍👧‍👦 Family Members</h2>
                        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                          <tr><td style="font-weight: bold; padding: 8px; width: 30%; background-color: #f5f5f5;">Relationship Status:</td><td style="padding: 8px;">${savedForm.relationship_status || 'Not specified'}</td></tr>
                          <tr><td style="font-weight: bold; padding: 8px; background-color: #f5f5f5;">Partner Name:</td><td style="padding: 8px;">${savedForm.first_name || 'Not provided'} ${savedForm.last_name || ''} ${savedForm.middle_name ? `(${savedForm.middle_name})` : ''}</td></tr>
                          <tr><td style="font-weight: bold; padding: 8px; background-color: #f5f5f5;">Partner Mobile:</td><td style="padding: 8px;">${savedForm.mobile_phone || 'Not provided'}</td></tr>
                          <tr><td style="font-weight: bold; padding: 8px; background-color: #f5f5f5;">Partner Work Phone:</td><td style="padding: 8px;">${savedForm.work_phone || 'Not provided'}</td></tr>
                        </table>
                      </div>

                      <div style="margin-bottom: 25px;">
                        <h2 style="color: #333; background-color: #e8f5e8; padding: 10px; border-radius: 5px;">📞 Referral</h2>
                        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                          <tr><td style="font-weight: bold; padding: 8px; width: 30%; background-color: #f5f5f5;">Source:</td><td style="padding: 8px;">${savedForm.referral_source || 'Not specified'}</td></tr>
                          <tr><td style="font-weight: bold; padding: 8px; background-color: #f5f5f5;">Referral Name:</td><td style="padding: 8px;">${savedForm.referral_name || 'Not provided'}</td></tr>
                          <tr><td style="font-weight: bold; padding: 8px; background-color: #f5f5f5;">Referral Email:</td><td style="padding: 8px;">${savedForm.referral_email || 'Not provided'}</td></tr>
                        </table>
                      </div>

                      <div style="margin-bottom: 25px;">
                        <h2 style="color: #333; background-color: #e8f5e8; padding: 10px; border-radius: 5px;">🏥 Health History</h2>
                        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                          <tr><td style="font-weight: bold; padding: 8px; width: 30%; background-color: #f5f5f5;">Health History:</td><td style="padding: 8px;">${savedForm.health_history || 'None reported'}</td></tr>
                          <tr><td style="font-weight: bold; padding: 8px; background-color: #f5f5f5;">Allergies:</td><td style="padding: 8px;">${savedForm.allergies || 'None reported'}</td></tr>
                          <tr><td style="font-weight: bold; padding: 8px; background-color: #f5f5f5;">Health Notes:</td><td style="padding: 8px;">${savedForm.health_notes || 'None'}</td></tr>
                        </table>
                      </div>

                      <div style="margin-bottom: 25px;">
                        <h2 style="color: #333; background-color: #e8f5e8; padding: 10px; border-radius: 5px;">💰 Payment Info</h2>
                        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                          <tr><td style="font-weight: bold; padding: 8px; width: 30%; background-color: #f5f5f5;">Annual Income:</td><td style="padding: 8px;">${savedForm.annual_income || 'Not specified'}</td></tr>
                          <tr><td style="font-weight: bold; padding: 8px; background-color: #f5f5f5;">Service Needed:</td><td style="padding: 8px; font-weight: bold; color: #4CAF50;">${savedForm.service_needed}</td></tr>
                          <tr><td style="font-weight: bold; padding: 8px; background-color: #f5f5f5;">Service Specifics:</td><td style="padding: 8px;">${savedForm.service_specifics || 'Not provided'}</td></tr>
                        </table>
                      </div>

                      <div style="margin-bottom: 25px;">
                        <h2 style="color: #333; background-color: #e8f5e8; padding: 10px; border-radius: 5px;">👶 Pregnancy/Baby</h2>
                        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                          <tr><td style="font-weight: bold; padding: 8px; width: 30%; background-color: #f5f5f5;">Due Date:</td><td style="padding: 8px;">${savedForm.due_date ? new Date(savedForm.due_date).toLocaleDateString() : 'Not specified'}</td></tr>
                          <tr><td style="font-weight: bold; padding: 8px; background-color: #f5f5f5;">Birth Location:</td><td style="padding: 8px;">${savedForm.birth_location || 'Not specified'}</td></tr>
                          <tr><td style="font-weight: bold; padding: 8px; background-color: #f5f5f5;">Birth Hospital:</td><td style="padding: 8px;">${savedForm.birth_hospital || 'Not specified'}</td></tr>
                          <tr><td style="font-weight: bold; padding: 8px; background-color: #f5f5f5;">Number of Babies:</td><td style="padding: 8px;">${savedForm.number_of_babies || 'Not specified'}</td></tr>
                          <tr><td style="font-weight: bold; padding: 8px; background-color: #f5f5f5;">Baby Name:</td><td style="padding: 8px;">${savedForm.baby_name || 'Not specified'}</td></tr>
                          <tr><td style="font-weight: bold; padding: 8px; background-color: #f5f5f5;">Provider Type:</td><td style="padding: 8px;">${savedForm.provider_type || 'Not specified'}</td></tr>
                          <tr><td style="font-weight: bold; padding: 8px; background-color: #f5f5f5;">Pregnancy Number:</td><td style="padding: 8px;">${savedForm.pregnancy_number || 'Not specified'}</td></tr>
                          <tr><td style="font-weight: bold; padding: 8px; background-color: #f5f5f5;">Hospital:</td><td style="padding: 8px;">${savedForm.hospital || 'Not specified'}</td></tr>
                        </table>
                      </div>

                      <div style="margin-bottom: 25px;">
                        <h2 style="color: #333; background-color: #e8f5e8; padding: 10px; border-radius: 5px;">📋 Past Pregnancies</h2>
                        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                          <tr><td style="font-weight: bold; padding: 8px; width: 30%; background-color: #f5f5f5;">Had Previous Pregnancies:</td><td style="padding: 8px;">${savedForm.had_previous_pregnancies ? 'Yes' : 'No'}</td></tr>
                          <tr><td style="font-weight: bold; padding: 8px; background-color: #f5f5f5;">Previous Pregnancies Count:</td><td style="padding: 8px;">${savedForm.previous_pregnancies_count || '0'}</td></tr>
                          <tr><td style="font-weight: bold; padding: 8px; background-color: #f5f5f5;">Living Children Count:</td><td style="padding: 8px;">${savedForm.living_children_count || '0'}</td></tr>
                          <tr><td style="font-weight: bold; padding: 8px; background-color: #f5f5f5;">Past Pregnancy Experience:</td><td style="padding: 8px;">${savedForm.past_pregnancy_experience || 'None'}</td></tr>
                        </table>
                      </div>

                      <div style="margin-bottom: 25px;">
                        <h2 style="color: #333; background-color: #e8f5e8; padding: 10px; border-radius: 5px;">🎯 Services Interested</h2>
                        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                          <tr><td style="font-weight: bold; padding: 8px; width: 30%; background-color: #f5f5f5;">Services:</td><td style="padding: 8px;">${Array.isArray(savedForm.services_interested) ? savedForm.services_interested.join(', ') : savedForm.services_interested || 'Not specified'}</td></tr>
                          <tr><td style="font-weight: bold; padding: 8px; background-color: #f5f5f5;">Service Support Details:</td><td style="padding: 8px;">${savedForm.service_support_details || 'Not provided'}</td></tr>
                        </table>
                      </div>

                      <div style="margin-bottom: 25px;">
                        <h2 style="color: #333; background-color: #e8f5e8; padding: 10px; border-radius: 5px;">📊 Demographics</h2>
                        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                          <tr><td style="font-weight: bold; padding: 8px; width: 30%; background-color: #f5f5f5;">Race/Ethnicity:</td><td style="padding: 8px;">${savedForm.race_ethnicity || 'Not specified'}</td></tr>
                          <tr><td style="font-weight: bold; padding: 8px; background-color: #f5f5f5;">Primary Language:</td><td style="padding: 8px;">${savedForm.primary_language || 'Not specified'}</td></tr>
                          <tr><td style="font-weight: bold; padding: 8px; background-color: #f5f5f5;">Client Age Range:</td><td style="padding: 8px;">${savedForm.client_age_range || 'Not specified'}</td></tr>
                          <tr><td style="font-weight: bold; padding: 8px; background-color: #f5f5f5;">Insurance:</td><td style="padding: 8px;">${savedForm.insurance || 'Not specified'}</td></tr>
                          <tr><td style="font-weight: bold; padding: 8px; background-color: #f5f5f5;">Demographics:</td><td style="padding: 8px;">${Array.isArray(savedForm.demographics_multi) ? savedForm.demographics_multi.join(', ') : savedForm.demographics_multi || 'None'}</td></tr>
                        </table>
                      </div>

                      <div style="margin-bottom: 25px;">
                        <h2 style="color: #333; background-color: #e8f5e8; padding: 10px; border-radius: 5px;">📋 Form Submission Details</h2>
                        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px;">
                          <tr><td style="font-weight: bold; padding: 8px; width: 30%; background-color: #f5f5f5;">Submission Date:</td><td style="padding: 8px;">${new Date().toLocaleString()}</td></tr>
                          <tr><td style="font-weight: bold; padding: 8px; background-color: #f5f5f5;">Status:</td><td style="padding: 8px;">lead</td></tr>
                        </table>
                      </div>

                    </div>
                  </div>
                `;



                await emailService.sendEmail(notificationEmail, subject, text, html);
            } catch (emailError) {
                console.error('Failed to send notification email:', emailError);
                // Do not block form submission if email fails
            }

            // Send confirmation email to the person who submitted the request
            try {
                const confirmationSubject = 'Request Received - We\'re Working on Your Match';

                const confirmationText = `Dear ${savedForm.firstname} ${savedForm.lastname},

Thank you for submitting your request for doula services. We have received your information and are working on finding the perfect match for you.

Best regards,
The Sokana Collective Team`;

                const confirmationHtml = `
                  <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #f9f9f9; padding: 20px;">
                    <div style="background-color: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
                      <h1 style="color: #4CAF50; text-align: center; margin-bottom: 30px; border-bottom: 3px solid #4CAF50; padding-bottom: 10px;">Request Received</h1>

                      <p style="font-size: 18px; color: #333; margin-bottom: 20px;">Dear ${savedForm.firstname} ${savedForm.lastname},</p>

                      <p style="font-size: 16px; color: #555; line-height: 1.6; margin-bottom: 20px;">
                        Thank you for submitting your request for doula services. We have received your information and are working on finding the perfect match for you.
                      </p>

                      <div style="text-align: center; margin-top: 30px; padding: 20px; background-color: #f5f5f5; border-radius: 5px;">
                        <p style="margin: 0; font-weight: bold; color: #333;">Best regards,</p>
                        <p style="margin: 5px 0 0 0; color: #4CAF50; font-weight: bold;">The Sokana Collective Team</p>
                      </div>
                    </div>
                  </div>
                `;

                await emailService.sendEmail(savedForm.email, confirmationSubject, confirmationText, confirmationHtml);
            } catch (confirmationEmailError) {
                console.error('Failed to send confirmation email:', confirmationEmailError);
                // Do not block form submission if confirmation email fails
            }

            res.status(200).json({ message: "Form data received, onto processing" });
        } catch (error) {
            console.error("Error processing form data:", error);
            res.status(400).json({ error: error.message });
        }
    }
}
