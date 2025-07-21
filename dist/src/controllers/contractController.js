"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ContractController = void 0;
const errors_1 = require("../domains/errors");
class ContractController {
    constructor(contractUseCase) {
        this.contractUseCase = contractUseCase;
    }
    ;
    //
    // Generate and save a contract (finalized)
    //
    async generateContract(req, res) {
        try {
            const { templateId, clientId, fields, note, fee, deposit } = req.body;
            if (!templateId || !clientId || !fields) {
                throw new errors_1.ValidationError('Missing required fields.');
            }
            // Delegate to use case for PDF generation + upload + DB write
            const contract = await this.contractUseCase.createContract({
                templateId,
                clientId,
                fields,
                note,
                fee,
                deposit,
                generatedBy: req.user.id,
            });
            res.status(201).json(contract);
        }
        catch (err) {
            const error = this.handleError(err, res);
            if (!res.headersSent) {
                res.status(error.status).json({ error: error.message });
            }
        }
    }
    //
    // Preview a generated contract PDF
    //
    async previewContract(req, res) {
        try {
            const contractId = req.params.id;
            if (!contractId)
                throw new errors_1.ValidationError('Missing contract ID');
            const { buffer, filename } = await this.contractUseCase.fetchContractPDF(contractId);
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `inline; filename=${filename}`);
            res.send(buffer);
        }
        catch (err) {
            const error = this.handleError(err, res);
            if (!res.headersSent) {
                res.status(error.status).json({ error: error.message });
            }
        }
    }
    //
    // getTemplates
    //
    // Get a list of all templates
    //
    // returns:
    //    Templates
    //
    async getAllTemplates(req, res) {
        try {
            const templates = await this.contractUseCase.getAllTemplates();
            res.status(200).json(templates.map((template) => template.toJson()));
        }
        catch (getError) {
            const error = this.handleError(getError, res);
            if (!res.headersSent) {
                res.status(error.status).json({ error: error.message });
            }
        }
    }
    //
    // deleteTemplate
    //
    // Delete a template
    //
    // returns:
    //    None
    //
    async deleteTemplate(req, res) {
        const name = req.params.name;
        try {
            const result = await this.contractUseCase.deleteTemplate(name);
            res.status(204).send();
        }
        catch (delError) {
            const error = this.handleError(delError, res);
            if (!res.headersSent) {
                res.status(error.status).json({ error: error.message });
            }
        }
    }
    //
    // deleteTemplate
    //
    // Delete a template
    //
    // returns:
    //    None
    //
    async updateTemplate(req, res) {
        const name = req.params.name;
        const file = req.file;
        const { deposit, fee } = req.body;
        try {
            const result = await this.contractUseCase.updateTemplate(name, deposit, fee, file);
            res.status(204).send();
        }
        catch (delError) {
            const error = this.handleError(delError, res);
            if (!res.headersSent) {
                res.status(error.status).json({ error: error.message });
            }
        }
    }
    //
    // uploadTemplate()
    //
    // Upload template to storage
    //
    // returns:
    //    none
    //
    async uploadTemplate(req, res) {
        try {
            const file = req.file;
            const { name, deposit, fee } = req.body;
            if (!file)
                throw new errors_1.ValidationError('No file uploaded');
            if (!name)
                throw new errors_1.ValidationError('No contract name specified');
            await this.contractUseCase.uploadTemplate(file, name, deposit, fee);
            res.status(201).json({ success: true });
        }
        catch (getError) {
            const error = this.handleError(getError, res);
            if (!res.headersSent) {
                res.status(error.status).json({ error: error.message });
            }
        }
    }
    //
    // Generate a filled template
    //
    // returns:
    //    none
    //
    async generateTemplate(req, res) {
        try {
            const { name, fields } = req.body;
            const download = req.query.download === 'true';
            if (!name)
                throw new errors_1.ValidationError('No template name provided');
            // generate the template as pdf
            const pdfBuffer = await this.contractUseCase.generateTemplate(name, fields ?? {});
            if (download) {
                res.setHeader('Content-Disposition', `attachment; filename=${fields.clientname}-${name}.pdf`);
                res.setHeader('Content-Type', 'application/pdf');
            }
            else {
                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', `inline; filename=${fields.clientname}-${name}-preview.pdf`);
            }
            res.send(pdfBuffer);
        }
        catch (genError) {
            const error = this.handleError(genError, res);
            if (!res.headersSent) {
                res.status(error.status).json({ error: error.message });
            }
        }
    }
    // Helper method to handle errors
    handleError(error, res) {
        console.error('Error:', error.message);
        if (error instanceof errors_1.ValidationError) {
            return { status: 400, message: error.message };
        }
        else if (error instanceof errors_1.ConflictError) {
            return { status: 409, message: error.message };
        }
        else if (error instanceof errors_1.AuthenticationError) {
            return { status: 401, message: error.message };
        }
        else if (error instanceof errors_1.NotFoundError) {
            return { status: 404, message: error.message };
        }
        else if (error instanceof errors_1.AuthorizationError) {
            return { status: 403, message: error.message };
        }
        else {
            return { status: 500, message: error.message };
        }
    }
    // Helper for returning basic summary of a client
    mapToClientSummary(client) {
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
exports.ContractController = ContractController;
