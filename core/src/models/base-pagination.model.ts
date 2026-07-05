export class BasePaginationModel {
  list!: any[];
  totalRecords!: number;
  next?: boolean;
  back?: boolean;
  constructor(params: {
    list: any[];
    totalRecords: number;
    skip?: number;
    limit?: number;
  }) {
    this.list = params.list;
    if (params.skip != undefined && params.limit != undefined) {
      this.next = params.skip + params.limit < params.totalRecords;
    }
    if (params.skip != undefined) {
      this.back = params.skip > 0;
    }
    this.totalRecords = params.totalRecords;
  }
}
