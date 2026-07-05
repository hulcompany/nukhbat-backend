export class BaseResponse {
  message: string;
  data?: any;

  [key: string]: any;

  constructor(params: { message?: string, data?: any, [key: string]: any } = {}) {
    const { message, data, ...rest } = params;
    this.message = params.message || 'Success';
    this.data = params.data;
    Object.assign(this, rest);
  }
}
