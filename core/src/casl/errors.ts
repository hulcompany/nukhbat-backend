import { HttpException } from "@nestjs/common";

export class ForbiddenFieldsException extends HttpException {
    constructor(fields?: string[]){
        super(fields ? `Forbidden fields: ${fields.join(', ')}` : "Forbidden Fields" , 403)
    }
}