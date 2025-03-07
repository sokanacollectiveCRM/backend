import { Request, Response } from "express";
import { RequestFormService } from "../Services/RequestFormService";
import { RequestForm } from "../Entities/RequestForm";


export class RequestFormController{
    private service: RequestFormService;


    constructor(){
        this.service = new RequestFormService();
    }

    async createForm(req: Request, res: Response){
        try {
            const formData = req.body;
            await this.service.newForm(formData);
            res.status(200).json({message: "Form data recieved, now onto processing"})
            
        } catch (error) {
            res.status(400).json({error})
        }

    }
    
}