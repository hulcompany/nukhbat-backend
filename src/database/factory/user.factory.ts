import { setSeederFactory } from 'typeorm-extension';
import { Faker } from '@faker-js/faker';
import { User } from '../../core/user/entity/user.entity';

export const UserFactory = setSeederFactory(User, (faker: Faker) => {
  const user = new User();
  user.name = faker.person.fullName();
  user.email = faker.internet.email();
  user.emailVerified = true;
  user.role = 'student';
  user.password =
    '$2b$10$AqgwtZDkdiKMVC4yXi1fnuK.xEhIahxnCap8KX9kbXU7Njloz.vo6';
  return user;
});
