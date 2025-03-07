import { RequestForm } from "../entities/RequestForm";
import { RequestFormRepository } from "../Repositories/RequestFormRepository";

export class RequestFormService{

    private repository : RequestFormRepository


    constructor(){
        this.repository = new RequestFormRepository();
    }

    async newForm(formData){
        if (!formData.first_name || !formData.last_name || !formData.service_needed){
            throw Error
        }
        if (!formData.email || !formData.email.includes('@')){
            throw Error
        }
    

    const finalForm = new RequestForm(
        formData.first_name,
        formData.last_name,
        formData.email,
        formData.service_needed,
        formData.phone_number,
        formData.address
    );
}

}
