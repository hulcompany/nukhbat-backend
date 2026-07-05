import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { Info } from './entity/info.entity';
import { InfoDto } from './dto/info.dto';

export class InfoService {
  constructor(
    @InjectRepository(Info) private readonly repo: Repository<Info>,
  ) {}

  async saveInfo(data: InfoDto) {
    let old = (await this.getInfo()) || this.repo.create();
    old.appStore = data.appStore;
    old.googlePlay = data.googlePlay;
    old.phone = data.phone;
    old.location = data.location;

    if (data.position?.lat && data.position?.lng) {
      old.position = { lat: data.position!.lat, lng: data.position!.lng };
    }
    await this.repo.save(old);
    return await this.getInfo();
  }

  async getInfo() {
    return (await this.repo.find({ take: 1 }))?.at(0) || ({} as Info);
  }
}
