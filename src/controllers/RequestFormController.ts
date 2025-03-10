import { Request, Response } from "express";
import { RequestFormService } from "../services/RequestFormService";


export class RequestFormController{
    private service: RequestFormService;


    constructor(){
        this.service = new RequestFormService();
    }

    async createForm(req: Request, res: Response){
        try {
            if (!req.body) {
              return res.status(400).json({ error: 'No body found in request' });
            }
        
            const formData = req.body;
            await this.service.newForm(formData);
            res.status(200).json({ message: "Form data received, onto processing" });
            
          } catch (error) {
            console.error("Error processing form data:", error);
            res.status(400).json({ error: error.message });
          }

    }
    
}