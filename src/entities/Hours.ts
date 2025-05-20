export class WORK_ENTRY {
  id: string;
  start_time: Date;
  end_time: Date;
  doula: {
      id: string;
      firstname: string;
      lastname: string;
  };
  client: {
      id: string;
      firstname: string;
      lastname: string;
  };
};

export class WORK_ENTRY_ROW {
  id: string;
  doula_id: string;
  client_id: string;
  start_time: Date;
  end_time: Date;
}