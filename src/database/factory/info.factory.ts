import { setSeederFactory } from 'typeorm-extension';
import { Faker } from '@faker-js/faker';
import { Info } from '../../public-content/info/entity/info.entity';

export const InfoFactory = setSeederFactory(Info, (faker: Faker) => {
  const info = new Info();
  info.appStore = faker.internet.url();
  info.googlePlay = faker.internet.url();
  info.phone = faker.phone.number();
  info.location = faker.location.streetAddress();
  info.position = {
    lat: faker.location.latitude(),
    lng: faker.location.longitude(),
  };
  info.about = faker.lorem.paragraphs(2);
  info.privacyPolicy = faker.lorem.paragraphs(3);
  info.termsAndConditions = faker.lorem.paragraphs(3);
  return info;
});
