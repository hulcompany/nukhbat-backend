import { setSeederFactory } from 'typeorm-extension';
import { Faker } from '@faker-js/faker';
import { DailyWisement } from '../../daily_wisement/entity/daily-wisement.entity';

export const DailyWisementFactory = setSeederFactory(
  DailyWisement,
  (faker: Faker) => {
    const wisement = new DailyWisement();
    wisement.text = faker.lorem.sentence();
    return wisement;
  },
);
